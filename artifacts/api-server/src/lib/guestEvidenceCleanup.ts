import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import {
  db,
  guestPreapplicationEvidenceTable,
  guestPreapplicationsTable,
} from "@workspace/db";
import { logger } from "./logger";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "./objectStorage";

export const INCOMPLETE_GUEST_UPLOAD_RETENTION_MS = 24 * 60 * 60 * 1000;
export const COMPLETED_GUEST_DRAFT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

const objectStorage = new ObjectStorageService();
let cleanupInProgress = false;

type EvidenceRow = typeof guestPreapplicationEvidenceTable.$inferSelect;

function withoutEvidenceReference(
  answers: Record<string, unknown>,
  evidence: EvidenceRow,
): { answers: Record<string, unknown>; changed: boolean } {
  const location: Partial<Record<string, [string, string]>> = {
    identity_front: ["proofOfIdentity", "frontObjectPath"],
    identity_back: ["proofOfIdentity", "backObjectPath"],
    verification_video: ["liveVideoRecording", "objectPath"],
    education_certificate: ["education", "certificateObjectPath"],
  };
  const field = location[evidence.evidenceSlot];
  if (!field) return { answers, changed: false };

  const [sectionName, key] = field;
  const section = answers[sectionName];
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    return { answers, changed: false };
  }
  const sectionRecord = section as Record<string, unknown>;
  if (sectionRecord[key] !== evidence.objectPath) {
    return { answers, changed: false };
  }

  const nextSection = { ...sectionRecord };
  delete nextSection[key];
  return {
    answers: { ...answers, [sectionName]: nextSection },
    changed: true,
  };
}

function answersReferenceEvidence(
  answers: Record<string, unknown>,
  evidence: EvidenceRow,
): boolean {
  const location: Partial<Record<string, [string, string]>> = {
    identity_front: ["proofOfIdentity", "frontObjectPath"],
    identity_back: ["proofOfIdentity", "backObjectPath"],
    verification_video: ["liveVideoRecording", "objectPath"],
    education_certificate: ["education", "certificateObjectPath"],
  };
  const field = location[evidence.evidenceSlot];
  if (!field) return false;
  const [sectionName, key] = field;
  const section = answers[sectionName];
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    return false;
  }
  return (section as Record<string, unknown>)[key] === evidence.objectPath;
}

function isExpiredIncompleteUpload(
  evidence: EvidenceRow,
  now: Date,
): boolean {
  if (evidence.uploadedAt) return false;
  if (evidence.uploadExpiresAt) return evidence.uploadExpiresAt <= now;
  // Handle upload records created before uploadExpiresAt was introduced.
  return evidence.createdAt <= new Date(now.getTime() - INCOMPLETE_GUEST_UPLOAD_RETENTION_MS);
}

async function removeGuestEvidenceObject(objectPath: string): Promise<void> {
  if (!objectPath.startsWith("/objects/")) {
    throw new Error("Guest evidence has an invalid private object path.");
  }

  try {
    const objectFile = await objectStorage.getObjectEntityFile(objectPath);
    await objectFile.delete({ ignoreNotFound: true });
  } catch (error) {
    if (!(error instanceof ObjectNotFoundError)) throw error;
  }
}

/**
 * Removes only expired rows from the guest-evidence table. A row lock and a
 * fresh status check prevent cleanup from deleting evidence after its guest
 * draft has been linked to a real enrollment application.
 */
