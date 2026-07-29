import { Application } from "../models/Application.js";
import { JDAnalysis } from "../models/JDAnalysis.js";
import { ResumeVersion } from "../models/ResumeVersion.js";
import { PrepSession } from "../models/PrepSession.js";

// GET /api/applications
// returns all applications for logged in user — grouped by status for kanban
export const getApplications = async (req, res) => {
  try {
    const { status, sort = "createdAt", order = "desc" } = req.query;

    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "jobTitle",
      "company",
      "status",
      "appliedAt",
    ];

    const sortField = allowedSortFields.includes(sort) ? sort : "createdAt";

    const filter = { userId: req.user._id, isDeleted: { $ne: true } };
    if (status) filter.status = status;

    const applications = await Application.find(filter)
      .sort({ [sortField]: order === "asc" ? 1 : -1 })
      .select("-jdRaw") // exclude raw JD from list — too heavy
      .lean();

    // group by status for kanban board
    const kanban = {
      saved: [],
      applied: [],
      screening: [],
      interview: [],
      offer: [],
      rejected: [],
    };

    for (const app of applications) {
      if (kanban[app.status]) {
        kanban[app.status].push(app);
      }
    }

    return res.status(200).json({
      success: true,
      total: applications.length,
      kanban,
      applications, // also return flat list for other views
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/applications/:id
// full application detail — includes jd analysis + resume version
export const getApplicationById = async (req, res) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      userId: req.user._id, // ensure user owns this application
      isDeleted: { $ne: true },
    }).lean();

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // fetch related documents in parallel
    const [jdAnalysis, resumeVersion, prepSession] = await Promise.all([
      application.jdAnalysisId
        ? JDAnalysis.findById(application.jdAnalysisId).lean()
        : null,
      application.resumeVersionId
        ? ResumeVersion.findById(application.resumeVersionId).lean()
        : null,
      PrepSession.findOne({ applicationId: application._id }).lean(),
    ]);

    console.log("========== JD ANALYSIS ==========");
    console.log("Present:", jdAnalysis?.presentKeywords);
    console.log("Missing:", jdAnalysis?.missingKeywords);
    console.log("ATS Keywords:", jdAnalysis?.atsKeywords);
    console.log("===============================");
    return res.status(200).json({
      success: true,
      application,
      jdAnalysis,
      resumeVersion,
      prepSession,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// PATCH /api/applications/:id/status
// moves application to a new kanban column
export const updateStatus = async (req, res) => {
  const { status } = req.body;

  const validStatuses = [
    "saved",
    "applied",
    "screening",
    "interview",
    "offer",
    "rejected",
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    });
  }

  try {
    const application = await Application.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isDeleted: { $ne: true },
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const previousStatus = application.status;

    application.status = status;

    // auto-set appliedAt timestamp when moved to applied
    if (status === "applied" && !application.appliedAt) {
      application.appliedAt = new Date();
    }

    // add timeline event
    application.timeline.push({
      event: "status_changed",
      detail: `${previousStatus} → ${status}`,
      timestamp: new Date(),
    });

    await application.save();

    return res.status(200).json({
      success: true,
      application,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// PATCH /api/applications/:id
// update editable fields — notes, portal URL etc.
export const updateApplication = async (req, res) => {
  const allowedFields = ["portalUrl", "portalType", "notes"];
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: "No valid fields to update" });
  }

  try {
    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, isDeleted: { $ne: true } },

      { $set: updates },
      { new: true },
    );

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    return res.status(200).json({ success: true, application });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// DELETE /api/applications/:id
// soft delete — marks as deleted, doesn't remove from DB
// keeps data for analytics later
export const deleteApplication = async (req, res) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isDeleted: { $ne: true },
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // soft delete — add timeline event and mark inactive
    application.isDeleted = true;
    application.timeline.push({
      event: "deleted",
      detail: "Application removed from board",
      timestamp: new Date(),
    });

    await application.save();

    return res.status(200).json({
      success: true,
      message: "Application removed from your board",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/applications/stats
// dashboard numbers — total, by status, avg fit score
export const getStats = async (req, res) => {
  try {
    const applications = await Application.find({
      userId: req.user._id,
      isDeleted: { $ne: true },
    }).lean();

    const stats = {
      total: applications.length,
      byStatus: {
        saved: 0,
        applied: 0,
        screening: 0,
        interview: 0,
        offer: 0,
        rejected: 0,
      },
    };

    for (const app of applications) {
      if (stats.byStatus[app.status] !== undefined) {
        stats.byStatus[app.status]++;
      }
    }

    // response rate = (screening + interview + offer) / applied
    const responded =
      stats.byStatus.screening +
      stats.byStatus.interview +
      stats.byStatus.offer;

    stats.responseRate =
      stats.byStatus.applied > 0
        ? Math.round((responded / stats.byStatus.applied) * 100)
        : 0;

    return res.status(200).json({ success: true, stats });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
