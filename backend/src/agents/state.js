import { Annotation } from "@langchain/langgraph";

/**
 * ApplyAIState — pipeline working memory only.
 *
 * Rule: if no downstream node reads a field, it does NOT belong here.
 * Nodes that produce final output write directly to DB via crmLogger.
 *
 * Naming convention:
 *   - Scores: 0-100 everywhere
 *   - workingResume: the mutable resume being built through the tailoring nodes
 */
export const ApplyAIState = Annotation.Root({
  // ── pipeline inputs (set once at invoke time) ─────────────────────────────
  userId: Annotation({ reducer: (_, next) => next }),
  applicationId: Annotation({ reducer: (_, next) => next }),
  jdRaw: Annotation({ reducer: (_, next) => next, default: () => "" }),

  // user's profile — read by fit_scorer, ats_scanner, bullet_rewriter,
  // kw_injector, evidence_mapper, interview_prep
  userProfile: Annotation({
    reducer: (_, next) => next,
    default: () => ({
      skills: [],
      bullets: [], // flattened experience bullets
      education: {},
      projects: [],
      resumeRaw: "",
      experience: [],
    }),
  }),

  // ── jd_parser output ──────────────────────────────────────────────────────
  // Read by: fit_scorer, ats_scanner, gap_analyzer, bullet_rewriter,
  //          kw_injector, ats_validator, evidence_mapper, interview_prep, crm_logger
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

      // new in batch 2 — what proof would satisfy each JD requirement
      // written by jd_parser, read by evidence_mapper
      evidenceAnchors: [],
    }),
  }),

  // ── fit_scorer output ─────────────────────────────────────────────────────
  // fitScore read by: crm_logger
  // fitDetails read by: gap_analyzer (severity adjustment), crm_logger
  fitScore: Annotation({ reducer: (_, next) => next, default: () => 0 }),

  fitDetails: Annotation({
    reducer: (_, next) => next,
    default: () => ({
      semanticScore: 0, // 0-100
      keywordScore: 0, // 0-100
      skillsSim: 0, // raw cosine 0-1 (internal, used by gap_analyzer)
      expSim: 0, // raw cosine 0-1
      projSim: 0, // raw cosine 0-1

      // new in batch 2 — per section breakdown
      perSectionMatch: {
        skillMatch: 0, // 0-100
        experienceMatch: 0, // 0-100
        projectMatch: 0, // 0-100
        educationMatch: 0, // 0-100
      },

      reasons: [],
    }),
  }),

  // ── ats_scanner output ────────────────────────────────────────────────────
  // atsCoverageScore read by: crm_logger, honestGapReport builder
  // presentKeywords read by: gap_analyzer
  // missingKeywords read by: gap_analyzer, kw_injector, ats_validator
  atsCoverageScore: Annotation({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  presentKeywords: Annotation({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // new in batch 2 — keywords implied by profile context but not explicitly stated
  // produced by ats_scanner, read by kw_injector + crm_logger
  inferableKeywords: Annotation({
    reducer: (_, next) => next,
    default: () => [],
  }),

  missingKeywords: Annotation({
    reducer: (_, next) => next,
    default: () => [],
  }),

  atsDetails: Annotation({
    reducer: (_, next) => next,
    default: () => ({
      mustScore: 0, // 0-100
      goodScore: 0, // 0-100
      reasons: [],
    }),
  }),

  // ── gap_analyzer output ───────────────────────────────────────────────────
  // gapAnalysis read by: crm_logger
  // tailorPriority read by: bullet_rewriter, kw_injector
  // gapInsights read by: bullet_rewriter, kw_injector
  gapAnalysis: Annotation({ reducer: (_, next) => next, default: () => [] }),
  tailorPriority: Annotation({ reducer: (_, next) => next, default: () => [] }),
  gapInsights: Annotation({ reducer: (_, next) => next, default: () => [] }),

  // ── workingResume — mutable resume built across tailoring nodes ───────────
  // bullet_rewriter → kw_injector → ats_validator → pdf_builder
  // This is NOT a copy of workingResume. It is temporary build state.
  workingResume: Annotation({
    reducer: (_, next) => next,
    default: () => ({
      // bullet_rewriter populates these
      originalBullets: [],
      tailoredBullets: [],
      qualityScore: 0, // 0-100 (threshold: retry if < 85)

      // kw_injector populates these
      updatedSkills: [],
      injectedKeywords: [],
      summary: "",

      // ats_validator populates this
      atsScore: 0, // 0-100

      // pdf_builder populates this — final structured resume for display
      resumeJSON: null,
    }),
  }),

  // ── loop control ─────────────────────────────────────────────────────────
  // shared counter — both retry loops (bullet quality + ATS score) use this
  atsRetryCount: Annotation({ reducer: (_, next) => next, default: () => 0 }),

  // ── honest gap report ─────────────────────────────────────────────────────
  // written by kw_injector when truly missing skills are found
  // read by crm_logger to persist to workingResume
  honestGapReport: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // evidenceMap — produced by evidence_mapper, saved by crm_logger into JDAnalysis
  // travels through state because JDAnalysis doesn't exist until crm_logger creates it
  evidenceMap: Annotation({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // ── interview_prep output ─────────────────────────────────────────────────
  // written by interview_prep, read by crm_logger
  prepQuestions: Annotation({ reducer: (_, next) => next, default: () => [] }),

  // learning plan — produced by interview_prep, saved by crm_logger into PrepSession
  // study guide based on critical gaps — what to study before the interview
  learningPlan: Annotation({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // ── pipeline metadata ─────────────────────────────────────────────────────
  currentNode: Annotation({ reducer: (_, next) => next, default: () => "" }),
  errors: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});
