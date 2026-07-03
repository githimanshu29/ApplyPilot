import axios from "axios";

const BASE_URL = "https://api.adzuna.com/v1/api/jobs/in/search"; // "in" = India

function normalizeAdzunaJob(job) {
  return {
    title: job.title || "",
    company: job.company?.display_name || "",
    location: job.location?.display_name || "",
    workType: "unknown",
    jdRaw: job.description || "",
    description: job.description || "",
    requiredSkills: [],
    source: "adzuna",
    sourceId: job.id,
    url: job.redirect_url || "",
    salaryMin: job.salary_min || null,
    salaryMax: job.salary_max || null,
    salaryCurrency: "INR",
    postedAt: job.created ? new Date(job.created) : new Date(),
  };
}

export async function fetchAdzunaJobs(query, page = 1) {
  try {
    const response = await axios.get(`${BASE_URL}/${page}`, {
      params: {
        app_id: process.env.ADZUNA_APP_ID,
        app_key: process.env.ADZUNA_APP_KEY,
        what: query,
        where: "india",
        results_per_page: 20,
        sort_by: "date",
        max_days_old: 30,
      },
      timeout: 10000,
    });

    const jobs = (response.data?.results || []).map(normalizeAdzunaJob);
    console.log(`[adzuna] fetched ${jobs.length} jobs for "${query}"`);
    return jobs;
  } catch (err) {
    console.error("[adzuna] failed:", err.message);
    return [];
  }
}
