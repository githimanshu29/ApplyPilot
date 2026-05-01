import { getGraph } from "../agents/graph.js";
import { Application } from "../models/Application.js";
import { ResumeVersion } from "../models/ResumeVersion.js";

export const analyzeJD = async (req, res) => {
  const { jdRaw, jobTitle, company, portalUrl, portalType } = req.body;

  if (!jdRaw?.trim()) {
    return res.status(400).json({ message: "Job description is required" });
  }

  if (!req.user?._id) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    // create application first so we have an ID to pass into the graph
    const application = await Application.create({
      userId: req.user._id,
      jobTitle: jobTitle || "Unknown",
      company: company || "Unknown",
      portalUrl: portalUrl || "",
      portalType: portalType || "other",
      jdRaw,
      status: "saved",
      timeline: [
        {
          event: "created",
          detail: "Application created via JD analysis",
        },
      ],
    });

    const graph = getGraph();

    // build userProfile from the logged-in user's stored profile
    // const userProfile = {
    //   skills: req.user.profile?.skills || [],
    //   bullets:
    //     req.user.profile?.experience?.flatMap((e) => e.bullets || []) || [],
    //   education: req.user.profile?.education || {},
    //   projects: req.user.profile?.projects || [],
    //   resumeRaw: req.user.profile?.resumeRaw || "",
    //   experience: req.user.profile?.experience || [],
    // };

    //Hardcoding profile to check the pipeline
    const userProfile = {
      skills: [
        "Node.js",
        "Express",
        "JavaScript",
        "MongoDB",
        "REST APIs",
        "Git",
      ],
      bullets: [
        "Built REST API for e-commerce platform using Node.js and Express",
        "Designed MongoDB schemas for user and product management",
        "Integrated JWT authentication and role-based access control",
        "Deployed application on AWS EC2 with Nginx reverse proxy",
      ],
      education: {
        degree: "B.Tech",
        branch: "Computer Science",
        college: "XYZ University",
        cgpa: 8.2,
        year: 2025,
      },
      projects: [
        {
          name: "ApplyAI",
          description: "AI-powered job application assistant",
          techStack: ["Node.js", "MongoDB", "LangChain", "React"],
          bullets: ["Built backend API", "Integrated LangGraph pipeline"],
        },
      ],
      resumeRaw:
        "Node.js Express MongoDB REST APIs JavaScript Git AWS JWT authentication backend developer",
      experience: [],
    };

    // run the full LangGraph pipeline
    const result = await graph.invoke({
      userId: req.user._id.toString(),
      applicationId: application._id.toString(),
      jdRaw,
      userProfile,
    });

    // build honest gap report if score never reached 80
    let honestGapReport = null;
    const atsScore = result.resumeVersion?.atsScore || 0;
    if (atsScore < 80) {
      const trulyMissing = (result.missingKeywords || []).map((k) =>
        typeof k === "string" ? k : k.keyword,
      );

      honestGapReport = {
        // atsCoverageScore = what ats_scanner found BEFORE tailoring
        // resumeVersion.atsScore = what ats_validator found AFTER tailoring
        // take the higher of the two — that's the honest best
        bestAchievableScore: Math.max(
          result.atsCoverageScore || 0,
          result.resumeVersion?.atsScore || 0,
        ),
        trulyMissingSkills: trulyMissing,
        explanation:
          `Your resume's best honest ATS score is ${Math.max(result.atsCoverageScore || 0, result.resumeVersion?.atsScore || 0)}%. ` +
          `The following skills are required but not in your profile: ` +
          `${trulyMissing.slice(0, 5).join(", ")}. ` +
          `These cannot be added without misrepresenting your experience. ` +
          `Consider building a project using these technologies to genuinely fill this gap.`,
      };
    }

    await ResumeVersion.findOneAndUpdate(
      { applicationId: application._id },
      { $set: { honestGapReport } },
      { sort: { versionNumber: -1 }, new: true },
    );
    await Application.findByIdAndUpdate(application._id, {
      status: "analysing", // or "analyzed"
    });

    return res.status(200).json({
      success: true,
      applicationId: application._id,

      // jd understanding
      jdAnalysis: result.jdAnalysis,

      // scores
      fitScore: result.fitScore,
      fitDetails: result.fitDetails,
      atsCoverageScore: result.atsCoverageScore,
      atsDetails: result.atsDetails,

      // keyword breakdown
      presentKeywords: result.presentKeywords,
      missingKeywords: result.missingKeywords,

      // gap analysis
      gapAnalysis: result.gapAnalysis,
      gapInsights: result.gapInsights,
      tailorPriority: result.tailorPriority,

      // tailored resume
      resumeVersion: result.resumeVersion,

      // honest truth when score < 80
      honestGapReport,

      errors: result.errors,
    });
  } catch (err) {
    console.error("[analyze] failed:", err.message);
    return res.status(500).json({ message: err.message });
  }
};
