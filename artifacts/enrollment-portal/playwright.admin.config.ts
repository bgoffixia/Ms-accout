import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    baseURL: "http://127.0.0.1:4174",
  },
  webServer: {
    command: "E2E_AUTH_MOCK=1 pnpm --filter @workspace/enrollment-portal run dev",
    url: "http://127.0.0.1:4174",
    env: { ...process.env, PORT: "4174", BASE_PATH: "/", E2E_AUTH_MOCK: "1" },
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
