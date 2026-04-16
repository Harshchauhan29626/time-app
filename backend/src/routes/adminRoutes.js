import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import dayjs from 'dayjs';
import { prisma } from '../config/prisma.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { logActivity } from '../services/activityService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function toBigIntSafe(value) {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function toTimeDate(value, fallback = '09:00') {
  if (value instanceof Date) return value;
  const normalized = typeof value === 'string' && value.includes(':') ? value : fallback;
  return new Date(`1970-01-01T${normalized}:00.000Z`);
}

function mapDaysPayload(days = [], startTime, endTime) {
  return days
    .map((day) => {
      const weekday = Number(day.weekday);
      const dayName = dayMap[weekday];
      if (!dayName) return null;
      const scheduledMinutes = Number(day.scheduledMinutes || 0);
      return {
        dayName,
        isWorking: scheduledMinutes > 0,
        startTime: scheduledMinutes > 0 ? toTimeDate(startTime, '09:00') : null,
        endTime: scheduledMinutes > 0 ? toTimeDate(endTime, '17:00') : null,
      };
    })
    .filter(Boolean);
}

function formatScheduleDays(workScheduleDays = []) {
  return workScheduleDays.map((day) => ({
    ...day,
    weekday: dayMap.indexOf(day.dayName),
    scheduledMinutes: day.isWorking && day.startTime && day.endTime
      ? dayjs(day.endTime).diff(dayjs(day.startTime), 'minute')
      : 0,
  }));
}

router.get('/time-off-types', asyncHandler(async (req, res) => {
  const data = await prisma.timeOffType.findMany({ where: { companyId: req.user.companyId } });
  res.json(data);
}));

router.post('/time-off-requests', asyncHandler(async (req, res) => {
  const schema = z.object({
    timeOffTypeId: z.coerce.number().int().positive(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().trim().max(1000).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });

  const timeOffTypeId = toBigIntSafe(parsed.data.timeOffTypeId);
  if (!timeOffTypeId) return res.status(400).json({ message: 'Invalid time off type' });
  const startDate = new Date(`${parsed.data.startDate}T00:00:00.000Z`);
  const endDate = new Date(`${parsed.data.endDate}T00:00:00.000Z`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return res.status(400).json({ message: 'Invalid start or end date' });
  }
  if (endDate < startDate) return res.status(400).json({ message: 'End date cannot be before start date' });

  const timeOffType = await prisma.timeOffType.findFirst({
    where: { id: timeOffTypeId, companyId: req.user.companyId },
  });
  if (!timeOffType) return res.status(404).json({ message: 'Time off type not found' });

  const created = await prisma.timeOffRequest.create({
    data: {
      companyId: req.user.companyId,
      userId: req.user.id,
      timeOffTypeId,
      startDate,
      endDate,
      reason: parsed.data.reason || null,
      status: 'pending',
    },
    include: {
      timeOffType: { select: { id: true, name: true, color: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  await logActivity({ companyId: req.user.companyId, userId: req.user.id, type: 'leave_requested', message: `${req.user.name} requested leave` });
  res.status(201).json(created);
}));

router.get('/time-off-requests', asyncHandler(async (req, res) => {
  const where = { companyId: req.user.companyId };
  if (req.user.role === 'employee') where.userId = req.user.id;

  const data = await prisma.timeOffRequest.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      timeOffType: { select: { id: true, name: true, color: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(data);
}));

router.patch('/time-off-requests/:id/status', requireRole('admin', 'manager'), asyncHandler(async (req, res) => {
  const parsed = z.object({ status: z.enum(['approved', 'rejected']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid status' });

  const id = toBigIntSafe(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id' });

  const updated = await prisma.timeOffRequest.update({
    where: { id },
    data: { status: parsed.data.status, approvedBy: req.user.id, approvedAt: new Date() },
  });

  await logActivity({ companyId: req.user.companyId, userId: req.user.id, type: `leave_${parsed.data.status}`, message: `Leave request ${parsed.data.status}` });
  res.json(updated);
}));

router.get('/work-schedules', asyncHandler(async (req, res) => {
  const rows = await prisma.workSchedule.findMany({ where: { companyId: req.user.companyId }, include: { workScheduleDays: true } });
  res.json(rows.map((row) => ({ ...row, days: formatScheduleDays(row.workScheduleDays) })));
}));

router.post('/work-schedules', requireRole('admin', 'manager'), asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    startTime: z.string(),
    endTime: z.string(),
    breakMinutes: z.coerce.number().default(60),
    weeklyHours: z.coerce.number().default(40),
    days: z.array(z.object({ weekday: z.number(), scheduledMinutes: z.number() })).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' });

  const row = await prisma.workSchedule.create({
    data: {
      companyId: req.user.companyId,
      name: parsed.data.name,
      startTime: toTimeDate(parsed.data.startTime, '09:00'),
      endTime: toTimeDate(parsed.data.endTime, '17:00'),
      breakMinutes: parsed.data.breakMinutes,
      weeklyHours: parsed.data.weeklyHours,
      workScheduleDays: {
        create: mapDaysPayload(parsed.data.days || [], parsed.data.startTime, parsed.data.endTime),
      },
    },
    include: { workScheduleDays: true },
  });

  res.status(201).json({ ...row, days: formatScheduleDays(row.workScheduleDays) });
}));

router.patch('/work-schedules/:id', requireRole('admin', 'manager'), asyncHandler(async (req, res) => {
  const id = toBigIntSafe(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid schedule id' });

  const { days = [], startTime = '09:00', endTime = '17:00', ...rest } = req.body;
  const row = await prisma.$transaction(async (tx) => {
    await tx.workScheduleDay.deleteMany({ where: { workScheduleId: id } });
    return tx.workSchedule.update({
      where: { id },
      data: {
        ...rest,
        startTime: toTimeDate(startTime, '09:00'),
        endTime: toTimeDate(endTime, '17:00'),
        workScheduleDays: { create: mapDaysPayload(days, startTime, endTime) },
      },
      include: { workScheduleDays: true },
    });
  });

  res.json({ ...row, days: formatScheduleDays(row.workScheduleDays) });
}));

router.delete('/work-schedules/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const id = toBigIntSafe(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid schedule id' });
  await prisma.workSchedule.delete({ where: { id } });
  res.json({ success: true });
}));

router.get('/holidays', asyncHandler(async (req, res) => {
  const rows = await prisma.holiday.findMany({ where: { companyId: req.user.companyId }, orderBy: { holidayDate: 'asc' } });
  res.json(rows);
}));

router.post('/holidays', requireRole('admin', 'manager'), asyncHandler(async (req, res) => {
  const parsed = z.object({
    name: z.string(),
    holidayDate: z.string(),
    type: z.enum(['public', 'company', 'optional']).default('public'),
    description: z.string().optional(),
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' });

  const row = await prisma.holiday.create({
    data: {
      companyId: req.user.companyId,
      name: parsed.data.name,
      holidayDate: new Date(parsed.data.holidayDate),
      type: parsed.data.type,
      description: parsed.data.description || null,
    },
  });

  res.status(201).json(row);
}));

router.patch('/holidays/:id', requireRole('admin', 'manager'), asyncHandler(async (req, res) => {
  const id = toBigIntSafe(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid holiday id' });
  const row = await prisma.holiday.update({ where: { id }, data: req.body });
  res.json(row);
}));

router.delete('/holidays/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const id = toBigIntSafe(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid holiday id' });
  await prisma.holiday.delete({ where: { id } });
  res.json({ success: true });
}));

router.get('/team', requireRole('admin', 'manager'), asyncHandler(async (req, res) => {
  const rows = await prisma.user.findMany({
    where: { companyId: req.user.companyId },
    include: {
      scheduleAssignments: {
        include: { workSchedule: true },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(rows);
}));

router.post('/team', requireRole('admin'), asyncHandler(async (req, res) => {
  const parsed = z.object({
    name: z.string(),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['manager', 'employee']),
    timezone: z.string().default('UTC'),
    workScheduleId: z.string().optional(),
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      companyId: req.user.companyId,
      name: parsed.data.name,
      email: parsed.data.email,
      password: passwordHash,
      role: parsed.data.role,
      timezone: parsed.data.timezone,
    },
  });

  if (parsed.data.workScheduleId) {
    const workScheduleId = toBigIntSafe(parsed.data.workScheduleId);
    if (workScheduleId) {
      await prisma.userWorkScheduleAssignment.create({
        data: {
          userId: user.id,
          workScheduleId,
          effectiveFrom: dayjs().startOf('day').toDate(),
        },
      });
    }
  }

  res.status(201).json(user);
}));

router.patch('/team/:id', requireRole('admin', 'manager'), asyncHandler(async (req, res) => {
  const userId = toBigIntSafe(req.params.id);
  if (!userId) return res.status(400).json({ message: 'Invalid team member id' });

  const { role, workScheduleId, timezone, name } = req.body;
  const updated = await prisma.user.update({ where: { id: userId }, data: { role, timezone, name } });

  if (workScheduleId) {
    const scheduleId = toBigIntSafe(workScheduleId);
    if (scheduleId) {
      await prisma.userWorkScheduleAssignment.updateMany({
        where: { userId, effectiveTo: null },
        data: { effectiveTo: dayjs().startOf('day').toDate() },
      });

      await prisma.userWorkScheduleAssignment.create({
        data: { userId, workScheduleId: scheduleId, effectiveFrom: dayjs().startOf('day').toDate() },
      });
    }
  }

  res.json(updated);
}));

router.get('/activities', asyncHandler(async (req, res) => {
  const rows = await prisma.activity.findMany({
    where: { companyId: req.user.companyId },
    include: { user: { select: { name: true, id: true } } },
    orderBy: { activityTime: 'desc' },
    take: 50,
  });
  res.json(rows);
}));

router.get('/settings', requireRole('admin', 'manager'), asyncHandler(async (req, res) => {
  const company = await prisma.company.findUnique({ where: { id: req.user.companyId } });
  const defaultSchedule = await prisma.workSchedule.findFirst({ where: { companyId: req.user.companyId }, orderBy: { createdAt: 'asc' } });
  res.json({ ...company, defaultWorkScheduleId: defaultSchedule?.id || null });
}));

router.patch('/settings', requireRole('admin', 'manager'), asyncHandler(async (req, res) => {
  const payload = {
    name: req.body.name,
    timezone: req.body.timezone,
  };

  const company = await prisma.company.update({ where: { id: req.user.companyId }, data: payload });
  res.json(company);
}));

export default router;
