import express from "express";
import {
  getApplications,
  getApplicationById,
  updateStatus,
  updateApplication,
  deleteApplication,
  getStats,
} from "../controllers/application.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/stats", getStats);                          // GET  /api/applications/stats
router.get("/", getApplications);                        // GET  /api/applications
router.get("/:id", getApplicationById);                  // GET  /api/applications/:id
router.patch("/:id/status", updateStatus);               // PATCH /api/applications/:id/status
router.patch("/:id", updateApplication);                 // PATCH /api/applications/:id
router.delete("/:id", deleteApplication);                // DELETE /api/applications/:id

export default router;