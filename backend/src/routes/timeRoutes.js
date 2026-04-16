import { Router } from 'express';
import dayjs from 'dayjs';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { minutesBetween } from '../utils/time.js';
import { logActivity } from '../services/activityService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function toTimeDate(value, fallback = '09:00') {
  if (value instanceof Date) return value;
  const normalized = typeof value === 'string' && value.includes(':') ? value : fallback;
  return new Date(`1970-01-01T${normalized}:00.000Z`);
}

function getScheduleMinutes(schedule, date) {
  if (!schedule) return 0;
  const dayName = dayNames[dayjs(date).day()];
  const targetDay = schedule.workScheduleDays?.find((item) => item.dayName === dayName && item.isWorking);

  if (targetDay?.startTime && targetDay?.endTime) {
    const duration = minutesBetween(targetDay.startTime, targetDay.endTime);
    return Math.max(0, duration - (schedule.breakMinutes || 0));
  }

  const weeklyMinutes = Math.round(Number(schedule.weeklyHours || 0) * 60);
  return weeklyMinutes > 0 ? Math.round(weeklyMinutes / 5) : 0;
}

async function findActiveEntry(userId) {
  return prisma.timeEntry.findFirst({
    where: { userId, clockOut: null },
    include: { breakEntries: true },
    orderBy: { clockIn: 'desc' },
  });
}

router.post('/time/clock-in', asyncHandler(async (req, res) => {
  const active = await findActiveEntry(req.user.id);
  if (active) return res.status(400).json({ message: 'Active entry already exists' });

  const assignment = await prisma.userWorkScheduleAssignment.findFirst({
    where: {
      userId: req.user.id,
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  const entry = await prisma.timeEntry.create({
    data: {
      companyId: req.user.companyId,
      userId: req.user.id,
      workScheduleId: assignment?.workScheduleId || null,
      entryDate: dayjs().startOf('day').toDate(),
      clockIn: new Date(),
      status: 'active',
    },
  });

  await logActivity({ companyId: req.user.companyId, userId: req.user.id, type: 'clocked_in', message: `${req.user.name} clocked in` });
  res.json(entry);
}));

router.post('/time/clock-out', asyncHandler(async (req, res) => {
  const entry = await findActiveEntry(req.user.id);
  if (!entry) return res.status(400).json({ message: 'No active entry to clock out' });

  const activeBreak = entry.breakEntries.find((item) => !item.breakEnd);
  if (activeBreak) return res.status(400).json({ message: 'End active break before clock out' });

  const clockOut = new Date();
  const breakMinutes = entry.breakEntries.reduce((sum, item) => sum + (item.totalMinutes || 0), 0);
  const totalMinutes = minutesBetween(entry.clockIn, clockOut);
  const workedMinutes = Math.max(0, totalMinutes - breakMinutes);

  const schedule = entry.workScheduleId
    ? await prisma.workSchedule.findUnique({ where: { id: entry.workScheduleId }, include: { workScheduleDays: true } })
    : null;
  const scheduledMinutes = getScheduleMinutes(schedule, entry.entryDate);

  const updated = await prisma.timeEntry.update({
    where: { id: entry.id },
    data: {
      clockOut,
      totalBreakMinutes: breakMinutes,
      totalWorkMinutes: workedMinutes,
      overtimeMinutes: Math.max(0, workedMinutes - scheduledMinutes),
      status: 'completed',
    },
  });

  await logActivity({ companyId: req.user.companyId, userId: req.user.id, type: 'clocked_out', message: `${req.user.name} clocked out` });
  res.json(updated);
}));

router.post('/time/break/start', asyncHandler(async (req, res) => {
  const entry = await findActiveEntry(req.user.id);
  if (!entry) return res.status(400).json({ message: 'No active entry' });
  if (entry.breakEntries.some((item) => !item.breakEnd)) return res.status(400).json({ message: 'Active break already exists' });

  const breakEntry = await prisma.breakEntry.create({
    data: {
      timeEntryId: entry.id,
      breakStart: new Date(),
      status: 'active',
    },
  });

  await logActivity({ companyId: req.user.companyId, userId: req.user.id, type: 'break_started', message: `${req.user.name} started a break` });
  res.json(breakEntry);
}));

router.post('/time/break/end', asyncHandler(async (req, res) => {
  const entry = await findActiveEntry(req.user.id);
  if (!entry) return res.status(400).json({ message: 'No active entry' });

  const activeBreak = entry.breakEntries.find((item) => !item.breakEnd);
  if (!activeBreak) return res.status(400).json({ message: 'No active break' });

  const breakEnd = new Date();
  const updated = await prisma.breakEntry.update({
    where: { id: activeBreak.id },
    data: {
      breakEnd,
      totalMinutes: minutesBetween(activeBreak.breakStart, breakEnd),
      status: 'completed',
    },
  });

  await logActivity({ companyId: req.user.companyId, userId: req.user.id, type: 'break_ended', message: `${req.user.name} ended a break` });
  res.json(updated);
}));

router.get('/time/current', asyncHandler(async (req, res) => {
  const entry = await findActiveEntry(req.user.id);
  res.json(entry);
}));

router.get('/time-entries', asyncHandler(async (req, res) => {
  const parsed = z.object({
    page: z.coerce.number().default(1),
    pageSize: z.coerce.number().default(10),
    range: z.enum(['today', 'week', 'month', 'custom']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).safeParse(req.query);

  if (!parsed.success) return res.status(400).json({ message: 'Invalid query' });

  const { page, pageSize, range, startDate, endDate } = parsed.data;
  const where = { companyId: req.user.companyId };
  if (req.user.role === 'employee') where.userId = req.user.id;

  if (range === 'today') where.entryDate = { gte: dayjs().startOf('day').toDate(), lte: dayjs().endOf('day').toDate() };
  if (range === 'week') where.entryDate = { gte: dayjs().startOf('week').toDate(), lte: dayjs().endOf('week').toDate() };
  if (range === 'month') where.entryDate = { gte: dayjs().startOf('month').toDate(), lte: dayjs().endOf('month').toDate() };
  if (range === 'custom' && startDate && endDate) where.entryDate = { gte: new Date(startDate), lte: new Date(endDate) };

  const [total, rows] = await Promise.all([
    prisma.timeEntry.count({ where }),
    prisma.timeEntry.findMany({
      where,
      orderBy: { clockIn: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  res.json({
    data: rows,
    pagination: { total, page, pageSize, pages: Math.ceil(total / pageSize) || 1 },
  });
}));

router.get('/time-entries/:id', asyncHandler(async (req, res) => {
  const id = BigInt(req.params.id);
  const row = await prisma.timeEntry.findUnique({ where: { id }, include: { breakEntries: true, user: true } });
  if (!row || row.companyId !== req.user.companyId) return res.status(404).json({ message: 'Not found' });
  if (req.user.role === 'employee' && row.userId !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
  res.json(row);
}));

export default router;
