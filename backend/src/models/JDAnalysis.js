import mongoose from "mongoose";

const gapItemSchema = new mongoose.Schema(
  {
    skill: String,
    present: Boolean,
    severity: { type: String, enum: ["none", "low", "medium", "high"] },
    type: { type: String, enum: ["required", "optional"] },
  },
  { _id: false },
);

const jdAnalysisSchema = new mongoose.Schema(
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

    rawJd: { type: String, required: true },

    // structured output from jd_parser
    jobTitle: String,
    company: String,
    roleDomain: String,
    seniorityLevel: String,
    experienceYears: {
      min: Number,
      max: Number,
    },
    requiredSkills: [String],
    niceToHave: [String],
    tools: [String],
    responsibilities: [String],

    // split into mustHave and goodToHave — matches your jdParser schema
    atsKeywords: {
      mustHave: [String],
      goodToHave: [String],
    },

    redFlags: [String],
    salaryHints: String,
    location: String,
    workType: String,

    // fit_scorer output
    fitScore: { type: Number, min: 0, max: 100 },
    fitDetails: {
      semanticScore: Number,
      keywordScore: Number,
      skillsSim: Number,
      expSim: Number,
      projSim: Number,
      presentKeywords: [String],
      missingKeywords: [String],
      reasons: [String],
    },

    // ats_scanner output
    atsCoverageScore: { type: Number, min: 0, max: 100 },
    presentKeywords: [String],

    // missingKeywords are objects with priority
    missingKeywords: [
      {
        keyword: String,
        priority: { type: String, enum: ["high", "medium", "low"] },
        _id: false,
      },
    ],

    atsDetails: {
      mustScore: Number,
      goodScore: Number,
      reasons: [String],
    },

    // gap_analyzer output
    gapAnalysis: [gapItemSchema],
    tailorPriority: [String],
    gapInsights: [String],
  },
  { timestamps: true },
);

export const JDAnalysis = mongoose.model("JDAnalysis", jdAnalysisSchema);
