import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    // ── identity
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: String,
    workType: {
      type: String,
      enum: ["remote", "hybrid", "onsite", "unknown"],
      default: "unknown",
    },

    // ── content
    jdRaw: String,
    description: String,
    responsibilities: [String],
    requiredSkills: [String],

    // ── source tracking
    source: {
      type: String,
      enum: ["jsearch", "adzuna", "scraped", "manual", "other"],
      required: true,
    },
    sourceId: String, // original ID from the source API
    url: String, // original job posting URL

    // ── salary
    salaryMin: Number,
    salaryMax: Number,
    salaryCurrency: { type: String, default: "INR" },

    // ── metadata
    postedAt: Date,
    isActive: { type: Boolean, default: true },

    // ranking scores (computed at fetch time)

    // these are fast pre-scores, not the full LangGraph pipeline

    recencyScore: { type: Number, default: 0 }, // 0-1 based on postedAt
    keywordOverlap: { type: Number, default: 0 }, // fast keyword count
    rankScore: { type: Number, default: 0 }, // final ranking score

    // which user this job was fetched/saved for
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
  },
  { timestamps: true },
);

// deduplication index — same job from two sources won't be stored twice
jobSchema.index(
  { title: 1, company: 1, location: 1, userId: 1 },
  { unique: true, sparse: true },
);

export const Job = mongoose.model("Job", jobSchema);
