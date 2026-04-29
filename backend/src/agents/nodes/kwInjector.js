import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { z } from "zod";

const InjectionSchema = z.object({
  updatedSkills: z.array(z.string()),
  injectedKeywords: z.array(z.string()),
  summary: z.string(),
});

// const llm = new ChatGoogleGenerativeAI({
//   model: "gemini-2.0-flash",
//   temperature: 0.2,
//   apiKey: process.env.GEMINI_API_KEY,
// });

const llm = new ChatGroq({
  model: "llama-3.1-8b-instant",
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
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

  const prompt = `You are an expert resume optimizer focused on ATS (Applicant Tracking System) performance.

Your goal is to improve the candidate's SKILLS section and generate a strong PROFESSIONAL SUMMARY while keeping the resume truthful and realistic.

────────────────────────────
ROLE CONTEXT
────────────────────────────
Target Role: ${jobTitle} at ${company}

Current Skills:
${currentSkills.join(", ")}

Keywords to Include (priority):
${keywordsToInject.join(", ")}

Focus Areas:
${gapInsights.join(", ") || "general improvement"}

────────────────────────────
INSTRUCTIONS
────────────────────────────
1. Update the SKILLS section:
   - Naturally include the provided keywords where appropriate
   - Do NOT blindly add all keywords if unrealistic
   - Merge with existing skills intelligently
   - Group skills into logical categories (e.g., Backend, DevOps, Databases, Tools)

2. Maintain authenticity:
   - Do NOT invent tools, technologies, or experience
   - Only include skills that are realistically aligned with the candidate profile

3. Avoid keyword stuffing:
   - Keep the skills section clean, readable, and professional
   - Prefer quality over quantity

4. Generate a PROFESSIONAL SUMMARY:
   - 2–3 concise lines
   - Tailored to the target role
   - Highlight strengths, technologies, and impact
   - ATS-friendly but human-readable

5. Prioritize high-impact keywords:
   - Ensure strong coverage of critical (high-priority) keywords
   - Maintain natural language flow

${retryNote}

────────────────────────────
CRITICAL OUTPUT RULES
────────────────────────────
Return ONLY valid JSON that strictly matches the required schema.
Do NOT include explanations, markdown, or extra text.
Do NOT wrap the JSON in code blocks.
Ensure all fields are present and correctly formatted.
`;

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
