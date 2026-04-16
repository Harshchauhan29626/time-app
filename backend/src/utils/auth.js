import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';
import { env } from '../config/env.js';

function toTokenSub(userId) {
  return typeof userId === 'bigint' ? userId.toString() : String(userId);
}

export function signAccessToken(user) {
  return jwt.sign(
    { sub: toTokenSub(user.id), role: user.role, companyId: toTokenSub(user.companyId) },
    env.jwtAccessSecret,
    { expiresIn: env.accessExpiresIn },
  );
}

export function signRefreshToken(user) {
  const expiresAt = dayjs().add(env.refreshExpiresInDays, 'day').toDate();
  const token = jwt.sign({ sub: toTokenSub(user.id) }, env.jwtRefreshSecret, {
    expiresIn: `${env.refreshExpiresInDays}d`,
  });
  return { token, expiresAt };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}
