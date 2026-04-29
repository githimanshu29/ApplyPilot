function isKeywordPresent(keyword, text) {
  if (text.includes(keyword)) return true;

  const words = keyword.split(" ");
  if (words.length > 1) {
    return words.every((w) => text.includes(w));
  }

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}s?\\b`, "i").test(text);
}

export async function atsValidatorNode(state) {
  console.log("[ats_validator] starting...");

  const mustHave = state.jdAnalysis.atsKeywords?.mustHave || [];
  const goodToHave = state.jdAnalysis.atsKeywords?.goodToHave || [];

  const { tailoredBullets, updatedSkills, injectedKeywords, summary } =
    state.resumeVersion;

  const tailoredText = [
    summary || "",
    (updatedSkills || []).join(" "),
    (injectedKeywords || []).join(" "),
    (tailoredBullets || []).join(" "),
    state.userProfile.resumeRaw || "",
  ]
    .join(" ")
    .toLowerCase();

  const present = [];
  const missing = [];

  // -------- MUST HAVE --------
  for (const keyword of mustHave) {
    const kw = keyword.toLowerCase();

    if (isKeywordPresent(kw, tailoredText)) {
      present.push(keyword);
    } else {
      missing.push({ keyword, priority: "high" });
    }
  }

  // -------- GOOD TO HAVE --------
  for (const keyword of goodToHave) {
    const kw = keyword.toLowerCase();

    if (isKeywordPresent(kw, tailoredText)) {
      present.push(keyword);
    } else {
      missing.push({ keyword, priority: "medium" });
    }
  }

  // -------- WEIGHTED SCORE --------
  const mustScore =
    mustHave.length === 0
      ? 1
      : present.filter((k) => mustHave.includes(k)).length / mustHave.length;

  const goodScore =
    goodToHave.length === 0
      ? 0
      : present.filter((k) => goodToHave.includes(k)).length /
        goodToHave.length;

  const atsScore = Math.round((0.7 * mustScore + 0.3 * goodScore) * 100);

  const retryCount = (state.atsRetryCount || 0) + 1;

  console.log(
    `[ats_validator] score: ${atsScore} (must: ${mustScore.toFixed(
      2,
    )}, good: ${goodScore.toFixed(2)}) — retry #${retryCount}`,
  );

  return {
    resumeVersion: {
      ...state.resumeVersion,
      atsScore,
    },
    missingKeywords: missing,
    atsRetryCount: retryCount,
    currentNode: "ats_validator",
  };
}

export function shouldContinueAfterValidation(state) {
  const { atsScore } = state.resumeVersion;
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
