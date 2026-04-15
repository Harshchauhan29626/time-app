import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/auth.js';

const router = Router();

const registerSchema = z.object({
  companyName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  timezone: z.string().default('UTC'),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
  const { companyName, name, email, password, timezone } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ message: 'Email already used' });
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { name: companyName, timezone } });
    const user = await tx.user.create({
      data: { companyId: company.id, name, email, passwordHash, role: 'admin', timezone },
    });
    return { company, user };
  });
  const accessToken = signAccessToken(result.user);
  const refresh = signRefreshToken(result.user);
  await prisma.refreshToken.create({ data: { userId: result.user.id, token: refresh.token, expiresAt: refresh.expiresAt } });
  res.json({ accessToken, refreshToken: refresh.token, user: { id: result.user.id, name, email, role: 'admin', companyId: result.company.id } });
});

router.post('/login', async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, include: { company: true } });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  const accessToken = signAccessToken(user);
  const refresh = signRefreshToken(user);
  await prisma.refreshToken.create({ data: { userId: user.id, token: refresh.token, expiresAt: refresh.expiresAt } });
  res.json({ accessToken, refreshToken: refresh.token, user: { id: user.id, name: user.name, email: user.email, role: user.role, company: user.company } });
});

router.post('/refresh', async (req, res) => {
  const token = req.body.refreshToken;
  if (!token) return res.status(400).json({ message: 'refreshToken required' });
  try {
    verifyRefreshToken(token);
    const dbToken = await prisma.refreshToken.findUnique({ where: { token }, include: { user: true } });
    if (!dbToken || dbToken.revokedAt || dbToken.expiresAt < new Date()) return res.status(401).json({ message: 'Invalid token' });
    const accessToken = signAccessToken(dbToken.user);
    res.json({ accessToken });
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
});

router.post('/logout', async (req, res) => {
  const token = req.body.refreshToken;
  if (token) await prisma.refreshToken.updateMany({ where: { token }, data: { revokedAt: new Date() } });
  res.json({ success: true });
});

export default router;
