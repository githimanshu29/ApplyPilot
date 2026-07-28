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
  githubUrl: z.string().optional().default(""), // added
  liveUrl: z.string().optional().default(""), // added
});

const EducationSchema = z.object({
  degree: z.string().default(""),
  branch: z.string().default(""),
  college: z.string().default(""),
  cgpa: z.number().nullable().optional(),
  year: z.union([z.string(), z.number()]).nullable().optional(),
});

const CertificationSchema = z.object({
  name: z.string().default(""),
  issuer: z.string().default(""),
  year: z.union([z.string(), z.number()]).nullable().optional(), // added
});

const AchievementSchema = z.object({
  title: z.string().default(""),
  description: z.string().default(""),
  year: z.union([z.string(), z.number()]).nullable().optional(), // added
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
  email: z.string().default(""), // added — needed by autofill systems
  phone: z.string().default(""), // added — needed by autofill systems
});

const ResumeSchema = z.object({
  skills: z
    .array(z.string())
    .default([])
    .describe(
      "All technical and domain skills — languages, frameworks, tools, platforms",
    ),
  experience: z
    .array(ExperienceSchema)
    .default([])
    .describe("Work experience and internships with bullet points"),
  projects: z
    .array(ProjectSchema)
    .default([])
    .describe("Personal or academic projects with tech stack and links"),
  education: EducationSchema.describe("Highest or most recent education entry"),
  certifications: z
    .array(CertificationSchema)
    .default([])
    .describe("Professional certifications, courses, or licenses with year"),
  achievements: z
    .array(AchievementSchema)
    .default([])
    .describe(
      "Awards, hackathons, competitive programming milestones, scholarships, rankings with year",
    ),
  links: LinksSchema.describe(
    "Professional links, coding profiles, and contact info from the resume",
  ),
});

// ── LLM ──────────────────────────────────────────────────────────────────

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

// ── Utilities ─────────────────────────────────────────────────────────────

/**
 * detectOCRGarbage
 *
 * Uses letters/(letters+digits) ratio — avoids false positives
 * from resumes with lots of dates, percentages, phone numbers.
 *
 * Previous approach (letters/total) wrongly flagged resumes with
 * heavy use of punctuation and whitespace.
 */
export function detectOCRGarbage(text) {
  if (!text || text.length < 10) return true;

  const letters = (text.match(/[a-zA-Z]/g) || []).length;
  const digits = (text.match(/[0-9]/g) || []).length;
  const meaningful = letters + digits;

  // if almost no letters or digits — definitely garbage
  if (meaningful < 20) return true;

  const letterRatio = letters / meaningful;

  // less than 50% letters in meaningful chars → likely garbage
  if (letterRatio < 0.5) return true;

  // repeating character sequences (OCR artifact)
  if (/(.)\1{8,}/.test(text)) return true;

  // box/replacement characters
  const boxChars = (text.match(/[\u25A0\u25A1\uFFFD\u0000]/g) || []).length;
  if (text.length > 0 && boxChars / text.length > 0.05) return true;

  return false;
}

/**
 * normalizeSkills
 *
 * Deduplicates and canonicalizes skill strings.
 *
 * Steps:
 *  1. Trim + normalize punctuation (dots, dashes, underscores → space)
 *  2. Lowercase for map lookup
 *  3. Check canonical map for known aliases
 *  4. Deduplicate case-insensitively
 *
 * This catches variants like:
 *  Node.js / NodeJS / node.js / NODEJS / node-js → Node.js
 *  React / ReactJS / react / React.js → React
 */
