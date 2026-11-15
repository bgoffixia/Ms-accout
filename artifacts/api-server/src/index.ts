import app from "./app";
import { logger } from "./lib/logger";
import { startGuestEvidenceCleanup } from "./lib/guestEvidenceCleanup";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// In the Railway container, the Vite build is placed alongside the API artifact.
// Keep the API independently usable (including the existing Vercel adapter) when
// the frontend build is not present.
const frontendDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../enrollment-portal/dist/public",
);
const frontendIndex = path.join(frontendDist, "index.html");

if (existsSync(frontendIndex)) {
  app.use(express.static(frontendDist, { index: false }));
  app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
    response.sendFile(frontendIndex);
  });
}

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startGuestEvidenceCleanup();
});
