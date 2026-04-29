import { Annotation } from "@langchain/langgraph";

export const ApplyAIState = Annotation.Root({
  // ── inputs
  userId: Annotation({ reducer: (_, next) => next }),
  applicationId: Annotation({ reducer: (_, next) => next }),
  jdRaw: Annotation({ reducer: (_, next) => next, default: () => "" }),

  userProfile: Annotation({
    reducer: (_, next) => next,
    default: () => ({
      skills: [],
      bullets: [],
      education: {},
      projects: [],
      resumeRaw: "",
    }),
  }),

  // ── jd_parser output
  // atsKeywords is now { mustHave: [], goodToHave: [] } — matches your jdParser schema
  jdAnalysis: Annotation({
    reducer: (_, next) => next,
    default: () => ({
      jobTitle: "",
      company: "",
      roleDomain: "other",
      seniorityLevel: "fresher",
      experienceYears: {},
      requiredSkills: [],
      niceToHave: [],
      tools: [],
      responsibilities: [],
      atsKeywords: { mustHave: [], goodToHave: [] },
      redFlags: [],
      salaryHints: "",
      location: "",
      workType: "onsite",
    }),
  }),

  // ── fit_scorer output
  fitScore: Annotation({ reducer: (_, next) => next, default: () => 0 }),

  // detailed breakdown — used by gapAnalyzer for severity adjustment
  fitDetails: Annotation({
    reducer: (_, next) => next,
    default: () => ({
      semanticScore: 0,
      keywordScore: 0,
      skillsSim: 0,
      expSim: 0,
      projSim: 0,
      presentKeywords: [],
      missingKeywords: [],
      reasons: [],
    }),
  }),

  // ── ats_scanner output
  atsCoverageScore: Annotation({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  // missingKeywords are objects: { keyword, priority: "high" | "medium" }
  missingKeywords: Annotation({
    reducer: (_, next) => next,
    default: () => [],
  }),
  presentKeywords: Annotation({
    reducer: (_, next) => next,
    default: () => [],
  }),

  atsDetails: Annotation({
    reducer: (_, next) => next,
    default: () => ({
      mustScore: 0,
      goodScore: 0,
      reasons: [],
    }),
  }),

  // ── gap_analyzer output
  gapAnalysis: Annotation({ reducer: (_, next) => next, default: () => [] }),
  tailorPriority: Annotation({ reducer: (_, next) => next, default: () => [] }),
  gapInsights: Annotation({ reducer: (_, next) => next, default: () => [] }),

  // resume version (built through rewriter → injector → validator)
  resumeVersion: Annotation({
    reducer: (_, next) => next,
    default: () => ({
      originalBullets: [],
      tailoredBullets: [],
      updatedSkills: [],
      injectedKeywords: [],
      summary: "",
      atsScore: 0,
      qualityScore: 0,
    }),
  }),

  // loop safety counter — shared by both retry loops
  atsRetryCount: Annotation({ reducer: (_, next) => next, default: () => 0 }),

  // honest gap report — shown when score can't reach 80 honestly
  honestGapReport: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // ─pipeline metadata
  currentNode: Annotation({ reducer: (_, next) => next, default: () => "" }),
  pdfUrl: Annotation({ reducer: (_, next) => next, default: () => "" }),
  errors: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});
