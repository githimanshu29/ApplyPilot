export default function ScoreRing({
  score = 0,
  label,
  size = 100,
  color = "#388bfd",
}) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  // color based on score range
  const strokeColor =
    score >= 80
      ? "#3fb950"
      : score >= 60
        ? "#e3b341"
        : score >= 40
          ? "#f0883e"
          : "#f85149";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        {/* background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#21262d"
          strokeWidth={8}
        />
        {/* progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="text-center" style={{ marginTop: `-${size / 2 + 12}px` }}>
        <div className="text-xl font-bold" style={{ color: strokeColor }}>
          {score}
        </div>
        <div className="text-xs text-[#8b949e]">{label}</div>
      </div>
      <div style={{ height: `${size / 2 - 8}px` }} />
    </div>
  );
}