export async function cleanupExpiredGuestEvidence(now = new Date()): Promise<void> {
  if (cleanupInProgress) return;
  cleanupInProgress = true;

  const runId = crypto.randomUUID();
  const incompleteCutoff = new Date(now.getTime() - INCOMPLETE_GUEST_UPLOAD_RETENTION_MS);
  const completedCutoff = new Date(now.getTime() - COMPLETED_GUEST_DRAFT_RETENTION_MS);
  let deletedCount = 0;
  let failureCount = 0;
  let candidateDraftCount = 0;

  try {
    const [expiredUploads, expiredUnreferencedGuestEvidence, inactiveDrafts] = await Promise.all([
      db
        .select()
        .from(guestPreapplicationEvidenceTable)
        .where(and(
          isNull(guestPreapplicationEvidenceTable.uploadedAt),
          or(
            lt(guestPreapplicationEvidenceTable.uploadExpiresAt, now),
            and(
              isNull(guestPreapplicationEvidenceTable.uploadExpiresAt),
              lt(guestPreapplicationEvidenceTable.createdAt, incompleteCutoff),
            ),
          ),
        )),
      db
        .select()
        .from(guestPreapplicationEvidenceTable)
        .where(and(
          isNull(guestPreapplicationEvidenceTable.uploadedByUserId),
          isNotNull(guestPreapplicationEvidenceTable.uploadedAt),
          lt(guestPreapplicationEvidenceTable.createdAt, incompleteCutoff),
        )),
      db
        .select()
        .from(guestPreapplicationsTable)
        .where(and(
          eq(guestPreapplicationsTable.submissionStatus, "draft"),
          isNull(guestPreapplicationsTable.linkedApplicationId),
          lt(guestPreapplicationsTable.updatedAt, completedCutoff),
        )),
    ]);

    const applicationIds = new Set<string>();
    for (const evidence of expiredUploads) applicationIds.add(evidence.applicationId);
    for (const evidence of expiredUnreferencedGuestEvidence) {
      applicationIds.add(evidence.applicationId);
    }
    for (const application of inactiveDrafts) applicationIds.add(application.id);
    candidateDraftCount = applicationIds.size;

    for (const applicationId of applicationIds) {
      try {
        const result = await db.transaction(async (transaction) => {
          const [application] = await transaction
            .select()
            .from(guestPreapplicationsTable)
            .where(eq(guestPreapplicationsTable.id, applicationId))
            .for("update")
            .limit(1);
          if (
            !application ||
            application.submissionStatus !== "draft" ||
            application.linkedApplicationId
          ) {
            return { deleted: 0, failures: 0 };
          }

          const evidenceRows = await transaction
            .select()
            .from(guestPreapplicationEvidenceTable)
            .where(eq(guestPreapplicationEvidenceTable.applicationId, applicationId));
          const inactiveDraft = application.updatedAt <= completedCutoff;
          let answers = structuredClone(application.answers ?? {});
          let answersChanged = false;
          let removed = 0;
          let failures = 0;

          for (const evidence of evidenceRows) {
            const expiredIncomplete = isExpiredIncompleteUpload(evidence, now);
            const expiredUnreferencedGuestEvidence =
              evidence.uploadedAt !== null &&
              evidence.uploadedByUserId === null &&
              evidence.createdAt <= incompleteCutoff &&
              !answersReferenceEvidence(answers, evidence);
            const expiredComplete = Boolean(evidence.uploadedAt && inactiveDraft);
            if (
              !expiredIncomplete &&
              !expiredUnreferencedGuestEvidence &&
              !expiredComplete
            ) continue;

            const reason = expiredIncomplete
              ? "incomplete_upload_expired"
              : expiredUnreferencedGuestEvidence
                ? "unreferenced_guest_upload_expired"
                : "unsubmitted_draft_inactive";
            try {
              await removeGuestEvidenceObject(evidence.objectPath);
              const [deleted] = await transaction
                .delete(guestPreapplicationEvidenceTable)
                .where(and(
                  eq(guestPreapplicationEvidenceTable.id, evidence.id),
                  eq(guestPreapplicationEvidenceTable.applicationId, applicationId),
                ))
                .returning({ id: guestPreapplicationEvidenceTable.id });
              if (!deleted) continue;

              const answerUpdate = withoutEvidenceReference(answers, evidence);
              answers = answerUpdate.answers;
              answersChanged ||= answerUpdate.changed;
              removed += 1;
              logger.info(
                { runId, applicationId, evidenceId: evidence.id, reason },
                "Expired guest evidence removed",
              );
            } catch (error) {
              failures += 1;
              logger.warn(
                { err: error, runId, applicationId, evidenceId: evidence.id, reason },
                "Expired guest evidence cleanup failed",
              );
            }
          }

          if (answersChanged) {
            await transaction
              .update(guestPreapplicationsTable)
              .set({ answers })
              .where(eq(guestPreapplicationsTable.id, applicationId));
          }
          return { deleted: removed, failures };
        });
        deletedCount += result.deleted;
        failureCount += result.failures;
      } catch (error) {
        failureCount += 1;
        logger.error(
          { err: error, runId, applicationId },
          "Guest evidence cleanup failed for an application",
        );
      }
    }

    logger.info(
      {
        runId,
        candidateDraftCount,
        deletedCount,
        failureCount,
        incompleteUploadRetentionHours: INCOMPLETE_GUEST_UPLOAD_RETENTION_MS / 3_600_000,
        completedDraftRetentionDays: COMPLETED_GUEST_DRAFT_RETENTION_MS / 86_400_000,
      },
      "Guest evidence cleanup run completed",
    );
  } catch (error) {
    logger.error({ err: error, runId }, "Guest evidence cleanup run failed");
  } finally {
    cleanupInProgress = false;
  }
}

export function startGuestEvidenceCleanup(): void {
  void cleanupExpiredGuestEvidence();
  const interval = setInterval(() => {
    void cleanupExpiredGuestEvidence();
  }, CLEANUP_INTERVAL_MS);
  interval.unref();
}
