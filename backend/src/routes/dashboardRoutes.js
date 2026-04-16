import { Router } from 'express';
import dayjs from 'dayjs';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getRange, minutesBetween } from '../utils/time.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

function calculateLiveEntryTotals(entry, now = new Date()) {
  const breaks = entry.breakEntries || [];
  const completedBreakMinutes = breaks.reduce((sum, item) => sum + (item.totalMinutes || 0), 0);
  const runningBreakMinutes = breaks
    .filter((item) => !item.breakEnd)
    .reduce((sum, item) => sum + minutesBetween(item.breakStart, now), 0);

  const breakMinutes = completedBreakMinutes + runningBreakMinutes;
  const workedMinutes = Math.max(0, minutesBetween(entry.clockIn, now) - breakMinutes);

  return {
    workedMinutes,
    breakMinutes,
  };
}

router.get('/dashboard/summary', asyncHandler(async (req, res) => {
  const range = ['day', 'week', 'month'].includes(req.query.range) ? req.query.range : 'week';
  const { start, end } = getRange(range);
  const now = new Date();

  const where = {
    companyId: req.user.companyId,
    entryDate: { gte: start, lte: end },
  };

  if (req.user.role === 'employee') where.userId = req.user.id;

  const [entries, currentEntry, upcomingHolidays, upcomingTimeOff, recentActivity] = await Promise.all([
    prisma.timeEntry.findMany({ where, orderBy: { clockIn: 'asc' }, include: { breakEntries: true } }),
    prisma.timeEntry.findFirst({ where: { userId: req.user.id, clockOut: null }, include: { breakEntries: true }, orderBy: { clockIn: 'desc' } }),
    prisma.holiday.findMany({ where: { companyId: req.user.companyId, holidayDate: { gte: dayjs().startOf('day').toDate() } }, orderBy: { holidayDate: 'asc' }, take: 5 }),
    prisma.timeOffRequest.findMany({
      where: { companyId: req.user.companyId, status: 'approved', startDate: { gte: dayjs().startOf('day').toDate() } },
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

  const chartMap = {};
  entries.forEach((entry) => {
    const key = dayjs(entry.entryDate).format('YYYY-MM-DD');
    if (!entry.clockOut) {
      chartMap[key] = (chartMap[key] || 0) + calculateLiveEntryTotals(entry, now).workedMinutes;
      return;
    }
    chartMap[key] = (chartMap[key] || 0) + (entry.totalWorkMinutes || 0);
  });

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
