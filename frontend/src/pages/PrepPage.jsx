import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { usePrepSession, useSubmitAnswer } from "../hooks/usePrep";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";

const CATEGORY_COLORS = {
  technical: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  behavioral: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  situational: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "role-specific": "bg-teal-500/15 text-teal-400 border-teal-500/30",
};

// ── Question Card ─────────────────────────────────────────────────────────────
function QuestionCard({ question, index, onSubmit, submitting }) {
  const [answer, setAnswer] = useState(question.userAnswer || "");
  const [showModel, setShowModel] = useState(false);
  const hasAnswered = question.score !== null && question.score !== undefined;

  // sync local answer state when React Query refreshes the session
  useEffect(() => {
    setAnswer(question.userAnswer || "");
  }, [question.userAnswer]);

  const scoreColor =
    question.score >= 0.8
      ? "text-green-400"
      : question.score >= 0.6
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <Card className="space-y-4">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center flex-1 min-w-0 gap-2">
          <span className="text-xs font-bold text-[#484f58] flex-shrink-0">
            Q{index + 1}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-md border capitalize flex-shrink-0 ${
              CATEGORY_COLORS[question.category] || CATEGORY_COLORS.technical
            }`}
          >
            {question.category}
          </span>
        </div>
        {hasAnswered && (
          <span className={`text-sm font-bold flex-shrink-0 ${scoreColor}`}>
            {Math.round(question.score * 100)}%
          </span>
        )}
      </div>

      {/* question */}
      <p className="text-sm text-[#e6edf3] leading-relaxed font-medium">
        {question.q}
      </p>

      {/* feedback after answer */}
      {hasAnswered && question.feedback && (
        <div className="px-3 py-2.5 rounded-lg bg-[#21262d] border border-[#30363d]">
          <p className="text-xs font-semibold text-[#8b949e] mb-1">Feedback</p>
          <p className="text-xs text-[#8b949e] leading-relaxed">
            {question.feedback}
          </p>
        </div>
      )}

      {/* answer area */}
      {!hasAnswered ? (
        <div className="space-y-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            placeholder="Type your answer here — be specific, use examples from your experience…"
            className="w-full px-3 py-2 rounded-lg text-sm bg-[#0d1117] border border-[#30363d] text-[#e6edf3] placeholder-[#484f58] outline-none focus:border-blue-500 resize-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onSubmit(index, answer)}
              loading={submitting}
              disabled={submitting || answer.trim().length < 20}
            >
              Submit answer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowModel((p) => !p)}
            >
              {showModel ? "Hide" : "Show"} model answer
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="px-3 py-2.5 rounded-lg bg-[#0d1117] border border-[#21262d]">
            <p className="text-xs font-semibold text-[#8b949e] mb-1">
              Your answer
            </p>
            <p className="text-xs text-[#8b949e] leading-relaxed">
              {question.userAnswer}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowModel((p) => !p)}
          >
            {showModel ? "Hide" : "Show"} model answer
          </Button>
        </div>
      )}

      {/* model answer */}
      {showModel && (
        <div className="px-3 py-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20">
          <p className="mb-1 text-xs font-semibold text-blue-400">
            Model answer
          </p>
          <p className="text-xs text-[#8b949e] leading-relaxed">{question.a}</p>
        </div>
      )}
    </Card>
  );
}

// ── Session Summary ────────────────────────────────────────────────────────────
function SessionSummary({ session }) {
  const avgPct = Math.round((session.avgScore || 0) * 100);
  const color =
    avgPct >= 80
      ? "text-green-400"
      : avgPct >= 60
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#e6edf3]">
          Session complete
        </h2>
        <span className={`text-2xl font-bold ${color}`}>{avgPct}%</span>
      </div>

      {session.weakPoints?.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-red-400">Needs work</p>
          <div className="space-y-1">
            {session.weakPoints.map((q, i) => (
              <p key={i} className="text-xs text-[#8b949e] flex gap-2">
                <span className="flex-shrink-0 text-red-400">·</span>
                {q}
              </p>
            ))}
          </div>
        </div>
      )}

      {session.strongPoints?.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-green-400">
            Strong areas
          </p>
          <div className="space-y-1">
            {session.strongPoints.map((q, i) => (
              <p key={i} className="text-xs text-[#8b949e] flex gap-2">
                <span className="flex-shrink-0 text-green-400">·</span>
                {q}
              </p>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PrepPage() {
  const { applicationId } = useParams();
  const { data: session, isLoading } = usePrepSession(applicationId);
  const { mutate: submitAnswer, isPending: submitting } =
    useSubmitAnswer(applicationId);
  const [submittingIndex, setSubmittingIndex] = useState(null);

  function handleSubmit(index, answer) {
    setSubmittingIndex(index);
    submitAnswer(
      { questionIndex: index, userAnswer: answer },
      { onSettled: () => setSubmittingIndex(null) },
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-[#8b949e] mb-3">
          No prep session found. Run the analysis pipeline first.
        </p>
        <Link to={`/applications/${applicationId}`}>
          <Button variant="secondary" size="sm">
            ← Back to application
          </Button>
        </Link>
      </div>
    );
  }

  const answered = session.questions.filter((q) => q.score !== null).length;
  const total = session.questions.length;
  const progress = Math.round((answered / total) * 100);

  return (
    <div className="max-w-2xl space-y-5">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to={`/applications/${applicationId}`}
            className="text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors"
          >
            ← Back to application
          </Link>
          <h1 className="text-xl font-semibold text-[#e6edf3] mt-1">
            Interview Prep
          </h1>
          <p className="text-sm text-[#8b949e]">
            {answered}/{total} answered
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-[#8b949e] mb-1">{progress}% done</div>
          <div className="w-24 h-1.5 bg-[#21262d] rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500 bg-blue-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* session summary if complete */}
      {session.status === "completed" && <SessionSummary session={session} />}

      {/* category breakdown */}
      <div className="flex flex-wrap gap-2">
        {["technical", "behavioral", "situational", "role-specific"].map(
          (cat) => {
            const count = session.questions.filter(
              (q) => q.category === cat,
            ).length;
            if (!count) return null;
            return (
              <span
                key={cat}
                className={`text-xs px-2.5 py-1 rounded-lg border ${CATEGORY_COLORS[cat]}`}
              >
                {cat}: {count}
              </span>
            );
          },
        )}
      </div>

      {/* questions */}
      <div className="space-y-4">
        {session.questions.map((q, i) => (
          <QuestionCard
            key={i}
            question={q}
            index={i}
            onSubmit={handleSubmit}
            submitting={submitting && submittingIndex === i}
          />
        ))}
      </div>
    </div>
  );
}
