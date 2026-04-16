import { Router } from 'express';
import dayjs from 'dayjs';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getRange, minutesBetween } from '../utils/time.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

function calculateLiveEntryTotals(entry, now = new Date(), windowStart = null, windowEnd = now) {
  const windowStartDate = windowStart ? new Date(windowStart) : null;
  const windowEndDate = new Date(windowEnd);
  const clockInDate = new Date(entry.clockIn);
  const effectiveStart = windowStartDate && clockInDate < windowStartDate ? windowStartDate : clockInDate;
  const effectiveEnd = windowEndDate;

  if (effectiveStart >= effectiveEnd) {
    return { workedMinutes: 0, breakMinutes: 0 };
  }

  const breaks = entry.breakEntries || [];
  const breakMinutes = breaks.reduce((sum, item) => {
    const breakStart = new Date(item.breakStart);
    const breakEnd = item.breakEnd ? new Date(item.breakEnd) : new Date(now);
    const overlapStart = breakStart > effectiveStart ? breakStart : effectiveStart;
    const overlapEnd = breakEnd < effectiveEnd ? breakEnd : effectiveEnd;

    if (overlapEnd <= overlapStart) return sum;
    return sum + minutesBetween(overlapStart, overlapEnd);
  }, 0);
  const workedMinutes = Math.max(0, minutesBetween(effectiveStart, effectiveEnd) - breakMinutes);

  return {
    workedMinutes,
    breakMinutes,
  };
}

router.get('/dashboard/summary', asyncHandler(async (req, res) => {
  const range = ['day', 'week', 'month'].includes(req.query.range) ? req.query.range : 'week';
  const timezone = req.user.timezone || req.user.companyTimezone || 'UTC';
  const { start, end } = getRange(range, timezone);
  const { start: todayStart } = getRange('day', timezone);
  const now = new Date();

  const where = {
    companyId: req.user.companyId,
    entryDate: { gte: start, lte: end },
  };

  if (req.user.role === 'employee') where.userId = req.user.id;

  const [entries, currentEntry, upcomingHolidays, upcomingTimeOff, recentActivity] = await Promise.all([
    prisma.timeEntry.findMany({ where, orderBy: { clockIn: 'asc' }, include: { breakEntries: true } }),
    prisma.timeEntry.findFirst({ where: { userId: req.user.id, clockOut: null }, include: { breakEntries: true }, orderBy: { clockIn: 'desc' } }),
    prisma.holiday.findMany({ where: { companyId: req.user.companyId, holidayDate: { gte: todayStart } }, orderBy: { holidayDate: 'asc' }, take: 5 }),
    prisma.timeOffRequest.findMany({
      where: { companyId: req.user.companyId, status: 'approved', startDate: { gte: todayStart } },
      include: { user: { select: { name: true } }, timeOffType: { select: { name: true } } },
      orderBy: { startDate: 'asc' },
      take: 5,
    }),
    prisma.activity.findMany({
      where: { companyId: req.user.companyId },
      include: { user: { select: { name: true } } },
      orderBy: { activityTime: 'desc' },
      take: 10,
    }),
  ]);

  const totals = entries.reduce((acc, entry) => {
    if (!entry.clockOut) {
      const live = calculateLiveEntryTotals(entry, now);
      return {
        workedMinutes: acc.workedMinutes + live.workedMinutes,
        breakMinutes: acc.breakMinutes + live.breakMinutes,
        overtimeMinutes: acc.overtimeMinutes + (entry.overtimeMinutes || 0),
      };
    }

    return {
      workedMinutes: acc.workedMinutes + (entry.totalWorkMinutes || 0),
      breakMinutes: acc.breakMinutes + (entry.totalBreakMinutes || 0),
      overtimeMinutes: acc.overtimeMinutes + (entry.overtimeMinutes || 0),
    };
  }, { workedMinutes: 0, breakMinutes: 0, overtimeMinutes: 0 });

  const activeBreak = currentEntry?.breakEntries?.find((item) => !item.breakEnd) || null;

  if (range === 'day' && currentEntry?.clockIn) {
    const isCurrentEntryInRange = entries.some((entry) => String(entry.id) === String(currentEntry.id));
    if (!isCurrentEntryInRange) {
      const liveToday = calculateLiveEntryTotals(currentEntry, now, start, now);
      totals.workedMinutes += liveToday.workedMinutes;
      totals.breakMinutes += liveToday.breakMinutes;
      totals.overtimeMinutes += currentEntry.overtimeMinutes || 0;
    }
  }

  const chartMap = {};
  entries.forEach((entry) => {
    const key = dayjs(entry.entryDate).tz(timezone).format('YYYY-MM-DD');
    if (!entry.clockOut) {
      chartMap[key] = (chartMap[key] || 0) + calculateLiveEntryTotals(entry, now).workedMinutes;
      return;
    }
    chartMap[key] = (chartMap[key] || 0) + (entry.totalWorkMinutes || 0);
  });

  if (range === 'day' && currentEntry?.clockIn && !entries.some((entry) => String(entry.id) === String(currentEntry.id))) {
    const todayKey = dayjs(start).tz(timezone).format('YYYY-MM-DD');
    chartMap[todayKey] = (chartMap[todayKey] || 0) + calculateLiveEntryTotals(currentEntry, now, start, now).workedMinutes;
  }

  const currentStatus = currentEntry ? (activeBreak ? 'on_break' : 'clocked_in') : 'not_tracking';

  const normalizedActivity = recentActivity.map((activity) => ({
    ...activity,
    message: activity.description || activity.title,
  }));

  res.json({
    workedMinutes: totals.workedMinutes,
    breakMinutes: totals.breakMinutes,
    overtimeMinutes: totals.overtimeMinutes,
    currentStatus,
    currentEntry,
    currentActiveEntry: currentEntry,
    isTracking: Boolean(currentEntry),
    isOnBreak: Boolean(activeBreak),
    upcomingHolidays,
    upcomingTimeOff,
    recentActivity: normalizedActivity,
    recentActivities: normalizedActivity,
    chartData: Object.entries(chartMap).map(([date, minutes]) => ({
      date,
      hours: Number((minutes / 60).toFixed(2)),
    })),
  });
}));

export default router;
