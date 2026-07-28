import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePipeline } from "../hooks/usePipeline";
import { getSocketId } from "../lib/socket";
import api from "../lib/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import PipelineProgress from "../components/pipeline/PipelineProgress";
import { scoreColor, scoreBg } from "../utils/helpers";

// ── Score Card ──────────────────────────────────────────────────────────────
function ScoreCard({ label, score, sub }) {
  const color =
    score >= 80
      ? "text-green-400"
      : score >= 60
        ? "text-yellow-400"
        : score >= 40
          ? "text-orange-400"
          : "text-red-400";

  const ring =
    score >= 80
      ? "#3fb950"
      : score >= 60
        ? "#e3b341"
        : score >= 40
          ? "#f0883e"
          : "#f85149";

  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg width="88" height="88" className="-rotate-90">
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="#21262d"
            strokeWidth="7"
          />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke={ring}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-lg font-bold ${color}`}>{score}</span>
        </div>
      </div>
      <p className="text-xs font-medium text-[#e6edf3]">{label}</p>
      {sub && <p className="text-xs text-[#8b949e]">{sub}</p>}
    </div>
  );
}

// ── Gap Pill ────────────────────────────────────────────────────────────────
function GapPill({ skill, present, severity }) {
  const colors = {
    none: "bg-green-500/10 border-green-500/20 text-green-400",
    low: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    medium: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    high: "bg-red-500/10 border-red-500/20 text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border ${colors[severity] || colors.none}`}
    >
      {present ? "✓" : "✗"} {skill}
    </span>
  );
}

