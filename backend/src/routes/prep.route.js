import express from "express";
import {
  getPrepSession,
  submitAnswer,
} from "../controllers/prep.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/:applicationId", getPrepSession); // GET  /api/prep/:applicationId
router.post("/:applicationId/answer", submitAnswer); // POST /api/prep/:applicationId/answer

export default router;
