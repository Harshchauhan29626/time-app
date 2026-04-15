import dayjs from 'dayjs';

export const minutesBetween = (start, end) => Math.max(0, dayjs(end).diff(dayjs(start), 'minute'));

export function getRange(range) {
  const now = dayjs();
  if (range === 'month') return { start: now.startOf('month').toDate(), end: now.endOf('month').toDate() };
  if (range === 'week') return { start: now.startOf('week').toDate(), end: now.endOf('week').toDate() };
  return { start: now.startOf('day').toDate(), end: now.endOf('day').toDate() };
}
