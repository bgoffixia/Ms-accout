import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import {
  db,
  enrollmentApplicationsTable,
  guestPreapplicationsTable,
  guestPreapplicationRevisionsTable,
  pool,
} from "@workspace/db";
import {
  decryptInvitationCode,
  encryptInvitationCode,
} from "../lib/invitationCodeCrypto";
import { logger } from "../lib/logger";

const batchSize = 250;
const applyChanges = process.argv.includes("--apply");
const confirmedDatabase = process.argv
  .find((argument) => argument.startsWith("--confirm-database="))
  ?.slice("--confirm-database=".length);
const confirmedServer = process.argv
  .find((argument) => argument.startsWith("--confirm-server="))
  ?.slice("--confirm-server=".length);
const confirmedUser = process.argv
  .find((argument) => argument.startsWith("--confirm-user="))
  ?.slice("--confirm-user=".length);

async function assertBackfillPreconditions(): Promise<void> {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required; verify the stable encryption secret before backfill.");
  }
  if (
    applyChanges &&
    (!confirmedDatabase || !confirmedServer || !confirmedUser)
  ) {
    throw new Error(
      "Apply requires --confirm-database, --confirm-server, and --confirm-user values copied from a separately verified database identity query.",
    );
  }

  const { rows } = await pool.query<{
    databaseName: string;
    serverAddress: string | null;
    serverPort: number | null;
    databaseUser: string;
    hasGuestReferenceCode: boolean;
    hasGuestCiphertext: boolean;
    hasApplicationReferenceCode: boolean;
    hasApplicationCiphertext: boolean;
    hasRevisionChanges: boolean;
    canReadGuest: boolean;
    canUpdateGuest: boolean;
    canReadApplications: boolean;
    canUpdateApplications: boolean;
    canReadRevisions: boolean;
    canUpdateRevisions: boolean;
  }>(`
    SELECT
      current_database() AS "databaseName",
      inet_server_addr()::text AS "serverAddress",
      inet_server_port() AS "serverPort",
      current_user AS "databaseUser",
      EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'guest_preapplications'
          AND column_name = 'reference_code' AND data_type = 'text') AS "hasGuestReferenceCode",
      EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'guest_preapplications'
          AND column_name = 'invitation_code_ciphertext' AND data_type = 'text'
          AND is_nullable = 'YES') AS "hasGuestCiphertext",
      EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'enrollment_applications'
          AND column_name = 'reference_code' AND data_type = 'text') AS "hasApplicationReferenceCode",
      EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'enrollment_applications'
          AND column_name = 'invitation_code_ciphertext' AND data_type = 'text'
          AND is_nullable = 'YES') AS "hasApplicationCiphertext",
      EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'guest_preapplication_revisions'
          AND column_name = 'changes' AND data_type = 'jsonb') AS "hasRevisionChanges",
      CASE WHEN to_regclass('public.guest_preapplications') IS NOT NULL
        THEN has_table_privilege(current_user, 'public.guest_preapplications', 'SELECT')
        ELSE false END AS "canReadGuest",
      CASE WHEN to_regclass('public.guest_preapplications') IS NOT NULL
        THEN has_table_privilege(current_user, 'public.guest_preapplications', 'UPDATE')
        ELSE false END AS "canUpdateGuest",
      CASE WHEN to_regclass('public.enrollment_applications') IS NOT NULL
        THEN has_table_privilege(current_user, 'public.enrollment_applications', 'SELECT')
        ELSE false END AS "canReadApplications",
      CASE WHEN to_regclass('public.enrollment_applications') IS NOT NULL
        THEN has_table_privilege(current_user, 'public.enrollment_applications', 'UPDATE')
        ELSE false END AS "canUpdateApplications",
      CASE WHEN to_regclass('public.guest_preapplication_revisions') IS NOT NULL
        THEN has_table_privilege(current_user, 'public.guest_preapplication_revisions', 'SELECT')
        ELSE false END AS "canReadRevisions",
      CASE WHEN to_regclass('public.guest_preapplication_revisions') IS NOT NULL
        THEN has_table_privilege(current_user, 'public.guest_preapplication_revisions', 'UPDATE')
        ELSE false END AS "canUpdateRevisions"
  `);
  const identity = rows[0];
  if (!identity) throw new Error("Database preflight did not return an identity.");

  logger.info(
    {
      databaseName: identity.databaseName,
      serverAddress: identity.serverAddress,
      serverPort: identity.serverPort,
      databaseUser: identity.databaseUser,
    },
    "Invitation Code backfill database identity",
  );

  if (
    applyChanges &&
    (identity.databaseName !== confirmedDatabase ||
      identity.serverAddress !== confirmedServer ||
      identity.databaseUser !== confirmedUser)
  ) {
    throw new Error(
      "Connected database identity does not exactly match the separately confirmed database, server, and role.",
    );
  }

  const checks: Array<[string, boolean]> = [
    ["guest reference_code text column", identity.hasGuestReferenceCode],
    ["guest nullable invitation_code_ciphertext text column", identity.hasGuestCiphertext],
    ["application reference_code text column", identity.hasApplicationReferenceCode],
    ["application nullable invitation_code_ciphertext text column", identity.hasApplicationCiphertext],
    ["revision changes jsonb column", identity.hasRevisionChanges],
    ["SELECT permission on guest applications", identity.canReadGuest],
    ["UPDATE permission on guest applications", identity.canUpdateGuest],
    ["SELECT permission on enrollment applications", identity.canReadApplications],
    ["UPDATE permission on enrollment applications", identity.canUpdateApplications],
    ["SELECT permission on guest revisions", identity.canReadRevisions],
    ["UPDATE permission on guest revisions", identity.canUpdateRevisions],
  ];
  const failedChecks = checks.filter(([, passed]) => !passed);

  if (failedChecks.length) {
    throw new Error(
      `Backfill preflight failed: ${failedChecks.map(([name]) => name).join(", ")}.`,
    );
  }
}

