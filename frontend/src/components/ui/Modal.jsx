import { useEffect } from "react";
import Button from "./Button";

export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}) {
  // close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* panel */}
      <div
        className={`relative w-full ${maxWidth} bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d]">
          <h3 className="text-sm font-semibold text-[#e6edf3]">{title}</h3>
          <button
            onClick={onClose}
            className="text-[#8b949e] hover:text-[#e6edf3] transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
