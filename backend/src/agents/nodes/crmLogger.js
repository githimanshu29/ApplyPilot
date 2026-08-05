import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Application } from "../../models/Application.js";
import { JDAnalysis } from "../../models/JDAnalysis.js";
import { workingResume } from "../../models/workingResume.js";
import { PrepSession } from "../../models/PrepSession.js";

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0,
  apiKey: process.env.GEMINI_API_KEY,
});

// ── Keyword Intelligence Merger ───────────────────────────────────────────────

/**
 * mergeKeywordIntelligence
 *
 * Assembles all 5 keyword buckets from pipeline state.
 * Called once at save time — only crmLogger has all 5 sources simultaneously.
 *
 * matched   → atsScanner found these in the original resume
 * inferable → atsScanner classified as implied by project context
 * missing   → still absent after all tailoring attempts
 * injected  → kwInjector added these honestly to the tailored resume
 * rejected  → kwInjector's honesty gate blocked these (not in profile)
 */
function mergeKeywordIntelligence(state) {
  const presentKeywords = state.presentKeywords || [];
  const inferableKeywords = state.inferableKeywords || [];
  const injectedKeywords = state.workingResume?.injectedKeywords || [];
  const rejectedKeywords = state.honestGapReport?.trulyMissingSkills || [];

  // missing = still absent after tailoring
  // = original missing keywords that weren't injected or rejected
  const injectedSet = new Set(injectedKeywords.map((k) => k.toLowerCase()));
  const rejectedSet = new Set(rejectedKeywords.map((k) => k.toLowerCase()));

  const remainingMissing = (state.missingKeywords || []).filter((item) => {
    const kw = (typeof item === "string" ? item : item.keyword).toLowerCase();
    return !injectedSet.has(kw) && !rejectedSet.has(kw);
  });

  return {
    matched: presentKeywords.map((k) => ({
      keyword: typeof k === "string" ? k : k.keyword,
      source: "resume",
    })),

    inferable: inferableKeywords.map((k) => ({
      keyword: k,
      reason: "Implied by project/experience context",
    })),

    missing: remainingMissing.map((k) => ({
      keyword: typeof k === "string" ? k : k.keyword,
      priority: typeof k === "object" ? k.priority : "medium",
    })),

    injected: injectedKeywords.map((k) => ({ keyword: k })),

    rejected: rejectedKeywords.map((k) => ({
      keyword: k,
      reason:
        "Not found in profile — cannot add without misrepresenting experience",
    })),
  };
}

// ── HonestGapReport Finalizer ─────────────────────────────────────────────────

/**
 * finalizeHonestGapReport
 *
 * kwInjector builds a partial report with trulyMissingSkills + explanation.
 * crmLogger finalizes it by:
 *   1. Setting bestAchievableScore (now known from ats_validator)
 *   2. Adding skillGaps from enriched gapAnalysis (has explanation objects)
 */
function finalizeHonestGapReport(state) {
  const partial = state.honestGapReport;
  const atsScore = state.workingResume?.atsScore ?? 0;
  const gapAnalysis = state.gapAnalysis || [];

  // if no honestGapReport was created (score reached 80 honestly), return null
  if (!partial) return null;

  // extract enriched gap details for truly missing skills only
  const skillGaps = (partial.trulyMissingSkills || []).map((skill) => {
    const gap = gapAnalysis.find(
      (g) => g.skill?.toLowerCase() === skill.toLowerCase(),
    );

    if (gap?.explanation) {
      return {
        skill,
        businessImpact: gap.explanation.estimatedBenefit || "",
        estimatedATSLoss: Math.round(
          (1 /
            Math.max(1, state.jdAnalysis?.atsKeywords?.mustHave?.length || 5)) *
            100,
        ),
        priority:
          gap.severity === "high" ? 1 : gap.severity === "medium" ? 2 : 3,
        learningDifficulty: gap.explanation.estimatedEffort || "",
        suggestedProject: gap.explanation.recommendedAction || "",
        resources: [],
        reasoning: gap.explanation.reasoning || "",
      };
    }

    return {
      skill,
      businessImpact: "",
      estimatedATSLoss: 0,
      priority: 2,
      learningDifficulty: "",
      suggestedProject: "",
      resources: [],
      reasoning: "",
    };
  });

  return {
    bestAchievableScore: atsScore,
    trulyMissingSkills: partial.trulyMissingSkills || [],
    explanation: partial.explanation || "",
    skillGaps,
  };
}

// ── Recruiter Simulation ──────────────────────────────────────────────────────

/**
 * runRecruiterSimulation
 *
 * Simulates a recruiter's reaction to the TAILORED resume vs this specific JD.
 * Runs inline in crmLogger — not a separate node — because:
 *   1. No downstream node reads it
 *   2. It requires final pipeline state (atsScore, gapAnalysis, tailored resume)
 *   3. It enriches what crmLogger saves, not what other nodes compute
 *
 * Returns null on failure — non-fatal, pipeline result is still saved.
 */
