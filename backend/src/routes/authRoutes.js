import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const registerSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required'),
  name: z.string().trim().min(2, 'Full name is required'),
  email: z.string().trim().email('Valid email is required').transform((val) => val.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  timezone: z.string().trim().min(2).default('UTC'),
}).strict();

const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required').transform((val) => val.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
}).strict();

router.post('/register', asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { companyName, name, email, password, timezone } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ message: 'Email already in use.' });

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { name: companyName, timezone } });
    return tx.user.create({
      data: {
        companyId: company.id,
        name,
        email,
        passwordHash,
        role: 'admin',
        timezone,
      },
      include: { company: true },
    });
  });

  const accessToken = signAccessToken(user);
  const refresh = signRefreshToken(user);

  await prisma.refreshToken.create({
    data: { userId: user.id, token: refresh.token, expiresAt: refresh.expiresAt },
  });

  return res.status(201).json({
    token: accessToken,
    accessToken,
    refreshToken: refresh.token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      timezone: user.timezone,
      company: user.company,
    },
  });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: true },
  });

  if (!user) return res.status(401).json({ message: 'Invalid email or password.' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid email or password.' });

  const accessToken = signAccessToken(user);
  const refresh = signRefreshToken(user);

  await prisma.refreshToken.create({ data: { userId: user.id, token: refresh.token, expiresAt: refresh.expiresAt } });

  return res.json({
    token: accessToken,
    accessToken,
    refreshToken: refresh.token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      timezone: user.timezone,
      company: user.company,
    },
  });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.body.refreshToken;
  if (!token) return res.status(400).json({ message: 'refreshToken is required.' });

  try {
    verifyRefreshToken(token);
  } catch {
    return res.status(401).json({ message: 'Refresh token is invalid or expired.' });
  }

  const dbToken = await prisma.refreshToken.findUnique({ where: { token }, include: { user: true } });
  if (!dbToken || dbToken.revokedAt || dbToken.expiresAt < new Date()) {
    return res.status(401).json({ message: 'Refresh token is invalid or expired.' });
  }

  const accessToken = signAccessToken(dbToken.user);
  return res.json({ token: accessToken, accessToken });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.body.refreshToken;
  if (token) {
    await prisma.refreshToken.updateMany({ where: { token }, data: { revokedAt: new Date() } });
  }
  return res.json({ success: true });
}));

export default router;
