function normalize(text) {
  return text.toLowerCase().trim();
}

function isKeywordPresent(keyword, text) {
  const kw = normalize(keyword);

  // exact substring
  if (text.includes(kw)) return true;

  const words = kw.split(" ");
  if (words.length > 1) {
    return words.every((w) => text.includes(w));
  }

  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}s?\\b`, "i").test(text);
}

export async function atsValidatorNode(state) {
  console.log("[ats_validator] starting...");

  const resumeVersion = state.resumeVersion || {};

  // Unified keyword source (aligned with pipeline)
  const atsKeywords = state.jdAnalysis?.atsKeywords;

  let mustHave = [];
  let goodToHave = [];

  if (Array.isArray(atsKeywords)) {
    // Current parser output
    mustHave = atsKeywords;
  } else {
    // Future parser output
    mustHave = atsKeywords?.mustHave || [];
    goodToHave = atsKeywords?.goodToHave || [];
  }

  const keywordsToCheck = [...new Set([...mustHave, ...goodToHave])]; // to avoid duplication

  // Resume text
  const tailoredText = [
    resumeVersion.resumeJSON?.summary || "",
    ...(resumeVersion.updatedSkills || []),
    ...(resumeVersion.tailoredBullets || []),
    ...(resumeVersion.resumeJSON?.experience?.flatMap((e) => e.bullets || []) ||
      []),
  ]
    .join(" ")
    .toLowerCase(); // by join converted to string and lowerCase also

  const present = [];
  const missing = [];

  //  Keyword validation
  for (const keyword of keywordsToCheck) {
    const kw = keyword.toLowerCase();

    if (isKeywordPresent(kw, tailoredText)) {
      present.push(keyword);
    } else {
      missing.push({
        keyword,
        priority: mustHave.includes(keyword) ? "high" : "medium",
      });
    }
  }

  //  Score calculation
  // if there are no keywords to check, the resume passes by default
  // this happens when jd_parser found no ats keywords — not the user's fault
  if (keywordsToCheck.length === 0) {
    return {
      resumeVersion: {
        ...resumeVersion,
        atsScore: state.atsCoverageScore ?? 0,
      },
      presentKeywords: [],
      missingKeywords: [],
      currentNode: "ats_validator",
    };
  }

  const total = keywordsToCheck.length;

  const coverage = present.length / total;
  const atsScore = Math.round(coverage * 100);

  const retryCount = (state.atsRetryCount || 0) + 1;

  console.log(
    `[ats_validator] score: ${atsScore}% — ${present.length}/${total} keywords matched — retry #${retryCount}`,
  );

  return {
    resumeVersion: {
      ...resumeVersion,
      atsScore,
    },
    presentKeywords: present,
    missingKeywords: missing,
    atsRetryCount: retryCount,
    currentNode: "ats_validator",
  };
}

export function shouldContinueAfterValidation(state) {
  const atsScore = state.resumeVersion?.atsScore ?? 0;
  const retryCount = state.atsRetryCount || 0;

  console.log("========== ATS VALIDATOR ==========");
  console.log("ATS Score:", atsScore);
  console.log("Retry Count:", retryCount);
  console.log("Present:", state.presentKeywords?.length);
  console.log("Missing:", state.missingKeywords?.length);
  console.log("===================================");

  if (!state.missingKeywords?.length && !state.presentKeywords?.length) {
    console.log("[ats_validator] No keyword optimization possible.");
    return "pdf_builder";
  }

  if (retryCount >= 1) {
    console.log("[ats_validator] Maximum retries reached.");
    return "pdf_builder";
  }

  if (atsScore >= 80) {
    console.log("[ats_validator] ATS target achieved.");
    return "pdf_builder";
  }

  console.log("[ats_validator] Retrying keyword injection.");
  return "kw_injector";
}
