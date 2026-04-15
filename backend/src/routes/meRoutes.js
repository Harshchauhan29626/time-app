import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { company: true } });
  res.json({ ...req.user, timezone: user.timezone, company: user.company });
});

router.patch('/me', requireAuth, async (req, res) => {
  const { name, timezone } = req.body;
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { name, timezone } });
  res.json(user);
});

export default router;
