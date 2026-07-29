import { ChatGroq } from "@langchain/groq";
import { z } from "zod";

const JDSchema = z.object({
  jobTitle: z.string().default(""),
  company: z.string().default(""),

  roleDomain: z
    .enum([
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
    ])
    .default("other"),

  seniorityLevel: z.enum(["fresher", "junior", "mid", "senior"]).optional(),

  experienceYears: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),

  requiredSkills: z.array(z.string()).default([]),
  niceToHave: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),

  atsKeywords: z.object({
    mustHave: z.array(z.string()).default([]),
    goodToHave: z.array(z.string()).default([]),
  }),

  redFlags: z.array(z.string()).default([]),

  salaryHints: z.string().optional(),
  location: z.string().optional(),

  workType: z.enum(["remote", "hybrid", "onsite"]).optional().default("onsite"),
});

const llms = [
  "openai/gpt-oss-120b",
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
];
const llm = new ChatGroq({
  model: llms[2],
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
});

const structuredLLM = llm.withStructuredOutput(JDSchema, {
  name: "extract_jd",
});

export async function jdParserNode(state) {
  console.log("[jd_parser] starting...");

  const prompt = `
You are an expert ATS Job Description parser.

Extract ONLY structured information.

Return ONLY data matching the provided schema.

----------------------------------------------------
ATS KEYWORDS
----------------------------------------------------

Return atsKeywords as THIS OBJECT:

{
  "mustHave":[...],
  "goodToHave":[...]
}

NOT

{
  "atsKeywords":[...]
}

NOT

{
  "mustHave":[...],
  "goodToHave":[...]
}

at the root.

mustHave:
Critical technologies, frameworks, programming languages,
certifications and domain skills required for ATS.

goodToHave:
Preferred technologies,
optional skills,
soft skills,
secondary tools.

Every requiredSkill MUST appear inside mustHave.

Every important tool MUST appear inside mustHave or goodToHave.

----------------------------------------------------
OTHER FIELDS
----------------------------------------------------

requiredSkills:
Only mandatory qualifications.

niceToHave:
Preferred qualifications.

tools:
Every framework,
language,
library,
platform,
cloud,
software,
database,
technology mentioned.

responsibilities:
Action-oriented responsibilities.

roleDomain:
Choose the closest domain.

----------------------------------------------------
GENERAL RULES
----------------------------------------------------

Do NOT invent information.

If unknown:

String -> ""

Array -> []

Object -> {}

For workType:

Only return

remote

hybrid

onsite

Otherwise omit it completely.

Never output fields outside the schema.

Never output markdown.

Never output explanations.

Return ONLY structured data.

----------------------------------------------------
JOB DESCRIPTION
----------------------------------------------------

${state.jdRaw}
`;

  try {
    const result = await structuredLLM.invoke(prompt);

    console.log(
      `[jd_parser] parsed ${result.requiredSkills.length} required skills`,
    );

    console.log(
      `[jd_parser] ATS keywords = ${
        result.atsKeywords.mustHave.length +
        result.atsKeywords.goodToHave.length
      }`,
    );

    return {
      jdAnalysis: result,
      currentNode: "jd_parser",
    };
  } catch (err) {
    console.error("[jd_parser] failed");
    console.error(err);

    // IMPORTANT:
    // Stop the graph immediately.
    // Downstream nodes cannot work with an invalid JD.
    throw err;
  }
}
