import { fetchJSearchJobs } from "../services/jsearch.js";
import { fetchAdzunaJobs } from "../services/adzuna.js";
import { scrapeJobFromUrl } from "../services/scrapper.js";
import { normalizeJob } from "../services/jobNormalizer.js";
import { deduplicateJobs } from "../services/deduplicator.js";
import { rankJobs } from "../services/rankingEngine.js";
import { Job } from "../models/Job.js";
import { analysisQueue } from "../jobs/queues.js";
import { Application } from "../models/Application.js";

// GET /api/jobs/discover
// fetches + ranks jobs from all sources based on user profile
export const discoverJobs = async (req, res) => {
  const { query, location = "India" } = req.query;
  const userSkills = req.user.profile?.skills || [];

  const searchQuery =
    query ||
    (userSkills.length > 0
      ? userSkills.slice(0, 3).join(" ")
      : "software engineer");

  try {
    // fetch from both sources in parallel
    const [jsearchJobs, adzunaJobs] = await Promise.allSettled([
      fetchJSearchJobs(searchQuery, location),
      fetchAdzunaJobs(searchQuery),
    ]);

    const rawJobs = [
      ...(jsearchJobs.status === "fulfilled" ? jsearchJobs.value : []),
      ...(adzunaJobs.status === "fulfilled" ? adzunaJobs.value : []),
    ];

    // normalize → deduplicate → rank
    const normalized = rawJobs.map((job) => normalizeJob(job, req.user._id));

    const unique = await deduplicateJobs(normalized, req.user._id);
    const ranked = rankJobs(unique, userSkills);

    // save top 20 to DB
    const top20 = ranked.slice(0, 20);

    if (top20.length > 0) {
      await Job.insertMany(top20, { ordered: false }).catch((err) => {
        // ignore duplicate key errors — deduplicator catches most but not all
        if (err.code !== 11000) throw err;
      });
    }

    return res.status(200).json({
      success: true,
      count: top20.length,
      jobs: top20,
    });
  } catch (err) {
    console.error("[job.controller] discoverJobs failed:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/jobs/scrape
// user pastes a URL — system tries to extract JD
export const scrapeJob = async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ message: "URL is required" });
  }

  const result = await scrapeJobFromUrl(url);

  if (!result.success) {
    return res.status(200).json({
      success: false,
      requiresManualPaste: true,
      message:
        "Could not extract job description from this URL. Please paste the JD manually.",
      url,
    });
  }

  return res.status(200).json({
    success: true,
    jdRaw: result.jdRaw,
    title: result.title,
    company: result.company,
    url: result.url,
    message: "JD extracted successfully. Review and confirm before analyzing.",
  });
};

// POST /api/jobs/save
// saves a job to user's board (does NOT trigger pipeline yet)
export const saveJob = async (req, res) => {
  const { title, company, jdRaw, url, source = "manual" } = req.body;

  if (!title || !jdRaw) {
    return res.status(400).json({ message: "title and jdRaw are required" });
  }

  try {
    const normalized = normalizeJob(
      { title, company, jdRaw, url, source },
      req.user._id,
    );

    const job = await Job.create(normalized);

    return res.status(201).json({
      success: true,
      job,
      message:
        "Job saved to your board. Click Optimize to run the AI pipeline.",
    });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: "This job is already on your board." });
    }
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/jobs/:jobId/optimize
// triggers the full LangGraph pipeline as a background BullMQ job
export const optimizeJob = async (req, res) => {
  const { jobId } = req.params;
  const { socketId } = req.body || {}; // frontend sends its socket ID for progress events

  try {
    const job = await Job.findOne({ _id: jobId, userId: req.user._id });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (!job.jdRaw) {
      return res.status(400).json({
        message: "This job has no JD. Please add the job description first.",
      });
    }

    // create application document
    const application = await Application.create({
      userId: req.user._id,
      jobTitle: job.title,
      company: job.company,
      portalUrl: job.url || "",
      jdRaw: job.jdRaw,
      status: "saved",
      timeline: [
        { event: "created", detail: "Application created from job board" },
      ],
    });

    // build user profile from stored data
    const userProfile = {
      skills: req.user.profile?.skills || [],
      bullets:
        req.user.profile?.experience?.flatMap((e) => e.bullets || []) || [],
      education: req.user.profile?.education || {},
      projects: req.user.profile?.projects || [],
      resumeRaw: req.user.profile?.resumeRaw || "",
      experience: req.user.profile?.experience || [],
    };

    // push to BullMQ queue — returns immediately, pipeline runs in background
    const queueJob = await analysisQueue.add("run-pipeline", {
      userId: req.user._id.toString(),
      applicationId: application._id.toString(),
      jdRaw: job.jdRaw,
      userProfile,
      socketId: socketId || null,
    });

    return res.status(202).json({
      success: true,
      applicationId: application._id,
      jobId: queueJob.id,
      message:
        "Pipeline started. Connect to socket for real-time progress updates.",
    });
  } catch (err) {
    console.error("[job.controller] optimizeJob failed:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/jobs
// returns saved jobs for the user, sorted by rankScore
export const getSavedJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.user._id })
      .sort({ rankScore: -1, createdAt: -1 })
      .limit(50);

    return res.status(200).json({ success: true, jobs });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
