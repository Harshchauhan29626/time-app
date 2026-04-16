export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message
    || fallback;
}

export function minutesToHours(minutes) {
  if (!Number.isFinite(Number(minutes))) return '0.00h';
  return `${(Number(minutes) / 60).toFixed(2)}h`;
}

export function minutesToCompact(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (!hours) return `${mins}m`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
