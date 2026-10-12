import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const systemChromium = "/repl/tools/bin/chromium";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173",
    launchOptions: {
      ...(process.env.CHROMIUM_PATH || existsSync(systemChromium)
        ? { executablePath: process.env.CHROMIUM_PATH || systemChromium }
        : {}),
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --filter @workspace/enrollment-portal run dev",
    url: "http://127.0.0.1:4173",
    env: { ...process.env, PORT: "4173", BASE_PATH: "/" },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
