import app from './app.js';
import { env } from './config/env.js';
import { verifyDatabaseConnection } from './config/prisma.js';

async function start() {
  await verifyDatabaseConnection();

  app.listen(env.port, () => {
    console.log(`[Startup] TimeFlow backend listening on port ${env.port}`);
    console.log(`[Startup] Database connected ${env.dbUser}@${env.dbHost}:${env.dbPort}/${env.dbName}`);
  });
}

start().catch((error) => {
  console.error(`[Startup] Failed to start backend: ${error.message}`);
  process.exit(1);
});
