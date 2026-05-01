import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  apiKey: process.env.GEMINI_API_KEY,
});

// cosine similarity
function cosineSimilarity(a, b) {
  let dot = 0,
    normA = 0,
    normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// build structured profile sections
function buildProfileSections(profile) {
  return {
    skills: profile.skills?.join(", ") || "",
    experience: profile.bullets?.join(". ") || "",
    projects:
      profile.projects
        ?.map(
          (p) =>
            `Project ${p.name}: ${p.description || ""} using ${(p.techStack || []).join(", ")}`,
        )
        .join("\n") || "",
  };
}

// main node
export async function fitScorerNode(state) {
  console.log("[fit_scorer] starting...");

  try {
    const profileSections = buildProfileSections(state.userProfile);

    const jdText = `${state.jdRaw}\nRequired: ${state.jdAnalysis.requiredSkills.join(
      ", ",
    )}`;

    // embeddings
    const [jdVec, skillsVec, expVec, projVec] = await Promise.all([
      embeddings.embedQuery(jdText),
      embeddings.embedQuery(profileSections.skills || " "),
      embeddings.embedQuery(profileSections.experience || " "),
      embeddings.embedQuery(profileSections.projects || " "),
    ]);

    // semantic similarity
    const skillsSim = cosineSimilarity(skillsVec, jdVec);
    const expSim = cosineSimilarity(expVec, jdVec);
    const projSim = cosineSimilarity(projVec, jdVec);

    const semanticScore = 0.4 * skillsSim + 0.4 * expSim + 0.2 * projSim;

    //ATS scoring
    const profileText = JSON.stringify(state.userProfile).toLowerCase();

    const required = state.jdAnalysis.requiredSkills || [];

    const present = [];
    const missing = [];

    //kw-> keyword
    required.forEach((kw) => {
      if (profileText.includes(kw.toLowerCase())) {
        present.push(kw);
      } else {
        missing.push(kw);
      }
    });

    const keywordScore =
      required.length === 0 ? 0 : present.length / required.length;

    //hybrid final score
    const finalSim = 0.7 * semanticScore + 0.3 * keywordScore;

    const fitScore = Math.round(((finalSim + 1) / 2) * 100);

    //Reasons
    const reasons = [];

    if (skillsSim > 0.7) {
      reasons.push("Strong alignment in core skills");
    } else if (skillsSim < 0.4) {
      reasons.push("Weak alignment in required skills");
    }

    if (expSim > 0.7) {
      reasons.push("Relevant experience matches job requirements");
    }

    if (projSim > 0.6) {
      reasons.push("Projects demonstrate relevant technical exposure");
    }

    if (missing.length > 0) {
      reasons.push(`Missing key skills: ${missing.slice(0, 3).join(", ")}`);
    }

    if (present.length > 0) {
      reasons.push(
        `Covers important skills like ${present.slice(0, 3).join(", ")}`,
      );
    }

    console.log(
      `[fit_scorer] semantic: ${semanticScore.toFixed(
        3,
      )}, keyword: ${keywordScore.toFixed(3)} → score: ${fitScore}`,
    );

    return {
      fitScore,
      fitDetails: {
        semanticScore,
        keywordScore,
        skillsSim,
        expSim,
        projSim,
        presentKeywords: present,
        missingKeywords: missing,
        reasons,
      },
      currentNode: "fit_scorer",
    };
  } catch (err) {
    console.error("[fit_scorer] failed:", err.message);

    return {
      fitScore: 0,
      errors: [{ node: "fit_scorer", message: err.message }],
    };
  }
}
