import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
} from '../services/auth.service.js';

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

  const response = await registerUser(parsed.data);
  return res.status(201).json(response);
}));

router.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const response = await loginUser(parsed.data);
  return res.status(200).json(response);
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const response = await refreshAccessToken(req.body.refreshToken);
  return res.status(200).json(response);
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const response = await logoutUser(req.body.refreshToken);
  return res.status(200).json(response);
}));

export default router;
