import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { createGzip } from "node:zlib";
import { and, desc, eq } from "drizzle-orm";
import {
  applicantMasterArchiveAuditTable,
  applicantMasterArchiveCasesTable,
  applicantMasterArchiveEvidenceTable,
  applicantMasterArchiveSnapshotsTable,
  db,
  enrollmentApplicationsTable,
  guestPreapplicationEvidenceTable,
  guestPreapplicationRevisionsTable,
  guestPreapplicationsTable,
} from "@workspace/db";
import { ObjectNotFoundError, ObjectStorageService } from "./objectStorage";

const objectStorage = new ObjectStorageService();

type ArchiveSourceType = "guest" | "application";
type JsonRecord = Record<string, unknown>;
type ArchiveActor = string | null;

type EvidenceMetadata = {
  objectPath: string;
  fieldPath: string;
  fileName: string;
  evidenceType: string;
  contentType: string;
  sizeBytes: number;
};

const privateKeyFields = /pin|password|accesskey|sessiontoken|secret|authorization/i;
const privateMetadataFields = /^(clerkUserId|reviewerUserId|updatedByUserId|reviewNote)$/i;

function archiveEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Applicant archive encryption is not configured.");
  return createHmac("sha256", secret).update("civic-enroll-applicant-archive-v1").digest();
}

function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", archiveEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    "enc:v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

function decryptJson(value: string): unknown {
  const [, version, ivPart, tagPart, ciphertextPart] = value.split(":");
  if (version !== "v1" || !ivPart || !tagPart || !ciphertextPart) {
    throw new Error("The applicant archive contains an unsupported encrypted record.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    archiveEncryptionKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as unknown;
}

function bankAccountKey(): Buffer | null {
  const secret = process.env.SESSION_SECRET;
  return secret
    ? createHmac("sha256", secret).update("civic-enroll-bank-v1").digest()
    : null;
}

function decryptBankAccount(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("enc:v1:")) return null;
  const key = bankAccountKey();
  if (!key) return null;
  const [, , ivPart, tagPart, ciphertextPart] = value.split(":");
  if (!ivPart || !tagPart || !ciphertextPart) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function sanitizeArchiveValue(value: unknown, fieldName = ""): unknown {
  if (privateKeyFields.test(fieldName) || privateMetadataFields.test(fieldName)) return undefined;
  if (fieldName.startsWith("__")) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeArchiveValue(item))
      .filter((item) => item !== undefined);
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .map(([key, child]) => [key, sanitizeArchiveValue(child, key)] as const)
        .filter((entry): entry is readonly [string, unknown] => entry[1] !== undefined),
    );
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function presentArchiveValue(value: unknown, evidence: Map<string, string>): unknown {
  if (typeof value === "string") {
    if (!value.startsWith("/objects/")) return value;
    return evidence.get(value) ?? "Private evidence unavailable";
  }
  if (Array.isArray(value)) return value.map((item) => presentArchiveValue(item, evidence));
  if (value !== null && typeof value === "object") {
    const record = value as JsonRecord;
    const bank = asRecord(record.bankDetails);
    const output: JsonRecord = {};
    for (const [key, child] of Object.entries(record)) {
      if (key === "accountNumberEncrypted" || key === "accountNumberLast4" || key === "accountNumberMasked") {
        continue;
      }
      if (key === "bankDetails") continue;
      output[key] = presentArchiveValue(child, evidence);
    }
    if (Object.hasOwn(record, "bankDetails")) {
      const bankOutput: JsonRecord = {};
      for (const [key, child] of Object.entries(bank)) {
        if (key === "accountNumberEncrypted" || key === "accountNumberLast4" || key === "accountNumberMasked") continue;
        bankOutput[key] = presentArchiveValue(child, evidence);
      }
      if (typeof bank.accountNumberEncrypted === "string") {
        bankOutput.accountNumber =
          decryptBankAccount(bank.accountNumberEncrypted) ?? "Unavailable (encryption key changed)";
      }
      output.bankDetails = bankOutput;
    }
    return output;
  }
  return value;
}

function collectEvidencePaths(
  value: unknown,
  prefix = "",
  paths = new Map<string, string>(),
): Map<string, string> {
  if (typeof value === "string" && /^\/objects\/[A-Za-z0-9/_-]+$/.test(value)) {
    if (!paths.has(value)) paths.set(value, prefix || "Applicant evidence");
    return paths;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectEvidencePaths(item, `${prefix}[${index}]`, paths));
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as JsonRecord)) {
      collectEvidencePaths(child, prefix ? `${prefix}.${key}` : key, paths);
    }
  }
  return paths;
}

