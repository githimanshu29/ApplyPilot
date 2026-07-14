import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0.4, // slight creativity for varied questions
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * interviewPrepNode
 *
 * Generates 15 interview questions tailored to the specific JD + user profile.
 * Split across four categories:
 *   - technical     (role-specific tech questions)
 *   - behavioral    (STAR format situations)
 *   - situational   (hypothetical scenarios)
 *   - role-specific (company/domain specific)
 *
 * Uses direct JSON parsing like bulletRewriter — more reliable than
 * withStructuredOutput for this model.
 */
export async function interviewPrepNode(state) {
  console.log("[interview_prep] starting...");

  const { jdAnalysis, userProfile, applicationId } = state;

  if (!applicationId || !jdAnalysis) {
    console.warn("[interview_prep] no applicationId — skipping");
    return { prepQuestions: [], currentNode: "interview_prep" };
  }

  const prompt = `You are an expert technical interviewer preparing interview questions.

Generate exactly 15 interview questions for this candidate and role.

────────────────────────────
ROLE CONTEXT
────────────────────────────
Role: ${jdAnalysis.jobTitle} at ${jdAnalysis.company}
Domain: ${jdAnalysis.roleDomain}
Seniority: ${jdAnalysis.seniorityLevel}
Required Skills: ${(jdAnalysis.requiredSkills || []).join(", ")}
Responsibilities: ${(jdAnalysis.responsibilities || []).slice(0, 5).join(", ")}

────────────────────────────
CANDIDATE PROFILE
────────────────────────────
Skills: ${(userProfile.skills || []).join(", ")}
Projects: ${(userProfile.projects || []).map((p) => p.name).join(", ")}

────────────────────────────
QUESTION DISTRIBUTION
────────────────────────────
- 6 technical questions (role-specific technical depth)
- 4 behavioral questions (past situations, STAR format expected)
- 3 situational questions (hypothetical scenarios)
- 2 role-specific questions (company/domain/industry context)

────────────────────────────
RULES
────────────────────────────
- Questions must be specific to THIS role — not generic
- Technical questions should test depth, not just "do you know X"
- Behavioral questions should reference skills from the candidate's profile
- Each question must have a strong model answer (3-5 sentences)
- Model answers should be honest and realistic — not perfect corporate speak
- Do NOT repeat similar questions

────────────────────────────
OUTPUT FORMAT
────────────────────────────
Return ONLY a JSON array. No markdown. No extra text.
Format:
[
  {
    "q": "question text",
    "a": "model answer text",
    "category": "technical" | "behavioral" | "situational" | "role-specific"
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
    if (arrayStart === -1) throw new Error("No JSON array in response");

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

    if (arrayEnd === -1) throw new Error("Malformed JSON array in response");

    const questions = JSON.parse(raw.slice(arrayStart, arrayEnd + 1));

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("No questions parsed from response");
    }

    // validate and clean each question
    const cleaned = questions
      .filter((q) => q.q && q.a)
      .map((q) => ({
        q: q.q.trim(),
        a: q.a.trim(),
        category: [
          "technical",
          "behavioral",
          "situational",
          "role-specific",
        ].includes(q.category)
          ? q.category
          : "technical",
        score: null,
        userAnswer: "",
        feedback: "",
      }));

    console.log(`[interview_prep] generated ${cleaned.length} questions`);

    return {
      prepQuestions: cleaned,
      currentNode: "interview_prep",
    };
  } catch (err) {
    console.error("[interview_prep] failed:", err.message);
    return {
      prepQuestions: [],
      errors: [{ node: "interview_prep", message: err.message }],
    };
  }
}