async function runRecruiterSimulation(state) {
  try {
    const { jdAnalysis, workingResume, fitScore, gapAnalysis } = state;

    const presentGaps = (gapAnalysis || [])
      .filter((g) => !g.present && g.severity === "high")
      .map((g) => g.skill)
      .slice(0, 5);

    const strongPoints = (gapAnalysis || [])
      .filter((g) => g.present && g.type === "required")
      .map((g) => g.skill)
      .slice(0, 5);

    const resumeSummary = workingResume?.resumeJSON
      ? [
          workingResume.resumeJSON.summary,
          `Skills: ${(workingResume.resumeJSON.skills || []).join(", ")}`,
          `Experience: ${(workingResume.resumeJSON.experience || [])
            .map((e) => `${e.role} at ${e.company}`)
            .join("; ")}`,
          `Projects: ${(workingResume.resumeJSON.projects || [])
            .map((p) => p.name)
            .join(", ")}`,
        ]
          .filter(Boolean)
          .join("\n")
      : "Resume data not available";

    const prompt = `You are an experienced technical recruiter evaluating a candidate for a specific role.

ROLE: ${jdAnalysis.jobTitle} at ${jdAnalysis.company}
DOMAIN: ${jdAnalysis.roleDomain}
SENIORITY: ${jdAnalysis.seniorityLevel}

REQUIRED SKILLS: ${(jdAnalysis.requiredSkills || []).join(", ")}

CANDIDATE RESUME SUMMARY:
${resumeSummary}

PIPELINE SCORES:
- Semantic Fit Score: ${fitScore}/100
- ATS Score (tailored): ${workingResume?.atsScore || 0}/100

VERIFIED STRENGTHS: ${strongPoints.join(", ") || "None identified"}
CRITICAL GAPS: ${presentGaps.join(", ") || "None"}

As a recruiter, simulate your honest reaction to this candidate.

Rules:
- Be realistic — not every 80% ATS score gets shortlisted
- Consider the seniority level carefully
- Hiring risks should be specific and actionable
- Likely questions should directly address the gaps
- If critical skills are missing, wouldShortlist should be false even with high ATS

Return ONLY valid JSON:
{
  "wouldShortlist": true | false,
  "confidence": <0-100>,
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "hiringRisks": ["...", "..."],
  "likelyQuestions": ["...", "..."],
  "interviewProbability": <0-100>,
  "reasoning": "2-3 sentence honest recruiter assessment"
}`;

    const response = await llm.invoke(prompt);
    let raw = response.content.trim();

    if (raw.startsWith("```")) {
      raw = raw
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
    }

    const objStart = raw.indexOf("{");
    const objEnd = raw.lastIndexOf("}");
    if (objStart === -1 || objEnd === -1) return null;

    const parsed = JSON.parse(raw.slice(objStart, objEnd + 1));

    return {
      wouldShortlist: Boolean(parsed.wouldShortlist),
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      hiringRisks: Array.isArray(parsed.hiringRisks) ? parsed.hiringRisks : [],
      likelyQuestions: Array.isArray(parsed.likelyQuestions)
        ? parsed.likelyQuestions
        : [],
      interviewProbability: Math.min(
        100,
        Math.max(0, Number(parsed.interviewProbability) || 0),
      ),
      reasoning: parsed.reasoning || "",
    };
  } catch (err) {
    console.warn(
      "[crm_logger] recruiter simulation failed — skipping:",
      err.message,
    );
    return null;
  }
}

// ── Node ──────────────────────────────────────────────────────────────────────

