import { defineConfig } from "drizzle-kit";
import path from "path";

const databaseUrl =
  process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Set DIRECT_DATABASE_URL (preferred) or DATABASE_URL before running Drizzle Kit.",
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