function fingerprintForPath(objectPath: string): string {
  return createHmac("sha256", archiveEncryptionKey())
    .update(objectPath)
    .digest("hex");
}

function readableDiffValue(value: unknown): unknown {
  return presentArchiveValue(value, new Map());
}

function collectFieldChanges(
  before: unknown,
  after: unknown,
  prefix = "",
  changes: Array<{ field: string; before: unknown; after: unknown }> = [],
): Array<{ field: string; before: unknown; after: unknown }> {
  if (prefix === "correctionHistory" || prefix.startsWith("correctionHistory.")) return changes;
  const beforeIsRecord = before !== null && typeof before === "object" && !Array.isArray(before);
  const afterIsRecord = after !== null && typeof after === "object" && !Array.isArray(after);
  if (beforeIsRecord || afterIsRecord) {
    const previous = beforeIsRecord ? before as JsonRecord : {};
    const current = afterIsRecord ? after as JsonRecord : {};
    const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
    for (const key of keys) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (["createdAt", "updatedAt", "correctionHistory"].includes(key) || key.startsWith("__")) continue;
      collectFieldChanges(previous[key], current[key], path, changes);
    }
    return changes;
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    if (
      typeof before === "string" &&
      typeof after === "string" &&
      before.startsWith("/objects/") &&
      after.startsWith("/objects/")
    ) {
      changes.push({ field: prefix || "Applicant evidence", before: "Private evidence attached", after: "Private evidence replaced" });
      return changes;
    }
    if (/accountNumberEncrypted/i.test(prefix)) {
      changes.push({
        field: prefix.replace(/accountNumberEncrypted/i, "accountNumber"),
        before: decryptBankAccount(before) ?? "Unavailable (encryption key changed)",
        after: decryptBankAccount(after) ?? "Unavailable (encryption key changed)",
      });
      return changes;
    }
    changes.push({
      field: prefix || "Application record",
      before: readableDiffValue(before ?? null),
      after: readableDiffValue(after ?? null),
    });
  }
  return changes;
}

function casePayload(
  sourceType: ArchiveSourceType,
  source: typeof guestPreapplicationsTable.$inferSelect | typeof enrollmentApplicationsTable.$inferSelect,
  linkedApplication?: typeof enrollmentApplicationsTable.$inferSelect | null,
  correctionHistory: unknown[] = [],
): JsonRecord {
  const sourceRecord = source as unknown as JsonRecord;
  const guest = sourceType === "guest";
  const answers = asRecord(sourceRecord.answers);
  const payload: JsonRecord = {
    recordType: sourceType,
    reference: sourceRecord.reference,
    categoryId: sourceRecord.categoryId,
    currentStep: sourceRecord.currentStep,
    answers: sanitizeArchiveValue(answers),
    status: sourceRecord.status,
    createdAt: sourceRecord.createdAt,
    updatedAt: sourceRecord.updatedAt,
    correctionHistory,
  };
  if (guest) {
    payload.fullName = sourceRecord.fullName;
    payload.email = sourceRecord.email;
    payload.phone = sourceRecord.phone;
    payload.detailsComplete = sourceRecord.detailsComplete;
    payload.submissionStatus = sourceRecord.submissionStatus;
    payload.emailVerified = sourceRecord.emailVerified;
    payload.linkedApplicationId = sourceRecord.linkedApplicationId;
  } else {
    payload.submittedAt = sourceRecord.submittedAt;
  }
  if (linkedApplication) {
    payload.linkedApplication = {
      categoryId: linkedApplication.categoryId,
      currentStep: linkedApplication.currentStep,
      status: linkedApplication.status,
      answers: sanitizeArchiveValue(linkedApplication.answers ?? {}),
      submittedAt: linkedApplication.submittedAt,
      createdAt: linkedApplication.createdAt,
      updatedAt: linkedApplication.updatedAt,
    };
  }
  return sanitizeArchiveValue(payload) as JsonRecord;
}

function safeFilename(value: string): string {
  return value
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .slice(0, 60) || "evidence";
}