export async function crmLoggerNode(state) {
  console.log("[crm_logger] saving results to DB...");

  const {
    userId,
    applicationId,
    jdAnalysis = {},
    fitScore,
    fitDetails,
    atsCoverageScore,
    presentKeywords,
    inferableKeywords,
    missingKeywords,
    atsDetails,
    gapAnalysis,
    tailorPriority,
    gapInsights,
    evidenceMap,
    workingResume = {},
    jdRaw,
  } = state;

  if (!userId || !applicationId) {
    throw new Error(
      "[crm_logger] Missing userId or applicationId — cannot save",
    );
  }

  try {
    // ── Step 1: merge keyword intelligence ────────────────────────────────────
    const keywordIntelligence = mergeKeywordIntelligence(state);

    // ── Step 2: finalize honestGapReport ──────────────────────────────────────
    const finalHonestGapReport = finalizeHonestGapReport(state);

    // ── Step 3: run recruiter simulation ──────────────────────────────────────
    console.log("[crm_logger] running recruiter simulation...");
    const recruiterSimulation = await runRecruiterSimulation(state);
    console.log(
      `[crm_logger] recruiter simulation — wouldShortlist: ${recruiterSimulation?.wouldShortlist ?? "failed"}`,
    );

    // ── Step 4: save JDAnalysis ───────────────────────────────────────────────
    const jdDoc = await JDAnalysis.create({
      applicationId,
      userId,
      rawJd: jdRaw || "",

      // jd_parser output
      jobTitle: jdAnalysis.jobTitle,
      company: jdAnalysis.company,
      roleDomain: jdAnalysis.roleDomain,
      seniorityLevel: jdAnalysis.seniorityLevel,
      experienceYears: jdAnalysis.experienceYears,
      requiredSkills: jdAnalysis.requiredSkills,
      niceToHave: jdAnalysis.niceToHave,
      tools: jdAnalysis.tools,
      responsibilities: jdAnalysis.responsibilities,
      atsKeywords: jdAnalysis.atsKeywords,
      redFlags: jdAnalysis.redFlags,
      salaryHints: jdAnalysis.salaryHints,
      location: jdAnalysis.location,
      workType: jdAnalysis.workType,

      // fit_scorer output
      fitScore,
      fitDetails,

      // ats_scanner output
      atsCoverageScore,
      presentKeywords,
      missingKeywords,
      atsDetails,

      // merged 5-bucket keyword intelligence
      keywordIntelligence,

      // gap_analyzer output
      gapAnalysis,
      tailorPriority,
      gapInsights,

      // evidence_mapper output
      evidenceMap: evidenceMap || [],
    });

    // ── Step 5: save workingResume────────────────────────────────────────────
    const latest = await ResumeVersion.findOne({ applicationId })
      .sort({ versionNumber: -1 })
      .lean();

    const nextVersion = latest ? latest.versionNumber + 1 : 1;

    const resumeDoc = await ResumeVersion.create({
      applicationId,
      userId,
      versionNumber: nextVersion,

      // tailored content
      originalBullets: workingResume.originalBullets || [],
      tailoredBullets: workingResume.tailoredBullets || [],
      tailoredExperienceBullets: workingResume.tailoredExperienceBullets || [],
      updatedSkills: workingResume.updatedSkills || [],
      injectedKeywords: workingResume.injectedKeywords || [],

      // structured resume for display and PDF generation
      resumeJSON: workingResume.resumeJSON || {},

      // scores — all 0-100
      atsScore: workingResume.atsScore || 0,
      qualityScore: workingResume.qualityScore || 0,

      // honest gap report — finalized with bestAchievableScore + skillGaps
      honestGapReport: finalHonestGapReport,

      // recruiter simulation — owned by workingResume(reacts to tailored resume)
      recruiterSimulation,
    });

    // ── Step 6: update Application ─────────────────────────────────────────────
    const updatedApplication = await Application.findByIdAndUpdate(
      applicationId,
      {
        jdAnalysisId: jdDoc._id,
        resumeVersionId: resumeDoc._id,
        status: "analyzed",
        $push: {
          timeline: {
            event: "analysis_completed",
            detail:
              `Fit: ${fitScore || 0}/100 | ` +
              `ATS: ${workingResume.atsScore || 0}/100 | ` +
              `Recruiter: ${recruiterSimulation?.wouldShortlist ? "Would shortlist" : "Would not shortlist"}`,
          },
        },
      },
      { new: true },
    );

    if (!updatedApplication) {
      throw new Error(`Application ${applicationId} not found during update`);
    }

    // ── Step 7: save PrepSession ──────────────────────────────────────────────
    if (state.prepQuestions?.length > 0) {
      // check for existing session — PrepSession has unique index on applicationId + userId
      const existingSession = await PrepSession.findOne({
        applicationId,
        userId,
      });

      if (!existingSession) {
        await PrepSession.create({
          applicationId,
          userId,
          questions: state.prepQuestions,
          learningPlan: state.learningPlan || [],
          status: "generated",
        });
        console.log(
          `[crm_logger] saved ${state.prepQuestions.length} prep questions`,
        );
      } else {
        console.log(
          "[crm_logger] prep session already exists — skipping duplicate create",
        );
      }
    }

    console.log(
      `[crm_logger] saved — ` +
        `JDAnalysis: ${jdDoc._id} | ` +
        `workingResumev${nextVersion}: ${resumeDoc._id} | ` +
        `keywords: ${keywordIntelligence.matched.length} matched, ` +
        `${keywordIntelligence.injected.length} injected, ` +
        `${keywordIntelligence.rejected.length} rejected`,
    );

    return { currentNode: "crm_logger" };
  } catch (err) {
    console.error("[crm_logger] failed:", err.message);
    throw err; // fatal — worker retry will handle it
  }
}
