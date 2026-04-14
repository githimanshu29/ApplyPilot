import { OpenAIEmbeddings } from "@langchain/openai";

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-ada-002",
  apiKey: process.env.OPENAI_API_KEY,
});

// build resume text for keyword matching and embedding , profile state se aa rahi hai
function buildResumeText(profile) {
  const parts = [];

  if (profile.resumeRaw) parts.push(profile.resumeRaw);
  if (profile.skills?.length) parts.push(profile.skills.join(" "));
  if (profile.bullets?.length) parts.push(profile.bullets.join(" "));

  if (profile.projects?.length) {
    profile.projects.forEach((p) => {
      if (p.techStack) parts.push(p.techStack.join(" "));
      if (p.bullets) parts.push(p.bullets.join(" "));
      if (p.description) parts.push(p.description);
    });
  }

  return parts.join(" ").toLowerCase();
}

//KeyWord Matching
function isKeywordPresent(keyword, resumeText) {
  if (resumeText.includes(keyword)) return true;

  const words = keyword.split(" ");
  if (words.length > 1) {
    return words.every((w) => resumeText.includes(w));
  }

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}s?\\b`, "i").test(resumeText);
}
// conditional semantic match with threshold
async function semanticMatch(keyword, resumeVec, threshold = 0.7) {
  const kwVec = await embeddings.embedQuery(keyword);

  let dot = 0,
    normA = 0,
    normB = 0;

  for (let i = 0; i < kwVec.length; i++) {
    dot += kwVec[i] * resumeVec[i];
    normA += kwVec[i] * kwVec[i];
    normB += resumeVec[i] * resumeVec[i];
  }

  const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return similarity > threshold;
}

//Hamari main node
export async function atsScannerNode(state) {
  console.log("[ats_scanner] starting...");

  try {
    const mustHave = state.jdAnalysis.atsKeywords?.mustHave || [];
    const goodToHave = state.jdAnalysis.atsKeywords?.goodToHave || [];

    const resumeText = buildResumeText(state.userProfile);

    // embed resume once
    const resumeVec = await embeddings.embedQuery(resumeText);

    const present = [];
    const missing = [];

    // ---------- MUST HAVE ----------
    for (const keyword of mustHave) {
      const kw = keyword.toLowerCase();

      let found = isKeywordPresent(kw, resumeText);

      if (!found) {
        found = await semanticMatch(kw, resumeVec, 0.75);
      }

      if (found) {
        present.push(keyword);
      } else {
        missing.push({ keyword, priority: "high" });
      }
    }

    // ---------- GOOD TO HAVE ----------
    for (const keyword of goodToHave) {
      const kw = keyword.toLowerCase();

      let found = isKeywordPresent(kw, resumeText);

      if (!found) {
        found = await semanticMatch(kw, resumeVec, 0.7);
      }

      if (found) {
        present.push(keyword);
      } else {
        missing.push({ keyword, priority: "medium" });
      }
    }

    // ---------- WEIGHTED SCORE ----------
    const mustScore =
      mustHave.length === 0
        ? 1
        : present.filter((k) => mustHave.includes(k)).length / mustHave.length;

    const goodScore =
      goodToHave.length === 0
        ? 0
        : present.filter((k) => goodToHave.includes(k)).length /
          goodToHave.length;

    const finalScore = Math.round((0.7 * mustScore + 0.3 * goodScore) * 100);

    // ---------- REASONS ----------
    const reasons = [];

    if (mustScore > 0.8) {
      reasons.push("Strong coverage of critical skills");
    } else if (mustScore < 0.5) {
      reasons.push("Missing several critical required skills");
    }

    if (goodScore > 0.6) {
      reasons.push("Good coverage of additional supporting skills");
    }

    if (missing.length > 0) {
      const topMissing = missing.slice(0, 3).map((m) => m.keyword);
      reasons.push(`Missing important keywords: ${topMissing.join(", ")}`);
    }

    console.log(
      `[ats_scanner] must: ${mustScore.toFixed(
        2,
      )}, good: ${goodScore.toFixed(2)} → score: ${finalScore}`,
    );

    return {
      atsCoverageScore: finalScore,
      missingKeywords: missing,
      presentKeywords: present,
      atsDetails: {
        mustScore,
        goodScore,
        reasons,
      },
      currentNode: "ats_scanner",
    };
  } catch (err) {
    console.error("[ats_scanner] failed:", err.message);

    return {
      atsCoverageScore: 0,
      errors: [{ node: "ats_scanner", message: err.message }],
    };
  }
}
