import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const navItems = [
  { to: "/dashboard", icon: "◈", label: "Dashboard" },
  { to: "/analyze", icon: "⟡", label: "Analyze JD" },
  { to: "/applications", icon: "▦", label: "Applications" },
  { to: "/jobs", icon: "◉", label: "Job Board" },
  { to: "/profile", icon: "◎", label: "Profile" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <aside className="w-56 min-w-56 bg-[#161b22] border-r border-[#30363d] flex flex-col h-full">
      {/* brand */}
      <div className="px-4 py-5 border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
            A
          </div>
          <span className="text-sm font-semibold text-[#e6edf3]">ApplyAI</span>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="px-2 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600/15 text-blue-400 border border-blue-500/20"
                    : "text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]"
                }`
              }
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* user section */}
      <div className="px-3 py-3 border-t border-[#30363d]">
        {/* profile has resume or not indicator */}
        {!user?.profile?.resumeRaw && (
          <NavLink
            to="/profile"
            className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs hover:bg-yellow-500/15 transition-colors"
          >
            <span>⚠</span>
            Upload resume first
          </NavLink>
        )}

        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#e6edf3] truncate">
              {user?.name}
            </p>
            <p className="text-xs text-[#8b949e] truncate">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full mt-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[#8b949e] hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <span>→</span> Sign out
        </button>
      </div>
    </aside>
  );
}
