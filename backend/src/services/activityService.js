import { prisma } from '../config/prisma.js';

export async function logActivity({ companyId, userId, type, message }) {
  return prisma.activity.create({
    data: {
      companyId,
      userId,
      type,
      title: message?.slice(0, 150) || type,
      description: message || null,
    },
  });
}