function tarHeader(name: string, size: number): Buffer {
  const header = Buffer.alloc(512, 0);
  const safeName = name.slice(0, 100);
  header.write(safeName, 0, 100, "utf8");
  header.write("0000644\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");
  header.write(`${Math.max(0, size).toString(8).padStart(11, "0")}\0`, 124, 12, "ascii");
  header.write(`${Math.floor(Date.now() / 1000).toString(8).padStart(11, "0")}\0`, 136, 12, "ascii");
  header.fill(0x20, 148, 156);
  header[156] = 0x30;
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  return header;
}

function tarPadding(size: number): Buffer {
  const remainder = size % 512;
  return remainder ? Buffer.alloc(512 - remainder) : Buffer.alloc(0);
}

async function createOrFindCase(
  sourceType: ArchiveSourceType,
  sourceId: string,
  reference: string,
  historyUnavailable: boolean,
) {
  await db
    .insert(applicantMasterArchiveCasesTable)
    .values({
      sourceType,
      sourceId,
      reference,
      historyUnavailable,
      updatedAt: new Date(),
    })
    .onConflictDoNothing();
  const [archiveCase] = await db
    .select()
    .from(applicantMasterArchiveCasesTable)
    .where(and(
      eq(applicantMasterArchiveCasesTable.sourceType, sourceType),
      eq(applicantMasterArchiveCasesTable.sourceId, sourceId),
    ))
    .limit(1);
  if (!archiveCase || archiveCase.sourceType !== sourceType) {
    throw new Error("Applicant archive case could not be created.");
  }
  return archiveCase;
}

async function archiveEvidence(
  archiveId: string,
  payload: JsonRecord,
  suppliedMetadata: EvidenceMetadata[] = [],
  actorUserId: ArchiveActor,
): Promise<Array<typeof applicantMasterArchiveEvidenceTable.$inferSelect>> {
  const paths = collectEvidencePaths(payload);
  for (const item of suppliedMetadata) {
    if (!paths.has(item.objectPath)) paths.set(item.objectPath, item.fieldPath);
  }
  const existingRows = await db
    .select()
    .from(applicantMasterArchiveEvidenceTable)
    .where(eq(applicantMasterArchiveEvidenceTable.archiveId, archiveId));
  const existing = new Map(existingRows.map((row) => [row.sourceFingerprint, row]));
  const supplied = new Map(suppliedMetadata.map((item) => [item.objectPath, item]));

  for (const [sourcePath, fieldPath] of paths) {
    const fingerprint = fingerprintForPath(sourcePath);
    if (existing.has(fingerprint)) continue;
    const metadata = supplied.get(sourcePath);
    let fileName = metadata?.fileName ?? safeFilename(sourcePath.split("/").at(-1) ?? "evidence");
    let contentType = metadata?.contentType ?? "application/octet-stream";
    let sizeBytes = metadata?.sizeBytes ?? 0;
    let archivedPath: string | null = null;
    let availability = "available";
    try {
      const sourceFile = await objectStorage.getObjectEntityFile(sourcePath);
      const [objectMetadata] = await sourceFile.getMetadata();
      contentType = metadata?.contentType ?? String(objectMetadata.contentType ?? contentType);
      sizeBytes = metadata?.sizeBytes ?? Number(objectMetadata.size ?? 0);
      if (!metadata?.fileName) {
        const originalName = objectMetadata.metadata?.originalName;
        if (typeof originalName === "string") fileName = safeFilename(originalName);
      }
      archivedPath = await objectStorage.copyPrivateObjectEntity(
        sourcePath,
        "archive",
        actorUserId ?? "archive-service",
      );
    } catch (error) {
      if (error instanceof ObjectNotFoundError || (error as Error)?.name === "ObjectNotFoundError") {
        availability = "missing";
      } else {
        throw error;
      }
    }
    await db
      .insert(applicantMasterArchiveEvidenceTable)
      .values({
        archiveId,
        sourceFingerprint: fingerprint,
        sourcePathEncrypted: encryptJson(sourcePath),
        archiveObjectPath: archivedPath,
        fieldPath,
        fileName: safeFilename(fileName),
        evidenceType: metadata?.evidenceType ?? fieldPath.split(".")[0] ?? "applicant_evidence",
        contentType,
        sizeBytes,
        availability,
      })
      .onConflictDoNothing();
    const [stored] = await db
      .select()
      .from(applicantMasterArchiveEvidenceTable)
      .where(and(
        eq(applicantMasterArchiveEvidenceTable.archiveId, archiveId),
        eq(applicantMasterArchiveEvidenceTable.sourceFingerprint, fingerprint),
      ))
      .limit(1);
    if (stored?.archiveObjectPath !== archivedPath && archivedPath) {
      await objectStorage.deleteArchiveObjectEntity(archivedPath).catch(() => undefined);
    }
    if (stored) existing.set(fingerprint, stored);
  }
  return [...existing.values()];
}

