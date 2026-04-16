import { Router } from 'express';
import dayjs from 'dayjs';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getRange } from '../utils/time.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

router.get('/dashboard/summary', asyncHandler(async (req, res) => {
  const range = ['day', 'week', 'month'].includes(req.query.range) ? req.query.range : 'week';
  const { start, end } = getRange(range);

  const where = {
    companyId: req.user.companyId,
    entryDate: { gte: start, lte: end },
  };

  if (req.user.role === 'employee') where.userId = req.user.id;

  const [entries, currentActiveEntry, upcomingHolidays, upcomingTimeOff, recentActivities] = await Promise.all([
    prisma.timeEntry.findMany({ where, orderBy: { clockIn: 'asc' } }),
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

  const totals = entries.reduce((acc, entry) => ({
    workedMinutes: acc.workedMinutes + (entry.totalWorkMinutes || 0),
    breakMinutes: acc.breakMinutes + (entry.totalBreakMinutes || 0),
    overtimeMinutes: acc.overtimeMinutes + (entry.overtimeMinutes || 0),
  }), { workedMinutes: 0, breakMinutes: 0, overtimeMinutes: 0 });

  const chartMap = {};
  entries.forEach((entry) => {
    const key = dayjs(entry.entryDate).format('YYYY-MM-DD');
    chartMap[key] = (chartMap[key] || 0) + (entry.totalWorkMinutes || 0);
  });

  res.json({
    ...totals,
    currentActiveEntry,
    upcomingHolidays,
    upcomingTimeOff,
    recentActivities: recentActivities.map((activity) => ({
      ...activity,
      message: activity.description || activity.title,
    })),
    chartData: Object.entries(chartMap).map(([date, minutes]) => ({
      date,
      hours: Number((minutes / 60).toFixed(2)),
    })),
  });
}));

export default router;
