import { date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const staffSmsSettingsTable = pgTable("staff_sms_settings", {
  key: text("key").primaryKey(),
  baseUrl: text("base_url").notNull().default(""),
  senderId: text("sender_id").notNull().default(""),
  dailyLimit: integer("daily_limit").notNull().default(100),
  dailyUsageDate: date("daily_usage_date", { mode: "string" }),
  dailyUsageCount: integer("daily_usage_count").notNull().default(0),
  updatedByUserId: text("updated_by_user_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const staffSmsOutboxTable = pgTable(
  "staff_sms_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientPhone: text("recipient_phone").notNull(),
    senderId: text("sender_id").notNull(),
    messageText: text("message_text").notNull(),
    status: text("status").notNull().default("sending"),
    providerMessageId: text("provider_message_id"),
    providerStatus: text("provider_status"),
    providerStatusGroup: text("provider_status_group"),
    providerStatusAt: timestamp("provider_status_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("staff_sms_outbox_provider_message_id_idx").on(
      table.providerMessageId,
    ),
    index("staff_sms_outbox_created_idx").on(table.createdAt),
    index("staff_sms_outbox_status_idx").on(table.status),
  ],
);

export type StaffSmsOutboxRecord = typeof staffSmsOutboxTable.$inferSelect;