async function writeSnapshot(
  sourceType: ArchiveSourceType,
  sourceId: string,
  reference: string,
  payload: JsonRecord,
  options: {
    actorUserId?: ArchiveActor;
    eventType: string;
    historyUnavailable?: boolean;
    onlyIfMissing?: boolean;
    evidenceMetadata?: EvidenceMetadata[];
  },
) {
  const archiveCase = await createOrFindCase(
    sourceType,
    sourceId,
    reference,
    options.historyUnavailable ?? sourceType === "application",
  );
  const evidenceRows = await archiveEvidence(
    archiveCase.id,
    payload,
    options.evidenceMetadata,
    options.actorUserId ?? null,
  );
  const [latest] = await db
    .select()
    .from(applicantMasterArchiveSnapshotsTable)
    .where(eq(applicantMasterArchiveSnapshotsTable.archiveId, archiveCase.id))
    .orderBy(desc(applicantMasterArchiveSnapshotsTable.version))
    .limit(1);
  if (options.onlyIfMissing && latest) {
    await db
      .update(applicantMasterArchiveCasesTable)
      .set({ updatedAt: new Date() })
      .where(eq(applicantMasterArchiveCasesTable.id, archiveCase.id));
    return { archiveId: archiveCase.id, created: false };
  }

  const previous = latest
    ? asRecord(decryptJson(latest.payloadEncrypted))
    : {};
  const changes = latest ? collectFieldChanges(previous, payload) : [];
  if (latest && options.eventType !== "initial_archive_snapshot" && changes.length === 0) {
    await db
      .update(applicantMasterArchiveCasesTable)
      .set({
        updatedAt: new Date(),
        ...(options.historyUnavailable !== undefined
          ? { historyUnavailable: options.historyUnavailable || archiveCase.historyUnavailable }
          : {}),
      })
      .where(eq(applicantMasterArchiveCasesTable.id, archiveCase.id));
    return { archiveId: archiveCase.id, created: false, evidenceRows };
  }
  const [snapshot] = await db
    .insert(applicantMasterArchiveSnapshotsTable)
    .values({
      archiveId: archiveCase.id,
      version: (latest?.version ?? 0) + 1,
      eventType: options.eventType,
      actorUserId: options.actorUserId ?? null,
      payloadEncrypted: encryptJson(payload),
      changesEncrypted: encryptJson(changes),
    })
    .returning();
  if (!snapshot) throw new Error("Applicant archive snapshot could not be saved.");
  await db
    .update(applicantMasterArchiveCasesTable)
    .set({
      reference,
      updatedAt: new Date(),
      ...(options.historyUnavailable !== undefined
        ? { historyUnavailable: options.historyUnavailable || archiveCase.historyUnavailable }
        : {}),
    })
    .where(eq(applicantMasterArchiveCasesTable.id, archiveCase.id));
  return { archiveId: archiveCase.id, snapshotId: snapshot.id, version: snapshot.version, created: true, evidenceRows };
}

