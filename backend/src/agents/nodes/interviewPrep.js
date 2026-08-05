import { ChatGroq } from "@langchain/groq";

const llm = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0.3, // slight creativity for varied questions
  apiKey: process.env.GROQ_API_KEY,
});

// ── Question distribution by seniority ───────────────────────────────────────

/**
 * getQuestionDistribution
 *
 * Returns how many questions of each type to generate.
 * Adapts to seniority — freshers get fundamentals,
 * mid/senior get system design and architecture.
 */
function getQuestionDistribution(seniorityLevel, roleDomain) {
  const isAIRole = [
    "machine_learning",
    "data_science",
    "genai",
    "ai_agents",
  ].includes(roleDomain);
  const isDevOps = ["devops", "cloud"].includes(roleDomain);

  const base = {
    fresher: {
      technical: 5,
      behavioral: 4,
      situational: 3,
      role_specific: 2,
      system_design: 0,
      coding: 1,
      ai_ml: isAIRole ? 2 : 0,
    },
    junior: {
      technical: 5,
      behavioral: 3,
      situational: 2,
      role_specific: 2,
      system_design: 1,
      coding: 2,
      ai_ml: isAIRole ? 2 : 0,
    },
    mid: {
      technical: 4,
      behavioral: 3,
      situational: 2,
      role_specific: 2,
      system_design: 2,
      coding: 2,
      ai_ml: isAIRole ? 3 : 0,
    },
    senior: {
      technical: 3,
      behavioral: 3,
      situational: 2,
      role_specific: 2,
      system_design: 3,
      coding: 2,
      ai_ml: isAIRole ? 3 : 0,
    },
  };

  const distribution = base[seniorityLevel] || base.fresher;

  // remove zero-count categories — cleaner prompt
  return Object.fromEntries(
    Object.entries(distribution).filter(([, count]) => count > 0),
  );
}

// ── Learning plan builder ─────────────────────────────────────────────────────

/**
 * buildLearningPlan
 *
 * Synthesizes the top critical gaps into a structured study guide.
 * Uses enriched explanation data from gapAnalyzer — no new LLM call needed.
 * Pure composition of existing pipeline data.
 */
function buildLearningPlan(gapAnalysis, jdAnalysis) {
  const criticalGaps = (gapAnalysis || [])
    .filter(
      (g) => !g.present && (g.severity === "high" || g.severity === "medium"),
    )
    .slice(0, 5);

  if (!criticalGaps.length) return [];

  return criticalGaps.map((gap, i) => {
    const explanation = gap.explanation;

    return {
      topic: gap.skill,
      why:
        explanation?.reasoning ||
        `Required for ${jdAnalysis.jobTitle} at ${jdAnalysis.seniorityLevel} level`,
      resources: [], // populated later when user requests or from curated list
      priority: i + 1,
      estimatedHours: parseEstimatedHours(explanation?.estimatedEffort),
    };
  });
}

/**
 * parseEstimatedHours
 * Extracts a numeric hour estimate from strings like "~10-15 hours" or "2 weekends"
 */
function parseEstimatedHours(effortString) {
  if (!effortString) return null;

  // try to extract first number from string
  const match = effortString.match(/\d+/);
  if (match) return parseInt(match[0]);

  // rough estimates for common patterns
  if (effortString.toLowerCase().includes("weekend")) return 16;
  if (effortString.toLowerCase().includes("week")) return 40;
  if (effortString.toLowerCase().includes("day")) return 8;

  return null;
}

// ── JSON extraction ───────────────────────────────────────────────────────────

/**
 * extractArrayFromResponse
 * Same brace-depth walker used in bulletRewriter — reliable across all models.
 */
function extractArrayFromResponse(raw) {
  const arrayStart = raw.indexOf("[");
  const objectStart = raw.indexOf("{");

  // array-first response
  if (arrayStart !== -1 && (objectStart === -1 || arrayStart < objectStart)) {
    let depth = 0,
      arrayEnd = -1;
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
    if (arrayEnd === -1) throw new Error("Malformed array in response");
    return JSON.parse(raw.slice(arrayStart, arrayEnd + 1));
  }

  // object-first — find the array inside
  if (objectStart !== -1) {
    let depth = 0,
      objectEnd = -1;
    for (let i = objectStart; i < raw.length; i++) {
      if (raw[i] === "{") depth++;
      else if (raw[i] === "}") {
        depth--;
        if (depth === 0) {
          objectEnd = i;
          break;
        }
      }
    }
    if (objectEnd === -1) throw new Error("Malformed object in response");
    const parsed = JSON.parse(raw.slice(objectStart, objectEnd + 1));
    const arr =
      parsed.questions ||
      parsed.items ||
      Object.values(parsed).find((v) => Array.isArray(v));
    if (!arr) throw new Error("No array found in object response");
    return arr;
  }

  throw new Error("No JSON found in response");
}

// ── Question validator ────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  "technical",
  "behavioral",
  "situational",
  "role_specific",
  "system_design",
  "coding",
  "ai_ml",
  "company_specific",
];

const VALID_DIFFICULTIES = ["easy", "medium", "hard"];
const VALID_IMPORTANCE = ["critical", "high", "medium", "low"];

function cleanQuestion(raw) {
  return {
    q: String(raw.q || raw.question || "").trim(),
    a: String(raw.a || raw.answer || "").trim(),
    category: VALID_CATEGORIES.includes(raw.category)
      ? raw.category
      : "technical",
    difficulty: VALID_DIFFICULTIES.includes(raw.difficulty)
      ? raw.difficulty
      : "medium",
    topic: String(raw.topic || "").trim(),
    subtopic: String(raw.subtopic || "").trim(),
    importance: VALID_IMPORTANCE.includes(raw.importance)
      ? raw.importance
      : "medium",
    score: null,
    userAnswer: "",
    feedback: "",
  };
}

