import Spinner from "../ui/Spinner";

const NODE_ORDER = [
  { key: "jd_parser", label: "Parsing job description", icon: "📋" },
  { key: "fit_scorer", label: "Scoring semantic fit", icon: "📊" },
  { key: "ats_scanner", label: "Scanning ATS keywords", icon: "🔍" },
  { key: "gap_analyzer", label: "Analyzing skill gaps", icon: "🧩" },
  { key: "bullet_rewriter", label: "Rewriting resume bullets", icon: "✏️" },
  { key: "kw_injector", label: "Injecting keywords honestly", icon: "🔑" },
  { key: "ats_validator", label: "Validating ATS score", icon: "✅" },
  { key: "pdf_builder", label: "Building resume JSON", icon: "📄" },
  { key: "crm_logger", label: "Saving to database", icon: "💾" },
  {
    key: "interview_prep",
    label: "Generating interview questions",
    icon: "🎯",
  },
];

export default function PipelineProgress({
  currentNode,
  completedNodes = [],
  error,
}) {
  const currentIndex = NODE_ORDER.findIndex((n) => n.key === currentNode);
  const progress = Math.round(
    (completedNodes.length / NODE_ORDER.length) * 100,
  );

  return (
    <div className="space-y-4">
      {/* progress bar */}
      <div>
        <div className="flex justify-between text-xs text-[#8b949e] mb-1.5">
          <span>Pipeline running…</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* nodes */}
      <div className="space-y-1.5">
        {NODE_ORDER.map((node) => {
          const done = completedNodes.includes(node.key);
          const active = currentNode === node.key;
          const pending = !done && !active;

          return (
            <div
              key={node.key}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-300
                ${active ? "bg-blue-500/10 border border-blue-500/20" : ""}
                ${done ? "opacity-60" : ""}
                ${pending ? "opacity-30" : ""}
              `}
            >
              {/* status indicator */}
              <div className="w-5 flex-shrink-0 flex items-center justify-center">
                {done && <span className="text-green-400 text-xs">✓</span>}
                {active && <Spinner size="sm" />}
                {pending && <span className="text-[#484f58] text-xs">○</span>}
              </div>

              {/* icon */}
              <span className="text-base leading-none">{node.icon}</span>

              {/* label */}
              <span
                className={
                  active ? "text-blue-400 font-medium" : "text-[#8b949e]"
                }
              >
                {node.label}
              </span>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          Pipeline error: {error}
        </div>
      )}
    </div>
  );
}