export async function captureGuestApplicantArchive(
  application: typeof guestPreapplicationsTable.$inferSelect,
  options: { actorUserId?: ArchiveActor; eventType?: string; onlyIfMissing?: boolean } = {},
) {
  const [linkedApplication] = application.linkedApplicationId
    ? await db
        .select()
        .from(enrollmentApplicationsTable)
        .where(eq(enrollmentApplicationsTable.id, application.linkedApplicationId))
        .limit(1)
    : [];
  const [revisions] = [await db
    .select()
    .from(guestPreapplicationRevisionsTable)
    .where(eq(guestPreapplicationRevisionsTable.applicationId, application.id))
    .orderBy(guestPreapplicationRevisionsTable.createdAt)];
  const evidenceRows = await db
    .select()
    .from(guestPreapplicationEvidenceTable)
    .where(eq(guestPreapplicationEvidenceTable.applicationId, application.id));
  const evidenceMetadata: EvidenceMetadata[] = evidenceRows
    .filter((item) => item.uploadedAt !== null)
    .map((item) => ({
      objectPath: item.objectPath,
      fieldPath: item.evidenceSlot,
      fileName: item.fileName,
      evidenceType: item.evidenceType,
      contentType: item.contentType,
      sizeBytes: item.sizeBytes,
    }));
  const payload = casePayload("guest", application, linkedApplication ?? null, revisions.map((revision) => ({
    currentStep: revision.currentStep,
    changes: revision.changes,
    createdAt: revision.createdAt,
  })));
  return writeSnapshot("guest", application.id, application.reference, payload, {
    actorUserId: options.actorUserId,
    eventType: options.eventType ?? "guest_progress_saved",
    onlyIfMissing: options.onlyIfMissing,
    historyUnavailable: false,
    evidenceMetadata,
  });
}

export async function captureEnrollmentApplicantArchive(
  application: typeof enrollmentApplicationsTable.$inferSelect,
  options: { actorUserId?: ArchiveActor; eventType?: string; onlyIfMissing?: boolean } = {},
) {
  if (application.sourceGuestPreapplicationId) {
    const [guest] = await db
      .select()
      .from(guestPreapplicationsTable)
      .where(eq(guestPreapplicationsTable.id, application.sourceGuestPreapplicationId))
      .limit(1);
    if (guest) return captureGuestApplicantArchive(guest, options);
  }
  const payload = casePayload("application", application);
  return writeSnapshot("application", application.id, application.reference, payload, {
    actorUserId: options.actorUserId,
    eventType: options.eventType ?? "application_progress_saved",
    onlyIfMissing: options.onlyIfMissing,
    historyUnavailable: true,
  });
}

export async function ensureInitialApplicantArchive(): Promise<void> {
  const guests = await db.select().from(guestPreapplicationsTable);
  for (const guest of guests) {
    await captureGuestApplicantArchive(guest, {
      eventType: "initial_archive_snapshot",
      onlyIfMissing: true,
    });
  }
  const applications = await db.select().from(enrollmentApplicationsTable);
  for (const application of applications) {
    if (application.sourceGuestPreapplicationId) continue;
    await captureEnrollmentApplicantArchive(application, {
      eventType: "initial_archive_snapshot",
      onlyIfMissing: true,
    });
  }
}

async function getEvidencePresentation(archiveId: string) {
  const rows = await db
    .select()
    .from(applicantMasterArchiveEvidenceTable)
    .where(eq(applicantMasterArchiveEvidenceTable.archiveId, archiveId));
  const labels = new Map<string, string>();
  for (const row of rows) {
    const sourcePath = decryptJson(row.sourcePathEncrypted);
    if (typeof sourcePath === "string") {
      labels.set(sourcePath, `[Proof: ${row.fileName}]`);
    }
  }
  return { rows, labels };
}

function readableSnapshot(snapshot: typeof applicantMasterArchiveSnapshotsTable.$inferSelect, labels: Map<string, string>) {
  const payload = asRecord(decryptJson(snapshot.payloadEncrypted));
  const changes = decryptJson(snapshot.changesEncrypted);
  return {
    id: snapshot.id,
    version: snapshot.version,
    eventType: snapshot.eventType,
    actorUserId: snapshot.actorUserId,
    createdAt: snapshot.createdAt.toISOString(),
    payload: presentArchiveValue(payload, labels),
    changes: Array.isArray(changes)
      ? changes.map((change) => {
          const row = asRecord(change);
          return {
            field: row.field,
            before: presentArchiveValue(row.before, labels),
            after: presentArchiveValue(row.after, labels),
          };
        })
      : [],
  };
}

