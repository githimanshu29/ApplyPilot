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

//llama-3.1-8b-instant
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

const structuredLLM = llm.withStructuredOutput(InjectionSchema, {
  name: "inject_keywords",
});

function normalizeKeyword(k) {
  return typeof k === "string" ? k : k.keyword;
}

/**
 * classifyKeywords
 *
 * Three buckets — only present and inferable go into the resume.
 * Truly missing keywords NEVER get injected — they go to honestGapReport.
 *
 * present   → explicitly in skills, bullets, or resumeRaw
 * inferable → not written but clearly implied by their project tech stack
 * missing   → genuinely absent, cannot be added honestly
 */
function classifyKeywords(keywords, userProfile) {
  const resumeText = [
    userProfile.resumeRaw || "",
    (userProfile.skills || []).join(" "),
    (userProfile.bullets || []).join(" "),
    (userProfile.experience || []).flatMap((e) => e.bullets || []).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  // all tech in user's projects — things they've genuinely worked with
  const projectTech = (userProfile.projects || [])
    .flatMap((p) => [
      ...(p.techStack || []),
      ...(p.bullets || []),
      p.description || "",
    ])
    .join(" ")
    .toLowerCase();

  const present = [];
  const inferable = [];
  const trulyMissing = [];

  for (const keyword of keywords) {
    const kw = keyword.toLowerCase().trim();

    // check 1 — explicitly present anywhere in resume text
    if (resumeText.includes(kw)) {
      present.push(keyword);
      continue;
    }

    // check 2 — inferable from project tech stack
    // e.g. user has "Node.js + Express" → "REST API" is inferable
    // e.g. user has "React" → "component-based architecture" is inferable
    const inferableMap = {
      "rest api": ["node", "express", "flask", "django", "fastapi", "spring"],
      restful: ["node", "express", "flask", "django"],
      "rest apis": ["node", "express", "flask", "django", "fastapi"],
      "version control": ["git", "github", "gitlab"],
      agile: ["scrum", "sprint", "jira"],
      "ci/cd": ["github actions", "jenkins", "gitlab", "pipeline"],
      cloud: ["aws", "gcp", "azure", "heroku", "vercel", "ec2", "s3"],
      "database design": ["mongodb", "mysql", "postgresql", "mongoose", "sql"],
      "api development": ["node", "express", "flask", "django", "rest"],
      "component-based": ["react", "vue", "angular"],
      "state management": ["react", "redux", "vue"],
      "responsive design": ["css", "html", "react", "tailwind"],
    };

    const inferableTriggers = inferableMap[kw];
    if (inferableTriggers) {
      const isInferable = inferableTriggers.some(
        (trigger) =>
          projectTech.includes(trigger) || resumeText.includes(trigger),
      );
      if (isInferable) {
        inferable.push(keyword);
        continue;
      }
    }

    // check 3 — partial match in project tech (user literally used this tech)
    if (projectTech.includes(kw)) {
      inferable.push(keyword);
      continue;
    }

    // nothing found — this is truly missing
    trulyMissing.push(keyword);
  }

  return { present, inferable, trulyMissing };
}

export async function kwInjectorNode(state) {
  console.log("[kw_injector] starting...");

  const workingResume = state.workingResume || {};
  const gapPriority = (state.tailorPriority || []).map(normalizeKeyword);
  const atsMissing = (state.missingKeywords || []).map(normalizeKeyword);
  const allKeywords = [...new Set([...gapPriority, ...atsMissing])];

  if (!allKeywords.length) {
    console.log("[kw_injector] nothing to process");
    return {
      workingResume: { ...workingResume, injectedKeywords: [] },
      currentNode: "kw_injector",
    };
  }

  // ── honesty gate ──────────────────────────────────────
  // atsScanner already classified keywords into 3 buckets in state
  // use that result directly — no need to recompute
  const alreadyPresent = state.presentKeywords || [];
  const alreadyInferable = state.inferableKeywords || [];

  // safeToInject = what atsScanner found as present or inferable
  // these are the only keywords we can honestly add to the resume
  const safeToInject = [
    ...new Set([
      ...alreadyPresent.map((k) => (typeof k === "string" ? k : k.keyword)),
      ...alreadyInferable,
      // also include any from tailorPriority that ats already classified as safe
      ...gapPriority.filter(
        (kw) =>
          alreadyPresent.some(
            (pk) =>
              (typeof pk === "string" ? pk : pk.keyword).toLowerCase() ===
              kw.toLowerCase(),
          ) ||
          alreadyInferable.some((ik) => ik.toLowerCase() === kw.toLowerCase()),
      ),
    ]),
  ];

  const trulyMissing = allKeywords.filter(
    (kw) => !safeToInject.some((s) => s.toLowerCase() === kw.toLowerCase()),
  );

  console.log(
    `[kw_injector] present: ${present.length}, inferable: ${inferable.length}, truly missing: ${trulyMissing.length}`,
  );
  console.log(
    `[kw_injector] safe to inject: ${safeToInject.join(", ") || "none"}`,
  );

  if (trulyMissing.length > 0) {
    console.log(
      `[kw_injector] NOT injecting (user doesn't have these): ${trulyMissing.join(", ")}`,
    );
  }

  // if nothing is honestly injectable, skip LLM call entirely
  if (!safeToInject.length) {
    console.log("[kw_injector] nothing honest to inject — skipping");
    return {
      workingResume: { ...workingResume, injectedKeywords: [] },
      honestGapReport: {
        bestAchievableScore: workingResume.atsScore || 0,
        trulyMissingSkills: trulyMissing,
        explanation:
          `These skills are required but not present in your profile: ${trulyMissing.join(", ")}. ` +
          `They cannot be added without misrepresenting your experience. ` +
          `Consider building a project using these technologies to genuinely fill this gap.`,
      },
      currentNode: "kw_injector",
    };
  }

  const { jobTitle, company } = state.jdAnalysis || {};
  const currentSkills = state.userProfile?.skills || [];
  const gapInsights = state.gapInsights || [];
  const retryCount = state.atsRetryCount || 0;

  const retryNote =
    retryCount > 0
      ? `Previous attempt did not improve ATS score enough. Increase coverage of the approved keywords without overstuffing.`
      : "";

  const prompt = `You are optimizing a resume for ATS screening.

Role: ${jobTitle} at ${company}

Current skills:
${currentSkills.join(", ")}

APPROVED keywords to include (these are already present or directly implied by the candidate's work — do NOT add anything outside this list):
${safeToInject.join(", ")}

Focus areas:
${gapInsights.join(", ") || "general improvement"}

Rules:
1. Update skills section — naturally include approved keywords
2. Group skills logically (Backend, DevOps, Tools, etc.)
3. ONLY use keywords from the approved list above — do NOT add anything else
4. Avoid keyword stuffing — keep it human-readable
5. Write a concise 2–3 line professional summary aligned with the role

${retryNote}

Return structured output only.`;

  try {
    const result = await structuredLLM.invoke(prompt);

    console.log(
      `[kw_injector] injected ${result.injectedKeywords?.length || 0} keywords honestly`,
    );

    // build honest gap report for truly missing skills — always surface this truth
    const honestGapReport =
      trulyMissing.length > 0
        ? {
            bestAchievableScore: null, // filled by ats_validator after this run
            trulyMissingSkills: trulyMissing,
            explanation:
              `The following skills are required but not in your profile: ${trulyMissing.join(", ")}. ` +
              `These were not added to your resume. To genuinely qualify for this role, ` +
              `consider building a project using these technologies.`,
          }
        : null;

    return {
      workingResume: {
        ...workingResume,
        updatedSkills: result.updatedSkills || currentSkills,
        injectedKeywords: result.injectedKeywords || [],
        summary: result.summary || "",
      },
      honestGapReport,
      currentNode: "kw_injector",
    };
  } catch (err) {
    console.error("[kw_injector] failed:", err.message);
    return {
      errors: [{ node: "kw_injector", message: err.message }],
      workingResume: {
        ...workingResume,
        injectedKeywords: [],
      },
    };
  }
}
