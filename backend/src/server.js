import "./config/env.js";
import app from "./app.js";
import prisma from "./config/prisma.js";

const PORT = Number(process.env.PORT || 5000);

async function start() {
  try {
    await prisma.$connect();
    console.log("[Startup] Database connected");

    app.listen(PORT, () => {
      console.log(`[Startup] TimeFlow backend listening on port ${PORT}`);
    });
  } catch (error) {
    console.error(`[Startup] Failed to start backend: ${error.message}`);
    process.exit(1);
  }
}

start();