async function backfillGuestCodes(): Promise<number> {
  let offset = 0;
  let encryptedCount = 0;
  while (true) {
    const rows = await db
      .select({
        id: guestPreapplicationsTable.id,
        referenceCode: guestPreapplicationsTable.referenceCode,
        ciphertext: guestPreapplicationsTable.invitationCodeCiphertext,
      })
      .from(guestPreapplicationsTable)
      .where(isNotNull(guestPreapplicationsTable.referenceCode))
      .orderBy(asc(guestPreapplicationsTable.id))
      .limit(batchSize)
      .offset(applyChanges ? 0 : offset);
    if (rows.length === 0) break;
    if (!applyChanges) {
      encryptedCount += rows.length;
      offset += rows.length;
      continue;
    }

    await db.transaction(async (transaction) => {
      for (const row of rows) {
        if (!row.referenceCode) continue;
        const scope = `guest:${row.id}` as const;
        let ciphertext = row.ciphertext;
        if (ciphertext) {
          if (decryptInvitationCode(ciphertext, scope) !== row.referenceCode) {
            throw new Error(
              "Conflicting Invitation Code values; this batch was not changed.",
            );
          }
        } else {
          ciphertext = encryptInvitationCode(row.referenceCode, scope);
        }
        const updated = await transaction
          .update(guestPreapplicationsTable)
          .set({ invitationCodeCiphertext: ciphertext, referenceCode: null })
          .where(
            and(
              eq(guestPreapplicationsTable.id, row.id),
              eq(guestPreapplicationsTable.referenceCode, row.referenceCode),
              row.ciphertext
                ? eq(
                    guestPreapplicationsTable.invitationCodeCiphertext,
                    row.ciphertext,
                  )
                : isNull(guestPreapplicationsTable.invitationCodeCiphertext),
            ),
          )
          .returning({ id: guestPreapplicationsTable.id });
        if (!updated[0]) {
          throw new Error("A legacy Invitation Code changed during backfill.");
        }
        encryptedCount += 1;
      }
    });
  }
  return encryptedCount;
}

