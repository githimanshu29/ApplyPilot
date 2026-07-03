import axios from "axios";

const BASE_URL = "https://jsearch.p.rapidapi.com/search";

const headers = {
  "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
  "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
};

function normalizeJSearchJob(job) {
  return {
    title: job.job_title || "",
    company: job.employer_name || "",
    location: job.job_city
      ? `${job.job_city}, ${job.job_country || ""}`
      : job.job_country || "",
    workType: job.job_is_remote ? "remote" : "onsite",
    jdRaw: job.job_description || "",
    description: job.job_description || "",
    requiredSkills: job.job_required_skills || [],
    source: "jsearch",
    sourceId: job.job_id,
    url: job.job_apply_link || job.job_google_link || "",
    salaryMin: job.job_min_salary || null,
    salaryMax: job.job_max_salary || null,
    salaryCurrency: job.job_salary_currency || "INR",
    postedAt: job.job_posted_at_datetime_utc
      ? new Date(job.job_posted_at_datetime_utc)
      : new Date(),
  };
}

export async function fetchJSearchJobs(
  query,
  location = "India",
  numPages = 2,
) {
  const jobs = [];

  try {
    for (let page = 1; page <= numPages; page++) {
      const response = await axios.get(BASE_URL, {
        headers,
        params: {
          query: `${query} ${location}`,
          page,
          num_pages: 1,
          date_posted: "month",
          employment_types: "FULLTIME,PARTTIME,INTERN",
          remote_jobs_only: false,
        },
        timeout: 10000,
      });

      const data = response.data?.data || [];
      jobs.push(...data.map(normalizeJSearchJob));
    }

    console.log(`[jsearch] fetched ${jobs.length} jobs for "${query}"`);
    return jobs;
  } catch (err) {
    console.error("[jsearch] failed:", err.message);
    return []; // return empty — don't crash if API is down
  }
}
