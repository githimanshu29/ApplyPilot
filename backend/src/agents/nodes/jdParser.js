import { ChatGroq } from "@langchain/groq";
import { z } from "zod";

// ── Evidence Anchor Schema ────────────────────────────────────────────────────
// One anchor per JD requirement.
// Answers: what proof in a resume would satisfy this requirement?
// Read by: evidence_mapper node
const evidenceAnchorSchema = z.object({
  requirement: z.string().default(""),

  skillOrTool: z.string().default(""),

  // where in a resume to look for this evidence
  evidenceTypes: z
    .array(
      z.enum([
        "project",
        "experience",
        "education",
        "certification",
        "open_source",
      ]),
    )
    .default([]),

  // what specific signal to look for — e.g. "docker-compose file, container deployment"
  verificationHint: z.string().default(""),

  importance: z.enum(["critical", "high", "medium", "low"]).default("medium"),
});

// ── JD Schema ─────────────────────────────────────────────────────────────────
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

  seniorityLevel: z
    .enum(["fresher", "junior", "mid", "senior"])
    .default("fresher"),

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

  // new in batch 2 — one anchor per required skill / critical ATS keyword
  // max 20 to keep response size reasonable
  evidenceAnchors: z
    .array(evidenceAnchorSchema)
    .default([])
    .describe(
      "For each required skill and critical ATS keyword: what proof in a resume would satisfy this requirement?",
    ),
});

// ── LLM ───────────────────────────────────────────────────────────────────────
const llm = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
});

const structuredLLM = llm.withStructuredOutput(JDSchema, {
  name: "extract_jd",
});

// ── Node ──────────────────────────────────────────────────────────────────────
export async function jdParserNode(state) {
  console.log("[jd_parser] starting...");

  const prompt = `You are an expert ATS Job Description parser.

Extract ONLY structured information. Return ONLY data matching the schema. Never invent.

----------------------------------------------------
ATS KEYWORDS
----------------------------------------------------

Return atsKeywords as this object:
{ "mustHave": [...], "goodToHave": [...] }

mustHave → critical technologies, frameworks, languages, certifications, domain skills.
goodToHave → preferred tools, soft skills, secondary technologies.

Every requiredSkill MUST appear inside mustHave.
Every important tool MUST appear inside mustHave or goodToHave.

----------------------------------------------------
EVIDENCE ANCHORS
----------------------------------------------------

For each required skill AND each mustHave keyword, generate one evidenceAnchor.

Rules:
- requirement → exact phrase from the JD ("Docker", "RESTful APIs", "5+ years Node.js")
- skillOrTool → the specific technology or skill ("Docker", "REST APIs", "Node.js")
- evidenceTypes → where in a resume to look: project, experience, education, certification, open_source
- verificationHint → what specific signal confirms this (e.g. "docker-compose, Dockerfile, container deployment mention")
- importance → critical if it appears in mustHave, high if required, medium if preferred, low if nice-to-have

Limit to the 15 most important requirements only.

----------------------------------------------------
OTHER FIELDS
----------------------------------------------------

requiredSkills → only mandatory qualifications.
niceToHave → preferred qualifications only.
tools → every framework, language, library, platform, cloud, database mentioned.
responsibilities → action-oriented statements of what the candidate will do.
roleDomain → closest matching domain based on responsibilities and skills.

----------------------------------------------------
RULES
----------------------------------------------------

Do NOT invent information.
If unknown: String → "" | Array → [] | Object → {}
For workType: only return remote, hybrid, or onsite. Otherwise omit.
Never output markdown. Never output explanations. Return ONLY structured data.

----------------------------------------------------
JOB DESCRIPTION
----------------------------------------------------

${state.jdRaw}
`;

  try {
    const result = await structuredLLM.invoke(prompt);

    console.log(
      `[jd_parser] done — ${result.requiredSkills.length} required skills, ` +
        `${result.atsKeywords.mustHave.length + result.atsKeywords.goodToHave.length} ATS keywords, ` +
        `${result.evidenceAnchors.length} evidence anchors`,
    );

    return {
      jdAnalysis: result,
      currentNode: "jd_parser",
    };
  } catch (err) {
    console.error("[jd_parser] failed:", err.message);

    // jd_parser failure is fatal — downstream nodes cannot work without a parsed JD
    throw err;
  }
}
