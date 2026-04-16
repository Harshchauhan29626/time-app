import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function verifyDatabaseConnection() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  return true;
}

export { prisma };
export default prisma;
