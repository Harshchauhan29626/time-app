<<<<<<< HEAD
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ message: "Backend is running" });
});

app.use("/api/auth", authRoutes);

export default app;
=======
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { verifyDatabaseConnection } from './config/prisma.js';
import authRoutes from './routes/authRoutes.js';
import meRoutes from './routes/meRoutes.js';
import timeRoutes from './routes/timeRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: env.nodeEnv, port: env.port });
});

app.get('/api/health/db', async (req, res, next) => {
  try {
    await verifyDatabaseConnection();
    res.json({ ok: true, database: env.dbName, host: env.dbHost, port: env.dbPort });
  } catch (error) {
    error.status = 500;
    error.message = `Database connection failed: ${error.message}`;
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api', meRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', timeRoutes);
app.use('/api', adminRoutes);

app.use(errorHandler);

export default app;
>>>>>>> 67b7b7d0b795237707ebd4029d1e39a1ce5dae28
