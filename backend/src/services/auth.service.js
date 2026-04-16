import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/token.js';
import { serializeBigInt } from '../utils/serialize.js';

function httpError(status, message, extras = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extras);
  return error;
}

function buildAuthResponse(user, accessToken, refreshToken) {
  return serializeBigInt({
    token: accessToken,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      companyId: user.companyId,
      name: user.name,
      email: user.email,
      role: user.role,
      timezone: user.timezone,
      company: user.company,
    },
  });
}

export async function registerUser(payload) {
  const { companyName, name, email, password, timezone } = payload;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw httpError(409, 'Email already in use.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: companyName, timezone },
    });

    return tx.user.create({
      data: {
        companyId: company.id,
        name,
        email,
        password: passwordHash,
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

  return buildAuthResponse(user, accessToken, refresh.token);
}

export async function loginUser(payload) {
  const { email, password } = payload;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: true },
  });

  if (!user) {
    throw httpError(401, 'Invalid email or password.');
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    throw httpError(401, 'Invalid email or password.');
  }

  const accessToken = signAccessToken(user);
  const refresh = signRefreshToken(user);

  await prisma.refreshToken.create({
    data: { userId: user.id, token: refresh.token, expiresAt: refresh.expiresAt },
  });

  return buildAuthResponse(user, accessToken, refresh.token);
}

export async function refreshAccessToken(token) {
  if (!token) {
    throw httpError(400, 'refreshToken is required.');
  }

  try {
    verifyRefreshToken(token);
  } catch {
    throw httpError(401, 'Refresh token is invalid or expired.');
  }

  const dbToken = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!dbToken || dbToken.isRevoked || dbToken.expiresAt < new Date()) {
    throw httpError(401, 'Refresh token is invalid or expired.');
  }

  const accessToken = signAccessToken(dbToken.user);
  return { token: accessToken, accessToken };
}

export async function logoutUser(refreshToken) {
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { isRevoked: true },
    });
  }

  return { success: true };
}
