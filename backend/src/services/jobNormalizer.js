/**
 * normalizeJob
 *
 * Takes a raw job object from any source and ensures it matches
 * the Job model schema exactly. Fills in safe defaults for missing fields.
 */
export function normalizeJob(raw, userId) {
  return {
    title: clean(raw.title) || "Unknown Role",
    company: clean(raw.company) || "Unknown Company",
    location: clean(raw.location) || "",
    workType: normalizeWorkType(raw.workType),
    jdRaw: clean(raw.jdRaw || raw.description) || "",
    description: clean(raw.description || raw.jdRaw) || "",
    responsibilities: Array.isArray(raw.responsibilities)
      ? raw.responsibilities.filter(Boolean)
      : [],
    requiredSkills: Array.isArray(raw.requiredSkills)
      ? raw.requiredSkills.filter(Boolean)
      : [],
    source: raw.source || "other",
    sourceId: raw.sourceId || null,
    url: raw.url || "",
    salaryMin: raw.salaryMin || null,
    salaryMax: raw.salaryMax || null,
    salaryCurrency: raw.salaryCurrency || "INR",
    postedAt: raw.postedAt instanceof Date ? raw.postedAt : new Date(),
    isActive: true,
    userId,
  };
}

function clean(str) {
  if (!str || typeof str !== "string") return "";
  return str.replace(/\s+/g, " ").trim();
}

function normalizeWorkType(value) {
  if (!value) return "unknown";
  const v = value.toLowerCase();
  if (v.includes("remote")) return "remote";
  if (v.includes("hybrid")) return "hybrid";
  if (v.includes("onsite") || v.includes("office") || v.includes("in-person"))
    return "onsite";
  return "unknown";
}
