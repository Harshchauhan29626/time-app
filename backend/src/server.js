import app from './app.js';
import { env, validateEnv } from './config/env.js';

const envCheck = validateEnv();
if (!envCheck.ok) {
  console.warn(`[Config] Missing env values: ${envCheck.missing.join(', ')}. Using fallback/defaults where possible.`);
}

app.listen(env.port, () => {
  console.log(`[Startup] TimeFlow backend listening on port ${env.port}`);
  console.log(`[Startup] Database target ${env.dbUser}@${env.dbHost}:${env.dbPort}/${env.dbName}`);
});
