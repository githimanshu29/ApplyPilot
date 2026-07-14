import { User } from "../models/User.js";
import {
  extractTextFromPDF,
  parseResumeWithAI,
  detectOCRGarbage,
  normalizeSkills,
} from "../services/resumeParser.js";
import { isPDFBuffer } from "../lib/upload.js";
import { checkRateLimit } from "../lib/rateLimiter.js";

// GET /api/profile
export const getProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  return res.status(200).json({ success: true, profile: user.profile });
};

// PUT /api/profile — manual update (keeps existing fields if not provided)
export const updateProfile = async (req, res) => {
  const { skills, education, experience, projects, resumeRaw,
          certifications, achievements, links } = req.body;

  try {
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          ...(skills !== undefined && {
            "profile.skills": normalizeSkills(skills),
          }),
          ...(education !== undefined && { "profile.education": education }),
          ...(experience !== undefined && { "profile.experience": experience }),
          ...(projects !== undefined && { "profile.projects": projects }),
          ...(resumeRaw !== undefined && { "profile.resumeRaw": resumeRaw }),
          ...(certifications !== undefined && {
            "profile.certifications": certifications,
          }),
          ...(achievements !== undefined && {
            "profile.achievements": achievements,
          }),
          ...(links !== undefined && { "profile.links": links }),
        },
      },
      { new: true }
    ).select("-password");

    return res.status(200).json({
      success: true,
      profile: updated.profile,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/profile/upload-resume
// PHASE 1 — parse only, return preview, do NOT save to DB yet
export const uploadResume = async (req, res) => {
  try {
    // rate limit — 5 uploads per hour per user
    const rateCheck = await checkRateLimit(
      req.user._id.toString(),
      "resume_upload",
      5,
      3600
    );

    if (!rateCheck.allowed) {
      return res.status(429).json({
        message: `Too many uploads. Try again in ${Math.ceil(rateCheck.resetIn / 60)} minutes.`,
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No PDF file uploaded" });
    }

    // real file validation — check magic bytes not just MIME
    if (!isPDFBuffer(req.file.buffer)) {
      return res.status(400).json({
        message: "Invalid file. The uploaded file does not appear to be a valid PDF.",
      });
    }

    console.log(
      `[profile] parsing resume — ${req.file.originalname} (${req.file.size} bytes)`
    );

    // extract raw text from PDF
    const resumeRaw = await extractTextFromPDF(req.file.buffer);

    if (!resumeRaw || resumeRaw.trim().length < 50) {
      return res.status(400).json({
        message:
          "Could not extract text from this PDF. It may be scanned or image-based. Please use a text-based PDF.",
      });
    }

    // OCR garbage detection
    if (detectOCRGarbage(resumeRaw)) {
      return res.status(400).json({
        message:
          "The extracted text looks corrupted or garbled. Your PDF may be image-based or use a non-standard encoding. Please try a different file.",
        rawPreview: resumeRaw.slice(0, 200),
      });
    }

    // AI parsing
    const parsed = await parseResumeWithAI(resumeRaw);

    // normalize skills before returning
    const normalizedSkills = normalizeSkills(parsed.skills || []);

    // PHASE 1 — return parsed data for user to review
    // do NOT save to DB yet
    return res.status(200).json({
      success: true,
      message: "Resume parsed successfully. Review the data below and confirm to save.",
      preview: {
        skills: normalizedSkills,
        education: parsed.education || {},
        experience: parsed.experience || [],
        projects: parsed.projects || [],
        certifications: parsed.certifications || [],
        achievements: parsed.achievements || [],
        links: parsed.links || {},
        resumeRaw,
      },
      meta: {
        filename: req.file.originalname,
        size: req.file.size,
        skillsFound: normalizedSkills.length,
        experienceFound: parsed.experience?.length || 0,
        projectsFound: parsed.projects?.length || 0,
        rawTextLength: resumeRaw.length,
      },
    });
  } catch (err) {
    console.error("[profile] uploadResume failed:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/profile/confirm-resume
// PHASE 2 — user reviewed + edited parsed data, now save to DB
export const confirmResume = async (req, res) => {
  const {
    skills,
    education,
    experience,
    projects,
    certifications,
    achievements,
    links,
    resumeRaw,
    meta, // filename, size from phase 1
  } = req.body;

  if (!skills && !resumeRaw) {
    return res.status(400).json({
      message: "No profile data to save. Please upload your resume first.",
    });
  }

  try {
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "profile.skills": normalizeSkills(skills || []),
          "profile.education": education || {},
          "profile.experience": experience || [],
          "profile.projects": projects || [],
          "profile.certifications": certifications || [],
          "profile.achievements": achievements || [],
          "profile.links": links || {},
          "profile.resumeRaw": resumeRaw || "",
          "profile.resumeMeta": {
            filename: meta?.filename || "resume.pdf",
            uploadedAt: new Date(),
            size: meta?.size || 0,
          },
        },
      },
      { new: true }
    ).select("-password");

    console.log(
      `[profile] saved — ${updated.profile.skills?.length} skills, ` +
      `${updated.profile.experience?.length} jobs, ` +
      `${updated.profile.projects?.length} projects`
    );

    return res.status(200).json({
      success: true,
      message: "Profile saved successfully",
      profile: updated.profile,
    });
  } catch (err) {
    console.error("[profile] confirmResume failed:", err.message);
    return res.status(500).json({ message: err.message });
  }
};