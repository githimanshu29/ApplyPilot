import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApplicationStats, useApplications } from "../hooks/useApplications";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";
import { statusConfig, timeAgo, scoreColor, truncate } from "../utils/helpers";

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = "text-[#e6edf3]" }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs text-[#8b949e] font-medium uppercase tracking-wide">
        {label}
      </span>
      <span className={`text-3xl font-bold ${color}`}>{value ?? "—"}</span>
      {sub && <span className="text-xs text-[#8b949e]">{sub}</span>}
    </Card>
  );
}

// ── Application Row ────────────────────────────────────────────────────────
function AppRow({ app }) {
  const cfg = statusConfig[app.status] || statusConfig.saved;
  return (
    <Link
      to={`/applications/${app._id}`}
      className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-[#21262d] transition-colors group"
    >
      {/* company avatar */}
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {(app.company?.[0] || "J").toUpperCase()}
      </div>

      {/* main info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#e6edf3] group-hover:text-white truncate">
          {truncate(app.jobTitle, 35)}
        </p>
        <p className="text-xs text-[#8b949e] truncate">{app.company}</p>
      </div>

      {/* status */}
      <span
        className={`text-xs px-2 py-0.5 rounded-md border font-medium flex-shrink-0 ${cfg.color}`}
      >
        {cfg.label}
      </span>

      {/* time */}
      <span className="text-xs text-[#8b949e] flex-shrink-0 hidden sm:block">
        {timeAgo(app.createdAt)}
      </span>
    </Link>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#21262d] flex items-center justify-center text-3xl mb-4">
        ◈
      </div>
      <h3 className="text-sm font-semibold text-[#e6edf3] mb-1">
        No applications yet
      </h3>
      <p className="text-xs text-[#8b949e] max-w-xs mb-6">
        Paste a job description to run the AI pipeline and get a tailored resume
        in minutes.
      </p>
      <Link to="/analyze">
        <Button>Analyze your first JD</Button>
      </Link>
    </div>
  );
}

// ── Pipeline Status Bar ────────────────────────────────────────────────────
function StatusBar({ stats }) {
  const total = stats?.total || 0;
  if (total === 0) return null;

  const stages = [
    { key: "applied", color: "bg-blue-500" },
    { key: "screening", color: "bg-yellow-500" },
    { key: "interview", color: "bg-purple-500" },
    { key: "offer", color: "bg-green-500" },
    { key: "rejected", color: "bg-red-500" },
    { key: "saved", color: "bg-[#484f58]" },
  ];

  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-2 gap-0.5 mb-2">
        {stages.map(({ key, color }) => {
          const count = stats?.byStatus?.[key] || 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={key}
              className={`${color} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`${statusConfig[key].label}: ${count}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {stages.map(({ key, color }) => {
          const count = stats?.byStatus?.[key] || 0;
          if (count === 0) return null;
          return (
            <div
              key={key}
              className="flex items-center gap-1.5 text-xs text-[#8b949e]"
            >
              <div className={`w-2 h-2 rounded-full ${color}`} />
              {statusConfig[key].label}: {count}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Quick Actions ──────────────────────────────────────────────────────────
function QuickActions({ hasProfile }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold text-[#e6edf3] mb-4">
        Quick actions
      </h2>
      <div className="space-y-2">
        {!hasProfile && (
          <Link to="/profile" className="block">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/15 transition-colors cursor-pointer">
              <span className="text-yellow-400">⚠</span>
              <div>
                <p className="text-xs font-medium text-yellow-400">
                  Upload your resume
                </p>
                <p className="text-xs text-[#8b949e]">
                  Required before analyzing any JD
                </p>
              </div>
            </div>
          </Link>
        )}

        <Link to="/analyze" className="block">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#21262d] border border-[#30363d] transition-colors cursor-pointer group">
            <span className="text-blue-400 text-base">⟡</span>
            <div>
              <p className="text-xs font-medium text-[#e6edf3] group-hover:text-white">
                Analyze a JD
              </p>
              <p className="text-xs text-[#8b949e]">
                Paste job description → AI pipeline runs
              </p>
            </div>
          </div>
        </Link>

        <Link to="/jobs" className="block">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#21262d] border border-[#30363d] transition-colors cursor-pointer group">
            <span className="text-teal-400 text-base">◉</span>
            <div>
              <p className="text-xs font-medium text-[#e6edf3] group-hover:text-white">
                Discover jobs
              </p>
              <p className="text-xs text-[#8b949e]">
                Browse ranked jobs from multiple sources
              </p>
            </div>
          </div>
        </Link>

        <Link to="/applications" className="block">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#21262d] border border-[#30363d] transition-colors cursor-pointer group">
            <span className="text-purple-400 text-base">▦</span>
            <div>
              <p className="text-xs font-medium text-[#e6edf3] group-hover:text-white">
                View kanban board
              </p>
              <p className="text-xs text-[#8b949e]">
                Track all your applications
              </p>
            </div>
          </div>
        </Link>
      </div>
    </Card>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useApplicationStats();
  const { data: appsData, isLoading: appsLoading } = useApplications();

  const hasProfile = !!(
    user?.profile?.resumeRaw || user?.profile?.skills?.length
  );
  const recentApps = appsData?.applications?.slice(0, 8) || [];
  const responseRate = stats?.responseRate ?? 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6">
      {/* header */}
      <div>
        <h1 className="text-xl font-semibold text-[#e6edf3]">
          {greeting()}, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-[#8b949e] mt-0.5">
          {stats?.total
            ? `You have ${stats.total} application${stats.total !== 1 ? "s" : ""} tracked`
            : "Start by uploading your resume and analyzing a job description"}
        </p>
      </div>

      {/* stats row */}
      {statsLoading ? (
        <div className="flex items-center gap-2 text-[#8b949e] text-sm">
          <Spinner size="sm" /> Loading stats…
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total"
            value={stats?.total ?? 0}
            sub="applications tracked"
          />
          <StatCard
            label="Applied"
            value={stats?.byStatus?.applied ?? 0}
            color="text-blue-400"
            sub="submitted"
          />
          <StatCard
            label="Interviews"
            value={
              (stats?.byStatus?.screening ?? 0) +
              (stats?.byStatus?.interview ?? 0)
            }
            color="text-purple-400"
            sub="screening + interview"
          />
          <StatCard
            label="Response rate"
            value={`${responseRate}%`}
            color={
              responseRate >= 30
                ? "text-green-400"
                : responseRate >= 10
                  ? "text-yellow-400"
                  : "text-[#e6edf3]"
            }
            sub="of applied"
          />
        </div>
      )}

      {/* pipeline distribution */}
      {stats?.total > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[#e6edf3] mb-3">
            Application pipeline
          </h2>
          <StatusBar stats={stats} />
        </Card>
      )}

      {/* main content: recent apps + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* recent applications — takes 2/3 */}
        <div className="lg:col-span-2">
          <Card className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
              <h2 className="text-sm font-semibold text-[#e6edf3]">
                Recent applications
              </h2>
              {recentApps.length > 0 && (
                <Link
                  to="/applications"
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View all →
                </Link>
              )}
            </div>

            {appsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            ) : recentApps.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="divide-y divide-[#21262d]">
                {recentApps.map((app) => (
                  <AppRow key={app._id} app={app} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* quick actions — takes 1/3 */}
        <div className="space-y-4">
          <QuickActions hasProfile={hasProfile} />

          {/* profile completeness */}
          <Card>
            <h2 className="text-sm font-semibold text-[#e6edf3] mb-3">
              Profile status
            </h2>
            <div className="space-y-2">
              {[
                { label: "Resume uploaded", done: !!user?.profile?.resumeRaw },
                {
                  label: "Skills added",
                  done: user?.profile?.skills?.length > 0,
                },
                {
                  label: "Experience added",
                  done: user?.profile?.experience?.length > 0,
                },
                {
                  label: "Projects added",
                  done: user?.profile?.projects?.length > 0,
                },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center gap-2.5 text-xs">
                  <span className={done ? "text-green-400" : "text-[#484f58]"}>
                    {done ? "✓" : "○"}
                  </span>
                  <span className={done ? "text-[#e6edf3]" : "text-[#8b949e]"}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
