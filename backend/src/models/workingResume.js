import mongoose from "mongoose";
import { string } from "zod";

const workingResumeSchema = new mongoose.Schema(
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
        year: String,
      },
    },

    // diff tracking — what changed vs original
    originalBullets: [String],
    tailoredBullets: [String],
    tailoredExperienceBullets: [
      {
        company: String,
        role: String,
        bullets: [String],
        _id: false,
      },
    ],
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

    // recruiter simulation — computed by crm_logger after all pipeline outputs exist
    // owned by workingResumebecause recruiters react to the tailored resume, not the raw JD
    recruiterSimulation: {
      wouldShortlist: Boolean,
      confidence: { type: Number, min: 0, max: 100 },
      strengths: [String],
      weaknesses: [String],
      hiringRisks: [String],
      likelyQuestions: [String],
      interviewProbability: { type: Number, min: 0, max: 100 },
      reasoning: String,
    },

    // PDF generated on demand from resumeJSON
    pdfUrl: String,

    //kya resume k lie kahi se call ayi hai
    gotCallback: { type: Boolean, default: null },
  },
  { timestamps: true },
);

export const workingResume = mongoose.model(
  "workingResume",
  workingResumeSchema,
);
