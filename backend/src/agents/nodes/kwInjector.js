import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

const InjectionSchema = z.object({
  updatedSkills: z.array(z.string()),
  injectedKeywords: z.array(z.string()),
  summary: z.string(),
});

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0.2,
  apiKey: process.env.GEMINI_API_KEY,
});

const structuredLLM = llm.withStructuredOutput(InjectionSchema, {
  name: "inject_keywords",
});

function normalizeKeyword(k) {
  return typeof k === "string" ? k : k.keyword;
}

export async function kwInjectorNode(state) {
  console.log("[kw_injector] starting...");

  const resumeVersion = state.resumeVersion || {};

  const gapPriority = (state.tailorPriority || []).map(normalizeKeyword);
  const atsMissing = (state.missingKeywords || []).map(normalizeKeyword);

  const keywordsToInject = [...new Set([...gapPriority, ...atsMissing])].slice(
    0,
    15,
  ); //duplicate hata diye by using set

  if (!keywordsToInject.length) {
    console.log("[kw_injector] nothing to inject");
    return {
      resumeVersion: {
        ...resumeVersion,
        injectedKeywords: [],
      },
      currentNode: "kw_injector",
    };
  }

  const { jobTitle, company } = state.jdAnalysis || {};

  const currentSkills = state.userProfile?.skills || [];
  const gapInsights = state.gapInsights || [];

  // 🔁 Retry context
  const retryCount = state.atsRetryCount || 0;
  const retryNote =
    retryCount > 0
      ? `Previous attempt did not improve ATS score enough. Increase keyword coverage and improve clarity without overstuffing.`
      : "";

  const prompt = `You are optimizing a resume for ATS screening.

Role: ${jobTitle} at ${company}

Current skills:
${currentSkills.join(", ")}

Keywords to include:
${keywordsToInject.join(", ")}

Focus areas:
${gapInsights.join(", ") || "general improvement"}

Rules:
1. Update the skills section by naturally including missing keywords
2. Group skills logically (Backend, DevOps, Tools, etc.)
3. Only include realistic skills — do NOT invent experience
4. Avoid keyword stuffing — keep it clean and human-readable
5. Ensure strong coverage of critical keywords
6. Generate a concise 2–3 line professional summary aligned with the role

${retryNote}

Return structured output only.`;

  try {
    const result = await structuredLLM.invoke(prompt);

    console.log(
      `[kw_injector] injected ${result.injectedKeywords?.length || 0} keywords`,
    );

    return {
      resumeVersion: {
        ...resumeVersion,
        updatedSkills: result.updatedSkills || currentSkills,
        injectedKeywords: result.injectedKeywords || [],
        summary: result.summary || "",
      },
      currentNode: "kw_injector",
    };
  } catch (err) {
    console.error("[kw_injector] failed:", err.message);

    return {
      errors: [{ node: "kw_injector", message: err.message }],
    };
  }
}
