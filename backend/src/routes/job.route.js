import express from "express";
import {
  discoverJobs,
  scrapeJob,
  saveJob,
  optimizeJob,
  getSavedJobs,
} from "../controllers/job.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// all job routes require auth
router.use(protect);

router.get("/discover", discoverJobs); // GET  /api/jobs/discover?query=backend&location=India

router.get("/", getSavedJobs); // GET  /api/jobs

router.post("/scrape", scrapeJob); // POST /api/jobs/scrape  { url }

router.post("/save", saveJob); // POST /api/jobs/save    { title, company, jdRaw, url }

router.post("/:jobId/optimize", optimizeJob); // POST /api/jobs/:id/optimize { socketId }

export default router;
