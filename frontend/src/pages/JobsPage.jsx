import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  useDiscoverJobs,
  useSavedJobs,
  useScrapeJob,
  useSaveJob,
  useOptimizeJob,
} from "../hooks/useJobs";
import { useQueryClient } from "@tanstack/react-query";
import { usePipeline } from "../hooks/usePipeline";
import { getSocketId } from "../lib/socket";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Spinner from "../components/ui/Spinner";
import Modal from "../components/ui/Modal";
import PipelineProgress from "../components/pipeline/PipelineProgress";
import { timeAgo, truncate } from "../utils/helpers";
import { useEffect } from "react";

// ── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({
  job,
  onSave,
  onOptimize,
  saved = false,
  optimizing = false,
}) {
  const rankColor =
    job.rankScore >= 70
      ? "text-green-400"
      : job.rankScore >= 40
        ? "text-yellow-400"
        : "text-[#8b949e]";

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-3 hover:border-[#484f58] transition-colors">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center min-w-0 gap-3">
          <div className="flex items-center justify-center flex-shrink-0 text-xs font-bold text-white rounded-lg w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600">
            {(job.company?.[0] || "J").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#e6edf3] truncate">
              {truncate(job.title, 40)}
            </p>
            <p className="text-xs text-[#8b949e]">{job.company}</p>
          </div>
        </div>
        {/* rank score */}
        {job.rankScore > 0 && (
          <span className={`text-xs font-semibold flex-shrink-0 ${rankColor}`}>
            {job.rankScore}% match
          </span>
        )}
      </div>

      {/* meta */}
      <div className="flex flex-wrap gap-2">
        {job.location && (
          <span className="text-xs text-[#8b949e]">
            📍 {truncate(job.location, 25)}
          </span>
        )}
        {job.workType && job.workType !== "unknown" && (
          <span className="text-xs px-2 py-0.5 rounded bg-[#21262d] text-[#8b949e] capitalize">
            {job.workType}
          </span>
        )}
        <span className="text-xs text-[#484f58]">{timeAgo(job.postedAt)}</span>
        <span className="text-xs px-2 py-0.5 rounded bg-[#21262d] text-[#484f58] capitalize">
          {job.source}
        </span>
      </div>

      {/* description snippet */}
      {job.jdRaw && (
        <p className="text-xs text-[#8b949e] leading-relaxed line-clamp-2">
          {job.jdRaw.slice(0, 180)}…
        </p>
      )}

      {/* actions */}
      <div className="flex gap-2 pt-1">
        {!saved ? (
          <Button size="sm" variant="secondary" onClick={() => onSave(job)}>
            Save to board
          </Button>
        ) : (
          <Button
            size="sm"
            loading={optimizing}
            onClick={() => onOptimize(job._id)}
          >
            {optimizing ? "Starting…" : "Optimize resume →"}
          </Button>
        )}
        {job.url && (
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost">
              View posting ↗
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

// ── Scrape Modal ──────────────────────────────────────────────────────────────
function ScrapeModal({ open, onClose, onResult }) {
  const [url, setUrl] = useState("");
  const [manualJD, setManualJD] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const scrape = useScrapeJob();
  const saveJob = useSaveJob();

  async function handleScrape() {
    if (!url.trim()) return;
    scrape.mutate(url, {
      onSuccess: (res) => {
        if (res.data.success) {
          setTitle(res.data.title || "");
          setCompany(res.data.company || "");
          setManualJD(res.data.jdRaw || "");
          setShowManual(true);
        } else {
          // scraping failed — show manual paste
          setShowManual(true);
        }
      },
    });
  }

  async function handleSave() {
    const jd = manualJD.trim();
    if (!jd || jd.length < 50) return;

    saveJob.mutate(
      {
        title: title || "Unknown Role",
        company: company || "Unknown",
        jdRaw: jd,
        url,
        source: "scraped",
      },
      {
        onSuccess: (res) => {
          onResult(res.data.job);
          onClose();
          setUrl("");
          setManualJD("");
          setShowManual(false);
          setTitle("");
          setCompany("");
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add job from URL"
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {!showManual ? (
          <>
            <Input
              label="Job posting URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://jobs.lever.co/company/job-id"
              hint="Works on Lever, Greenhouse, Wellfound, Unstop career pages"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleScrape}
                loading={scrape.isPending}
                disabled={!url.trim()}
              >
                Extract JD
              </Button>
              <Button variant="ghost" onClick={() => setShowManual(true)}>
                Paste manually instead
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="px-3 py-2 rounded-lg bg-[#21262d] text-xs text-[#8b949e]">
              {scrape.data?.data?.success
                ? "✓ JD extracted — review and save"
                : "⚠ Extraction failed — paste the JD manually below"}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Job Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Backend Engineer"
              />
              <Input
                label="Company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Razorpay"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#e6edf3]">
                Job Description
              </label>
              <textarea
                value={manualJD}
                onChange={(e) => setManualJD(e.target.value)}
                rows={8}
                placeholder="Paste the full job description here…"
                className="w-full px-3 py-2 rounded-lg text-sm bg-[#0d1117] border border-[#30363d] text-[#e6edf3] placeholder-[#484f58] outline-none focus:border-blue-500 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                loading={saveJob.isPending}
                disabled={manualJD.trim().length < 50}
              >
                Save to board
              </Button>
              <Button variant="secondary" onClick={() => setShowManual(false)}>
                Back
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Pipeline Modal ────────────────────────────────────────────────────────────
function PipelineModal({ open, onClose, applicationId, pipeline }) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(null);

  // start countdown when pipeline completes
  useEffect(() => {
    if (pipeline.result && applicationId) {
      setCountdown(3);
    }
  }, [pipeline.result, applicationId]);

  // tick down and auto-navigate
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      navigate(`/applications/${applicationId}`);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, applicationId, navigate]);

  return (
    <Modal open={open} onClose={onClose} title="Optimizing your resume">
      <div className="space-y-4">
        <PipelineProgress
          currentNode={pipeline.currentNode}
          completedNodes={pipeline.completedNodes}
          error={pipeline.error}
        />
        {pipeline.result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-green-400">
              <span>✓</span> Done — fit score: {pipeline.result.fitScore}, ATS:{" "}
              {pipeline.result.atsScore}
            </div>
            <p className="text-xs text-[#8b949e]">
              Redirecting in {countdown}s…
            </p>
            <Button
              className="w-full"
              onClick={() => navigate(`/applications/${applicationId}`)}
            >
              View full analysis now →
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
// ── Main Page ─────────────────────────────────────────────────────────────────
export default function JobsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("discover"); // discover | saved
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [optimizingJobId, setOptimizingJobId] = useState(null);
  const [currentAppId, setCurrentAppId] = useState(null);

  const pipeline = usePipeline();
  const { data: discoverData, isLoading: discovering } =
    useDiscoverJobs(activeQuery);
  const { data: savedData, isLoading: loadingSaved } = useSavedJobs();
  const saveJob = useSaveJob();
  const optimizeJob = useOptimizeJob();
  const queryClient = useQueryClient();

  // reset optimizing state when pipeline finishes or errors
  useEffect(() => {
    if (pipeline.result || pipeline.error) {
      setOptimizingJobId(null);
    }
  }, [pipeline.result, pipeline.error]);

  // invalidate applications AFTER pipeline completes — not on 202
  // because BullMQ processes async, data isn't ready on immediate 202
  useEffect(() => {
    if (pipeline.result) {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    }
  }, [pipeline.result]);

  const userSkills = user?.profile?.skills || [];
  const defaultQuery = userSkills.slice(0, 3).join(" ") || "software engineer";

  function handleDiscover() {
    setActiveQuery(searchQuery.trim() || defaultQuery);
    setTab("discover");
  }

  function handleSaveJob(job) {
    saveJob.mutate({
      title: job.title,
      company: job.company,
      jdRaw: job.jdRaw,
      url: job.url,
      source: job.source,
      location: job.location,
    });
  }

  function handleOptimize(jobId) {
    const socketId = getSocketId();
    setOptimizingJobId(jobId);
    pipeline.reset();

    optimizeJob.mutate(
      { jobId, socketId },
      {
        onSuccess: (res) => {
          setCurrentAppId(res.data.applicationId);
          setPipelineOpen(true);
        },
        onError: () => setOptimizingJobId(null),
      },
    );
  }

  // auto-open pipeline modal when pipeline starts
  // fix: state update during render is not allowed in React
  useEffect(() => {
    if (pipeline.running) setPipelineOpen(true);
  }, [pipeline.running]);

  const discoverJobs = discoverData?.jobs || [];
  const savedJobs = savedData?.jobs || [];

  return (
    <div className="space-y-5">
      {/* header */}
      <div>
        <h1 className="text-xl font-semibold text-[#e6edf3]">Job Board</h1>
        <p className="text-sm text-[#8b949e] mt-0.5">
          Discover, save, and optimize your resume for any job
        </p>
      </div>

      {/* search + actions */}
      <div className="flex gap-2">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleDiscover()}
          placeholder={`Search jobs (e.g. "${defaultQuery}")`}
          className="flex-1 px-3 py-2 rounded-lg text-sm bg-[#161b22] border border-[#30363d] text-[#e6edf3] placeholder-[#484f58] outline-none focus:border-blue-500"
        />
        <Button onClick={handleDiscover} loading={discovering && !!activeQuery}>
          Search
        </Button>
        <Button variant="secondary" onClick={() => setScrapeOpen(true)}>
          + Add URL
        </Button>
      </div>

      {/* tabs */}
      <div className="flex gap-1 bg-[#161b22] border border-[#30363d] rounded-lg p-1 w-fit">
        {[
          {
            key: "discover",
            label: `Discover${discoverJobs.length ? ` (${discoverJobs.length})` : ""}`,
          },
          {
            key: "saved",
            label: `Saved${savedJobs.length ? ` (${savedJobs.length})` : ""}`,
          },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-[#21262d] text-[#e6edf3]"
                : "text-[#8b949e] hover:text-[#e6edf3]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* discover tab */}
      {tab === "discover" && (
        <>
          {!activeQuery && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 text-4xl">◉</div>
              <p className="text-sm text-[#8b949e] mb-4">
                Search for jobs or click Search to find matches based on your
                skills
              </p>
              <Button
                onClick={() => {
                  setActiveQuery(defaultQuery);
                }}
              >
                Find jobs for my skills
              </Button>
            </div>
          )}
          {discovering && activeQuery && (
            <div className="flex items-center gap-2 text-[#8b949e] text-sm py-8 justify-center">
              <Spinner /> Fetching jobs from JSearch + Adzuna…
            </div>
          )}
          {!discovering && discoverJobs.length > 0 && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {discoverJobs.map((job, i) => (
                <JobCard
                  key={job._id || job.sourceId || i}
                  job={job}
                  onSave={handleSaveJob}
                  onOptimize={handleOptimize}
                  saved={false}
                  optimizing={optimizingJobId === job._id}
                />
              ))}
            </div>
          )}
          {!discovering && activeQuery && discoverJobs.length === 0 && (
            <div className="text-center py-12 text-sm text-[#8b949e]">
              No jobs found. Try a different search term.
            </div>
          )}
        </>
      )}

      {/* saved tab */}
      {tab === "saved" && (
        <>
          {loadingSaved && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}
          {!loadingSaved && savedJobs.length === 0 && (
            <div className="text-center py-16 text-sm text-[#8b949e]">
              No saved jobs yet. Discover jobs or add via URL.
            </div>
          )}
          {!loadingSaved && savedJobs.length > 0 && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {savedJobs.map((job) => (
                <JobCard
                  key={job._id}
                  job={job}
                  onSave={handleSaveJob}
                  onOptimize={handleOptimize}
                  saved={true}
                  optimizing={optimizingJobId === job._id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* modals */}
      <ScrapeModal
        open={scrapeOpen}
        onClose={() => setScrapeOpen(false)}
        onResult={() => setTab("saved")}
      />
      <PipelineModal
        open={pipelineOpen}
        onClose={() => {
          setPipelineOpen(false);
          setOptimizingJobId(null);
          pipeline.reset();
        }}
        applicationId={currentAppId}
        pipeline={pipeline}
      />
    </div>
  );
}
