import bcrypt from "bcryptjs";
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

    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },

    refreshToken: {
      type: String,
      default: "",
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

userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export const User = mongoose.model("User", userSchema);
