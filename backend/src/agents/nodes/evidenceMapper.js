import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0,
  apiKey: process.env.GEMINI_API_KEY,
});

// ── Profile text builders ─────────────────────────────────────────────────────

/**
 * buildSearchableProfile
 *
 * Flattens the entire user profile into searchable sections.
 * Each section is kept separate so we know WHERE evidence was found.
 */
function buildSearchableProfile(profile) {
  const skills = (profile.skills || []).join(" ").toLowerCase();

  const experience = (profile.experience || [])
    .map((e) => ({
      label: `${e.role} at ${e.company}`,
      text: [
        e.role, e.company, e.duration,
        ...(e.bullets || []),
        ...(e.techStack || []),
      ].join(" ").toLowerCase(),
    }));

  const projects = (profile.projects || [])
    .map((p) => ({
      label: p.name,
      text: [
        p.name, p.description,
        ...(p.techStack || []),
        ...(p.bullets || []),
        p.githubUrl, p.liveUrl,
      ].filter(Boolean).join(" ").toLowerCase(),
    }));

  const education = (() => {
    const edu = profile.education;
    if (!edu) return { label: "", text: "" };
    if (Array.isArray(edu)) {
      return {
        label: "Education",
        text: edu
          .map((e) => [e.degree, e.branch, e.college, e.university, ...(e.relevantCoursework || [])].filter(Boolean).join(" "))
          .join(" ")
          .toLowerCase(),
      };
    }
    return {
      label: "Education",
      text: [edu.degree, edu.branch, edu.college, edu.university]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  })();

  const certifications = (profile.certifications || [])
    .map((c) => `${c.name} ${c.issuer}`)
    .join(" ")
    .toLowerCase();

  // full text for quick substring checks
  const fullText = [
    skills,
    experience.map((e) => e.text).join(" "),
    projects.map((p) => p.text).join(" "),
    education.text,
    certifications,
    (profile.resumeRaw || "").toLowerCase(),
  ].join(" ");

  return { skills, experience, projects, education, certifications, fullText };
}

// ── String matching ───────────────────────────────────────────────────────────

/**
 * checkAnchorByStringMatch
 *
 * Tries to find evidence using pure string matching.
 * Uses both the skillOrTool and verificationHint signals from jdParser.
 *
 * Returns:
 *   { found: true,  verifiedAs: "verified"|"inferred", evidence, source }
 *   { found: false }
 */
function checkAnchorByStringMatch(anchor, searchableProfile) {
  const { skillOrTool, verificationHint, evidenceTypes } = anchor;
  const skill = skillOrTool.toLowerCase().trim();

  // hints from jdParser — e.g. "docker-compose, Dockerfile, container deployment"
  const hints = (verificationHint || "")
    .toLowerCase()
    .split(/[,;]/)
    .map((h) => h.trim())
    .filter(Boolean);

  const allSignals = [skill, ...hints];

  // check skills section first — most direct verification
  if (evidenceTypes.includes("experience") || evidenceTypes.includes("project")) {
    // check skills list
    if (allSignals.some((s) => searchableProfile.skills.includes(s))) {
      return {
        found: true,
        verifiedAs: "verified",
        evidence: `Found in skills section: "${skillOrTool}"`,
        source: "skills",
      };
    }
  }

  // check projects
  if (evidenceTypes.includes("project")) {
    for (const project of searchableProfile.projects) {
      const matched = allSignals.filter((s) => project.text.includes(s));
      if (matched.length > 0) {
        // skill itself found = verified, only hint found = inferred
        const verifiedAs = project.text.includes(skill) ? "verified" : "inferred";
        return {
          found: true,
          verifiedAs,
          evidence: `Found in project "${project.label}": ${matched.slice(0, 2).join(", ")}`,
          source: "project",
        };
      }
    }
  }

  // check experience
  if (evidenceTypes.includes("experience")) {
    for (const exp of searchableProfile.experience) {
      const matched = allSignals.filter((s) => exp.text.includes(s));
      if (matched.length > 0) {
        const verifiedAs = exp.text.includes(skill) ? "verified" : "inferred";
        return {
          found: true,
          verifiedAs,
          evidence: `Found in experience "${exp.label}": ${matched.slice(0, 2).join(", ")}`,
          source: "experience",
        };
      }
    }
  }

  // check education
  if (evidenceTypes.includes("education")) {
    const matched = allSignals.filter((s) => searchableProfile.education.text.includes(s));
    if (matched.length > 0) {
      return {
        found: true,
        verifiedAs: "verified",
        evidence: `Found in education: ${matched.slice(0, 2).join(", ")}`,
        source: "education",
      };
    }
  }

  // check certifications
  if (evidenceTypes.includes("certification")) {
    if (allSignals.some((s) => searchableProfile.certifications.includes(s))) {
      return {
        found: true,
        verifiedAs: "verified",
        evidence: `Found in certifications: "${skillOrTool}"`,
        source: "certification",
      };
    }
  }

  // broad check against full profile text as last resort
  if (allSignals.some((s) => s.length > 3 && searchableProfile.fullText.includes(s))) {
    const matchedSignal = allSignals.find(
      (s) => s.length > 3 && searchableProfile.fullText.includes(s)
    );
    return {
      found: true,
      verifiedAs: skill === matchedSignal ? "verified" : "inferred",
      evidence: `Referenced in resume: "${matchedSignal}"`,
      source: "resume_raw",
    };
  }

  return { found: false };
}

// ── LLM fallback ──────────────────────────────────────────────────────────────

/**
 * resolveAmbiguousAnchors
 *
 * One batch LLM call for anchors string matching couldn't resolve.
 * Only called when there are unresolved anchors — skipped entirely if string
 * matching handles everything.
 */
async function resolveAmbiguousAnchors(unresolvedAnchors, userProfile) {
  if (!unresolvedAnchors.length) return new Map();

  const anchorList = unresolvedAnchors
    .map((a, i) =>
      `${i + 1}. Requirement: "${a.anchor.requirement}" | Looking for: "${a.anchor.skillOrTool}" | Hint: "${a.anchor.verificationHint}"`
    )
    .join("\n");

  const profileSummary = [
    `Skills: ${(userProfile.skills || []).join(", ")}`,
    `Projects: ${(userProfile.projects || []).map((p) => `${p.name} (${(p.techStack || []).join(", ")})`).join("; ")}`,
    `Experience: ${(userProfile.experience || []).map((e) => `${e.role} at ${e.company}`).join("; ")}`,
  ].join("\n");

  const prompt = `You are checking if a candidate's profile satisfies specific job requirements.

CANDIDATE PROFILE:
${profileSummary}

REQUIREMENTS TO CHECK:
${anchorList}

For each requirement, determine if the candidate profile satisfies it — even implicitly.

Rules:
- verified: skill/tool explicitly mentioned
- inferred: skill is strongly implied (e.g. "built REST APIs with Node.js" implies Express knowledge)
- not_found: genuinely absent with no reasonable inference
- evidence: quote the specific part of profile that supports your conclusion (or "Not found" if absent)
- confidence: 0-100 — how certain you are

Return ONLY a JSON array:
[
  {
    "requirement": "exact requirement from input",
    "verifiedAs": "verified" | "inferred" | "not_found",
    "evidence": "...",
    "confidence": 80
  }
]`;

  try {
    const response = await llm.invoke(prompt);
    let raw = response.content.trim();

    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    const arrayStart = raw.indexOf("[");
    if (arrayStart === -1) return new Map();

    let depth = 0;
    let arrayEnd = -1;
    for (let i = arrayStart; i < raw.length; i++) {
      if (raw[i] === "[") depth++;
      else if (raw[i] === "]") {
        depth--;
        if (depth === 0) { arrayEnd = i; break; }
      }
    }

    if (arrayEnd === -1) return new Map();

    const results = JSON.parse(raw.slice(arrayStart, arrayEnd + 1));

    const resultMap = new Map();
    results.forEach((r) => {
      if (r.requirement) {
        resultMap.set(r.requirement.toLowerCase(), {
          verifiedAs: ["verified", "inferred", "not_found"].includes(r.verifiedAs)
            ? r.verifiedAs
            : "not_found",
          evidence: r.evidence || "Not found in profile",
          confidence: Math.min(100, Math.max(0, Number(r.confidence) || 50)),
        });
      }
    });

    return resultMap;
  } catch (err) {
    console.warn("[evidence_mapper] LLM fallback failed:", err.message);
    return new Map();
  }
}

// ── Node ──────────────────────────────────────────────────────────────────────

export async function evidenceMapperNode(state) {
  console.log("[evidence_mapper] starting...");

  try {
    const anchors = state.jdAnalysis?.evidenceAnchors || [];

    if (!anchors.length) {
      console.log("[evidence_mapper] no evidence anchors — skipping");
      return { evidenceMap: [], currentNode: "evidence_mapper" };
    }

    const searchableProfile = buildSearchableProfile(state.userProfile);
    const evidenceMap = [];
    const unresolved = [];

    // ── Step 1: string matching pass ──────────────────────────────────────────
    for (const anchor of anchors) {
      const result = checkAnchorByStringMatch(anchor, searchableProfile);

      if (result.found) {
        evidenceMap.push({
          requirement: anchor.requirement,
          skillOrTool: anchor.skillOrTool,
          importance: anchor.importance,
          verifiedAs: result.verifiedAs,
          evidence: result.evidence,
          source: result.source,
          confidence: result.verifiedAs === "verified" ? 95 : 70,
        });
      } else {
        // collect for LLM fallback
        unresolved.push({ anchor });
      }
    }

    console.log(
      `[evidence_mapper] string matching: ${evidenceMap.length} resolved, ` +
      `${unresolved.length} need LLM`
    );

    // ── Step 2: LLM fallback for unresolved anchors ───────────────────────────
    if (unresolved.length > 0) {
      const llmResults = await resolveAmbiguousAnchors(unresolved, state.userProfile);

      for (const { anchor } of unresolved) {
        const llmResult = llmResults.get(anchor.requirement.toLowerCase());

        if (llmResult) {
          evidenceMap.push({
            requirement: anchor.requirement,
            skillOrTool: anchor.skillOrTool,
            importance: anchor.importance,
            verifiedAs: llmResult.verifiedAs,
            evidence: llmResult.evidence,
            source: "llm_inferred",
            confidence: llmResult.confidence,
          });
        } else {
          // LLM also couldn't resolve — mark as not found
          evidenceMap.push({
            requirement: anchor.requirement,
            skillOrTool: anchor.skillOrTool,
            importance: anchor.importance,
            verifiedAs: "not_found",
            evidence: "Not found in profile",
            source: "not_found",
            confidence: 90,
          });
        }
      }
    }

    // sort by importance — critical first for frontend display
    const importanceOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    evidenceMap.sort(
      (a, b) =>
        (importanceOrder[a.importance] ?? 4) -
        (importanceOrder[b.importance] ?? 4)
    );

    const verified  = evidenceMap.filter((e) => e.verifiedAs === "verified").length;
    const inferred  = evidenceMap.filter((e) => e.verifiedAs === "inferred").length;
    const notFound  = evidenceMap.filter((e) => e.verifiedAs === "not_found").length;

    console.log(
      `[evidence_mapper] done — verified: ${verified}, inferred: ${inferred}, not_found: ${notFound}`
    );

    return {
      evidenceMap,
      currentNode: "evidence_mapper",
    };
  } catch (err) {
    console.error("[evidence_mapper] failed:", err.message);
    return {
      evidenceMap: [],
      errors: [{ node: "evidence_mapper", message: err.message }],
    };
  }
}