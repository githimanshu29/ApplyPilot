import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  useApplications,
  useUpdateStatus,
  useDeleteApplication,
} from "../hooks/useApplications";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";
import { statusConfig, timeAgo, truncate, scoreColor } from "../utils/helpers";

const COLUMNS = [
  { key: "saved", label: "Saved", color: "border-t-[#484f58]" },
  { key: "applied", label: "Applied", color: "border-t-blue-500" },
  { key: "screening", label: "Screening", color: "border-t-yellow-500" },
  { key: "interview", label: "Interview", color: "border-t-purple-500" },
  { key: "offer", label: "Offer", color: "border-t-green-500" },
  { key: "rejected", label: "Rejected", color: "border-t-red-500" },
];

// ── Application Card ────────────────────────────────────────────────────────
function AppCard({ app, onStatusChange, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);
  const nextStatuses = COLUMNS.filter((c) => c.key !== app.status).map(
    (c) => c.key,
  );

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 space-y-2.5 group hover:border-[#484f58] transition-colors">
      {/* header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center min-w-0 gap-2">
          <div className="flex items-center justify-center flex-shrink-0 text-xs font-bold text-white rounded-md w-7 h-7 bg-gradient-to-br from-blue-600 to-purple-600">
            {(app.company?.[0] || "J").toUpperCase()}
          </div>
          <div className="min-w-0">
            <Link
              to={`/applications/${app._id}`}
              className="text-xs font-medium text-[#e6edf3] hover:text-white truncate block transition-colors"
            >
              {truncate(app.jobTitle, 28)}
            </Link>
            <p className="text-xs text-[#8b949e] truncate">{app.company}</p>
          </div>
        </div>

        {/* context menu */}
        {/* context menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className="opacity-0 group-hover:opacity-100 text-[#8b949e] hover:text-[#e6edf3] text-sm px-1 transition-all"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-6 z-20 w-36 bg-[#21262d] border border-[#30363d] rounded-lg shadow-xl overflow-hidden">
              <p className="px-3 py-1.5 text-xs font-semibold text-[#484f58] uppercase tracking-wide border-b border-[#30363d]">
                Move to
              </p>
              {nextStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onStatusChange(app._id, s);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-[#8b949e] hover:bg-[#2d333b] hover:text-[#e6edf3] transition-colors"
                >
                  {statusConfig[s]?.label}
                </button>
              ))}
              <div className="border-t border-[#30363d]">
                <button
                  onClick={() => {
                    onDelete(app._id);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* time */}
      <p className="text-xs text-[#484f58]">{timeAgo(app.createdAt)}</p>

      {/* view link */}
      <Link
        to={`/applications/${app._id}`}
        className="block text-xs text-blue-400 transition-colors hover:text-blue-300"
      >
        View analysis →
      </Link>
    </div>
  );
}

// ── Column ───────────────────────────────────────────────────────────────────
function Column({ col, apps, onStatusChange, onDelete }) {
  return (
    <div className="flex flex-col min-w-[220px] max-w-[220px]">
      {/* column header */}
      <div
        className={`bg-[#161b22] border border-[#30363d] border-t-2 ${col.color} rounded-t-lg px-3 py-2.5 flex items-center justify-between`}
      >
        <span className="text-xs font-semibold text-[#e6edf3]">
          {col.label}
        </span>
        <span className="text-xs font-medium text-[#8b949e] bg-[#21262d] px-1.5 py-0.5 rounded-md">
          {apps.length}
        </span>
      </div>

      {/* cards */}
      <div className="flex-1 bg-[#161b22]/50 border-x border-b border-[#30363d] rounded-b-lg p-2 space-y-2 min-h-[200px]">
        {apps.length === 0 && (
          <p className="text-xs text-[#484f58] text-center py-6">Empty</p>
        )}
        {apps.map((app) => (
          <AppCard
            key={app._id}
            app={app}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function KanbanPage() {
  const { data, isLoading } = useApplications();
  const { mutate: updateStatus } = useUpdateStatus();
  const { mutate: deleteApp } = useDeleteApplication();

  const kanban = data?.kanban || {};
  const total = data?.applications?.length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e6edf3]">Applications</h1>
          <p className="text-sm text-[#8b949e] mt-0.5">
            {total} total · drag status via card menu
          </p>
        </div>
        <Link to="/analyze">
          <Button size="sm">+ Analyze JD</Button>
        </Link>
      </div>

      {/* empty state */}
      {total === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#21262d] flex items-center justify-center text-2xl mb-4">
            ▦
          </div>
          <h3 className="text-sm font-semibold text-[#e6edf3] mb-1">
            No applications yet
          </h3>
          <p className="text-xs text-[#8b949e] mb-5">
            Analyze a job description to create your first application
          </p>
          <Link to="/analyze">
            <Button>Analyze your first JD</Button>
          </Link>
        </div>
      )}

      {/* board */}
      {total > 0 && (
        <div className="pb-4 overflow-x-auto">
          <div className="flex gap-3 min-w-max">
            {COLUMNS.map((col) => (
              <Column
                key={col.key}
                col={col}
                apps={kanban[col.key] || []}
                onStatusChange={(id, status) => updateStatus({ id, status })}
                onDelete={(id) => deleteApp(id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