// ── Quick Result ────────────────────────────────────────────────────────────
function QuickResult({ result, applicationId, onViewFull }) {
  return (
    <div className="space-y-4">
      {/* success */}
      <div className="flex items-center gap-2 text-sm font-medium text-green-400">
        <span>✓</span> Pipeline complete
      </div>

      {/* scores */}
      <Card>
        <h3 className="text-sm font-semibold text-[#e6edf3] mb-4">Scores</h3>
        <div className="flex justify-around">
          <ScoreCard
            label="Fit Score"
            score={result.fitScore || 0}
            sub="semantic match"
          />
          <ScoreCard
            label="ATS Score"
            score={result.atsScore || 0}
            sub="after tailoring"
          />
        </div>
      </Card>

      {/* honest gap report */}
      {result.honestGapReport && (
        <div className="px-4 py-3 border rounded-lg bg-yellow-500/8 border-yellow-500/20">
          <p className="mb-1 text-xs font-semibold text-yellow-400">
            Honest Gap Report
          </p>
          <p className="text-xs text-[#8b949e] leading-relaxed">
            {result.honestGapReport.explanation}
          </p>
          {result.honestGapReport.trulyMissingSkills?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {result.honestGapReport.trulyMissingSkills.map((skill) => (
                <span
                  key={skill}
                  className="px-2 py-0.5 rounded text-xs bg-red-500/10 border border-red-500/20 text-red-400"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <Button onClick={onViewFull} className="w-full" size="lg">
        View full analysis →
      </Button>
    </div>
  );
}

// ── JD Form ─────────────────────────────────────────────────────────────────
function JDForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    jdRaw: "",
    jobTitle: "",
    company: "",
    portalUrl: "",
    portalType: "other",
  });
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.jdRaw.trim() || form.jdRaw.trim().length < 100) {
      setError("Paste the full job description (at least 100 characters)");
      return;
    }
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <Textarea
        label="Job Description"
        name="jdRaw"
        value={form.jdRaw}
        onChange={handleChange}
        placeholder="Paste the full job description here — include responsibilities, required skills, and any other details you see on the posting…"
        rows={10}
        hint="Copy everything from the job posting — more context = better analysis"
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Job Title"
          name="jobTitle"
          value={form.jobTitle}
          onChange={handleChange}
          placeholder="Backend Engineer"
        />
        <Input
          label="Company"
          name="company"
          value={form.company}
          onChange={handleChange}
          placeholder="Razorpay"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Portal URL (optional)"
          name="portalUrl"
          value={form.portalUrl}
          onChange={handleChange}
          placeholder="https://jobs.example.com/..."
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#e6edf3]">Source</label>
          <select
            name="portalType"
            value={form.portalType}
            onChange={handleChange}
            className="px-3 py-2 rounded-lg text-sm bg-[#0d1117] border border-[#30363d] text-[#e6edf3] outline-none focus:border-blue-500"
          >
            <option value="other">Other</option>
            <option value="linkedin">LinkedIn</option>
            <option value="naukri">Naukri</option>
            <option value="internshala">Internshala</option>
          </select>
        </div>
      </div>

      <Button type="submit" loading={loading} size="lg" className="w-full">
        {loading ? "Starting pipeline…" : "Analyze this JD →"}
      </Button>
    </form>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function AnalyzePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pipeline = usePipeline();

  const [phase, setPhase] = useState("form"); // form | running | done
  const [submitting, setSubmitting] = useState(false);
  const [applicationId, setApplicationId] = useState(null);

  const hasProfile = !!(
    user?.profile?.resumeRaw || user?.profile?.skills?.length
  );

  async function handleSubmit(formData) {
    setSubmitting(true);
    try {
      const socketId = getSocketId();
      const res = await api.post("/analyze", { ...formData, socketId });
      setApplicationId(res.data.applicationId);
      setPhase("running");

      // if socket isn't connected, poll for result after 45 seconds
      setTimeout(() => {
        if (phase === "running") setPhase("poll");
      }, 50000);
    } catch (err) {
      console.error("[analyze]", err);
    } finally {
      setSubmitting(false);
    }
  }

  // watch pipeline state — when complete, move to done
  if (phase === "running" && pipeline.result) {
    setPhase("done");
  }

  function handleViewFull() {
    const id = applicationId || pipeline.applicationId;
    if (id) navigate(`/applications/${id}`);
  }

  function handleReset() {
    pipeline.reset();
    setPhase("form");
    setApplicationId(null);
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* header */}
      <div>
        <h1 className="text-xl font-semibold text-[#e6edf3]">
          Analyze a Job Description
        </h1>
        <p className="text-sm text-[#8b949e] mt-0.5">
          Paste any JD — AI tailors your resume and generates interview
          questions
        </p>
      </div>

      {/* no profile warning */}
      {!hasProfile && (
        <div className="flex items-start gap-3 px-4 py-3 border rounded-lg bg-yellow-500/10 border-yellow-500/20">
          <span className="text-yellow-400">⚠</span>
          <div>
            <p className="text-sm font-medium text-yellow-400">
              Upload your resume first
            </p>
            <p className="text-xs text-[#8b949e] mt-0.5">
              The pipeline needs your profile to tailor your resume.{" "}
              <a href="/profile" className="text-blue-400 hover:underline">
                Go to Profile →
              </a>
            </p>
          </div>
        </div>
      )}

      {/* phase: form */}
      {phase === "form" && (
        <Card>
          <JDForm onSubmit={handleSubmit} loading={submitting} />
        </Card>
      )}

      {/* phase: running */}
      {phase === "running" && (
        <Card>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#e6edf3]">
              AI Pipeline running
            </h2>
            <p className="text-xs text-[#8b949e] mt-0.5">
              Sit back — this takes 20-40 seconds
            </p>
          </div>
          <PipelineProgress
            currentNode={pipeline.currentNode}
            completedNodes={pipeline.completedNodes}
            error={pipeline.error}
          />
          {pipeline.error && (
            <Button
              onClick={handleReset}
              variant="secondary"
              size="sm"
              className="mt-4"
            >
              Try again
            </Button>
          )}
        </Card>
      )}

      {/* phase: done */}
      {phase === "done" && pipeline.result && (
        <Card>
          <QuickResult
            result={pipeline.result}
            applicationId={applicationId}
            onViewFull={handleViewFull}
          />
          <Button
            onClick={handleReset}
            variant="ghost"
            size="sm"
            className="w-full mt-3"
          >
            Analyze another JD
          </Button>
        </Card>
      )}

      {/* tips — shown alongside form */}
      {phase === "form" && (
        <Card>
          <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide mb-3">
            What happens when you click Analyze
          </h3>
          <ol className="space-y-2">
            {[
              [
                "📋",
                "JD parsed",
                "Extracts skills, keywords, role domain, seniority",
              ],
              [
                "📊",
                "Fit scored",
                "Semantic similarity between your profile and the JD",
              ],
              ["🔍", "ATS scanned", "Keyword coverage — what an ATS would see"],
              [
                "✏️",
                "Bullets rewritten",
                "STAR format, honest, quantified where possible",
              ],
              [
                "🔑",
                "Keywords injected",
                "Only present or inferable — never fabricated",
              ],
              ["🎯", "Interview prep", "15 tailored Q&A pairs generated"],
            ].map(([icon, label, desc]) => (
              <li key={label} className="flex items-start gap-3">
                <span className="text-base leading-none mt-0.5">{icon}</span>
                <div>
                  <span className="text-xs font-medium text-[#e6edf3]">
                    {label}
                  </span>
                  <span className="text-xs text-[#8b949e]"> — {desc}</span>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
