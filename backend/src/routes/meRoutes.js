import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { company: true } });
  res.json({ ...req.user, timezone: user?.timezone, company: user?.company || null });
}));

router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const { name, timezone } = req.body;
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { name, timezone } });
  res.json(user);
}));

export default router;
