import mongoose from "mongoose";

const timelineEventSchema = new mongoose.Schema(
  {
    event: String,
    detail: String,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const applicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    jobTitle: { type: String, required: true },
    company: { type: String, required: true },
    portalUrl: String,
    portalType: {
      type: String,
      enum: ["naukri", "linkedin", "internshala", "other"],
      default: "other",
    },

    //for dashboard updates
    status: {
      type: String,
      enum: ["saved", "applied", "screening", "interview", "offer", "rejected"],
      default: "saved",
    },

    // raw JD stored here so we can re-run analysis anytime
    jdRaw: String,

    jdAnalysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JDAnalysis",
    },
    resumeVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResumeVersion",
    },

    // full event history — shown as timeline on application detail page
    timeline: [timelineEventSchema],

    appliedAt: Date,
    followUpJobId: String,
  },
  { timestamps: true },
);

export const Application = mongoose.model("Application", applicationSchema);
