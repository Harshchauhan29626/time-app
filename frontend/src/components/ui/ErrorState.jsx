export default function ErrorState({ title = 'Unable to load data', message, onRetry }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
      <p className="font-semibold text-rose-700">{title}</p>
      <p className="text-sm text-rose-600 mt-1">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700">
          Retry
        </button>
      ) : null}
    </div>
  );
}
