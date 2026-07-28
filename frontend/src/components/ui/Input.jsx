export default function Input({
  label,
  error,
  hint,
  className = "",
  ...props
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-[#e6edf3]">{label}</label>
      )}
      <input
        className={`
          w-full px-3 py-2 rounded-lg text-sm
          bg-[#0d1117] border border-[#30363d]
          text-[#e6edf3] placeholder-[#484f58]
          outline-none transition-colors
          focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500/30" : ""}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-[#8b949e]">{hint}</p>}
    </div>
  );
}
