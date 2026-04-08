import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    // structured profile — built from uploaded resume later
    profile: {
      skills: [String],
      resumeRaw: String,
      education: {
        degree: String,
        branch: String,
        college: String,
        cgpa: Number,
        graduationYear: Number,
      },
      projects: [
        {
          name: String,
          description: String,
          techStack: [String],
          bullets: [String],
        },
      ],
      experience: [
        {
          company: String,
          role: String,
          duration: String,
          bullets: [String],
        },
      ],
    },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
