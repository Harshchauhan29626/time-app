import { Router } from 'express';
import dayjs from 'dayjs';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { minutesBetween } from '../utils/time.js';
import { logActivity } from '../services/activityService.js';

const router = Router();
router.use(requireAuth);

async function getScheduledMinutesForDay(userId, date) {
  const assignment = await prisma.userWorkScheduleAssignment.findFirst({
    where: { userId, OR: [{ endsOn: null }, { endsOn: { gte: date } }], startsOn: { lte: date } },
    include: { workSchedule: { include: { days: true } } },
    orderBy: { startsOn: 'desc' },
  });
  if (!assignment) return 0;
  const weekday = dayjs(date).day();
  const day = assignment.workSchedule.days.find((d) => d.weekday === weekday);
  return day?.scheduledMinutes || 0;
}

router.post('/time/clock-in', async (req, res) => {
  const active = await prisma.timeEntry.findFirst({ where: { userId: req.user.id, clockOut: null } });
  if (active) return res.status(400).json({ message: 'Active entry already exists' });
  const entry = await prisma.timeEntry.create({ data: { companyId: req.user.companyId, userId: req.user.id, clockIn: new Date() } });
  await logActivity({ companyId: req.user.companyId, userId: req.user.id, type: 'clocked_in', message: `${req.user.name} clocked in` });
  res.json(entry);
});

router.post('/time/clock-out', async (req, res) => {
  const entry = await prisma.timeEntry.findFirst({ where: { userId: req.user.id, clockOut: null }, include: { breaks: true } });
  if (!entry) return res.status(400).json({ message: 'No active entry to clock out' });
  const activeBreak = entry.breaks.find((b) => !b.endAt);
  if (activeBreak) return res.status(400).json({ message: 'End active break before clock out' });
  const clockOut = new Date();
  const breakMinutes = entry.breaks.reduce((sum, b) => sum + b.minutes, 0);
  const totalMinutes = minutesBetween(entry.clockIn, clockOut);
  const workedMinutes = Math.max(0, totalMinutes - breakMinutes);
  const scheduledMinutes = await getScheduledMinutesForDay(req.user.id, entry.clockIn);
  const overtimeMinutes = Math.max(0, workedMinutes - scheduledMinutes);
  const updated = await prisma.timeEntry.update({
    where: { id: entry.id },
    data: { clockOut, breakMinutes, workedMinutes, overtimeMinutes, status: 'closed' },
  });
  await logActivity({ companyId: req.user.companyId, userId: req.user.id, type: 'clocked_out', message: `${req.user.name} clocked out` });
  res.json(updated);
});

router.post('/time/break/start', async (req, res) => {
  const entry = await prisma.timeEntry.findFirst({ where: { userId: req.user.id, clockOut: null }, include: { breaks: true } });
  if (!entry) return res.status(400).json({ message: 'No active entry' });
  if (entry.breaks.some((b) => !b.endAt)) return res.status(400).json({ message: 'Active break already exists' });
  const breakEntry = await prisma.breakEntry.create({ data: { userId: req.user.id, timeEntryId: entry.id, startAt: new Date() } });
  await logActivity({ companyId: req.user.companyId, userId: req.user.id, type: 'break_started', message: `${req.user.name} started a break` });
  res.json(breakEntry);
});

router.post('/time/break/end', async (req, res) => {
  const entry = await prisma.timeEntry.findFirst({ where: { userId: req.user.id, clockOut: null }, include: { breaks: true } });
  if (!entry) return res.status(400).json({ message: 'No active entry' });
  const activeBreak = entry.breaks.find((b) => !b.endAt);
  if (!activeBreak) return res.status(400).json({ message: 'No active break' });
  const endAt = new Date();
  const minutes = minutesBetween(activeBreak.startAt, endAt);
  const updated = await prisma.breakEntry.update({ where: { id: activeBreak.id }, data: { endAt, minutes } });
  await logActivity({ companyId: req.user.companyId, userId: req.user.id, type: 'break_ended', message: `${req.user.name} ended a break` });
  res.json(updated);
});

router.get('/time/current', async (req, res) => {
  const entry = await prisma.timeEntry.findFirst({ where: { userId: req.user.id, clockOut: null }, include: { breaks: true } });
  res.json(entry);
});

router.get('/time-entries', async (req, res) => {
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
  let dateFilter;
  if (range === 'today') dateFilter = { gte: dayjs().startOf('day').toDate(), lte: dayjs().endOf('day').toDate() };
  if (range === 'week') dateFilter = { gte: dayjs().startOf('week').toDate(), lte: dayjs().endOf('week').toDate() };
  if (range === 'month') dateFilter = { gte: dayjs().startOf('month').toDate(), lte: dayjs().endOf('month').toDate() };
  if (range === 'custom' && startDate && endDate) dateFilter = { gte: new Date(startDate), lte: new Date(endDate) };
  if (dateFilter) where.clockIn = dateFilter;
  const [total, rows] = await Promise.all([
    prisma.timeEntry.count({ where }),
    prisma.timeEntry.findMany({ where, orderBy: { clockIn: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { user: true } }),
  ]);
  res.json({ data: rows, pagination: { total, page, pageSize, pages: Math.ceil(total / pageSize) } });
});

router.get('/time-entries/:id', async (req, res) => {
  const row = await prisma.timeEntry.findUnique({ where: { id: req.params.id }, include: { breaks: true, user: true } });
  if (!row || row.companyId !== req.user.companyId) return res.status(404).json({ message: 'Not found' });
  if (req.user.role === 'employee' && row.userId !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
  res.json(row);
});

export default router;
