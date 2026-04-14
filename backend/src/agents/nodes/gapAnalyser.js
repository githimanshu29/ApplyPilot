export async function gapAnalyzerNode(state) {
  console.log("[gap_analyzer] starting...");

  try {
    const requiredSkills = state.jdAnalysis.requiredSkills || [];
    const niceToHave = state.jdAnalysis.niceToHave || [];

    const presentKeywords = state.presentKeywords || [];
    const missingKeywords = state.missingKeywords || [];

    const fitDetails = state.fitDetails || {};

    const presentSet = new Set(presentKeywords.map((k) => k.toLowerCase()));

    const gapAnalysis = [];

    // REQUIRED SKILLS
    for (const skill of requiredSkills) {
      const sl = skill.toLowerCase();

      const present = Array.from(presentSet).some(
        (k) => k.includes(sl) || sl.includes(k),
      );

      gapAnalysis.push({
        skill,
        present,
        severity: present ? "none" : "high",
        type: "required",
      });
    }

    // NICE TO HAVE
    for (const skill of niceToHave) {
      const sl = skill.toLowerCase();

      const present = Array.from(presentSet).some(
        (k) => k.includes(sl) || sl.includes(k),
      );

      gapAnalysis.push({
        skill,
        present,
        severity: present ? "none" : "medium",
        type: "optional",
      });
    }

    // PRIORITY ORDER
    const highPriority = missingKeywords.filter((k) => k.priority === "high");

    const mediumPriority = missingKeywords.filter(
      (k) => k.priority === "medium",
    );

    const tailorPriority = [...highPriority, ...mediumPriority];

    // GAP INSIGHTS
    const gapInsights = [];

    if (fitDetails.skillsSim !== undefined) {
      if (fitDetails.skillsSim < 0.5) {
        gapInsights.push("Weak alignment in core skills");
      } else if (fitDetails.skillsSim > 0.75) {
        gapInsights.push("Strong core skill alignment");
      }
    }

    if (fitDetails.expSim !== undefined && fitDetails.expSim < 0.5) {
      gapInsights.push("Experience does not strongly match job requirements");
    }

    if (fitDetails.projSim !== undefined && fitDetails.projSim < 0.5) {
      gapInsights.push("Projects are not strongly aligned with the role");
    }

    if (missingKeywords.length > 0) {
      const criticalMissing = highPriority.slice(0, 3).map((k) => k.keyword);

      if (criticalMissing.length > 0) {
        gapInsights.push(
          `Missing critical skills: ${criticalMissing.join(", ")}`,
        );
      }
    }

    if (presentKeywords.length > 0) {
      const strongAreas = presentKeywords.slice(0, 3);
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
