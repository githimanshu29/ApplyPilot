import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  apiKey: process.env.GEMINI_API_KEY,
});

// ── String matching ───────────────────────────────────────────────────────────

function buildResumeText(profile) {
  return [
    profile.resumeRaw || "",
    (profile.skills || []).join(" "),
    (profile.bullets || []).join(" "),
    (profile.experience || []).flatMap((e) => e.bullets || []).join(" "),
    (profile.projects || [])
      .flatMap((p) => [
        ...(p.techStack || []),
        ...(p.bullets || []),
        p.description || "",
      ])
      .join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function isKeywordPresent(keyword, resumeText) {
  const kw = keyword.toLowerCase().trim();
  if (resumeText.includes(kw)) return true;

  const words = kw.split(" ");
  if (words.length > 1) {
    return words.every((w) => resumeText.includes(w));
  }

  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}s?\\b`, "i").test(resumeText);
}

// ── Inferable check ───────────────────────────────────────────────────────────

/**
 * isKeywordInferable
 *
 * Checks if a keyword is implied by the user's project tech stack
 * even if not explicitly stated.
 * Only called for keywords that failed string matching.
 *
 * Returns the inference reason or null if not inferable.
 */
function isKeywordInferable(keyword, profile) {
  const kw = keyword.toLowerCase().trim();

  const projectTech = (profile.projects || [])
    .flatMap((p) => [...(p.techStack || []), p.description || ""])
    .join(" ")
    .toLowerCase();

  const experienceTech = (profile.experience || [])
    .flatMap((e) => [...(e.bullets || []), ...(e.techStack || [])])
    .join(" ")
    .toLowerCase();

  const allContext = [projectTech, experienceTech].join(" ");

  // inference rules — keyword → what triggers infer
  const inferenceRules = {
    "rest api": ["node", "express", "flask", "django", "fastapi", "spring"],
    "rest apis": ["node", "express", "flask", "django", "fastapi", "spring"],
    restful: ["node", "express", "flask", "django"],
    "restful api": ["node", "express", "flask", "django"],
    "api development": ["node", "express", "flask", "django", "fastapi"],
    "version control": ["git", "github", "gitlab"],
    agile: ["scrum", "sprint", "jira", "kanban"],
    "ci/cd": ["github actions", "jenkins", "gitlab", "pipeline", "workflow"],
    cloud: ["aws", "gcp", "azure", "heroku", "vercel", "ec2"],
    "database design": ["mongodb", "mysql", "postgresql", "mongoose", "sql"],
    microservices: ["docker", "kubernetes", "api gateway", "service mesh"],
    "component-based": ["react", "vue", "angular"],
    "state management": ["redux", "zustand", "context", "vuex"],
    "responsive design": ["css", "tailwind", "bootstrap", "html"],
    "object oriented": ["class", "java", "python", "typescript", "c++"],
    "data structures": ["leetcode", "algorithms", "competitive"],
    "web development": ["html", "css", "javascript", "react", "node"],
    "backend development": ["node", "express", "python", "java", "api"],
    "frontend development": [
      "react",
      "vue",
      "angular",
      "html",
      "css",
      "javascript",
    ],
    "cross-platform": ["react native", "flutter", "ionic"],
    serverless: ["aws lambda", "vercel", "netlify", "firebase functions"],
  };

  const triggers = inferenceRules[kw];
  if (triggers) {
    const matchedTrigger = triggers.find((t) =>
      allContext.includes(t.toLowerCase()),
    );
    if (matchedTrigger) {
      return `Implied by "${matchedTrigger}" in profile`;
    }
  }

  // direct partial match in project tech — e.g. "Express" implies "Node.js"
  if (projectTech.includes(kw) || experienceTech.includes(kw)) {
    return `Referenced in project/experience context`;
  }

  return null;
}

// ── Semantic batch matching ───────────────────────────────────────────────────

/**
 * semanticBatchMatch
 *
 * ONE batch embedding call for all unresolved keywords.
 * Compares each unresolved keyword's vector against the resume vector.
 * Returns a Map: keyword → { matched: boolean, similarity: number }
 */
async function semanticBatchMatch(
  unresolvedKeywords,
  resumeVec,
  threshold = 0.72,
) {
  if (!unresolvedKeywords.length) return new Map();

  try {
    // batch embed all unresolved keywords in one API call
    const kwVecs = await Promise.all(
      unresolvedKeywords.map((kw) => embeddings.embedQuery(kw)),
    );

    const results = new Map();

    kwVecs.forEach((kwVec, i) => {
      let dot = 0,
        normA = 0,
        normB = 0;
      for (let j = 0; j < kwVec.length; j++) {
        dot += kwVec[j] * resumeVec[j];
        normA += kwVec[j] * kwVec[j];
        normB += resumeVec[j] * resumeVec[j];
      }
      const similarity =
        normA === 0 || normB === 0
          ? 0
          : dot / (Math.sqrt(normA) * Math.sqrt(normB));

      results.set(unresolvedKeywords[i], {
        matched: similarity >= threshold,
        similarity: Math.round(similarity * 100),
      });
    });

    return results;
  } catch (err) {
    console.warn("[ats_scanner] semantic batch failed:", err.message);
    return new Map();
  }
}

// ── Weighted score calculation ────────────────────────────────────────────────

/**
 * computeWeightedScore
 *
 * verified  = 1.0 weight — explicitly in resume
 * inferable = 0.5 weight — implied, better than zero
 * missing   = 0.0 weight
 */
function computeWeightedScore(keywords, presentKeywords, inferableKeywords) {
  if (!keywords.length) return 1;

  const presentSet = new Set(presentKeywords.map((k) => k.toLowerCase()));
  const inferableSet = new Set(inferableKeywords.map((k) => k.toLowerCase()));

  let score = 0;
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    if (presentSet.has(kwLower)) score += 1.0;
    else if (inferableSet.has(kwLower)) score += 0.5;
  }

  return score / keywords.length;
}

// ── Node ──────────────────────────────────────────────────────────────────────

export async function atsScannerNode(state) {
  console.log("[ats_scanner] starting...");

  try {
    const mustHave = state.jdAnalysis.atsKeywords?.mustHave || [];
    const goodToHave = state.jdAnalysis.atsKeywords?.goodToHave || [];
    const allKeywords = [...mustHave, ...goodToHave];

    if (!allKeywords.length) {
      console.log("[ats_scanner] no keywords to scan");
      return {
        atsCoverageScore: 0,
        presentKeywords: [],
        inferableKeywords: [],
        missingKeywords: [],
        atsDetails: { mustScore: 0, goodScore: 0, reasons: [] },
        currentNode: "ats_scanner",
      };
    }

    const resumeText = buildResumeText(state.userProfile);

    // embed resume once for semantic fallback
    const resumeVec = await embeddings.embedQuery(resumeText);

    // ── Pass 1: string matching ───────────────────────────────────────────────
    const present = []; // verified by exact/fuzzy string match
    const inferable = []; // implied by profile context
    const missing = []; // not found by any method so far

    const inferenceReasons = new Map(); // keyword → why it's inferred

    for (const keyword of allKeywords) {
      if (isKeywordPresent(keyword, resumeText)) {
        present.push(keyword);
        continue;
      }

      const inferReason = isKeywordInferable(keyword, state.userProfile);
      if (inferReason) {
        inferable.push(keyword);
        inferenceReasons.set(keyword, inferReason);
        continue;
      }

      missing.push(keyword);
    }

    console.log(
      `[ats_scanner] pass 1 — present: ${present.length}, ` +
        `inferable: ${inferable.length}, unresolved: ${missing.length}`,
    );

    // ── Pass 2: semantic batch for unresolved only ────────────────────────────
    const semanticResults = await semanticBatchMatch(missing, resumeVec);

    const finalPresent = [...present];
    const finalInferable = [...inferable];
    const finalMissing = [];

    for (const keyword of missing) {
      const semantic = semanticResults.get(keyword);
      if (semantic?.matched) {
        // semantic match is weaker than string match → goes to inferable
        finalInferable.push(keyword);
        inferenceReasons.set(
          keyword,
          `Semantically similar (${semantic.similarity}% match)`,
        );
      } else {
        finalMissing.push(keyword);
      }
    }

    // ── Score calculation ─────────────────────────────────────────────────────

    const mustScore = computeWeightedScore(
      mustHave,
      finalPresent,
      finalInferable,
    );
    const goodScore = computeWeightedScore(
      goodToHave,
      finalPresent,
      finalInferable,
    );

    // same formula as before — consistent with stored historical scores
    const finalScore = Math.round((0.7 * mustScore + 0.3 * goodScore) * 100);

    // ── Build reasons ─────────────────────────────────────────────────────────
    const reasons = [];

    if (mustScore >= 0.8) {
      reasons.push(
        `Strong mustHave coverage (${Math.round(mustScore * 100)}%)`,
      );
    } else if (mustScore < 0.5) {
      reasons.push(
        `Weak mustHave coverage (${Math.round(mustScore * 100)}%) — critical gaps exist`,
      );
    }

    if (goodScore >= 0.6) {
      reasons.push(
        `Good goodToHave coverage (${Math.round(goodScore * 100)}%)`,
      );
    }

    if (finalInferable.length > 0) {
      reasons.push(
        `${finalInferable.length} keyword(s) inferred from project context`,
      );
    }

    if (finalMissing.length > 0) {
      const topMissing = finalMissing.slice(0, 3).join(", ");
      reasons.push(`Missing: ${topMissing}`);
    }

    // ── Format missingKeywords with priority for downstream nodes ─────────────
    // kept as objects {keyword, priority} for kwInjector + atsValidator compat
    const missingKeywordsFormatted = [
      ...finalMissing
        .filter((k) => mustHave.includes(k))
        .map((k) => ({ keyword: k, priority: "high" })),
      ...finalMissing
        .filter((k) => goodToHave.includes(k))
        .map((k) => ({ keyword: k, priority: "medium" })),
    ];

    console.log(
      `[ats_scanner] final — present: ${finalPresent.length}, ` +
        `inferable: ${finalInferable.length}, ` +
        `missing: ${finalMissing.length} → score: ${finalScore}`,
    );

    return {
      atsCoverageScore: finalScore,
      presentKeywords: finalPresent,
      inferableKeywords: finalInferable,
      missingKeywords: missingKeywordsFormatted,
      atsDetails: {
        mustScore: Math.round(mustScore * 100),
        goodScore: Math.round(goodScore * 100),
        reasons,
      },
      currentNode: "ats_scanner",
    };
  } catch (err) {
    console.error("[ats_scanner] failed:", err.message);
    return {
      atsCoverageScore: 0,
      presentKeywords: [],
      inferableKeywords: [],
      missingKeywords: [],
      atsDetails: { mustScore: 0, goodScore: 0, reasons: [] },
      errors: [{ node: "ats_scanner", message: err.message }],
    };
  }
}
