import { useParams, Link } from "react-router-dom";
import { useApplication, useUpdateStatus } from "../hooks/useApplications";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";
import { statusConfig, formatDate, scoreColor } from "../utils/helpers";

// ── Score Bar ───────────────────────────────────────────────────────────────
function ScoreBar({ label, score, max = 100 }) {
  const pct = Math.round((score / max) * 100);
  const color =
    pct >= 80
      ? "bg-green-500"
      : pct >= 60
        ? "bg-yellow-500"
        : pct >= 40
          ? "bg-orange-500"
          : "bg-red-500";

  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-[#8b949e]">{label}</span>
        <span className={scoreColor(pct)}>{score}</span>
      </div>
      <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Status Selector ─────────────────────────────────────────────────────────
function StatusSelector({ current, applicationId }) {
  const { mutate, isPending } = useUpdateStatus();
  const statuses = [
    "saved",
    "applied",
    "screening",
    "interview",
    "offer",
    "rejected",
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {statuses.map((s) => {
        const cfg = statusConfig[s];
        const active = current === s;
        return (
          <button
            key={s}
            onClick={() => !active && mutate({ id: applicationId, status: s })}
            disabled={isPending}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
              active
                ? cfg.color + " opacity-100"
                : "bg-transparent border-[#30363d] text-[#8b949e] hover:border-[#484f58] hover:text-[#e6edf3]"
            }`}
          >
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Bullet Diff ─────────────────────────────────────────────────────────────
function BulletDiff({ original, tailored }) {
  if (!tailored?.length) return null;

  return (
    <div className="space-y-3">
      {tailored.map((bullet, i) => (
        <div
          key={i}
          className="rounded-lg overflow-hidden border border-[#30363d]"
        >
          {original?.[i] && (
            <div className="px-3 py-2 bg-red-500/5 border-b border-[#30363d]">
              <p className="mb-1 text-xs font-medium tracking-wide uppercase text-red-400/70">
                Before
              </p>
              <p className="text-xs text-[#8b949e] leading-relaxed">
                {original[i]}
              </p>
            </div>
          )}
          <div className="px-3 py-2 bg-green-500/5">
            <p className="mb-1 text-xs font-medium tracking-wide uppercase text-green-400/70">
              After
            </p>
            <p className="text-xs text-[#e6edf3] leading-relaxed">{bullet}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Gap Analysis ────────────────────────────────────────────────────────────
function GapAnalysis({ gaps, insights }) {
  const required = gaps?.filter((g) => g.type === "required") || [];
  const optional = gaps?.filter((g) => g.type === "optional") || [];

  const severityOrder = { high: 0, medium: 1, low: 2, none: 3 };
  const sorted = [...required].sort(
    (a, b) =>
      (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3),
  );

  const severityStyle = {
    high: "bg-red-500/10 border-red-500/20 text-red-400",
    medium: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    low: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    none: "bg-green-500/10 border-green-500/20 text-green-400",
  };

  return (
    <div className="space-y-4">
      {/* insights */}
      {insights?.length > 0 && (
        <div className="space-y-1.5">
          {insights.map((insight, i) => (
            <p
              key={i}
              className="text-xs text-[#8b949e] flex items-start gap-2"
            >
              <span className="flex-shrink-0 text-blue-400">→</span>
              {insight}
            </p>
          ))}
        </div>
      )}

      {/* required skills */}
      {sorted.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide mb-2">
            Required skills
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sorted.map((g) => (
              <span
                key={g.skill}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border ${severityStyle[g.severity]}`}
              >
                {g.present ? "✓" : "✗"} {g.skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* optional */}
      {optional.filter((g) => !g.present).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide mb-2">
            Nice to have (missing)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {optional
              .filter((g) => !g.present)
              .map((g) => (
                <span
                  key={g.skill}
                  className="px-2.5 py-1 rounded-lg text-xs bg-[#21262d] border border-[#30363d] text-[#8b949e]"
                >
                  {g.skill}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Honest Gap Report ───────────────────────────────────────────────────────
function HonestGapReport({ report }) {
  if (!report) return null;

  return (
    <div className="px-4 py-4 space-y-3 border rounded-xl bg-yellow-500/8 border-yellow-500/25">
      <div className="flex items-center gap-2">
        <span className="text-yellow-400">⚠</span>
        <h3 className="text-sm font-semibold text-yellow-400">
          Honest Gap Report
        </h3>
        <span className="text-xs text-[#8b949e]">
          Best achievable score: {report.bestAchievableScore}%
        </span>
      </div>
      <p className="text-xs text-[#8b949e] leading-relaxed">
        {report.explanation}
      </p>
      {report.trulyMissingSkills?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[#8b949e] mb-2">
            Skills that could NOT be added (not in your profile):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {report.trulyMissingSkills.map((s) => (
              <span
                key={s}
                className="px-2.5 py-1 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400"
              >
                ✗ {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function ApplicationDetailPage() {
  const { id } = useParams();
  const { data, isLoading, error } = useApplication(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-[#8b949e] text-sm">Application not found</p>
        <Link
          to="/applications"
          className="inline-block mt-2 text-sm text-blue-400"
        >
          ← Back to applications
        </Link>
      </div>
    );
  }

  const { application, jdAnalysis, resumeVersion, prepSession } = data;
  const cfg = statusConfig[application.status] || statusConfig.saved;

  return (
    <div className="max-w-3xl space-y-6">
      {/* breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#8b949e]">
        <Link
          to="/applications"
          className="hover:text-[#e6edf3] transition-colors"
        >
          Applications
        </Link>
        <span>›</span>
        <span className="text-[#e6edf3]">{application.jobTitle}</span>
      </div>

      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#e6edf3]">
            {application.jobTitle}
          </h1>
          <p className="text-sm text-[#8b949e] mt-0.5">{application.company}</p>
          <p className="text-xs text-[#484f58] mt-1">
            {formatDate(application.createdAt)}
          </p>
        </div>
        {application.portalUrl && (
          <a
            href={application.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="secondary" size="sm">
              Apply →
            </Button>
          </a>
        )}
      </div>

      {/* status selector */}
      <Card>
        <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide mb-3">
          Application status
        </p>
        <StatusSelector current={application.status} applicationId={id} />
      </Card>

      {/* scores */}
      {jdAnalysis && (
        <Card>
          <h2 className="text-sm font-semibold text-[#e6edf3] mb-4">
            Analysis scores
          </h2>
          <div className="space-y-4">
            <ScoreBar
              label="Semantic fit score"
              score={jdAnalysis.fitScore || 0}
            />
            <ScoreBar
              label="ATS coverage (original)"
              score={jdAnalysis.atsCoverageScore || 0}
            />
            {resumeVersion?.atsScore !== undefined && (
              <ScoreBar
                label="ATS score (after tailoring)"
                score={resumeVersion.atsScore}
              />
            )}
          </div>

          {/* fit breakdown */}
          {jdAnalysis.fitDetails?.reasons?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#21262d] space-y-1.5">
              {jdAnalysis.fitDetails.reasons.map((r, i) => (
                <p key={i} className="text-xs text-[#8b949e] flex gap-2">
                  <span className="flex-shrink-0 text-blue-400">·</span> {r}
                </p>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* honest gap report */}
      {resumeVersion?.honestGapReport && (
        <HonestGapReport report={resumeVersion.honestGapReport} />
      )}

      {/* gap analysis */}
      {jdAnalysis?.gapAnalysis?.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[#e6edf3] mb-4">
            Skill gap analysis
          </h2>
          <GapAnalysis
            gaps={jdAnalysis.gapAnalysis}
            insights={jdAnalysis.gapInsights}
          />
        </Card>
      )}

      {/* tailored resume */}
      {resumeVersion?.tailoredBullets?.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#e6edf3]">
              Tailored resume bullets
            </h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-md border ${
                resumeVersion.atsScore >= 80
                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                  : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
              }`}
            >
              ATS {resumeVersion.atsScore}%
            </span>
          </div>
          <BulletDiff
            original={resumeVersion.originalBullets}
            tailored={resumeVersion.tailoredBullets}
          />

          {/* updated skills */}
          {resumeVersion.updatedSkills?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#21262d]">
              <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide mb-2">
                Updated skills section
              </p>
              <div className="flex flex-wrap gap-1.5">
                {resumeVersion.updatedSkills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2.5 py-1 rounded-lg text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* summary */}
          {resumeVersion.resumeJSON?.summary && (
            <div className="mt-4 pt-4 border-t border-[#21262d]">
              <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide mb-2">
                Professional summary
              </p>
              <p className="text-xs text-[#8b949e] leading-relaxed italic">
                "{resumeVersion.resumeJSON.summary}"
              </p>
            </div>
          )}
        </Card>
      )}

      {/* keywords */}
      {jdAnalysis && (
        <Card>
          <h2 className="text-sm font-semibold text-[#e6edf3] mb-4">
            Keywords
          </h2>
          <div className="space-y-3">
            {jdAnalysis.presentKeywords?.length > 0 && (
              <div>
                <p className="text-xs text-[#8b949e] mb-1.5">
                  Present in resume ({jdAnalysis.presentKeywords.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {jdAnalysis.presentKeywords.map((k) => (
                    <span
                      key={k}
                      className="px-2 py-0.5 rounded text-xs bg-green-500/10 border border-green-500/20 text-green-400"
                    >
                      ✓ {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {jdAnalysis.missingKeywords?.length > 0 && (
              <div>
                <p className="text-xs text-[#8b949e] mb-1.5">
                  Missing ({jdAnalysis.missingKeywords.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {jdAnalysis.missingKeywords.map((k) => {
                    const kw = typeof k === "string" ? k : k.keyword;
                    const priority = typeof k === "object" ? k.priority : null;
                    return (
                      <span
                        key={kw}
                        className={`px-2 py-0.5 rounded text-xs border ${
                          priority === "high"
                            ? "bg-red-500/10 border-red-500/20 text-red-400"
                            : "bg-[#21262d] border-[#30363d] text-[#8b949e]"
                        }`}
                      >
                        ✗ {kw}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* interview prep CTA */}
      {prepSession && (
        <Card className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#e6edf3]">
              Interview preparation
            </h2>
            <p className="text-xs text-[#8b949e] mt-0.5">
              {prepSession.questions?.length} questions generated ·{" "}
              {prepSession.status === "completed"
                ? `Avg score: ${Math.round((prepSession.avgScore || 0) * 100)}%`
                : prepSession.status === "in_progress"
                  ? "In progress"
                  : "Not started"}
            </p>
          </div>
          <Link to={`/prep/${id}`}>
            <Button variant="secondary" size="sm">
              {prepSession.status === "generated"
                ? "Start prep →"
                : "Continue →"}
            </Button>
          </Link>
        </Card>
      )}

      {/* timeline */}
      {application.timeline?.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[#e6edf3] mb-3">
            Timeline
          </h2>
          <div className="space-y-2">
            {[...application.timeline].reverse().map((event, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <span className="text-[#484f58] flex-shrink-0 mt-0.5">·</span>
                <span className="text-[#8b949e]">{event.detail}</span>
                <span className="text-[#484f58] flex-shrink-0 ml-auto">
                  {formatDate(event.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
