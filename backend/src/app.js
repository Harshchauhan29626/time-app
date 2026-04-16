import express from 'express';
import cors from 'cors';

import authRoutes from './routes/authRoutes.js';
import meRoutes from './routes/meRoutes.js';
import timeRoutes from './routes/timeRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { serializeBigInt } from './utils/serialize.js';
import { env } from './config/env.js';

const app = express();

const allowedOrigins = env.clientOrigins;

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: Origin ${origin} is not allowed`));
    },
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
