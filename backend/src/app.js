import express from 'express';
import cors from 'cors';

import authRoutes from './routes/authRoutes.js';
import meRoutes from './routes/meRoutes.js';
import timeRoutes from './routes/timeRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { serializeBigInt } from './utils/serialize.js';

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }),
);

app.use(express.json());

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (payload) => originalJson(serializeBigInt(payload));
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ message: 'Backend is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api', meRoutes);
app.use('/api', timeRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use(errorHandler);

export default app;
