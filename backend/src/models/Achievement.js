import mongoose from "mongoose";

const achievementSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // what kind of achievement this is
    category: {
      type: String,
      enum: [
        "hackathon",
        "award",
        "scholarship",
        "leadership",
        "research",
        "volunteer",
        "opensource",
        "competitive_programming",
        "publication",
        "other",
      ],
      required: true,
    },

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    year: { type: Number },

    // org that gave it — college, company, platform
    issuedBy: { type: String, trim: true },

    // verifiable proof — certificate URL, devpost link, GitHub PR, etc.
    proofUrl: { type: String, trim: true },

    // what impact did this have — "ranked top 3 among 200 teams"
    impact: { type: String, trim: true },

    // skills this achievement demonstrates — used by pipeline for evidence mapping
    relatedSkills: [String],

    // shown on resume or not
    showOnResume: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Achievement = mongoose.model("Achievement", achievementSchema);
