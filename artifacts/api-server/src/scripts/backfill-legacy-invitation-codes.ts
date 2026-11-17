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
        changes: redactInvitationCodeHistory(row.changes),
      }))
      .filter(
        (row): row is { id: string; changes: unknown[] } =>
          row.changes !== null,
      );
    redactedCount += updates.length;
    if (applyChanges && updates.length) {
      await db.transaction(async (transaction) => {
        for (const row of updates) {
          await transaction
            .update(guestPreapplicationRevisionsTable)
            .set({
              changes: row.changes as Array<{
                field: string;
                before: string;
                after: string;
              }>,
            })
            .where(eq(guestPreapplicationRevisionsTable.id, row.id));
        }
      });
    }
    offset += rows.length;
  }
  return redactedCount;
}

try {
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
