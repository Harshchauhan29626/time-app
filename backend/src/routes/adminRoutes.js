import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { logActivity } from '../services/activityService.js';

const router = Router();
router.use(requireAuth);

router.get('/time-off-types', async (req, res) => {
  const data = await prisma.timeOffType.findMany({ where: { companyId: req.user.companyId } });
  res.json(data);
});

router.post('/time-off-requests', async (req, res) => {
  const schema = z.object({ timeOffTypeId: z.string(), startDate: z.string(), endDate: z.string(), reason: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' });
  const created = await prisma.timeOffRequest.create({ data: { ...parsed.data, startDate: new Date(parsed.data.startDate), endDate: new Date(parsed.data.endDate), companyId: req.user.companyId, userId: req.user.id } });
  await logActivity({ companyId: req.user.companyId, userId: req.user.id, type: 'leave_requested', message: `${req.user.name} requested leave` });
  res.status(201).json(created);
});

router.get('/time-off-requests', async (req, res) => {
  const where = { companyId: req.user.companyId };
  if (req.user.role === 'employee') where.userId = req.user.id;
  const data = await prisma.timeOffRequest.findMany({ where, include: { user: true, timeOffType: true }, orderBy: { createdAt: 'desc' } });
  res.json(data);
});

router.patch('/time-off-requests/:id/status', requireRole('admin', 'manager'), async (req, res) => {
  const parsed = z.object({ status: z.enum(['approved', 'rejected']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid status' });
  const updated = await prisma.timeOffRequest.update({ where: { id: req.params.id }, data: { status: parsed.data.status, reviewedById: req.user.id, reviewedAt: new Date() } });
  await logActivity({ companyId: req.user.companyId, userId: req.user.id, type: `leave_${parsed.data.status}`, message: `Leave request ${parsed.data.status}` });
  res.json(updated);
});

router.get('/work-schedules', async (req, res) => {
  const rows = await prisma.workSchedule.findMany({ where: { companyId: req.user.companyId }, include: { days: true } });
  res.json(rows);
});

router.post('/work-schedules', requireRole('admin', 'manager'), async (req, res) => {
  const schema = z.object({ name: z.string(), startTime: z.string(), endTime: z.string(), breakMinutes: z.number(), weeklyHours: z.number(), days: z.array(z.object({ weekday: z.number(), scheduledMinutes: z.number() })) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' });
  const { days, ...rest } = parsed.data;
  const row = await prisma.workSchedule.create({ data: { companyId: req.user.companyId, ...rest, days: { create: days } }, include: { days: true } });
  res.status(201).json(row);
});

router.patch('/work-schedules/:id', requireRole('admin', 'manager'), async (req, res) => {
  const { days = [], ...rest } = req.body;
  const row = await prisma.$transaction(async (tx) => {
    await tx.workScheduleDay.deleteMany({ where: { workScheduleId: req.params.id } });
    return tx.workSchedule.update({ where: { id: req.params.id }, data: { ...rest, days: { create: days } }, include: { days: true } });
  });
  res.json(row);
});

router.delete('/work-schedules/:id', requireRole('admin'), async (req, res) => {
  await prisma.workSchedule.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

router.get('/holidays', async (req, res) => {
  const rows = await prisma.holiday.findMany({ where: { companyId: req.user.companyId }, orderBy: { holidayDate: 'asc' } });
  res.json(rows);
});

router.post('/holidays', requireRole('admin', 'manager'), async (req, res) => {
  const parsed = z.object({ name: z.string(), holidayDate: z.string(), type: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' });
  const row = await prisma.holiday.create({ data: { companyId: req.user.companyId, name: parsed.data.name, type: parsed.data.type, holidayDate: new Date(parsed.data.holidayDate) } });
  res.status(201).json(row);
});

router.patch('/holidays/:id', requireRole('admin', 'manager'), async (req, res) => {
  const row = await prisma.holiday.update({ where: { id: req.params.id }, data: req.body });
  res.json(row);
});

router.delete('/holidays/:id', requireRole('admin'), async (req, res) => {
  await prisma.holiday.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

router.get('/team', requireRole('admin', 'manager'), async (req, res) => {
  const rows = await prisma.user.findMany({ where: { companyId: req.user.companyId }, include: { scheduleAssignments: { include: { workSchedule: true }, orderBy: { startsOn: 'desc' }, take: 1 } } });
  res.json(rows);
});

router.post('/team', requireRole('admin'), async (req, res) => {
  const parsed = z.object({ name: z.string(), email: z.string().email(), password: z.string().min(8), role: z.enum(['manager', 'employee']), timezone: z.string().default('UTC'), workScheduleId: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' });
  const { workScheduleId, ...data } = parsed.data;
  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      companyId: req.user.companyId,
      name: data.name,
      email: data.email,
      role: data.role,
      timezone: data.timezone,
      password: passwordHash,
    },
  });
  if (workScheduleId) {
    await prisma.userWorkScheduleAssignment.create({ data: { userId: user.id, workScheduleId, startsOn: new Date() } });
  }
  res.status(201).json(user);
});

router.patch('/team/:id', requireRole('admin', 'manager'), async (req, res) => {
  const { role, workScheduleId, timezone, name } = req.body;
  const updated = await prisma.user.update({ where: { id: req.params.id }, data: { role, timezone, name } });
  if (workScheduleId) {
    await prisma.userWorkScheduleAssignment.updateMany({ where: { userId: req.params.id, endsOn: null }, data: { endsOn: new Date() } });
    await prisma.userWorkScheduleAssignment.create({ data: { userId: req.params.id, workScheduleId, startsOn: new Date() } });
  }
  res.json(updated);
});

router.get('/activities', async (req, res) => {
  const rows = await prisma.activity.findMany({ where: { companyId: req.user.companyId }, include: { user: true }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json(rows);
});

router.get('/settings', requireRole('admin', 'manager'), async (req, res) => {
  const company = await prisma.company.findUnique({ where: { id: req.user.companyId } });
  res.json(company);
});

router.patch('/settings', requireRole('admin', 'manager'), async (req, res) => {
  const company = await prisma.company.update({ where: { id: req.user.companyId }, data: req.body });
  res.json(company);
});

export default router;
