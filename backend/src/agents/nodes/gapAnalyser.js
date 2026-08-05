import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0,
  apiKey: process.env.GEMINI_API_KEY,
});

// ── Pure logic helpers ────────────────────────────────────────────────────────

function normalize(text) {
  return text.toLowerCase().trim();
}

function isSkillMatch(skill, presentSet) {
  const sl = normalize(skill);
  return Array.from(presentSet).some((k) => {
    const pk = normalize(k);
    if (pk === sl) return true;
    const words = sl.split(" ");
    if (words.length > 1) return words.every((w) => pk.includes(w));
    return pk.includes(sl) || sl.includes(pk);
  });
}

/**
 * computeSeverity
 *
 * Deterministic severity assignment.
 * Uses perSectionMatch (0-100) for threshold — consistent scale throughout.
 * Previous code used raw skillsSim (0-1) — migrated here.
 */
function computeSeverity(type, isPresent, perSectionMatch) {
  if (isPresent) return "none";

  const skillMatch = perSectionMatch?.skillMatch ?? 50;

  if (type === "required") {
    // if semantic alignment is strong, candidate is close — downgrade to medium
    return skillMatch > 70 ? "medium" : "high";
  }

  if (type === "optional") {
    // if overall fit is weak, optional gaps matter more
    return skillMatch < 50 ? "medium" : "low";
  }

  return "low";
}

// ── LLM enrichment ────────────────────────────────────────────────────────────

/**
 * enrichGapsWithExplanation
 *
 * ONE batch LLM call for ALL missing gaps.
 * Never call LLM per gap — that's N sequential API calls.
 *
 * Returns a Map: skill → explanation object
 */
async function enrichGapsWithExplanation(missingGaps, jdAnalysis, userProfile) {
  if (!missingGaps.length) return new Map();

  const gapList = missingGaps
    .map(
      (g, i) =>
        `${i + 1}. Skill: "${g.skill}" | Type: ${g.type} | Severity: ${g.severity}`,
    )
    .join("\n");

  const prompt = `You are an AI career advisor analyzing skill gaps for a candidate.

Role: ${jdAnalysis.jobTitle} at ${jdAnalysis.company}
Domain: ${jdAnalysis.roleDomain}
Seniority: ${jdAnalysis.seniorityLevel}

Candidate skills: ${(userProfile.skills || []).join(", ")}
Candidate projects: ${(userProfile.projects || []).map((p) => p.name).join(", ") || "none"}
Candidate experience: ${(userProfile.experience || []).map((e) => `${e.role} at ${e.company}`).join(", ") || "none"}

Missing skills to analyze:
${gapList}

For EACH missing skill, provide a precise explanation.

Rules:
- evidence: what specifically is absent from the candidate profile
- reasoning: why this skill matters for the role and how it connects to the JD
- confidence: 0-100 — how certain you are this is genuinely missing (not just poorly named)
- recommendedAction: most practical single action to address this gap
- estimatedBenefit: specific improvement expected (e.g. "recovers ~15% ATS score" or "unlocks DevOps roles")
- estimatedEffort: realistic time estimate (e.g. "2-3 weekend projects" or "~20 hours learning + 1 project")

STRICT RULES:
- Never fabricate skills the candidate has
- Never say "learn X in 1 day" — be realistic
- If the skill is inferable from their projects, say so in reasoning and lower confidence to 60-70
- Keep each explanation concise — one sentence per field maximum

Return ONLY a JSON array in this exact format:
[
  {
    "skill": "exact skill name from the input list",
    "evidence": "...",
    "reasoning": "...",
    "confidence": 85,
    "recommendedAction": "...",
    "estimatedBenefit": "...",
    "estimatedEffort": "..."
  }
]`;

  try {
    const response = await llm.invoke(prompt);
    let raw = response.content.trim();

    // strip markdown if present
    if (raw.startsWith("```")) {
      raw = raw
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
    }

    // extract array using bracket-depth walker
    const arrayStart = raw.indexOf("[");
    if (arrayStart === -1)
      throw new Error("No JSON array in enrichment response");

    let depth = 0;
    let arrayEnd = -1;
    for (let i = arrayStart; i < raw.length; i++) {
      if (raw[i] === "[") depth++;
      else if (raw[i] === "]") {
        depth--;
        if (depth === 0) {
          arrayEnd = i;
          break;
        }
      }
    }

    if (arrayEnd === -1)
      throw new Error("Malformed JSON in enrichment response");

    const enriched = JSON.parse(raw.slice(arrayStart, arrayEnd + 1));

    // build lookup map: skill name → explanation
    const explanationMap = new Map();
    enriched.forEach((item) => {
      if (item.skill) {
        explanationMap.set(item.skill.toLowerCase(), {
          evidence: item.evidence || "Not found in profile",
          reasoning: item.reasoning || "",
          confidence: Math.min(100, Math.max(0, Number(item.confidence) || 75)),
          recommendedAction: item.recommendedAction || "",
          estimatedBenefit: item.estimatedBenefit || "",
          estimatedEffort: item.estimatedEffort || "",
        });
      }
    });

    return explanationMap;
  } catch (err) {
    console.warn(
      "[gap_analyzer] enrichment failed — proceeding without explanations:",
      err.message,
    );
    return new Map();
  }
}

