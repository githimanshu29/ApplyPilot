import express from "express";
import {
  getProfile,
  updateProfile,
  uploadResume,
  confirmResume,
} from "../controllers/profile.controller.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../lib/upload.js";

const router = express.Router();

router.get("/", protect, getProfile);
router.put("/", protect, updateProfile);

// phase 1 — upload PDF → get parsed preview
router.post("/upload-resume", protect, upload.single("resume"), uploadResume);

// phase 2 — user confirms (possibly edited) parsed data → save to DB
router.post("/confirm-resume", protect, confirmResume);

export default router;
