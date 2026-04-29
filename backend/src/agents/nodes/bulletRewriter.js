import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
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

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash-lite",
  temperature: 0.3,
  apiKey: process.env.GEMINI_API_KEY,
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
    .slice()
    .sort(sortByPriority)
    .map(normalizeKeyword);

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

  const prompt = `You are a professional resume writer.

Role: ${jobTitle} at ${company}

Required skills: ${requiredSkills.join(", ")}
Important keywords to include: ${importantKeywords.join(", ")}
Focus areas: ${gapInsights.join(", ") || "general improvement"}

Candidate skills: ${(state.userProfile?.skills || []).join(", ")}

Rules:
1. Start with strong varied action verbs
2. Use STAR format (action + method + impact)
3. Naturally integrate important keywords (no stuffing)
4. Improve clarity, specificity, and measurable impact
5. Add realistic quantification if missing
6. Do NOT invent experience
7. Keep each bullet concise (1–2 lines)
8. Avoid repetition across bullets

${retryNote}

Bullets to rewrite:
${currentBullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}
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
