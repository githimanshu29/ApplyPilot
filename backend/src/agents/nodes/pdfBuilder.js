/**
 * pdfBuilderNode 
 *
 * Phase 3 replacement plan:
 * 1.  resumeJSON uthao   state se.
 * 2. User picks a LaTeX template (classic / modern / minimal)
  3. Map resumeJSON fields into the LaTeX template string
  4. Compile via a LaTeX API or local latexmk
  5. Upload karo PDF ko Cloudinary pe → store URL in state
 6. Return pdfUrl + resumeJSON to state
 
  For now — we skip PDF generation and just pass resumeJSON through.
  The controller will return resumeJSON to the frontend directly.
 */
export async function pdfBuilderNode(state) {
  console.log("[pdf_builder] building structured resumeJSON");

  const { workingResume, userProfile } = state;

  const baseExperience = userProfile.experience || [];

  // CASE 1: future-ready (per-experience bullets exist)
  if (workingResume.tailoredExperienceBullets?.length) {
    const experience = baseExperience.map((exp) => {
      const match = workingResume.tailoredExperienceBullets.find(
        (e) => e.company === exp.company || e.role === exp.role,
      );

      return {
        ...exp,
        bullets: match?.bullets?.length ? match.bullets : exp.bullets,
      };
    });

    return buildResponse(state, experience);
  }

  // CASE 2: current system (flat bullets → distribute)
  if (workingResume.tailoredBullets?.length) {
    const allBullets = workingResume.tailoredBullets;

    const bulletsPerExp = Math.ceil(
      allBullets.length / (baseExperience.length || 1),
    );

    let index = 0;

    const experience = baseExperience.map((exp) => {
      const slice = allBullets.slice(index, index + bulletsPerExp);
      index += bulletsPerExp;

      return {
        ...exp,
        bullets: slice.length ? slice : exp.bullets,
      };
    });

    return buildResponse(state, experience);
  }

  // CASE 3: fallback (no AI bullets)
  return buildResponse(state, baseExperience);
}

// helper to keep logic clean and consistent
function buildResponse(state, experience) {
  const { workingResume, userProfile } = state;

  const resumeJSON = {
    summary: workingResume.summary || "",

    skills: workingResume.updatedSkills?.length
      ? workingResume.updatedSkills
      : userProfile.skills || [],

    experience,

    projects: userProfile.projects || [],
    education: userProfile.education || {},
  };

  return {
    workingResume: {
      ...workingResume,
      resumeJSON,
    },
    currentNode: "pdf_builder",
  };
}