export function normalizeSkills(skills = []) {
  const canonicalMap = {
    // JavaScript ecosystem
    react: "React",
    reactjs: "React",
    "react js": "React",
    nodejs: "Node.js",
    "node js": "Node.js",
    node: "Node.js",
    expressjs: "Express",
    "express js": "Express",
    nextjs: "Next.js",
    "next js": "Next.js",
    vuejs: "Vue.js",
    "vue js": "Vue.js",
    vue: "Vue.js",
    nuxtjs: "Nuxt.js",
    "nuxt js": "Nuxt.js",
    angularjs: "Angular",
    "angular js": "Angular",

    // Languages
    javascript: "JavaScript",
    js: "JavaScript",
    typescript: "TypeScript",
    ts: "TypeScript",
    python3: "Python",
    "python 3": "Python",
    py: "Python",
    cpp: "C++",
    "c plus plus": "C++",
    csharp: "C#",
    "c sharp": "C#",
    golang: "Go",
    html5: "HTML",
    "html 5": "HTML",
    css3: "CSS",
    "css 3": "CSS",
    tailwindcss: "Tailwind CSS",
    "tailwind css": "Tailwind CSS",
    tailwind: "Tailwind CSS",

    // Databases
    mongodb: "MongoDB",
    mongo: "MongoDB",
    "mongo db": "MongoDB",
    postgresql: "PostgreSQL",
    postgres: "PostgreSQL",
    mysql: "MySQL",
    "my sql": "MySQL",
    mssql: "MS SQL",
    "ms sql server": "MS SQL",
    sqlite: "SQLite",
    redis: "Redis",
    elasticsearch: "Elasticsearch",
    "elastic search": "Elasticsearch",

    // Cloud & DevOps
    aws: "AWS",
    "amazon web services": "AWS",
    gcp: "GCP",
    "google cloud platform": "GCP",
    "google cloud": "GCP",
    azure: "Azure",
    "microsoft azure": "Azure",
    docker: "Docker",
    kubernetes: "Kubernetes",
    k8s: "Kubernetes",
    "github actions": "GitHub Actions",
    "ci cd": "CI/CD",
    cicd: "CI/CD",

    // Version control
    git: "Git",
    github: "GitHub",
    "git hub": "GitHub",
    gitlab: "GitLab",
    "git lab": "GitLab",

    // AI/ML
    langchain: "LangChain",
    "lang chain": "LangChain",
    langgraph: "LangGraph",
    "lang graph": "LangGraph",
    tensorflow: "TensorFlow",
    "tensor flow": "TensorFlow",
    pytorch: "PyTorch",
    "py torch": "PyTorch",
    "scikit learn": "Scikit-learn",
    sklearn: "Scikit-learn",

    // APIs
    "rest api": "REST APIs",
    "rest apis": "REST APIs",
    restful: "REST APIs",
    "restful api": "REST APIs",
    "restful apis": "REST APIs",
    graphql: "GraphQL",
    "graph ql": "GraphQL",

    // Other common
    linux: "Linux",
    unix: "Unix",
    nginx: "Nginx",
    apache: "Apache",
    firebase: "Firebase",
    supabase: "Supabase",
  };

  const seen = new Set();
  const normalized = [];

  for (const skill of skills) {
    if (!skill || typeof skill !== "string") continue;

    const trimmed = skill.trim();
    if (!trimmed) continue;

    // normalize punctuation before map lookup
    // Node.js → node js, C++ stays C++ (only dots/dashes/underscores)
    const lookupKey = trimmed
      .toLowerCase()
      .replace(/[.\-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // check canonical map
    const canonical = canonicalMap[lookupKey];
    const finalSkill = canonical || trimmed;

    // deduplicate using normalized key
    const dedupeKey = finalSkill.toLowerCase().replace(/\s+/g, " ").trim();

    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      normalized.push(finalSkill);
    }
  }

  return normalized;
}

// ── Core functions ────────────────────────────────────────────────────────

/**
 * extractTextFromPDF
 * PDF buffer → raw text string
 */
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
 * raw resume text → structured profile object
 */
export async function parseResumeWithAI(resumeRaw) {
  if (!resumeRaw || resumeRaw.trim().length < 50) {
    throw new Error("Resume text too short — PDF may be image-based or empty");
  }

  const prompt = `You are parsing a resume to extract structured information.

Extract all relevant details accurately. Do not invent or infer anything not present in the text.

Rules:
- Do NOT summarize
- Preserve exact wording of bullet points
- Do not rewrite or improve grammar
- Do not merge bullets
- Return every project separately
- Return every experience separately
- Extract email and phone from contact section into links.email and links.phone
- For projects — extract githubUrl and liveUrl if present in the resume
- For certifications and achievements — extract year if mentioned
- If any field is missing, return empty string or empty array
- Never output null

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
