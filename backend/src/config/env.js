import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), 'backend/.env');

if (!fs.existsSync(envPath)) {
  throw new Error('Missing backend/.env. Copy backend/.env.example to backend/.env and fill real values.');
}

const loaded = dotenv.config({ path: envPath });
if (loaded.error) {
  throw loaded.error;
}

function encodeDbUrlPassword(rawPassword = '') {
  return encodeURIComponent(rawPassword);
}

function buildDatabaseUrlFromParts({ user, password, host, port, dbName }) {
  return `mysql://${user}:${encodeDbUrlPassword(password)}@${host}:${port}/${dbName}`;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const required = {
  PORT: process.env.PORT || '5000',
  CLIENT_URL: requireEnv('CLIENT_URL'),
  DB_HOST: requireEnv('DB_HOST'),
  DB_PORT: requireEnv('DB_PORT'),
  DB_NAME: requireEnv('DB_NAME'),
  DB_USER: requireEnv('DB_USER'),
  DB_PASSWORD: requireEnv('DB_PASSWORD'),
  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_DAYS: process.env.JWT_REFRESH_EXPIRES_DAYS || '7',
};

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = buildDatabaseUrlFromParts({
    user: required.DB_USER,
    password: required.DB_PASSWORD,
    host: required.DB_HOST,
    port: required.DB_PORT,
    dbName: required.DB_NAME,
  });
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(required.PORT),
  clientUrl: required.CLIENT_URL,
  jwtAccessSecret: required.JWT_SECRET,
  jwtRefreshSecret: required.JWT_REFRESH_SECRET,
  accessExpiresIn: required.JWT_ACCESS_EXPIRES_IN,
  refreshExpiresInDays: Number(required.JWT_REFRESH_EXPIRES_DAYS),
  dbHost: required.DB_HOST,
  dbPort: Number(required.DB_PORT),
  dbName: required.DB_NAME,
  dbUser: required.DB_USER,
  dbPassword: required.DB_PASSWORD,
  databaseUrl: process.env.DATABASE_URL,
};
