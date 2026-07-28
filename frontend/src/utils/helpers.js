// format date to readable string
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// time ago — "2 days ago"
export function timeAgo(dateStr) {
  if (!dateStr) return "";
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

// score to color class
export function scoreColor(score) {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

// score to background color
export function scoreBg(score) {
  if (score >= 80) return "bg-green-500/15 border-green-500/30 text-green-400";
  if (score >= 60)
    return "bg-yellow-500/15 border-yellow-500/30 text-yellow-400";
  if (score >= 40)
    return "bg-orange-500/15 border-orange-500/30 text-orange-400";
  return "bg-red-500/15 border-red-500/30 text-red-400";
}

// status label + color
export const statusConfig = {
  saved: {
    label: "Saved",
    color: "bg-[#21262d] text-[#8b949e] border-[#30363d]",
  },
  applied: {
    label: "Applied",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  screening: {
    label: "Screening",
    color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  interview: {
    label: "Interview",
    color: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  },
  offer: {
    label: "Offer",
    color: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-500/15 text-red-400 border-red-500/30",
  },
};

// truncate long strings
export function truncate(str, n = 40) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n) + "…" : str;
}

// get initials from name
export function initials(name = "") {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
