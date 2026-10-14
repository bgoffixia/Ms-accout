import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const applicationStatus = pgEnum("application_status", [
  "draft",
  "submitted",
  "under_review",
  "needs_information",
  "approved",
  "rejected",
]);

export const supportStatus = pgEnum("support_status", [
  "open",
  "in_progress",
  "resolved",
  "answered",
  "closed",
]);

export const guestPreapplicationStatus = pgEnum("guest_preapplication_status", [
  "received",
  "contacted",
  "closed",
]);

export const guestEvidenceType = pgEnum("guest_evidence_type", [
  "identity_document",
  "verification_video",
  "education_certificate",
]);

export const guestSubmissionStatus = pgEnum("guest_submission_status", [
  "draft",
  "submitted",
]);
export const guestPreapplicationsTable = pgTable(
  "guest_preapplications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id").notNull().unique(),
    reference: text("reference").notNull().unique(),
    accessKeyHash: text("access_key_hash").notNull().unique(),
    categoryId: text("category_id").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    currentStep: integer("current_step").notNull().default(0),
    answers: jsonb("answers")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    detailsComplete: boolean("details_complete").notNull().default(false),
    status: guestPreapplicationStatus("status").notNull().default("received"),
    submissionStatus: guestSubmissionStatus("submission_status").notNull().default("draft"),
    emailVerified: boolean("email_verified").notNull().default(false),
    clerkUserId: text("clerk_user_id"),
    linkedApplicationId: uuid("linked_application_id"),
    pinHash: text("pin_hash"),
    pinEncrypted: text("pin_encrypted"),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("guest_preapplications_status_idx").on(table.status),
    index("guest_preapplications_submission_status_idx").on(table.submissionStatus),
    index("guest_preapplications_created_idx").on(table.createdAt),
    index("guest_preapplications_evidence_cleanup_idx").on(
      table.submissionStatus,
      table.linkedApplicationId,
      table.updatedAt,
    ),
    uniqueIndex("guest_preapplications_linked_application_idx").on(table.linkedApplicationId),
  ],
);

export const guestPreapplicationEvidenceTable = pgTable(
  "guest_preapplication_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => guestPreapplicationsTable.id, { onDelete: "cascade" }),
    evidenceType: guestEvidenceType("evidence_type").notNull(),
    evidenceSlot: text("evidence_slot").notNull().default("identity_document"),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    objectPath: text("object_path").notNull().unique(),
    uploadedByUserId: text("uploaded_by_user_id"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    uploadExpiresAt: timestamp("upload_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("guest_preapplication_evidence_application_idx").on(
      table.applicationId,
    ),
    index("guest_preapplication_evidence_type_idx").on(
      table.applicationId,
      table.evidenceType,
    ),
    index("guest_preapplication_evidence_upload_expiry_idx").on(
      table.uploadedAt,
      table.uploadExpiresAt,
      table.createdAt,
    ),
  ],
);
export const guestPreapplicationRevisionsTable = pgTable(
  "guest_preapplication_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => guestPreapplicationsTable.id, { onDelete: "cascade" }),
    currentStep: integer("current_step").notNull(),
    changes: jsonb("changes")
      .$type<Array<{ field: string; before: string; after: string }>>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("guest_preapplication_revisions_application_idx").on(
      table.applicationId,
      table.createdAt,
    ),
  ],
);
export const enrollmentApplicationsTable = pgTable(
  "enrollment_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: text("reference").notNull().unique(),
    clerkUserId: text("clerk_user_id").notNull(),
    sourceGuestPreapplicationId: uuid("source_guest_preapplication_id")
      .references(() => guestPreapplicationsTable.id, { onDelete: "set null" }),
    categoryId: text("category_id").notNull(),
    status: applicationStatus("status").notNull().default("draft"),
    currentStep: integer("current_step").notNull().default(0),
    pinHash: text("pin_hash"),
    pinEncrypted: text("pin_encrypted"),
    answers: jsonb("answers")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    reviewNote: text("review_note"),
    reviewerUserId: text("reviewer_user_id"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("enrollment_applications_owner_idx").on(table.clerkUserId),
    index("enrollment_applications_status_idx").on(table.status),
    index("enrollment_applications_category_idx").on(table.categoryId),
    uniqueIndex("enrollment_applications_guest_source_idx").on(table.sourceGuestPreapplicationId),
  ],
);

export const applicationEventsTable = pgTable(
  "application_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => enrollmentApplicationsTable.id, {
        onDelete: "cascade",
      }),
    actorUserId: text("actor_user_id").notNull(),
    eventType: text("event_type").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("application_events_application_idx").on(table.applicationId),
  ],
);

export const supportTicketsTable = pgTable(
  "enrollment_support_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    applicationId: uuid("application_id").references(
      () => enrollmentApplicationsTable.id,
      { onDelete: "set null" },
    ),
    subject: text("subject").notNull(),
    category: text("category").notNull().default("other"),
    message: text("message").notNull(),
    messages: jsonb("messages")
      .$type<
        Array<{
          id: string;
          actorUserId: string;
          actorRole: "applicant" | "administrator";
          body: string;
          createdAt: string;
        }>
      >()
      .notNull()
      .default([]),
    status: supportStatus("status").notNull().default("open"),
    response: text("response"),
    assignedToUserId: text("assigned_to_user_id"),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("enrollment_support_owner_idx").on(table.clerkUserId),
    index("enrollment_support_status_idx").on(table.status),
  ],
);

export const portalSettingsTable = pgTable("portal_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedByUserId: text("updated_by_user_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertEnrollmentApplicationSchema = createInsertSchema(
  enrollmentApplicationsTable,
).omit({
  id: true,
  reference: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEnrollmentApplication = z.infer<
  typeof insertEnrollmentApplicationSchema
>;
export type EnrollmentApplication =
  typeof enrollmentApplicationsTable.$inferSelect;
export type ApplicationEvent = typeof applicationEventsTable.$inferSelect;
export type SupportTicket = typeof supportTicketsTable.$inferSelect;
export type GuestPreapplication = typeof guestPreapplicationsTable.$inferSelect;
