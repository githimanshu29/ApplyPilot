import Spinner from "./Spinner";

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white",
    secondary:
      "bg-[#21262d] hover:bg-[#2d333b] text-[#e6edf3] border border-[#30363d]",
    danger: "bg-red-600 hover:bg-red-500 text-white",
    ghost: "hover:bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3]",
    success: "bg-green-700 hover:bg-green-600 text-white",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-sm",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