// ── Node ──────────────────────────────────────────────────────────────────────

export async function interviewPrepNode(state) {
  console.log("[interview_prep] starting...");

  const { jdAnalysis, userProfile, gapAnalysis } = state;

  if (!state.applicationId || !jdAnalysis) {
    console.warn(
      "[interview_prep] missing applicationId or jdAnalysis — skipping",
    );
    return {
      prepQuestions: [],
      learningPlan: [],
      currentNode: "interview_prep",
    };
  }

  // ── Step 1: build learning plan from existing gap data (no LLM needed) ──────
  const learningPlan = buildLearningPlan(gapAnalysis, jdAnalysis);

  // ── Step 2: determine question distribution based on role ─────────────────
  const distribution = getQuestionDistribution(
    jdAnalysis.seniorityLevel,
    jdAnalysis.roleDomain,
  );

  const totalQuestions = Object.values(distribution).reduce((a, b) => a + b, 0);

  const distributionText = Object.entries(distribution)
    .map(
      ([cat, count]) =>
        `- ${count} ${cat.replace("_", " ")} question${count > 1 ? "s" : ""}`,
    )
    .join("\n");

  // identify critical gaps for targeted questions
  const criticalGaps = (gapAnalysis || [])
    .filter((g) => !g.present && g.severity === "high")
    .map((g) => g.skill)
    .slice(0, 5);

  const strongSkills = (gapAnalysis || [])
    .filter((g) => g.present && g.type === "required")
    .map((g) => g.skill)
    .slice(0, 5);

  const prompt = `You are an expert technical interviewer preparing a realistic interview question set.

────────────────────────────────────────────────
ROLE
────────────────────────────────────────────────
Title:      ${jdAnalysis.jobTitle}
Company:    ${jdAnalysis.company}
Domain:     ${jdAnalysis.roleDomain}
Seniority:  ${jdAnalysis.seniorityLevel}
Required:   ${(jdAnalysis.requiredSkills || []).join(", ")}

────────────────────────────────────────────────
CANDIDATE
────────────────────────────────────────────────
Skills:      ${(userProfile.skills || []).join(", ")}
Projects:    ${(userProfile.projects || []).map((p) => `${p.name} (${(p.techStack || []).join(", ")})`).join("; ")}
Experience:  ${(userProfile.experience || []).map((e) => `${e.role} at ${e.company}`).join("; ") || "none"}
Strong:      ${strongSkills.join(", ") || "none identified"}
Gaps:        ${criticalGaps.join(", ") || "none"}

────────────────────────────────────────────────
QUESTION DISTRIBUTION (${totalQuestions} total)
────────────────────────────────────────────────
${distributionText}

────────────────────────────────────────────────
REQUIREMENTS
────────────────────────────────────────────────
For EACH question provide:
- q:          the interview question (specific, not generic)
- a:          model answer (3-5 sentences, realistic — not perfect)
- category:   one of: technical | behavioral | situational | role_specific | system_design | coding | ai_ml
- difficulty: easy | medium | hard
- topic:      specific topic (e.g. "Node.js Event Loop", "System Design", "Leadership")
- subtopic:   specific subtopic (e.g. "Callback Hell", "Rate Limiting", "Conflict Resolution")
- importance: critical | high | medium | low

Rules:
- Questions must directly relate to THIS role and candidate profile
- Technical questions test DEPTH not just yes/no knowledge
- Behavioral questions should reference the candidate's specific projects/experience
- System design questions should match seniority — no distributed systems for freshers
- If critical gaps exist, include questions that probe those gaps (recruiter will ask)
- Model answers should be honest and achievable, not perfect textbook answers
- No duplicate questions or overlapping topics
- Difficulty should match seniority: freshers → mostly easy/medium, seniors → mostly medium/hard

────────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────────
Return ONLY a valid JSON array. No markdown. No explanation. No wrapper object.

[
  {
    "q": "...",
    "a": "...",
    "category": "technical",
    "difficulty": "medium",
    "topic": "...",
    "subtopic": "...",
    "importance": "high"
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

    const parsed = extractArrayFromResponse(raw);

    if (!Array.isArray(parsed) || !parsed.length) {
      throw new Error("No questions in response");
    }

    // clean and validate every question
    const questions = parsed.filter((q) => q.q && q.a).map(cleanQuestion);

    if (!questions.length) {
      throw new Error("All questions failed validation");
    }

    // ── Log breakdown ─────────────────────────────────────────────────────────
    const byCategory = questions.reduce((acc, q) => {
      acc[q.category] = (acc[q.category] || 0) + 1;
      return acc;
    }, {});

    const byDifficulty = questions.reduce((acc, q) => {
      acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
      return acc;
    }, {});

    console.log(
      `[interview_prep] generated ${questions.length} questions | ` +
        `categories: ${JSON.stringify(byCategory)} | ` +
        `difficulty: ${JSON.stringify(byDifficulty)} | ` +
        `learning plan: ${learningPlan.length} topics`,
    );

    return {
      prepQuestions: questions,
      learningPlan,
      currentNode: "interview_prep",
    };
  } catch (err) {
    console.error("[interview_prep] failed:", err.message);
    return {
      prepQuestions: [],
      learningPlan: buildLearningPlan(gapAnalysis, jdAnalysis), // still return learning plan even if questions fail
      errors: [{ node: "interview_prep", message: err.message }],
    };
  }
}
