import { Annotation } from "@langchain/langgraph";

export const ApplyAIState = Annotation.Root({
  // ── inputs
  userId: Annotation({ reducer: (_, next) => next }),
  applicationId: Annotation({ reducer: (_, next) => next }),

  // ── raw inputs
  jdRaw: Annotation({ reducer: (_, next) => next, default: () => "" }),

  //profile of the user built from resume or scraping
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
  jdAnalysis: Annotation({
    reducer: (_, next) => next,
    default: () => ({
      jobTitle: "",
      company: "",
      requiredSkills: [],
      niceToHave: [],
      atsKeywords: [],
      seniorityLevel: "",
      redFlags: [],
      salaryHints: "",
    }),
  }),

  // ── fit_scorer output
  fitScore: Annotation({ reducer: (_, next) => next, default: () => 0 }),

  // ── ats_scanner output
  atsCoverageScore: Annotation({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  missingKeywords: Annotation({
    reducer: (_, next) => next,
    default: () => [],
  }),
  presentKeywords: Annotation({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // ── gap_analyzer output
  gapAnalysis: Annotation({ reducer: (_, next) => next, default: () => [] }),
  tailorPriority: Annotation({ reducer: (_, next) => next, default: () => [] }),

  // ── resume version (built across rewriter → injector → validator)
  resumeVersion: Annotation({
    reducer: (_, next) => next,
    default: () => ({
      originalBullets: [],
      tailoredBullets: [],
      injectedKeywords: [],
      updatedSkills: [],
      summary: "",
      atsScore: 0,
      qualityScore: 0,
    }),
  }),

  // loop safety counter
  atsRetryCount: Annotation({ reducer: (_, next) => next, default: () => 0 }),

  // ── pipeline metadata
  currentNode: Annotation({ reducer: (_, next) => next, default: () => "" }),
  pdfUrl: Annotation({ reducer: (_, next) => next, default: () => "" }),
  errors: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});
