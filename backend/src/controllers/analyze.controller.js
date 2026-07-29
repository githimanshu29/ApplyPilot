import { Application } from "../models/Application.js";
import { analysisQueue } from "../jobs/queues.js";

export const analyzeJD = async (req, res) => {
  const { jdRaw, jobTitle, company, portalUrl, portalType, socketId } =
    req.body || {};

  if (!jdRaw?.trim()) {
    return res.status(400).json({ message: "Job description is required" });
  }

  const userProfile = {
    skills: req.user.profile?.skills || [],
    bullets:
      req.user.profile?.experience?.flatMap((e) => e.bullets || []) || [],
    education: req.user.profile?.education || {},
    projects: req.user.profile?.projects || [],
    resumeRaw: req.user.profile?.resumeRaw || "",
    experience: req.user.profile?.experience || [],
  };

  if (!userProfile.skills.length && !userProfile.resumeRaw) {
    return res.status(400).json({
      message:
        "Your profile is empty. Upload your resume first before analyzing a JD.",
    });
  }

  try {
    // create application document first
    const application = await Application.create({
      userId: req.user._id,
      jobTitle: jobTitle || "Unknown",
      company: company || "Unknown",
      portalUrl: portalUrl || "",
      portalType: portalType || "other",
      jdRaw,
      status: "saved",
      analysisStatus: "processing",
      timeline: [
        { event: "created", detail: "Application created via JD analysis" },
      ],
    });

    // push to queue — returns immediately
    const queueJob = await analysisQueue.add("run-pipeline", {
      userId: req.user._id.toString(),
      applicationId: application._id.toString(),
      jdRaw,
      userProfile,
      socketId: socketId ?? null,
    });

    // return 202 Accepted — processing in background
    return res.status(202).json({
      success: true,
      applicationId: application._id,
      queueJobId: queueJob.id,
      message:
        "Analysis started. Connect to socket with your socketId for real-time progress.",
    });
  } catch (err) {
    console.error("[analyze] failed:", err.message);
    return res.status(500).json({ message: err.message });
  }
};
