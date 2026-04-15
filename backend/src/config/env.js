import path from 'path';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), 'backend/.env');
dotenv.config({ path: envPath });

function encodeDbUrlPassword(rawPassword = '') {
  return encodeURIComponent(rawPassword);
}

function buildDatabaseUrlFromParts() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || '3306';
  const dbName = process.env.DB_NAME || 'timeflow_db';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  return `mysql://${user}:${encodeDbUrlPassword(password)}@${host}:${port}/${dbName}`;
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = buildDatabaseUrlFromParts();
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtAccessSecret: process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshExpiresInDays: Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7),
  dbHost: process.env.DB_HOST || '127.0.0.1',
  dbPort: Number(process.env.DB_PORT || 3306),
  dbName: process.env.DB_NAME || 'timeflow_db',
  dbUser: process.env.DB_USER || 'root',
  dbPassword: process.env.DB_PASSWORD || '',
  databaseUrl: process.env.DATABASE_URL,
};

export function validateEnv() {
  const missing = [];
  if (!process.env.JWT_SECRET && !process.env.JWT_ACCESS_SECRET) missing.push('JWT_SECRET');
  if (!process.env.JWT_REFRESH_SECRET) missing.push('JWT_REFRESH_SECRET');
  if (!process.env.DB_HOST) missing.push('DB_HOST');
  if (!process.env.DB_PORT) missing.push('DB_PORT');
  if (!process.env.DB_NAME) missing.push('DB_NAME');
  if (!process.env.DB_USER) missing.push('DB_USER');
  if (!process.env.DB_PASSWORD) missing.push('DB_PASSWORD');

  return {
    ok: missing.length === 0,
    missing,
  };
}
