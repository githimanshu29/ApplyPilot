/**
 * Ranking Engine
 *
 * Fast pre-scoring — runs at job fetch time, not pipeline time.
 * Formula: 0.6 * keywordOverlap + 0.4 * recencyScore
 *
 * keywordOverlap = how many of user's skills appear in the JD
 * recencyScore   = how recent the job is (1.0 = today, 0.0 = 30+ days ago)
 *
 * We deliberately do NOT run fitScorer (embeddings) here — that costs
 * API calls per job. Save it for when user actually selects a job.
 */

function computeRecencyScore(postedAt) {
  if (!postedAt) return 0.5; // unknown date = neutral

  const now = Date.now();
  const ageMs = now - new Date(postedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 1) return 1.0;
  if (ageDays <= 3) return 0.9;
  if (ageDays <= 7) return 0.75;
  if (ageDays <= 14) return 0.5;
  if (ageDays <= 30) return 0.25;
  return 0.1;
}

function computeKeywordOverlap(job, userSkills) {
  if (!userSkills?.length || !job.jdRaw) return 0;

  const jdLower = job.jdRaw.toLowerCase();
  const matched = userSkills.filter((skill) =>
    jdLower.includes(skill.toLowerCase()),
  );

  return matched.length / userSkills.length;
}

/**
 * rankJobs
 * @param {Array} jobs - normalized job objects
 * @param {Array} userSkills - user's skills array
 * @returns {Array} jobs sorted by rankScore descending
 */
export function rankJobs(jobs, userSkills = []) {
  const scored = jobs.map((job) => {
    const recencyScore = computeRecencyScore(job.postedAt);
    const keywordOverlap = computeKeywordOverlap(job, userSkills);

    // weighted formula — recency matters but skill overlap matters more
    const rankScore = Math.round(
      (0.6 * keywordOverlap + 0.4 * recencyScore) * 100,
    );

    return {
      ...job,
      recencyScore,
      keywordOverlap,
      rankScore,
    };
  });

  // sort descending by rankScore
  return scored.sort((a, b) => b.rankScore - a.rankScore);
}
