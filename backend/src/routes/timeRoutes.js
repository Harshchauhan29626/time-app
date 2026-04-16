import { Router } from 'express';
import dayjs from 'dayjs';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getRange, minutesBetween } from '../utils/time.js';
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

function calculateLiveEntryMinutes(entry, now = new Date()) {
  const breaks = entry.breakEntries || [];
  const breakMinutes = breaks.reduce((sum, item) => {
    const breakEnd = item.breakEnd || now;
    return sum + minutesBetween(item.breakStart, breakEnd);
  }, 0);

  const workedMinutes = Math.max(0, minutesBetween(entry.clockIn, now) - breakMinutes);

  return { workedMinutes, breakMinutes };
}

function overlapsRange(entry, start, end, now = new Date()) {
  const entryStart = new Date(entry.clockIn);
  const entryEnd = entry.clockOut ? new Date(entry.clockOut) : now;
  return entryStart <= end && entryEnd >= start;
}

router.post('/time/clock-in', asyncHandler(async (req, res) => {
  const active = await findActiveEntry(req.user.id);
  if (active) return res.status(400).json({ message: 'Active entry already exists' });
  const timezone = req.user.timezone || req.user.companyTimezone || 'UTC';
  const { start: dayStart } = getRange('day', timezone);

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
      entryDate: dayStart,
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
  const activeBreak = entry?.breakEntries?.find((item) => !item.breakEnd) || null;

  res.json({
    currentActiveEntry: entry,
    isTracking: Boolean(entry),
    isOnBreak: Boolean(activeBreak),
    activeBreak,
  });
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
  const timezone = req.user.timezone || req.user.companyTimezone || 'UTC';
  const where = { companyId: req.user.companyId };
  if (req.user.role === 'employee') where.userId = req.user.id;

  let selectedRange = null;
  if (range === 'today') selectedRange = getRange('day', timezone);
  if (range === 'week') selectedRange = getRange('week', timezone);
  if (range === 'month') selectedRange = getRange('month', timezone);
  if (range === 'custom' && startDate && endDate) selectedRange = { start: new Date(startDate), end: new Date(endDate) };

  if (selectedRange) {
    where.OR = [
      { entryDate: { gte: selectedRange.start, lte: selectedRange.end } },
      { clockOut: null, clockIn: { lte: selectedRange.end } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.timeEntry.count({ where }),
    prisma.timeEntry.findMany({
      where,
      orderBy: { clockIn: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, email: true } }, breakEntries: true },
    }),
  ]);

  const now = new Date();
  const transformedRows = rows
    .filter((row) => {
      if (!selectedRange) return true;
      return overlapsRange(row, selectedRange.start, selectedRange.end, now);
    })
    .map((row) => {
      const live = row.clockOut ? null : calculateLiveEntryMinutes(row, now);
      return {
        id: row.id,
        date: row.entryDate,
        clockIn: row.clockIn,
        clockOut: row.clockOut,
        workedMinutes: row.clockOut ? (row.totalWorkMinutes || 0) : live.workedMinutes,
        breakMinutes: row.clockOut ? (row.totalBreakMinutes || 0) : live.breakMinutes,
        overtimeMinutes: row.overtimeMinutes || 0,
        status: row.clockOut ? (row.status || 'completed') : 'active',
        user: row.user,
      };
    });

  res.json({
    data: transformedRows,
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
