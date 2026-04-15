import { prisma } from '../config/prisma.js';

export async function logActivity({ companyId, userId, type, message, metadata }) {
  return prisma.activity.create({ data: { companyId, userId, type, message, metadata } });
}
