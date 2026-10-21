import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type StaffEmailAlertEvents = {
  contact_received: boolean;
  step_saved: boolean;
  contact_updated: boolean;
  evidence_saved: boolean;
  application_submitted: boolean;
};

export type StaffEmailBranding = {
  logoUrl: string | null;
  accentColor: string;
  headerColor: string;
  senderName: string;
};

export const staffEmailSettingsTable = pgTable("staff_email_settings", {
  key: text("key").primaryKey(),
  recipients: jsonb("recipients").$type<string[]>().notNull().default([]),
  alerts: jsonb("alerts").$type<StaffEmailAlertEvents>().notNull(),
  branding: jsonb("branding")
    .$type<StaffEmailBranding>()
    .notNull()
    .default({
      logoUrl: null,
      accentColor: "#49b8aa",
      headerColor: "#102b46",
      senderName: "Security Verification",
    }),
  updatedByUserId: text("updated_by_user_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const staffEmailOutboxTable = pgTable(
  "staff_email_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    subject: text("subject").notNull(),
    messageText: text("message_text").notNull(),
    eventKind: text("event_kind"),
    applicationReference: text("application_reference"),
    status: text("status").notNull().default("sending"),
    providerMessageId: text("provider_message_id"),
    deliveryStatus: text("delivery_status"),
    errorMessage: text("error_message"),
    createdByUserId: text("created_by_user_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("staff_email_outbox_idempotency_idx").on(table.idempotencyKey),
    index("staff_email_outbox_created_idx").on(table.createdAt),
    index("staff_email_outbox_status_idx").on(table.status),
  ],
);

export type StaffEmailOutboxRecord =
  typeof staffEmailOutboxTable.$inferSelect;
