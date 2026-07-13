import { User } from "../models/User.js";

// GET /api/profile
export const getProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  return res.status(200).json({ success: true, profile: user.profile });
};

// PUT /api/profile
// user sends their full structured profile — built from resume
export const updateProfile = async (req, res) => {
  const { skills, education, experience, projects, resumeRaw } = req.body;

  try {
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "profile.skills": skills || [],
          "profile.education": education || {},
          "profile.experience": experience || [],
          "profile.projects": projects || [],
          "profile.resumeRaw": resumeRaw || "",
        },
      },
      { new: true },
    ).select("-password");

    return res.status(200).json({
      success: true,
      profile: updated.profile,
      message: "Profile updated successfully",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
