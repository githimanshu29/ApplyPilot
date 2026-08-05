import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  apiKey: process.env.GEMINI_API_KEY,
});

// ── Math ──────────────────────────────────────────────────────────────────────

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

/**
 * Scale cosine similarity (-1 to 1) → user-facing score (0-100).
 * In practice text embeddings produce 0-1 range, so this is a safe upward scale.
 */
function cosineToScore(cosine) {
  return Math.round(Math.max(0, Math.min(100, ((cosine + 1) / 2) * 100)));
}

// ── Profile text builders ─────────────────────────────────────────────────────

function buildSkillsText(profile) {
  return profile.skills?.join(", ") || "";
}

function buildExperienceText(profile) {
  const bullets = profile.bullets?.join(". ") || "";
  const expRoles = (profile.experience || [])
    .map((e) => `${e.role} at ${e.company}`)
    .join(", ");
  return [expRoles, bullets].filter(Boolean).join(". ");
}

function buildProjectsText(profile) {
  return (profile.projects || [])
    .map(
      (p) =>
        `${p.name}: ${p.description || ""} using ${(p.techStack || []).join(", ")}`,
    )
    .join("\n");
}

/**
 * Builds education text for embedding comparison.
 * Handles both object (current) and array (future batch expansion) shapes.
 */
function buildEducationText(profile) {
  const edu = profile.education;
  if (!edu) return "";

  // array shape (future)
  if (Array.isArray(edu)) {
    return edu
      .map((e) =>
        [e.degree, e.branch, e.college, e.university]
          .filter(Boolean)
          .join(" in "),
      )
      .join(". ");
  }

  // object shape (current)
  const parts = [];
  if (edu.degree) parts.push(edu.degree);
  if (edu.branch) parts.push(`in ${edu.branch}`);
  if (edu.college || edu.university)
    parts.push(`from ${edu.college || edu.university}`);
  if (edu.cgpa) parts.push(`CGPA ${edu.cgpa}`);
  return parts.join(" ");
}

// ── Node ──────────────────────────────────────────────────────────────────────

export async function fitScorerNode(state) {
  console.log("[fit_scorer] starting...");

  try {
    const profile = state.userProfile;

    const skillsText = buildSkillsText(profile);
    const experienceText = buildExperienceText(profile);
    const projectsText = buildProjectsText(profile);
    const educationText = buildEducationText(profile);

    // JD text — amplify required skills for stronger signal
    const jdText = [
      state.jdRaw,
      `Required: ${(state.jdAnalysis.requiredSkills || []).join(", ")}`,
    ].join("\n");

    // embed all sections in parallel — one call per section + JD
    const [jdVec, skillsVec, expVec, projVec, eduVec] = await Promise.all([
      embeddings.embedQuery(jdText),
      embeddings.embedQuery(skillsText || " "),
      embeddings.embedQuery(experienceText || " "),
      embeddings.embedQuery(projectsText || " "),
      embeddings.embedQuery(educationText || " "),
    ]);

    // raw cosine values — kept for gap_analyzer severity thresholds
    // (gap_analyzer migrates to perSectionMatch in its own update)
    const skillsSim = cosineSimilarity(skillsVec, jdVec);
    const expSim = cosineSimilarity(expVec, jdVec);
    const projSim = cosineSimilarity(projVec, jdVec);
    const eduSim = cosineSimilarity(eduVec, jdVec);

    // per-section match — 0-100, user-facing breakdown
    // answers WHY the fit score is what it is
    const perSectionMatch = {
      skillMatch: cosineToScore(skillsSim),
      experienceMatch: cosineToScore(expSim),
      projectMatch: cosineToScore(projSim),
      educationMatch: cosineToScore(eduSim),
    };

    // existing formula unchanged — produces consistent fitScore
    const semanticScore = 0.4 * skillsSim + 0.4 * expSim + 0.2 * projSim;

    // keyword coverage of required skills against full profile text
    const profileText = JSON.stringify(profile).toLowerCase();
    const required = state.jdAnalysis.requiredSkills || [];
    const presentRequired = [];
    const missingRequired = [];

    required.forEach((kw) => {
      if (profileText.includes(kw.toLowerCase())) {
        presentRequired.push(kw);
      } else {
        missingRequired.push(kw);
      }
    });

    const keywordScore =
      required.length === 0 ? 0 : presentRequired.length / required.length;

    // hybrid score — semantic + keyword coverage
    const finalSim = 0.7 * semanticScore + 0.3 * keywordScore;
    const fitScore = Math.round(((finalSim + 1) / 2) * 100);

    // ── build reasons — each one explains a specific signal ──────────────────
    const reasons = [];

    if (perSectionMatch.skillMatch >= 70) {
      reasons.push(
        `Strong skill alignment (${perSectionMatch.skillMatch}/100)`,
      );
    } else if (perSectionMatch.skillMatch < 40) {
      reasons.push(
        `Weak skill alignment (${perSectionMatch.skillMatch}/100) — core skills need attention`,
      );
    }

    if (perSectionMatch.experienceMatch >= 70) {
      reasons.push(
        `Experience strongly matches role requirements (${perSectionMatch.experienceMatch}/100)`,
      );
    } else if (perSectionMatch.experienceMatch < 40) {
      reasons.push(
        `Experience weakly matches role (${perSectionMatch.experienceMatch}/100)`,
      );
    }

    if (perSectionMatch.projectMatch >= 60) {
      reasons.push(
        `Projects demonstrate relevant technical exposure (${perSectionMatch.projectMatch}/100)`,
      );
    }

    if (perSectionMatch.educationMatch < 40) {
      reasons.push(
        `Education background may not align with role requirements (${perSectionMatch.educationMatch}/100)`,
      );
    }

    if (missingRequired.length > 0) {
      reasons.push(
        `Missing key required skills: ${missingRequired.slice(0, 3).join(", ")}`,
      );
    }

    if (presentRequired.length > 0) {
      reasons.push(
        `Confirmed skills: ${presentRequired.slice(0, 3).join(", ")}`,
      );
    }

    console.log(
      `[fit_scorer] skill: ${perSectionMatch.skillMatch}, ` +
        `exp: ${perSectionMatch.experienceMatch}, ` +
        `proj: ${perSectionMatch.projectMatch}, ` +
        `edu: ${perSectionMatch.educationMatch} → fitScore: ${fitScore}`,
    );

    return {
      fitScore,
      fitDetails: {
        semanticScore,
        keywordScore,

        // raw cosine — kept until gap_analyzer migrates to perSectionMatch
        skillsSim,
        expSim,
        projSim,

        // 0-100 per-section breakdown — the WHY behind fitScore
        perSectionMatch,

        presentKeywords: presentRequired,
        missingKeywords: missingRequired,
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
