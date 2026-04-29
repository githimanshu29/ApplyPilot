function normalize(text) {
  return text.toLowerCase().trim();
}

function isSkillMatch(skill, presentSet) {
  const sl = normalize(skill);

  return Array.from(presentSet).some((k) => {
    const pk = normalize(k);

    // exact
    if (pk === sl) return true;

    // word-level match
    const words = sl.split(" ");
    if (words.length > 1) {
      return words.every((w) => pk.includes(w));
    }

    // partial (safe)
    return pk.includes(sl) || sl.includes(pk);
  });
}

export async function gapAnalyzerNode(state) {
  console.log("[gap_analyzer] starting...");

  try {
    //hamare inputs
    const requiredSkills = state.jdAnalysis.requiredSkills || [];
    const niceToHave = state.jdAnalysis.niceToHave || [];
    const presentKeywords = state.presentKeywords || [];
    const missingKeywords = state.missingKeywords || [];
    const fitDetails = state.fitDetails || {};
    //inputs ends

    const presentSet = new Set(presentKeywords.map((k) => normalize(k))); // k yaha par text hai

    const gapAnalysis = [];

    // REQUIRED
    for (const skill of requiredSkills) {
      const present = isSkillMatch(skill, presentSet);

      let severity = "none";

      if (!present) {
        severity = "high";

        // semantic adjustment
        if (fitDetails.skillsSim > 0.7) {
          severity = "medium"; // semantic says you're close
        }
      }

      gapAnalysis.push({
        skill,
        present,
        severity,
        type: "required",
      });
    }

    //
    for (const skill of niceToHave) {
      const present = isSkillMatch(skill, presentSet);

      let severity = "none";

      if (!present) {
        severity = "low";

        if (fitDetails.skillsSim < 0.5) {
          severity = "medium"; // weak overall → optional matters more
        }
      }

      gapAnalysis.push({
        skill,
        present,
        severity,
        type: "optional",
      });
    }

    // ---------- PRIORITY ----------
    const tailorPriority = [
      ...gapAnalysis
        .filter((g) => !g.present && g.type === "required") //filtering kar raha hai jo skill required but present nhi hai
        .map((g) => g.skill), // converting object to string inside a array like:["Docker"]

      ...missingKeywords.map((k) => k.keyword || k),
    ];

    // ---------- INSIGHTS ----------
    const gapInsights = [];

    if (fitDetails.skillsSim < 0.5) {
      gapInsights.push("Weak alignment in core skills");
    } else if (fitDetails.skillsSim > 0.75) {
      gapInsights.push("Strong core skill alignment");
    }

    if (fitDetails.expSim < 0.5) {
      gapInsights.push("Experience does not strongly match job requirements");
    }

    if (fitDetails.projSim < 0.5) {
      gapInsights.push("Projects are not strongly aligned with the role");
    }

    const criticalMissing = gapAnalysis
      .filter((g) => !g.present && g.severity === "high")
      .slice(0, 3)
      .map((g) => g.skill);

    if (criticalMissing.length > 0) {
      gapInsights.push(
        `Missing critical skills: ${criticalMissing.join(", ")}`,
      );
    }

    const strongAreas = presentKeywords.slice(0, 3);
    if (strongAreas.length > 0) {
      gapInsights.push(`Strong areas include: ${strongAreas.join(", ")}`);
    }

    console.log(
      `[gap_analyzer] ${
        gapAnalysis.filter((g) => !g.present).length
      } gaps, ${tailorPriority.length} prioritized`,
    );

    return {
      gapAnalysis,
      tailorPriority,
      gapInsights,
      currentNode: "gap_analyzer",
    };
  } catch (err) {
    console.error("[gap_analyzer] failed:", err.message);

    return {
      gapAnalysis: [],
      tailorPriority: [],
      gapInsights: [],
      errors: [{ node: "gap_analyzer", message: err.message }],
    };
  }
}
