import { verifyAccessToken } from '../utils/auth.js';
import { prisma } from '../config/prisma.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
    const token = header.slice(7);
    const decoded = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    req.user = { id: user.id, role: user.role, companyId: user.companyId, name: user.name, email: user.email };
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized' });
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  return next();
};
