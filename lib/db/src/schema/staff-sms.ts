import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const staffSmsSettingsTable = pgTable("staff_sms_settings", {
  key: text("key").primaryKey(),
  baseUrl: text("base_url").notNull().default(""),
  senderId: text("sender_id").notNull().default(""),
  updatedByUserId: text("updated_by_user_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
