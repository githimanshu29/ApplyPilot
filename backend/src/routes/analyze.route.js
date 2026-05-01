import express from "express";
import { analyzeJD } from "../controllers/analyze.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// POST /api/analyze
// protected — user must be logged in so we have their profile
router.post("/", protect, analyzeJD);

export default router;
