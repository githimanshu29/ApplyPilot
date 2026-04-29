import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { z } from "zod";

const BulletSchema = z.object({
  rewrittenBullets: z.array(
    z.object({
      original: z.string(),
      rewritten: z.string(),
      qualityScore: z.number().min(0).max(1),
      reasoning: z.string(),
    }),
  ),
});

// const llm = new ChatGoogleGenerativeAI({
//   model: "gemini-2.0-flash-lite",
//   temperature: 0.3,
//   apiKey: process.env.GEMINI_API_KEY,
// });

const llm = new ChatGroq({
  model: "llama-3.1-8b-instant",
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
});

const structuredLLM = llm.withStructuredOutput(BulletSchema, {
  name: "rewrite_bullets",
});

function normalizeKeyword(k) {
  return typeof k === "string" ? k : k.keyword;
}

function sortByPriority(a, b) {
  const order = { high: 0, medium: 1, low: 2 };
  return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
}

export async function bulletRewriterNode(state) {
  console.log("[bullet_rewriter] starting...");

  const resumeVersion = state.resumeVersion || {};

  const currentBullets =
    resumeVersion.tailoredBullets && resumeVersion.tailoredBullets.length > 0
      ? resumeVersion.tailoredBullets
      : state.userProfile?.bullets || [];

  if (!currentBullets.length) {
    return {
      resumeVersion: {
        ...resumeVersion,
        tailoredBullets: [],
        qualityScore: 1,
      },
      currentNode: "bullet_rewriter",
    };
  }

  const { requiredSkills = [], jobTitle, company } = state.jdAnalysis || {};

  //  PRIORITY KEYWORDS (ATS + GAP ANALYZER)
  const atsKeywords = (state.missingKeywords || [])
    .slice() //copy array exactly so that original remain untouched and logic doesnt breaks
    .sort(sortByPriority)
    .map(normalizeKeyword);
  //sortPriority and and normalizeKeywords are functions

  const gapPriority = (state.tailorPriority || []).map(normalizeKeyword);

  const importantKeywords = [
    ...new Set([...gapPriority, ...atsKeywords]),
  ].slice(0, 12);

  // GAP INSIGHTS
  const gapInsights = state.gapInsights || [];

  // RETRY CONTEXT
  const retryCount = state.atsRetryCount || 0;

  const retryNote =
    retryCount > 0
      ? `Previous attempt had low quality. Improve clarity, impact, and better integrate missing keywords. Avoid repeating weak phrasing.`
      : "";

  const prompt = `You are an expert resume writer specializing in ATS-optimized bullet points.

Your task is to rewrite the candidate's resume bullets to improve clarity, impact, and keyword alignment for the target role.

────────────────────────────
ROLE CONTEXT
────────────────────────────
Target Role: ${jobTitle} at ${company}

Required Skills:
${requiredSkills.join(", ")}

High-Priority Keywords:
${importantKeywords.join(", ")}

Focus Areas:
${gapInsights.join(", ") || "general improvement"}

Candidate Skills:
${(state.userProfile?.skills || []).join(", ")}

────────────────────────────
REWRITING INSTRUCTIONS
────────────────────────────
For EACH bullet point:

1. Use a strong, varied action verb at the beginning
2. Follow STAR format:
   - Action (what was done)
   - Method (how it was done: tools/techniques)
   - Impact (result, outcome, or purpose)
3. Naturally incorporate relevant keywords where appropriate
4. Improve clarity and specificity
5. Add realistic quantification if missing (%, scale, performance, users, etc.)
6. Keep it truthful — do NOT invent experience
7. Keep each bullet concise (1–2 lines max)
8. Ensure diversity — avoid repeating phrasing or structure across bullets

────────────────────────────
QUALITY EXPECTATIONS
────────────────────────────
- Output should sound professional and impactful
- Avoid vague phrases like "worked on" or "helped with"
- Prefer strong verbs like "Developed", "Engineered", "Optimized", "Designed"
- Maintain readability while improving ATS alignment

${retryNote}

────────────────────────────
INPUT BULLETS
────────────────────────────
${currentBullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}

────────────────────────────
CRITICAL OUTPUT RULES
────────────────────────────
Return ONLY valid JSON that strictly matches the required schema.
Do NOT include explanations, markdown, or extra text.
Do NOT wrap the JSON in code blocks.
Ensure each bullet has: original, rewritten, qualityScore, reasoning.
`;

  try {
    const result = await structuredLLM.invoke(prompt);

    const rewritten = result.rewrittenBullets || [];

    const tailoredBullets = rewritten.map((r) => r.rewritten);

    const qualityScore =
      rewritten.length > 0
        ? rewritten.reduce((sum, r) => sum + r.qualityScore, 0) /
          rewritten.length
        : 0;

    console.log(`[bullet_rewriter] avg quality: ${qualityScore.toFixed(2)}`);

    return {
      resumeVersion: {
        ...resumeVersion,
        originalBullets:
          resumeVersion.originalBullets?.length > 0
            ? resumeVersion.originalBullets
            : currentBullets,
        tailoredBullets,
        qualityScore,
      },
      currentNode: "bullet_rewriter",
    };
  } catch (err) {
    console.error("[bullet_rewriter] failed:", err.message);

    return {
      errors: [{ node: "bullet_rewriter", message: err.message }],
      resumeVersion: {
        ...resumeVersion,
        qualityScore: 1,
      },
    };
  }
}

export function shouldRetryBullets(state) {
  const qualityScore = state.resumeVersion?.qualityScore ?? 1;
  const retryCount = state.atsRetryCount || 0;

  if (qualityScore < 0.85 && retryCount < 3) {
    console.log(
      `[bullet_rewriter] quality ${qualityScore.toFixed(2)} < 0.85 — retrying`,
    );
    return "bullet_rewriter";
  }

  return "kw_injector";
}
