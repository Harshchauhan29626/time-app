export default function StatCard({ label, value, hint }) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </article>
  );
}
