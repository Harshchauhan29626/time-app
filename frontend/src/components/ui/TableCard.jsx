export default function TableCard({ children }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
