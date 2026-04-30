import mongoose from "mongoose";

const resumeVersionSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    versionNumber: { type: Number, default: 1 },

    // source of truth ye structured data hai for resume
    resumeJSON: {
      summary: String,
      skills: [String],
      experience: [
        {
          company: String,
          role: String,
          duration: String,
          bullets: [String],
          _id: false,
        },
      ],
      projects: [
        {
          name: String,
          techStack: [String],
          bullets: [String],
          _id: false,
        },
      ],
      education: {
        degree: String,
        branch: String,
        college: String,
        cgpa: Number,
        year: Number,
      },
    },

    // diff tracking — what changed vs original
    originalBullets: [String],
    tailoredBullets: [String],
    updatedSkills: [String],
    injectedKeywords: [String],

    // scores
    atsScore: { type: Number, min: 0, max: 100 },
    qualityScore: { type: Number, min: 0, max: 1 },

    // template chosen by user — LaTeX templates come in Phase 3
    templateId: { type: String, default: "classic" },

    // honest gap report when score can't reach 80 honestly
    honestGapReport: {
      bestAchievableScore: Number,
      trulyMissingSkills: [String],
      explanation: String,
    },

    // PDF generated on demand from resumeJSON
    pdfUrl: String,

    //kya resume k lie kahi se call ayi hai
    gotCallback: { type: Boolean, default: null },
  },
  { timestamps: true },
);

export const ResumeVersion = mongoose.model(
  "ResumeVersion",
  resumeVersionSchema,
);
