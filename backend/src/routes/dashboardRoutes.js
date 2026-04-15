import { Router } from 'express';
import dayjs from 'dayjs';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getRange } from '../utils/time.js';

const router = Router();
router.use(requireAuth);

router.get('/dashboard/summary', async (req, res) => {
  const range = ['day', 'week', 'month'].includes(req.query.range) ? req.query.range : 'week';
  const { start, end } = getRange(range);
  const userScope = req.user.role === 'employee' ? { userId: req.user.id } : {};
  const where = { companyId: req.user.companyId, clockIn: { gte: start, lte: end }, ...userScope };
  const entries = await prisma.timeEntry.findMany({ where });
  const totals = entries.reduce(
    (acc, e) => ({
      workedMinutes: acc.workedMinutes + e.workedMinutes,
      breakMinutes: acc.breakMinutes + e.breakMinutes,
      overtimeMinutes: acc.overtimeMinutes + e.overtimeMinutes,
    }),
    { workedMinutes: 0, breakMinutes: 0, overtimeMinutes: 0 },
  );
  const currentActiveEntry = await prisma.timeEntry.findFirst({ where: { userId: req.user.id, clockOut: null }, include: { breaks: true } });
  const upcomingHolidays = await prisma.holiday.findMany({ where: { companyId: req.user.companyId, holidayDate: { gte: new Date() } }, orderBy: { holidayDate: 'asc' }, take: 5 });
  const upcomingTimeOff = await prisma.timeOffRequest.findMany({
    where: { companyId: req.user.companyId, status: 'approved', startDate: { gte: new Date() } },
    include: { user: true, timeOffType: true },
    orderBy: { startDate: 'asc' },
    take: 5,
  });
  const recentActivities = await prisma.activity.findMany({ where: { companyId: req.user.companyId }, include: { user: true }, orderBy: { createdAt: 'desc' }, take: 10 });

  const chartMap = {};
  entries.forEach((e) => {
    const key = dayjs(e.clockIn).format('YYYY-MM-DD');
    chartMap[key] = (chartMap[key] || 0) + e.workedMinutes;
  });

  res.json({
    ...totals,
    currentActiveEntry,
    upcomingHolidays,
    upcomingTimeOff,
    recentActivities,
    chartData: Object.entries(chartMap).map(([date, minutes]) => ({ date, hours: Number((minutes / 60).toFixed(2)) })),
  });
});

export default router;
