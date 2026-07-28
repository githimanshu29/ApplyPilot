const variants = {
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  green: "bg-green-500/15 text-green-400 border-green-500/30",
  yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  red: "bg-red-500/15 text-red-400 border-red-500/30",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  gray: "bg-[#21262d] text-[#8b949e] border-[#30363d]",
  orange: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  teal: "bg-teal-500/15 text-teal-400 border-teal-500/30",
};

// maps application status to color
export const statusColor = {
  saved: "gray",
  applied: "blue",
  screening: "yellow",
  interview: "purple",
  offer: "green",
  rejected: "red",
};

export default function Badge({ children, variant = "gray", className = "" }) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border
        ${variants[variant] || variants.gray}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
