import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logActivity } from '../services/activityService.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'manager'));

function toBigIntSafe(value) {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

router.get('/admin/time-off-requests/pending', asyncHandler(async (req, res) => {
  const rows = await prisma.timeOffRequest.findMany({
    where: { companyId: req.user.companyId, status: 'pending' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      timeOffType: { select: { id: true, name: true, color: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json({ data: rows });
}));

router.patch('/admin/time-off-requests/:id/status', asyncHandler(async (req, res) => {
  const parsed = z.object({ status: z.enum(['approved', 'rejected']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid status' });

  const id = toBigIntSafe(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id' });

  const request = await prisma.timeOffRequest.findFirst({
    where: { id, companyId: req.user.companyId },
    include: {
      user: { select: { id: true, name: true } },
      timeOffType: { select: { name: true } },
    },
  });

  if (!request) return res.status(404).json({ message: 'Time off request not found' });
  if (request.status !== 'pending') return res.status(400).json({ message: 'Only pending requests can be updated' });

  const updated = await prisma.timeOffRequest.update({
    where: { id },
    data: {
      status: parsed.data.status,
      approvedBy: req.user.id,
      approvedAt: new Date(),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      timeOffType: { select: { id: true, name: true, color: true } },
    },
  });

  await logActivity({
    companyId: req.user.companyId,
    userId: req.user.id,
    type: `leave_${parsed.data.status}`,
    message: `${req.user.name} ${parsed.data.status} ${request.user?.name || 'employee'}'s ${request.timeOffType?.name || 'leave'} request`,
  });

  return res.json({
    message: parsed.data.status === 'approved' ? 'Request approved successfully' : 'Request rejected successfully',
    data: updated,
  });
}));

export default router;
