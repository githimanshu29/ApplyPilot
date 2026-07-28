export default function Card({ children, className = "", ...props }) {
  return (
    <div
      className={`bg-[#161b22] border border-[#30363d] rounded-xl p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
