import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.databaseUrl,
    },
  },
});

export async function verifyDatabaseConnection() {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}