async function backfillEnrollmentCodes(): Promise<number> {
  let offset = 0;
  let encryptedCount = 0;
  while (true) {
    const rows = await db
      .select({
        id: enrollmentApplicationsTable.id,
        referenceCode: enrollmentApplicationsTable.referenceCode,
        ciphertext: enrollmentApplicationsTable.invitationCodeCiphertext,
      })
      .from(enrollmentApplicationsTable)
      .where(isNotNull(enrollmentApplicationsTable.referenceCode))
      .orderBy(asc(enrollmentApplicationsTable.id))
      .limit(batchSize)
      .offset(applyChanges ? 0 : offset);
    if (rows.length === 0) break;
    if (!applyChanges) {
      encryptedCount += rows.length;
      offset += rows.length;
      continue;
    }

    await db.transaction(async (transaction) => {
      for (const row of rows) {
        if (!row.referenceCode) continue;
        const scope = `application:${row.id}` as const;
        let ciphertext = row.ciphertext;
        if (ciphertext) {
          if (decryptInvitationCode(ciphertext, scope) !== row.referenceCode) {
            throw new Error(
              "Conflicting Invitation Code values; this batch was not changed.",
            );
          }
        } else {
          ciphertext = encryptInvitationCode(row.referenceCode, scope);
        }
        const updated = await transaction
          .update(enrollmentApplicationsTable)
          .set({ invitationCodeCiphertext: ciphertext, referenceCode: null })
          .where(
            and(
              eq(enrollmentApplicationsTable.id, row.id),
              eq(enrollmentApplicationsTable.referenceCode, row.referenceCode),
              row.ciphertext
                ? eq(
                    enrollmentApplicationsTable.invitationCodeCiphertext,
                    row.ciphertext,
                  )
                : isNull(enrollmentApplicationsTable.invitationCodeCiphertext),
            ),
          )
          .returning({ id: enrollmentApplicationsTable.id });
        if (!updated[0]) {
          throw new Error("A legacy Invitation Code changed during backfill.");
        }
        encryptedCount += 1;
      }
    });
  }
  return encryptedCount;
}

function redactInvitationCodeHistory(changes: unknown): unknown[] | null {
  if (!Array.isArray(changes)) return null;
  let changed = false;
  const safeChanges = changes.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      return entry;
    const change = entry as Record<string, unknown>;
    const field = typeof change.field === "string" ? change.field : "";
    if (!/invitation.?code|reference.?code/i.test(field)) return entry;
    changed = true;
    return {
      ...change,
      before: "Private value not stored",
      after: "Private value not stored",
    };
  });
  return changed ? safeChanges : null;
}

async function backfillRevisionHistory(): Promise<number> {
  let offset = 0;
  let redactedCount = 0;
  while (true) {
    const rows = await db
      .select({
        id: guestPreapplicationRevisionsTable.id,
        changes: guestPreapplicationRevisionsTable.changes,
      })
      .from(guestPreapplicationRevisionsTable)
      .orderBy(asc(guestPreapplicationRevisionsTable.id))
      .limit(batchSize)
      .offset(offset);
    if (rows.length === 0) break;
    const updates = rows
      .map((row) => ({
        id: row.id,
        previousChanges: row.changes,
        changes: redactInvitationCodeHistory(row.changes),
      }))
      .filter(
        (row): row is {
          id: string;
          previousChanges: Array<{
            field: string;
            before: string;
            after: string;
          }>;
          changes: unknown[];
        } =>
          row.changes !== null,
      );
    redactedCount += updates.length;
    if (applyChanges && updates.length) {
      await db.transaction(async (transaction) => {
        for (const row of updates) {
          const updated = await transaction
            .update(guestPreapplicationRevisionsTable)
            .set({
              changes: row.changes as Array<{
                field: string;
                before: string;
                after: string;
              }>,
            })
            .where(
              and(
                eq(guestPreapplicationRevisionsTable.id, row.id),
                eq(
                  guestPreapplicationRevisionsTable.changes,
                  row.previousChanges,
                ),
              ),
            )
            .returning({ id: guestPreapplicationRevisionsTable.id });
          if (!updated[0]) {
            throw new Error("Revision history changed during backfill.");
          }
        }
      });
    }
    offset += rows.length;
  }
  return redactedCount;
}

try {
  await assertBackfillPreconditions();
  const [guestCodes, enrollmentCodes, revisionRows] = await Promise.all([
    backfillGuestCodes(),
    backfillEnrollmentCodes(),
    backfillRevisionHistory(),
  ]);
  logger.info(
    {
      mode: applyChanges ? "applied" : "dry-run",
      legacyGuestCodes: guestCodes,
      legacyEnrollmentCodes: enrollmentCodes,
      revisionRowsToRedact: revisionRows,
    },
    "Invitation Code backfill finished",
  );
} catch {
  logger.error("Invitation Code backfill failed; no code values were logged.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
