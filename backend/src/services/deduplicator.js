import { Job } from "../models/Job.js";

/**
 * deduplicateJobs
 *
 * Takes an array of normalized job objects, removes in-memory duplicates,
 * then checks against DB for jobs already stored for this user.
 * Returns only the jobs that are genuinely new.
 */
export async function deduplicateJobs(jobs, userId) {
  // step 1 — in-memory deduplication
  // key = title + company + location (lowercased)
  const seen = new Map();

  const uniqueInBatch = jobs.filter((job) => {
    const key = `${job.title}__${job.company}__${job.location}`
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });

  // step 2 — DB deduplication
  // build query to find any of these jobs already stored for this user
  const queries = uniqueInBatch.map((job) => ({
    userId,
    title: { $regex: new RegExp(escapeRegex(job.title), "i") },
    company: { $regex: new RegExp(escapeRegex(job.company), "i") },
  }));

  if (!queries.length) return [];

  const existing = await Job.find({ $or: queries }).select("title company");

  const existingKeys = new Set(
    existing.map((j) =>
      `${j.title}__${j.company}`.toLowerCase().replace(/\s+/g, " "),
    ),
  );

  const newJobs = uniqueInBatch.filter((job) => {
    const key = `${job.title}__${job.company}`
      .toLowerCase()
      .replace(/\s+/g, " ");
    return !existingKeys.has(key);
  });

  console.log(
    `[deduplicator] ${jobs.length} in → ${uniqueInBatch.length} unique → ${newJobs.length} new`,
  );

  return newJobs;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
