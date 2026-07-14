import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { z } from "zod";

const ExperienceSchema = z.object({
  company: z.string().default(""),
  role: z.string().default(""),
  duration: z.string().optional().default(""),
  bullets: z.array(z.string()).default([]),
});

const ProjectSchema = z.object({
  name: z.string().default(""),
  description: z.string().optional().default(""),
  techStack: z.array(z.string()).default([]),
  bullets: z.array(z.string()).default([]),
});

const EducationSchema = z.object({
  degree: z.string().default(""),
  branch: z.string().default(""),
  college: z.string().default(""),
  cgpa: z.number().nullable().optional(),
  year: z.number().nullable().optional(),
});

const CertificationSchema = z.object({
  name: z.string().default(""),
  issuer: z.string().default(""),
});

const AchievementSchema = z.object({
  title: z.string().default(""),
  description: z.string().default(""),
});

const LinksSchema = z.object({
  github: z.string().default(""),
  linkedin: z.string().default(""),
  portfolio: z.string().default(""),
  leetcode: z.string().default(""),
  codeforces: z.string().default(""),
  codechef: z.string().default(""),
  hackerrank: z.string().default(""),
  kaggle: z.string().default(""),
  behance: z.string().default(""),
  dribbble: z.string().default(""),
  website: z.string().default(""),
});

const ResumeSchema = z.object({
  skills: z
    .array(z.string())
    .describe(
      "All technical and domain skills mentioned — languages, frameworks, tools, platforms",
    )
    .default([]),
  experience: z
    .array(ExperienceSchema)
    .describe("Work experience and internships with bullet points")
    .default([]),
  projects: z
    .array(ProjectSchema)
    .describe("Personal or academic projects with tech stack")
    .default([]),
  education: EducationSchema.describe("Highest or most recent education entry"),
  certifications: z
    .array(CertificationSchema)
    .default([])
    .describe("Professional certifications, courses, or licenses")
    .default([]),

  achievements: z
    .array(AchievementSchema)
    .default([])
    .describe(
      "Awards, competitive programming milestones, hackathons, scholarships, publications, rankings, recognitions, or other notable accomplishments",
    ),

  links: LinksSchema.describe(
    "Professional and coding profile links such as GitHub, LinkedIn, Portfolio, LeetCode, Codeforces, Kaggle, etc.",
  ),
});

// const llm = new ChatGoogleGenerativeAI({
//   model: "gemini-2.0-flash",
//   temperature: 0,
//   apiKey: process.env.GEMINI_API_KEY,
// });

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

const structuredLLM = llm.withStructuredOutput(ResumeSchema, {
  name: "parse_resume",
});

/**
 * extractTextFromPDF
 * takes PDF buffer → returns raw text string
 */

/**
 * detectOCRGarbage
 *
 * Scans raw text for signs of bad OCR or image-based PDFs.
 * Returns true if the text looks like garbage.
 *
 * Heuristics:
 *  - Less than 40% alphabetic characters
 *  - Repeating characters like aaaaaaa, iiiiiii
 *  - High density of box/replacement characters
 */
export function detectOCRGarbage(text) {
  if (!text || text.length < 10) return true;

  const totalChars = text.length;
  const alphaChars = (text.match(/[a-zA-Z]/g) || []).length;
  const alphaRatio = alphaChars / totalChars;

  // less than 35% alphabetic → probably garbage
  if (alphaRatio < 0.35) return true;

  // detect repeating character sequences (OCR artifact)
  if (/(.)\1{8,}/.test(text)) return true;

  // detect box/replacement characters common in bad PDF extraction
  const boxChars = (text.match(/[\u25A0\u25A1\uFFFD\u0000]/g) || []).length;
  if (boxChars / totalChars > 0.05) return true;

  return false;
}

/**
 * normalizeSkills
 *
 * Deduplicates and normalizes skill strings.
 * "React", "ReactJS", "react", "React.js" → all become "React"
 *
 * Strategy:
 *  1. Trim whitespace
 *  2. Build canonical map for known aliases
 *  3. Deduplicate case-insensitively
 */
export function normalizeSkills(skills = []) {
  // canonical map — common aliases → standard name
  const canonicalMap = {
    reactjs: "React",
    "react.js": "React",
    "react js": "React",
    nodejs: "Node.js",
    "node js": "Node.js",
    node: "Node.js",
    expressjs: "Express",
    "express.js": "Express",
    mongodb: "MongoDB",
    mongo: "MongoDB",
    postgresql: "PostgreSQL",
    postgres: "PostgreSQL",
    javascript: "JavaScript",
    js: "JavaScript",
    typescript: "TypeScript",
    ts: "TypeScript",
    python3: "Python",
    py: "Python",
    cpp: "C++",
    "c plus plus": "C++",
    golang: "Go",
    mysql: "MySQL",
    html5: "HTML",
    css3: "CSS",
    tailwindcss: "Tailwind CSS",
    tailwind: "Tailwind CSS",
    nextjs: "Next.js",
    "next.js": "Next.js",
    vuejs: "Vue.js",
    vue: "Vue.js",
    graphql: "GraphQL",
    restapi: "REST APIs",
    "rest api": "REST APIs",
    restful: "REST APIs",
    "restful api": "REST APIs",
    aws: "AWS",
    "amazon web services": "AWS",
    gcp: "GCP",
    "google cloud": "GCP",
    azure: "Azure",
    "microsoft azure": "Azure",
    docker: "Docker",
    kubernetes: "Kubernetes",
    k8s: "Kubernetes",
    git: "Git",
    github: "GitHub",
    gitlab: "GitLab",
    langchain: "LangChain",
    langgraph: "LangGraph",
  };

  const seen = new Set();
  const normalized = [];

  for (const skill of skills) {
    if (!skill || typeof skill !== "string") continue;

    const trimmed = skill.trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();

    // check canonical map first
    const canonical = canonicalMap[lower];
    const finalSkill = canonical || trimmed;
    const dedupeKey = finalSkill.toLowerCase();

    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      normalized.push(finalSkill);
    }
  }

  return normalized;
}

export async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text || "";
  } catch (err) {
    throw new Error(`PDF text extraction failed: ${err.message}`);
  }
}

/**
 * parseResumeWithAI
 * takes raw resume text → returns structured profile object
 */
export async function parseResumeWithAI(resumeRaw) {
  if (!resumeRaw || resumeRaw.trim().length < 50) {
    throw new Error("Resume text too short — PDF may be image-based or empty");
  }

  const prompt = `You are parsing a resume to extract structured information.

Extract all relevant details accurately. Do not invent or infer anything not present in the text.
For skills — include all technical skills, languages, frameworks, tools, and platforms mentioned.
For experience — include internships, jobs, freelance work. Extract bullet points as-is.
For projects — include personal, academic, or open source projects.
For education — extract the primary/highest degree.



Important things to remember:

Do NOT summarize.

Preserve wording.

Extract bullet points exactly.

Do not rewrite.

Do not improve grammar.

Do not merge bullets.

Return every project separately.

Return every experience separately.

If a field is missing,
return an empty string or empty array.

Never output null.

Resume Text:
---
${resumeRaw.slice(0, 20000)}
---`;

  try {
    const result = await structuredLLM.invoke(prompt);
    return result;
  } catch (err) {
    throw new Error(`Resume AI parsing failed: ${err.message}`);
  }
}