// ── Node ──────────────────────────────────────────────────────────────────────

export async function gapAnalyzerNode(state) {
  console.log("[gap_analyzer] starting...");

  try {
    const requiredSkills = state.jdAnalysis.requiredSkills || [];
    const niceToHave = state.jdAnalysis.niceToHave || [];
    const presentKeywords = state.presentKeywords || [];
    const missingKeywords = state.missingKeywords || [];
    const perSectionMatch = state.fitDetails?.perSectionMatch || {};

    const presentSet = new Set(presentKeywords.map((k) => normalize(k)));

    // ── Step 1: classify all skills (pure logic, no LLM) ─────────────────────

    const gapAnalysis = [];

    for (const skill of requiredSkills) {
      const present = isSkillMatch(skill, presentSet);
      const severity = computeSeverity("required", present, perSectionMatch);
      gapAnalysis.push({
        skill,
        present,
        severity,
        type: "required",
        explanation: null,
      });
    }

    for (const skill of niceToHave) {
      const present = isSkillMatch(skill, presentSet);
      const severity = computeSeverity("optional", present, perSectionMatch);
      gapAnalysis.push({
        skill,
        present,
        severity,
        type: "optional",
        explanation: null,
      });
    }

    // ── Step 2: enrich missing gaps with explanations (one LLM call) ─────────

    // only enrich gaps worth explaining — skip present skills and low priority
    const gapsToEnrich = gapAnalysis.filter(
      (g) => !g.present && (g.severity === "high" || g.severity === "medium"),
    );

    console.log(
      `[gap_analyzer] ${gapAnalysis.filter((g) => !g.present).length} gaps found, ` +
        `${gapsToEnrich.length} to enrich`,
    );

    const explanationMap = await enrichGapsWithExplanation(
      gapsToEnrich,
      state.jdAnalysis,
      state.userProfile,
    );

    // merge explanations back into gapAnalysis
    const enrichedGapAnalysis = gapAnalysis.map((gap) => {
      if (!gap.present) {
        const explanation = explanationMap.get(gap.skill.toLowerCase());
        return explanation ? { ...gap, explanation } : gap;
      }
      return gap;
    });

    // ── Step 3: build tailorPriority — ordered list for bullet_rewriter ──────

    // order: high severity required → medium severity required → missing keywords
    const tailorPriority = [
      ...new Set([
        ...enrichedGapAnalysis
          .filter(
            (g) => !g.present && g.type === "required" && g.severity === "high",
          )
          .map((g) => g.skill),
        ...enrichedGapAnalysis
          .filter(
            (g) =>
              !g.present && g.type === "required" && g.severity === "medium",
          )
          .map((g) => g.skill),
        ...missingKeywords.map((k) => (typeof k === "string" ? k : k.keyword)),
      ]),
    ];

    // ── Step 4: build gapInsights — human-readable summary ───────────────────

    const gapInsights = [];

    const skillMatch = perSectionMatch.skillMatch ?? 0;
    const expMatch = perSectionMatch.experienceMatch ?? 0;
    const projMatch = perSectionMatch.projectMatch ?? 0;

    if (skillMatch >= 75) {
      gapInsights.push(`Strong skill alignment (${skillMatch}/100)`);
    } else if (skillMatch < 50) {
      gapInsights.push(
        `Weak skill alignment (${skillMatch}/100) — core skills need attention`,
      );
    }

    if (expMatch < 50) {
      gapInsights.push(
        `Experience doesn't strongly match role requirements (${expMatch}/100)`,
      );
    }

    if (projMatch < 50) {
      gapInsights.push(
        `Projects are not strongly aligned with this role (${projMatch}/100)`,
      );
    }

    const criticalMissing = enrichedGapAnalysis
      .filter((g) => !g.present && g.severity === "high")
      .slice(0, 3)
      .map((g) => g.skill);

    if (criticalMissing.length > 0) {
      gapInsights.push(
        `Missing critical skills: ${criticalMissing.join(", ")}`,
      );
    }

    const strongAreas = presentKeywords.slice(0, 3);
    if (strongAreas.length > 0) {
      gapInsights.push(`Verified skills: ${strongAreas.join(", ")}`);
    }

    console.log(
      `[gap_analyzer] done — ${enrichedGapAnalysis.filter((g) => !g.present).length} gaps, ` +
        `${tailorPriority.length} in priority queue, ` +
        `${explanationMap.size} explanations generated`,
    );

    return {
      gapAnalysis: enrichedGapAnalysis,
      tailorPriority,
      gapInsights,
      currentNode: "gap_analyzer",
    };
  } catch (err) {
    console.error("[gap_analyzer] failed:", err.message);
    return {
      gapAnalysis: [],
      tailorPriority: [],
      gapInsights: [],
      errors: [{ node: "gap_analyzer", message: err.message }],
    };
  }
}