export async function listApplicantArchive(search = "") {
  const cases = await db
    .select()
    .from(applicantMasterArchiveCasesTable)
    .orderBy(desc(applicantMasterArchiveCasesTable.updatedAt));
  const snapshots = await db
    .select()
    .from(applicantMasterArchiveSnapshotsTable)
    .orderBy(desc(applicantMasterArchiveSnapshotsTable.createdAt));
  const latestByCase = new Map<string, typeof snapshots[number]>();
  const counts = new Map<string, number>();
  for (const snapshot of snapshots) {
    counts.set(snapshot.archiveId, (counts.get(snapshot.archiveId) ?? 0) + 1);
    if (!latestByCase.has(snapshot.archiveId)) latestByCase.set(snapshot.archiveId, snapshot);
  }
  const needle = search.trim().toLowerCase();
  return cases.flatMap((archiveCase) => {
    const latest = latestByCase.get(archiveCase.id);
    if (!latest) return [];
    const payload = asRecord(decryptJson(latest.payloadEncrypted));
    const item = {
      id: archiveCase.id,
      reference: archiveCase.reference,
      applicantName: String(payload.fullName ?? ""),
      applicantEmail: String(payload.email ?? ""),
      categoryId: String(payload.categoryId ?? ""),
      status: String(payload.status ?? payload.submissionStatus ?? "unknown"),
      versionCount: counts.get(archiveCase.id) ?? 0,
      historyUnavailable: archiveCase.historyUnavailable,
      updatedAt: latest.createdAt.toISOString(),
    };
    const query = `${item.reference} ${item.applicantName} ${item.applicantEmail} ${item.categoryId} ${item.status}`.toLowerCase();
    return !needle || query.includes(needle) ? [item] : [];
  });
}

