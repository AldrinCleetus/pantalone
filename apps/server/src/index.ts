import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { storeConfig } from "./config/store.js";
import { pool } from "./db/index.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`${storeConfig.name} listening on ${env.PUBLIC_BASE_URL} (port ${env.PORT})`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
