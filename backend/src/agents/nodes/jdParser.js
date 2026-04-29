import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { z } from "zod";

const JDSchema = z.object({
  jobTitle: z.string().min(1),
  company: z.string().min(1),

  roleDomain: z.enum([
    "frontend",
    "backend",
    "fullstack",
    "machine_learning",
    "data_science",
    "genai",
    "ai_agents",
    "devops",
    "mobile",
    "ui_ux",
    "cloud",
    "cybersecurity",

    "finance",
    "accounting",
    "consulting",
    "marketing",
    "sales",
    "operations",
    "hr",

    "other",
  ]),

  seniorityLevel: z.enum(["fresher", "junior", "mid", "senior"]),
  experienceYears: z
    .object({ min: z.number().optional(), max: z.number().optional() })
    .optional(),

  requiredSkills: z.array(z.string()),
  niceToHave: z.array(z.string()),

  tools: z.array(z.string()),

  responsibilities: z.array(z.string()),

  atsKeywords: z.object({
    mustHave: z
      .array(z.string())
      .describe(
        "10-15 critical keywords that MUST appear in the resume for ATS filtering. Include exact tech names, frameworks, tools, and domain terms.",
      ),

    goodToHave: z
      .array(z.string())
      .describe(
        "Optional keywords that improve ATS ranking but are not mandatory. Include complementary tools, soft skills, methodologies, and secondary technologies.",
      ),
  }),

  redFlags: z.array(z.string()),
  salaryHints: z.string().optional(),

  location: z.string().optional(),
  workType: z.enum(["remote", "hybrid", "onsite"]).optional(),
});

// const llm = new ChatGoogleGenerativeAI({
//   model: "gemini-2.5-flash-lite",
//   temperature: 0,
//   apiKey: process.env.GEMINI_API_KEY,
// });

const llm = new ChatGroq({
  model: "llama-3.1-8b-instant",
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
});

const structuredLLM = llm.withStructuredOutput(JDSchema, {
  name: "extract_jd",
});

export async function jdParserNode(state) {
  console.log("[jd_parser] starting...");

  const prompt = `You are analyzing a job description for a candidate applying to a role.

Your task is to extract structured information precisely and objectively.

The role can belong to ANY domain (engineering, finance, consulting, marketing, operations, etc.). Do NOT assume it is a software role. Identify the correct domain based on the job description.

────────────────────────────
ATS KEYWORD EXTRACTION
────────────────────────────
Think like an ATS (Applicant Tracking System). Extract exact keywords and phrases that an ATS would scan for.

Include:
- Core skills (technical or domain-specific)
- Tools, software, platforms (e.g., Excel, AWS, Tally, React, SAP)
- Methodologies (e.g., Agile, auditing standards, financial modeling)
- Domain-specific terminology (e.g., taxation, REST APIs, risk analysis)
- Relevant soft skills (e.g., communication, stakeholder management)

Rules:
- Be exhaustive but precise (15–25 keywords total)
- Prefer exact phrases from the JD when possible
- Do NOT invent skills or tools not mentioned or clearly implied
- Avoid duplicates or overly generic terms

────────────────────────────
OTHER EXTRACTIONS
────────────────────────────
- roleDomain: classify based on responsibilities and skills (not just title)
- responsibilities: clear, action-oriented tasks
- requiredSkills: strictly required qualifications
- niceToHave: optional or preferred skills

────────────────────────────
CRITICAL OUTPUT RULES
────────────────────────────
Return ONLY valid JSON that strictly matches the required schema.
Do NOT include explanations, markdown, or extra text.
Do NOT wrap the JSON in code blocks.

────────────────────────────
JOB DESCRIPTION
────────────────────────────
${state.jdRaw}
`;

  try {
    const result = await structuredLLM.invoke(prompt);

    console.log(
      `[jd_parser] done — ${result.requiredSkills.length} required skills, ${result.atsKeywords.mustHave.length + result.atsKeywords.goodToHave.length} ATS keywords`,
    );

    return {
      jdAnalysis: result,
      currentNode: "jd_parser",
    };
  } catch (err) {
    console.error("[jd_parser] failed:", err.message);
    return {
      errors: [{ node: "jd_parser", message: err.message }],
      currentNode: "jd_parser",
    };
  }
}
