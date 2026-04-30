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
  const gapPriority = (state.tailorPriority || []).map((k) =>
    typeof k === "string" ? k : k.keyword,
  );

  const atsMissing = (state.missingKeywords || []).map((k) =>
    typeof k === "string" ? k : k.keyword,
  );

  const keywordsToCheck = [...new Set([...gapPriority, ...atsMissing])]; // to avoid duplication

  // Resume text
  const tailoredText = [
    resumeVersion.summary || "",
    (resumeVersion.updatedSkills || []).join(" "),
    (resumeVersion.tailoredBullets || []).join(" "),
    state.userProfile?.resumeRaw || "",
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
        priority: gapPriority.includes(keyword) ? "high" : "medium",
      });
    }
  }

  //  Score calculation
  const total = keywordsToCheck.length || 1;
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
    missingKeywords: missing,
    atsRetryCount: retryCount,
    currentNode: "ats_validator",
  };
}

export function shouldContinueAfterValidation(state) {
  const atsScore = state.resumeVersion?.atsScore ?? 0;
  const retryCount = state.atsRetryCount || 0;

  if (atsScore >= 80 || retryCount >= 4) {
    console.log(
      `[ats_validator] score ${atsScore} — proceeding to pdf_builder`,
    );
    return "pdf_builder";
  }

  console.log(`[ats_validator] score ${atsScore} < 80 — looping back`);
  return "kw_injector";
}
