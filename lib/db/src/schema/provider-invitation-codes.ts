import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const providerInvitationCodeSettingsTable = pgTable(
  "provider_invitation_code_settings",
  {
    providerId: text("provider_id").primaryKey(),
    requiredLength: integer("required_length").notNull().default(8),
    updatedByUserId: text("updated_by_user_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "provider_invitation_code_settings_provider_check",
      sql`${table.providerId} IN ('category-1', 'category-2', 'category-3', 'category-4')`,
    ),
    check(
      "provider_invitation_code_settings_length_check",
      sql`${table.requiredLength} BETWEEN 4 AND 12`,
    ),
  ],
).enableRLS();

export const providerInvitationCodeSettingAuditTable = pgTable(
  "provider_invitation_code_setting_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id").notNull(),
    providerId: text("provider_id").notNull(),
    previousLength: integer("previous_length").notNull(),
    newLength: integer("new_length").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "provider_invitation_code_setting_audit_provider_check",
      sql`${table.providerId} IN ('category-1', 'category-2', 'category-3', 'category-4')`,
    ),
    check(
      "provider_invitation_code_setting_audit_previous_length_check",
      sql`${table.previousLength} BETWEEN 4 AND 12`,
    ),
    check(
      "provider_invitation_code_setting_audit_new_length_check",
      sql`${table.newLength} BETWEEN 4 AND 12`,
    ),
    index("provider_invitation_code_setting_audit_provider_changed_idx").on(
      table.providerId,
      table.changedAt,
    ),
  ],
).enableRLS();

export type ProviderInvitationCodeSetting =
  typeof providerInvitationCodeSettingsTable.$inferSelect;
