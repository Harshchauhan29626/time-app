import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// backend/src/config/env.js -> backend/.env
const envPath = path.resolve(__dirname, '../../.env');

if (!fs.existsSync(envPath)) {
  throw new Error(`Missing .env file at: ${envPath}`);
}

dotenv.config({ path: envPath });

const requiredEnv = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing env values: ${missing.join(', ')}`);
}

const env = {
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresDays: Number(process.env.JWT_REFRESH_EXPIRES_DAYS || '7'),

  // Backwards-compatible aliases used in existing code.
  jwtAccessSecret: process.env.JWT_SECRET,
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshExpiresInDays: Number(process.env.JWT_REFRESH_EXPIRES_DAYS || '7'),

  databaseUrl: process.env.DATABASE_URL,
};

export { env };
export default env;
