import { Application } from "../../models/Application.js";
import { JDAnalysis } from "../../models/JDAnalysis.js";
import { ResumeVersion } from "../../models/ResumeVersion.js";

export async function crmLoggerNode(state) {
  console.log("[crm_logger] saving results to DB...");

  try {
    const {
      userId,
      applicationId,
      jdAnalysis = {},
      fitScore,
      fitDetails,
      atsCoverageScore,
      presentKeywords,
      missingKeywords,
      atsDetails,
      gapAnalysis,
      tailorPriority,
      gapInsights,
      resumeVersion = {},
      honestGapReport,
      jdRaw,
    } = state;

    if (!userId || !applicationId) {
      throw new Error("Missing userId or applicationId");
    }

    //  1. Save JDAnalysis (explicit mapping = safer)
    const jdDoc = await JDAnalysis.create({
      applicationId,
      userId,
      rawJd: jdRaw || jdAnalysis.rawJd || "",

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

      fitScore,
      fitDetails,

      atsCoverageScore,
      presentKeywords,
      missingKeywords,
      atsDetails,

      gapAnalysis,
      tailorPriority,
      gapInsights,
    });

    //Incrementing version logic
    const latest = await ResumeVersion.findOne({ applicationId }).sort({
      versionNumber: -1,
    });

    const nextVersion = latest ? latest.versionNumber + 1 : 1;

    //  2. Save ResumeVersion (future-ready)
    const resumeDoc = await ResumeVersion.create({
      applicationId,
      userId,
      versionNumber: nextVersion,

      originalBullets: resumeVersion.originalBullets || [],
      tailoredBullets: resumeVersion.tailoredBullets || [],
      tailoredExperienceBullets: resumeVersion.tailoredExperienceBullets || [],

      updatedSkills: resumeVersion.updatedSkills || [],
      injectedKeywords: resumeVersion.injectedKeywords || [],

      resumeJSON: resumeVersion.resumeJSON || {},

      atsScore: resumeVersion.atsScore || 0,
      qualityScore: resumeVersion.qualityScore || 0,

      honestGapReport: honestGapReport || null,
    });

    //  3. Update Application
    await Application.findByIdAndUpdate(
      applicationId,
      {
        jdAnalysisId: jdDoc._id,
        resumeVersionId: resumeDoc._id,
        $push: {
          timeline: {
            event: "analysis_completed",
            detail: `Fit: ${fitScore || 0} | ATS: ${resumeVersion?.atsScore || 0}`,
          },
        },
      },
      { new: true },
    );

    console.log("[crm_logger] saved successfully");

    return { currentNode: "crm_logger" };
  } catch (err) {
    console.error("[crm_logger] failed:", err.message);

    return {
      errors: [{ node: "crm_logger", message: err.message }],
    };
  }
}
