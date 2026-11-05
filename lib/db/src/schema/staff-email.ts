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
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type StaffEmailAlertEvents = {
  contact_received: boolean;
  step_saved: boolean;
  contact_updated: boolean;
  evidence_saved: boolean;
  application_submitted: boolean;
};

export type StaffEmailBranding = {
  logoUrl: string | null;
  logoObjectPath: string | null;
  accentColor: string;
  headerColor: string;
  senderName: string;
  senderEmail: string;
  bannerMark: string;
  bannerTitle: string;
  bannerSubtitle: string;
  preheaderText: string;
  messageEyebrow: string;
  footerText: string;
  footerLinkText: string;
  footerLinkUrl: string | null;
  footerLinkColor: string;
  footerBackgroundColor: string;
  footerTextColor: string;
  footerBackgroundUrl: string | null;
  footerBackgroundObjectPath: string | null;
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
      logoObjectPath: null,
      accentColor: "#49b8aa",
      headerColor: "#102b46",
      senderName: "M-soft Account Protection",
      senderEmail: "notifications@vu-gov.cc",
      bannerMark: "MS",
      bannerTitle: "M-soft Account Protection",
      bannerSubtitle: "Bank Grade Security System",
      preheaderText: "A message from M-soft Account Protection.",
      messageEyebrow: "STAFF MESSAGE",
      footerText: "M-soft Account Protection staff communications",
      footerLinkText: "Visit M-soft Account Protection",
      footerLinkUrl: null,
      footerLinkColor: "#287d8b",
      footerBackgroundColor: "#f1f5f8",
      footerTextColor: "#738392",
      footerBackgroundUrl: null,
      footerBackgroundObjectPath: null,
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
    providerEventAt: timestamp("provider_event_at", { withTimezone: true }),
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

export const staffEmailProviderEventsTable = pgTable(
  "staff_email_provider_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    outboxId: uuid("outbox_id")
      .notNull()
      .references(() => staffEmailOutboxTable.id, { onDelete: "cascade" }),
    providerEventId: text("provider_event_id").notNull(),
    deliveryStatus: text("delivery_status").notNull(),
    providerEventAt: timestamp("provider_event_at", {
      withTimezone: true,
    }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("staff_email_provider_events_provider_id_idx").on(
      table.providerEventId,
    ),
    index("staff_email_provider_events_outbox_time_idx").on(
      table.outboxId,
      table.providerEventAt,
    ),
  ],
);

export const staffEmailTemplatesTable = pgTable(
  "staff_email_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    messageText: text("message_text").notNull(),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("staff_email_templates_name_idx").on(table.name),
  ],
);

export const insertStaffEmailTemplateSchema = createInsertSchema(
  staffEmailTemplatesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStaffEmailTemplate = z.infer<
  typeof insertStaffEmailTemplateSchema
>;
export type StaffEmailTemplate = typeof staffEmailTemplatesTable.$inferSelect;

export type StaffEmailOutboxRecord =
  typeof staffEmailOutboxTable.$inferSelect;
