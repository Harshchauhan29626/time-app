export default function EmptyState({ title, message }) {
  return (
    <div className="rounded-2xl bg-white border border-dashed border-slate-200 p-10 text-center shadow-sm">
      <p className="text-lg font-medium text-slate-800">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
    </div>
  );
}