export async function getApplicantArchiveDetail(archiveId: string) {
  const [archiveCase] = await db
    .select()
    .from(applicantMasterArchiveCasesTable)
    .where(eq(applicantMasterArchiveCasesTable.id, archiveId))
    .limit(1);
  if (!archiveCase) return null;
  const snapshots = await db
    .select()
    .from(applicantMasterArchiveSnapshotsTable)
    .where(eq(applicantMasterArchiveSnapshotsTable.archiveId, archiveId))
    .orderBy(desc(applicantMasterArchiveSnapshotsTable.version));
  const { rows, labels } = await getEvidencePresentation(archiveId);
  const latest = snapshots[0] ? asRecord(decryptJson(snapshots[0].payloadEncrypted)) : {};
  return {
    id: archiveCase.id,
    reference: archiveCase.reference,
    sourceType: archiveCase.sourceType,
    applicantName: String(latest.fullName ?? ""),
    applicantEmail: String(latest.email ?? ""),
    categoryId: String(latest.categoryId ?? ""),
    status: String(latest.status ?? latest.submissionStatus ?? "unknown"),
    historyUnavailable: archiveCase.historyUnavailable,
    updatedAt: archiveCase.updatedAt.toISOString(),
    snapshots: snapshots.map((snapshot) => readableSnapshot(snapshot, labels)),
    evidence: rows.map((row) => ({
      id: row.id,
      fieldPath: row.fieldPath,
      fileName: row.fileName,
      evidenceType: row.evidenceType,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      availability: row.availability,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function recordApplicantArchiveAudit(input: {
  archiveId?: string | null;
  reference?: string | null;
  actorUserId: string | null;
  action: string;
  details?: JsonRecord;
}) {
  await db.insert(applicantMasterArchiveAuditTable).values({
    archiveId: input.archiveId ?? null,
    reference: input.reference ?? null,
    actorUserId: input.actorUserId,
    action: input.action,
    details: input.details ?? {},
  });
}

export async function createApplicantArchiveBundle(archiveId: string): Promise<Readable | null> {
  const detail = await getApplicantArchiveDetail(archiveId);
  if (!detail) return null;
  const evidenceRows = await db
    .select()
    .from(applicantMasterArchiveEvidenceTable)
    .where(eq(applicantMasterArchiveEvidenceTable.archiveId, archiveId));
  const available = evidenceRows.filter(
    (row) => row.availability === "available" && row.archiveObjectPath,
  );
  const files = await Promise.all(available.map(async (row) => ({
    row,
    file: await objectStorage.getObjectEntityFile(row.archiveObjectPath!),
  })));
  const manifest = Buffer.from(JSON.stringify({
    format: "applicant-master-archive-v1",
    record: detail,
    proofFiles: files.map(({ row }) => ({
      id: row.id,
      archivePath: `proofs/${row.id}-${safeFilename(row.fileName)}`,
      fieldPath: row.fieldPath,
      fileName: row.fileName,
      evidenceType: row.evidenceType,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
    })),
  }, null, 2));

  async function* tarEntries() {
    yield tarHeader("manifest.json", manifest.length);
    yield manifest;
    yield tarPadding(manifest.length);
    for (const { row, file } of files) {
      const name = `proofs/${row.id}-${safeFilename(row.fileName)}`;
      yield tarHeader(name, row.sizeBytes);
      for await (const chunk of file.createReadStream()) {
        yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      }
      yield tarPadding(row.sizeBytes);
    }
    yield Buffer.alloc(1024);
  }

  return Readable.from(tarEntries()).pipe(createGzip());
}

function replaceEvidencePaths(value: unknown, pathMap: Map<string, string>): unknown {
  if (typeof value === "string") return pathMap.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => replaceEvidencePaths(item, pathMap));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as JsonRecord).map(([key, child]) => [
      key,
      replaceEvidencePaths(child, pathMap),
    ]));
  }
  return value;
}

export async function restoreApplicantArchiveSnapshot(
  archiveId: string,
  snapshotId: string,
  actorUserId: string,
): Promise<{ reference: string; version: number }> {
  const [archiveCase] = await db
    .select()
    .from(applicantMasterArchiveCasesTable)
    .where(eq(applicantMasterArchiveCasesTable.id, archiveId))
    .limit(1);
  const [snapshot] = await db
    .select()
    .from(applicantMasterArchiveSnapshotsTable)
    .where(eq(applicantMasterArchiveSnapshotsTable.id, snapshotId))
    .limit(1);
  if (!archiveCase || !snapshot || snapshot.archiveId !== archiveId) {
    throw new Error("Archive snapshot not found.");
  }
  const payload = asRecord(decryptJson(snapshot.payloadEncrypted));
  const rawAnswers = asRecord(payload.answers);
  const [guest] = archiveCase.sourceType === "guest"
    ? await db
        .select()
        .from(guestPreapplicationsTable)
        .where(eq(guestPreapplicationsTable.id, archiveCase.sourceId))
        .limit(1)
    : [];
  const [application] = archiveCase.sourceType === "application"
    ? await db
        .select()
        .from(enrollmentApplicationsTable)
        .where(eq(enrollmentApplicationsTable.id, archiveCase.sourceId))
        .limit(1)
    : guest?.linkedApplicationId
      ? await db
          .select()
          .from(enrollmentApplicationsTable)
          .where(eq(enrollmentApplicationsTable.id, guest.linkedApplicationId))
          .limit(1)
      : [];
  if (!guest && !application) {
    throw new Error("The original live application no longer exists; export the archive to recover its data.");
  }

  const archivedEvidence = await db
    .select()
    .from(applicantMasterArchiveEvidenceTable)
    .where(eq(applicantMasterArchiveEvidenceTable.archiveId, archiveId));
  const pathMap = new Map<string, string>();
  const restoredEvidence: Array<{ row: typeof archivedEvidence[number]; objectPath: string }> = [];
  for (const row of archivedEvidence) {
    if (row.availability !== "available" || !row.archiveObjectPath) continue;
    const originalPath = decryptJson(row.sourcePathEncrypted);
    if (typeof originalPath !== "string" || !collectEvidencePaths(rawAnswers).has(originalPath)) continue;
    const objectPath = await objectStorage.copyPrivateObjectEntity(
      row.archiveObjectPath,
      "uploads",
      actorUserId,
    );
    pathMap.set(originalPath, objectPath);
    restoredEvidence.push({ row, objectPath });
  }
  const answers = replaceEvidencePaths(rawAnswers, pathMap) as JsonRecord;
  const now = new Date();
  if (guest) {
    await db
      .update(guestPreapplicationsTable)
      .set({
        fullName: String(payload.fullName ?? guest.fullName),
        email: String(payload.email ?? guest.email),
        phone: typeof payload.phone === "string" ? payload.phone : null,
        categoryId: String(payload.categoryId ?? guest.categoryId),
        currentStep: Number(payload.currentStep ?? guest.currentStep),
        answers,
        detailsComplete: Boolean(payload.detailsComplete),
        updatedByUserId: actorUserId,
        updatedAt: now,
      })
      .where(eq(guestPreapplicationsTable.id, guest.id));
    if (application) {
      await db
        .update(enrollmentApplicationsTable)
        .set({
          categoryId: String(asRecord(payload.linkedApplication).categoryId ?? payload.categoryId ?? application.categoryId),
          currentStep: Number(asRecord(payload.linkedApplication).currentStep ?? payload.currentStep ?? application.currentStep),
          answers: replaceEvidencePaths(
            asRecord(payload.linkedApplication).answers ?? rawAnswers,
            pathMap,
          ) as JsonRecord,
          updatedAt: now,
        })
        .where(eq(enrollmentApplicationsTable.id, application.id));
    }
    const fieldForSlot: Record<string, string> = {
      identity_front: "proofOfIdentity.frontObjectPath",
      identity_back: "proofOfIdentity.backObjectPath",
      verification_video: "liveVideoRecording.objectPath",
      education_certificate: "education.certificateObjectPath",
    };
    const slotForField = new Map(Object.entries(fieldForSlot).map(([slot, field]) => [field, slot]));
    for (const { row, objectPath } of restoredEvidence) {
      const evidenceSlot = slotForField.get(row.fieldPath) ?? row.fieldPath;
      const evidenceType = row.evidenceType === "identity_document" ||
        row.evidenceType === "verification_video" ||
        row.evidenceType === "education_certificate"
        ? row.evidenceType
        : "identity_document";
      await db.insert(guestPreapplicationEvidenceTable).values({
        applicationId: guest.id,
        evidenceType,
        evidenceSlot,
        fileName: row.fileName,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        objectPath,
        uploadedByUserId: actorUserId,
        uploadedAt: now,
        uploadExpiresAt: null,
      }).onConflictDoNothing();
    }
    const [updatedGuest] = await db
      .select()
      .from(guestPreapplicationsTable)
      .where(eq(guestPreapplicationsTable.id, guest.id))
      .limit(1);
    if (updatedGuest) {
      await captureGuestApplicantArchive(updatedGuest, {
        actorUserId,
        eventType: "super_admin_restore",
      });
    }
  } else if (application) {
    await db
      .update(enrollmentApplicationsTable)
      .set({
        categoryId: String(payload.categoryId ?? application.categoryId),
        currentStep: Number(payload.currentStep ?? application.currentStep),
        answers,
        updatedAt: now,
      })
      .where(eq(enrollmentApplicationsTable.id, application.id));
    const [updatedApplication] = await db
      .select()
      .from(enrollmentApplicationsTable)
      .where(eq(enrollmentApplicationsTable.id, application.id))
      .limit(1);
    if (updatedApplication) {
      await captureEnrollmentApplicantArchive(updatedApplication, {
        actorUserId,
        eventType: "super_admin_restore",
      });
    }
  }
  return { reference: archiveCase.reference, version: snapshot.version };
}

export async function deleteApplicantArchiveCase(
  archiveId: string,
  actorUserId: string,
): Promise<string | null> {
  const [archiveCase] = await db
    .select()
    .from(applicantMasterArchiveCasesTable)
    .where(eq(applicantMasterArchiveCasesTable.id, archiveId))
    .limit(1);
  if (!archiveCase) return null;
  const evidence = await db
    .select()
    .from(applicantMasterArchiveEvidenceTable)
    .where(eq(applicantMasterArchiveEvidenceTable.archiveId, archiveId));
  await recordApplicantArchiveAudit({
    archiveId,
    reference: archiveCase.reference,
    actorUserId,
    action: "delete_requested",
    details: { evidenceCount: evidence.length },
  });
  for (const item of evidence) {
    if (item.archiveObjectPath) {
      try {
        await objectStorage.deleteArchiveObjectEntity(item.archiveObjectPath);
      } catch (error) {
        if (!(error instanceof ObjectNotFoundError) && (error as Error)?.name !== "ObjectNotFoundError") {
          throw error;
        }
      }
    }
  }
  await db
    .delete(applicantMasterArchiveCasesTable)
    .where(eq(applicantMasterArchiveCasesTable.id, archiveId));
  await recordApplicantArchiveAudit({
    archiveId,
    reference: archiveCase.reference,
    actorUserId,
    action: "delete_completed",
    details: { evidenceCount: evidence.length },
  });
  return archiveCase.reference;
}

export async function getApplicantArchiveCase(archiveId: string) {
  const [archiveCase] = await db
    .select()
    .from(applicantMasterArchiveCasesTable)
    .where(eq(applicantMasterArchiveCasesTable.id, archiveId))
    .limit(1);
  return archiveCase ?? null;
}
