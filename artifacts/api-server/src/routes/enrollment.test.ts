import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { gunzipSync } from "node:zlib";

const mockState = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>[]>(),
  users: new Map<string, Record<string, unknown>>(),
  storageObjects: new Map<string, { contentType: string; bytes: Buffer; public?: boolean }>(),
  uploadCount: 0,
  tables: (() => {
    const makeTable = (name: string) => {
      const target = { __tableName: name };
      return new Proxy(target, {
        get(current, property) {
          if (property === "__tableName") return current.__tableName;
          if (typeof property === "symbol") return undefined;
          return { table: target, name: String(property) };
        },
      });
    };
    return {
      guestPreapplicationsTable: makeTable("guest_preapplications"),
      guestPreapplicationEvidenceTable: makeTable("guest_preapplication_evidence"),
      guestPreapplicationRevisionsTable: makeTable("guest_preapplication_revisions"),
      applicantMasterArchiveCasesTable: makeTable("applicant_master_archive_cases"),
      applicantMasterArchiveSnapshotsTable: makeTable("applicant_master_archive_snapshots"),
      applicantMasterArchiveEvidenceTable: makeTable("applicant_master_archive_evidence"),
      applicantMasterArchiveAuditTable: makeTable("applicant_master_archive_audit"),
      enrollmentApplicationsTable: makeTable("enrollment_applications"),
      applicationEventsTable: makeTable("application_events"),
      portalSettingsTable: makeTable("portal_settings"),
      supportTicketsTable: makeTable("enrollment_support_tickets"),
    };
  })(),
}));

function matches(row: Record<string, unknown>, expression: any): boolean {
  if (!expression) return true;
  if (expression.type === "and") {
    return expression.expressions.every((item: any) => matches(row, item));
  }
  if (expression.type === "or") {
    return expression.expressions.some((item: any) => matches(row, item));
  }
  const value = expression.left?.name
    ? row[expression.left.name]
    : undefined;
  switch (expression.type) {
    case "eq":
      return value === expression.right;
    case "ne":
      return value !== expression.right;
    case "isNull":
      return value == null;
    case "isNotNull":
      return value != null;
    case "inArray":
      return expression.right.includes(value);
    case "lt":
      return value instanceof Date && value < expression.right;
    default:
      return false;
  }
}

function selected(row: Record<string, unknown>, shape?: Record<string, any>) {
  if (!shape) return row;
  return Object.fromEntries(
    Object.entries(shape).map(([key, column]) => [key, row[column.name]]),
  );
}

function newRow(tableName: string, values: Record<string, unknown>) {
  const now = new Date();
  if (tableName === "guest_preapplications") {
    return {
      id: crypto.randomUUID(),
      currentStep: 0,
      answers: {},
      detailsComplete: false,
      status: "received",
      submissionStatus: "draft",
      emailVerified: false,
      clerkUserId: null,
      linkedApplicationId: null,
      pinHash: null,
      phone: null,
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now,
      ...values,
    };
  }
  if (tableName === "guest_preapplication_evidence") {
    return {
      id: crypto.randomUUID(),
      uploadedByUserId: null,
      uploadedAt: null,
      createdAt: now,
      ...values,
    };
  }
  if (tableName === "application_events") {
    return { id: crypto.randomUUID(), createdAt: now, ...values };
  }
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...values,
  };
}

function tableRows(name: string) {
  const rows = mockState.rows.get(name);
  if (!rows) throw new Error(`No in-memory table registered for ${name}`);
  return rows;
}

function makeDatabase() {
  return {
    select(shape?: Record<string, any>) {
      let tableName = "";
      let condition: any;
      let limit = Number.POSITIVE_INFINITY;
      const run = () => tableRows(tableName)
        .filter((row) => matches(row, condition))
        .slice(0, limit)
        .map((row) => selected(row, shape));
      const query: any = {
        from(source: any) {
          tableName = source.__tableName;
          return query;
        },
        where(value: any) {
          condition = value;
          return query;
        },
        for() {
          return query;
        },
        orderBy() {
          return query;
        },
        limit(value: number) {
          limit = value;
          return Promise.resolve(run());
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
    insert(source: any) {
      const tableName = source.__tableName;
      let values: Record<string, unknown> = {};
      let ignoreConflict = false;
      let conflictUpdate: { target: any; set: Record<string, unknown> } | undefined;
      const run = () => {
        const rows = tableRows(tableName);
        if (conflictUpdate) {
          const conflictName = conflictUpdate.target?.name;
          const existing = rows.find((row) => conflictName && row[conflictName] === values[conflictName]);
          if (existing) {
            Object.assign(existing, conflictUpdate.set);
            return [existing];
          }
        }
        const uniqueFields: Record<string, string[]> = {
          guest_preapplications: ["submissionId", "reference", "accessKeyHash"],
          enrollment_applications: ["reference", "sourceGuestPreapplicationId"],
          guest_preapplication_evidence: ["objectPath"],
        };
        const conflict = (uniqueFields[tableName] ?? []).some((field) =>
          values[field] != null && rows.some((row) => row[field] === values[field]),
        );
        if (conflict) {
          if (ignoreConflict) return [];
          throw new Error("unique constraint");
        }
        const row = newRow(tableName, values);
        rows.push(row);
        return [row];
      };
      const builder: any = {
        values(input: Record<string, unknown>) {
          values = input;
          return builder;
        },
        onConflictDoNothing() {
          ignoreConflict = true;
          return builder;
        },
        onConflictDoUpdate(input: { target: any; set: Record<string, unknown> }) {
          conflictUpdate = input;
          return builder;
        },
        returning() {
          return Promise.resolve(run());
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return builder;
    },
    update(source: any) {
      const tableName = source.__tableName;
      let values: Record<string, unknown> = {};
      let condition: any;
      const run = () => {
        const updated = tableRows(tableName).filter((row) => matches(row, condition));
        for (const row of updated) Object.assign(row, values);
        return updated;
      };
      const builder: any = {
        set(input: Record<string, unknown>) {
          values = input;
          return builder;
        },
        where(input: any) {
          condition = input;
          return builder;
        },
        returning() {
          return Promise.resolve(run());
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return builder;
    },
    delete(source: any) {
      const tableName = source.__tableName;
      let condition: any;
      const builder: any = {
        where(input: any) {
          condition = input;
          return builder;
        },
        returning(shape?: Record<string, any>) {
          const rows = tableRows(tableName);
          const removed = rows.filter((row) => matches(row, condition));
          mockState.rows.set(tableName, rows.filter((row) => !matches(row, condition)));
          return Promise.resolve(removed.map((row) => selected(row, shape)));
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          const rows = tableRows(tableName);
          const removed = rows.filter((row) => matches(row, condition));
          mockState.rows.set(tableName, rows.filter((row) => !matches(row, condition)));
          return Promise.resolve(removed).then(resolve, reject);
        },
      };
      return builder;
    },
    async transaction(callback: (transaction: any) => Promise<unknown>) {
      return callback(this);
    },
  };
}

vi.mock("drizzle-orm", () => ({
  and: (...expressions: any[]) => ({ type: "and", expressions }),
  count: () => ({ type: "count" }),
  desc: (column: unknown) => column,
  eq: (left: unknown, right: unknown) => ({ type: "eq", left, right }),
  inArray: (left: unknown, right: unknown[]) => ({ type: "inArray", left, right }),
  isNotNull: (left: unknown) => ({ type: "isNotNull", left }),
  isNull: (left: unknown) => ({ type: "isNull", left }),
  lt: (left: unknown, right: unknown) => ({ type: "lt", left, right }),
  ne: (left: unknown, right: unknown) => ({ type: "ne", left, right }),
  or: (...expressions: any[]) => ({ type: "or", expressions }),
}));

vi.mock("@workspace/db", () => ({
  db: makeDatabase(),
  ...mockState.tables,
}));

vi.mock("@clerk/express", () => ({
  clerkClient: {
    users: {
      getUser: vi.fn(async (userId: string) => mockState.users.get(userId)),
    },
  },
  getAuth: vi.fn((request: any) => ({ userId: request.headers["x-test-user"] ?? null })),
}));

vi.mock("../lib/objectStorage", () => {
  const TestObjectNotFoundError = class ObjectNotFoundError extends Error {};
  return {
  ObjectNotFoundError: TestObjectNotFoundError,
  ObjectStorageService: class {
    async getObjectEntityUploadURL() {
      mockState.uploadCount += 1;
      return `https://storage.test/upload/${crypto.randomUUID()}`;
    }

    normalizeObjectEntityPath(uploadUrl: string) {
      return `/objects/uploads/${uploadUrl.split("/").at(-1)}`;
    }

    async storePublicLogo(bytes: Buffer, contentType: string) {
      const path = `/objects/uploads/${crypto.randomUUID()}`;
      mockState.storageObjects.set(path, { contentType, bytes, public: true });
      return path;
    }

    async trySetObjectEntityAclPolicy(path: string) {
      const object = mockState.storageObjects.get(path);
      if (!object) throw new Error(`Missing mocked object ${path}`);
      object.public = true;
      return path;
    }

    async canAccessObjectEntity({ objectFile }: { objectFile: { objectPath: string } }) {
      return mockState.storageObjects.get(objectFile.objectPath)?.public === true;
    }

    async deleteObjectEntity(path: string) {
      mockState.storageObjects.delete(path);
    }

    async copyPrivateObjectEntity(sourcePath: string, folder: "archive" | "uploads") {
      const source = mockState.storageObjects.get(sourcePath);
      if (!source) throw new TestObjectNotFoundError(`Missing mocked object ${sourcePath}`);
      const destination = `/objects/${folder}/${crypto.randomUUID()}`;
      mockState.storageObjects.set(destination, { ...source, public: false });
      return destination;
    }

    async deleteArchiveObjectEntity(path: string) {
      if (!/^\/objects\/archive\/[0-9a-f-]+$/i.test(path)) {
        throw new Error("Invalid archive object path.");
      }
      mockState.storageObjects.delete(path);
    }

    async getObjectEntityFile(path: string) {
      const object = mockState.storageObjects.get(path);
      if (!object) throw new TestObjectNotFoundError(`Missing mocked object ${path}`);
      const stream: any = {
        on() {
          return stream;
        },
        pipe(destination: any) {
          destination.end(object.bytes);
          return destination;
        },
      };
      return {
        getMetadata: async () => [{
          size: String(object.bytes.length),
          contentType: object.contentType,
        }],
        objectPath: path,
        download: async (range?: { start: number; end: number }) => [
          range ? object.bytes.subarray(range.start, range.end + 1) : object.bytes,
        ],
        delete: async () => {
          mockState.storageObjects.delete(path);
        },
        createReadStream: () => Readable.from([object.bytes]),
      };
    }
  },
  };
});

import express from "express";
import router from "./enrollment";
import { captureGuestApplicantArchive } from "../lib/applicantArchive";
import { cleanupExpiredGuestEvidence } from "../lib/guestEvidenceCleanup";

const accessKey = "a".repeat(43);
const contactEmail = "applicant@example.test";
const privatePng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const privateMp4 = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
const testArchiveKeyring = JSON.stringify({
  activeKeyId: "test-archive-key",
  keys: { "test-archive-key": "test-only-archive-key-material-0123456789" },
});

function encryptLegacyFixture(value: unknown, context: string): string {
  const key = createHmac("sha256", "test-session-secret").update(context).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
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

function encryptLegacyBankFixture(value: string): string {
  const key = createHmac("sha256", "test-session-secret")
    .update("civic-enroll-bank-v1")
    .digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "enc:v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

describe("guest application verification and persistence", () => {
  const app = express();
  let server: ReturnType<typeof app.listen>;
  let baseUrl = "";

  beforeAll(async () => {
    process.env.PRIVATE_OBJECT_DIR = "test-private";
    process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID = "test-bucket";
    process.env.SESSION_SECRET = "test-session-secret";
    process.env.APPLICANT_ARCHIVE_KEYS = testArchiveKeyring;
    app.use(express.json());
    app.use((request: any, _response: any, next: () => void) => {
      request.log = { error: () => undefined, warn: () => undefined, info: () => undefined };
      next();
    });
    app.use("/api", router);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port.");
    baseUrl = `http://127.0.0.1:${address.port}/api`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  });

  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret";
    process.env.APPLICANT_ARCHIVE_KEYS = testArchiveKeyring;
    mockState.rows.clear();
    for (const name of [
      "guest_preapplications",
      "guest_preapplication_evidence",
      "guest_preapplication_revisions",
      "applicant_master_archive_cases",
      "applicant_master_archive_snapshots",
      "applicant_master_archive_evidence",
      "applicant_master_archive_audit",
      "enrollment_applications",
      "application_events",
      "portal_settings",
      "enrollment_support_tickets",
    ]) mockState.rows.set(name, []);
    mockState.users.clear();
    mockState.storageObjects.clear();
    mockState.uploadCount = 0;
    mockState.users.set("applicant-unverified", {
      id: "applicant-unverified",
      primaryEmailAddress: {
        emailAddress: contactEmail,
        verification: { status: "unverified" },
      },
      publicMetadata: {},
    });
    mockState.users.set("applicant-mismatch", {
      id: "applicant-mismatch",
      primaryEmailAddress: {
        emailAddress: "different@example.test",
        verification: { status: "verified" },
      },
      publicMetadata: {},
    });
    mockState.users.set("applicant-verified", {
      id: "applicant-verified",
      primaryEmailAddress: {
        emailAddress: contactEmail,
        verification: { status: "verified" },
      },
      publicMetadata: {},
    });
    mockState.users.set("reviewer", {
      id: "reviewer",
      primaryEmailAddress: {
        emailAddress: "reviewer@example.test",
        verification: { status: "verified" },
      },
      publicMetadata: { role: "sub_admin" },
    });
    mockState.users.set("primary-admin", {
      id: "primary-admin",
      primaryEmailAddress: {
        emailAddress: "admin@example.test",
        verification: { status: "verified" },
      },
      publicMetadata: { role: "admin" },
    });
    mockState.users.set("administrator", {
      id: "administrator",
      primaryEmailAddress: {
        emailAddress: "admin@example.test",
        verification: { status: "verified" },
      },
      publicMetadata: { role: "admin" },
    });
  });

  async function request(path: string, init: RequestInit = {}, userId?: string): Promise<{ response: Response; body: any }> {
    const headers = new Headers(init.headers);
    if (init.body) headers.set("Content-Type", "application/json");
    if (userId) headers.set("x-test-user", userId);
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const body = response.status === 204 ? null : await response.json();
    return { response, body };
  }

  async function uploadEvidence(
    applicationId: string,
    reference: string,
    evidenceSlot: "identity_front" | "verification_video",
    fileName: string,
    contentType: string,
    bytes: Buffer,
  ) {
    const prepared = await request(
      `/guest/preapplications/${applicationId}/evidence/upload-url`,
      {
        method: "POST",
        body: JSON.stringify({
          reference,
          accessKey,
          evidenceType: evidenceSlot === "verification_video" ? "verification_video" : "identity_document",
          evidenceSlot,
          fileName,
          contentType,
          sizeBytes: bytes.length,
        }),
      },
    );
    expect(prepared.response.status).toBe(200);
    const objectPath = `/objects/uploads/${prepared.body.uploadUrl.split("/").at(-1)}`;
    mockState.storageObjects.set(objectPath, { contentType, bytes });
    const evidenceId = prepared.body.evidenceId as string;
    const completed = await request(
      `/guest/preapplications/${applicationId}/evidence/${evidenceId}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ reference, accessKey }),
      },
    );
    expect(completed.response.status).toBe(200);
    expect(completed.body.objectPath).toBe(objectPath);
    return objectPath;
  }

  async function createGuestDraft(email = contactEmail) {
    return request("/guest/preapplications", {
      method: "POST",
      body: JSON.stringify({
        submissionId: crypto.randomUUID(),
        accessKey,
        categoryId: "category-1",
        fullName: "Test Applicant",
        email,
      }),
    });
  }

  it("updates the canonical and answer contact emails while leaving the application unverified", async () => {
    const created = await createGuestDraft();
    expect(created.response.status).toBe(201);
    const corrected = await request(`/guest/preapplications/${created.body.id}/email`, {
      method: "PATCH",
      body: JSON.stringify({
        reference: created.body.reference,
        accessKey,
        email: "Corrected.Applicant@Example.Test",
      }),
    });

    expect(corrected.response.status).toBe(200);
    expect(corrected.body).toMatchObject({
      email: "corrected.applicant@example.test",
      emailVerified: false,
      submissionStatus: "draft",
      answers: { personalInformation: { email: "corrected.applicant@example.test" } },
    });
    const reviewerDrafts = await request("/admin/guest-preapplications", {}, "reviewer");
    expect(reviewerDrafts.response.status).toBe(200);
    expect(reviewerDrafts.body[0]).toMatchObject({
      email: "corrected.applicant@example.test",
      emailVerified: false,
      submissionStatus: "draft",
    });
  });

  it("rejects contact email changes when the private tracking key is incorrect", async () => {
    const created = await createGuestDraft();
    const response = await request(`/guest/preapplications/${created.body.id}/email`, {
      method: "PATCH",
      body: JSON.stringify({
        reference: created.body.reference,
        accessKey: "b".repeat(43),
        email: "corrected@example.test",
      }),
    });

    expect(response.response.status).toBe(404);
    expect(mockState.rows.get("guest_preapplications")?.[0]).toMatchObject({
      email: contactEmail,
      submissionStatus: "draft",
      emailVerified: false,
    });
  });

  it("does not allow contact email changes after an application has been submitted", async () => {
    const created = await createGuestDraft();
    const savedDraft = mockState.rows.get("guest_preapplications")?.[0];
    if (!savedDraft) throw new Error("Expected the guest draft to be saved.");
    savedDraft.submissionStatus = "submitted";
    savedDraft.emailVerified = true;

    const response = await request(`/guest/preapplications/${created.body.id}/email`, {
      method: "PATCH",
      body: JSON.stringify({
        reference: created.body.reference,
        accessKey,
        email: "corrected@example.test",
      }),
    });

    expect(response.response.status).toBe(409);
    expect(savedDraft).toMatchObject({
      email: contactEmail,
      submissionStatus: "submitted",
      emailVerified: true,
    });
  });

  it("keeps guest drafts and private evidence available through verification failures and links one successful submission", async () => {
    const created = await request("/guest/preapplications", {
      method: "POST",
      body: JSON.stringify({
        submissionId: crypto.randomUUID(),
        accessKey,
        categoryId: "category-1",
        fullName: "  Test Applicant  ",
        email: contactEmail,
        phone: "+1 555 555 0100",
      }),
    });
    expect(created.response.status).toBe(201);
    const { id: applicationId, reference } = created.body as { id: string; reference: string };
    expect(created.body.fullName).toBe("Test Applicant");
    expect(created.body.categoryId).toBe("category-1");
    expect(created.body.emailVerified).toBe(false);

    const initialProgress = await request(`/guest/preapplications/${applicationId}`, {
      method: "PATCH",
      body: JSON.stringify({
        reference,
        accessKey,
        currentStep: 3,
        answers: { name: "Test Applicant", nickname: "TA" },
        complete: false,
        pin: "4826",
      }),
    });
    expect(initialProgress.response.status).toBe(200);
    expect(initialProgress.body.currentStep).toBe(3);
    expect(initialProgress.body.hasPin).toBe(true);
    expect(JSON.stringify(initialProgress.body)).not.toContain("4826");

    const identityPath = await uploadEvidence(
      applicationId,
      reference,
      "identity_front",
      "identity.png",
      "image/png",
      privatePng,
    );
    const videoPath = await uploadEvidence(
      applicationId,
      reference,
      "verification_video",
      "verification.mp4",
      "video/mp4",
      privateMp4,
    );
    const answers = {
      name: "Test Applicant",
      nickname: "TA",
      categoryEntryComplete: true,
      reviewDeclarationAccepted: true,
      personalInformation: {
        firstName: "Test",
        surname: "Applicant",
        dateOfBirth: "1990-01-01",
        nationality: "Canadian",
        phone: "+15555550100",
        email: contactEmail,
        residentialAddress: "10 Main Street",
        stateRegion: "Ontario",
        city: "Toronto",
      },
      nextOfKin: {
        fullName: "Next Contact",
        relationship: "Sibling",
        phone: "+15555550101",
        residentialAddress: "20 Main Street",
        city: "Toronto",
        stateRegion: "Ontario",
      },
      education: {
        highestQualification: "Diploma",
        institution: "Test College",
        courseField: "Business",
        startYear: "2010",
        completionYear: "2012",
        certificationStatus: "Completed",
      },
      workInformation: { employmentStatus: "student" },
      proofOfIdentity: {
        documentType: "Passport",
        frontObjectPath: identityPath,
      },
      liveVideoRecording: {
        consentAccepted: true,
        durationSeconds: 12,
        objectPath: videoPath,
      },
    };
    const completeProgress = await request(`/guest/preapplications/${applicationId}`, {
      method: "PATCH",
      body: JSON.stringify({
        reference,
        accessKey,
        currentStep: 7,
        answers,
        complete: true,
      }),
    });
    expect(completeProgress.response.status, JSON.stringify(completeProgress.body)).toBe(200);
    expect(completeProgress.body.detailsComplete).toBe(true);
    expect(completeProgress.body.hasPin).toBe(true);

    const anonymousReviewerCheck = await request("/admin/guest-preapplications");
    expect(anonymousReviewerCheck.response.status).toBe(401);
    const applicantReviewerCheck = await request("/admin/guest-preapplications", {}, "applicant-unverified");
    expect(applicantReviewerCheck.response.status).toBe(403);
    const adminReviewerCheck = await request("/admin/guest-preapplications", {}, "administrator");
    expect(adminReviewerCheck.response.status).toBe(403);
    const visibleDraft = await request("/admin/guest-preapplications", {}, "reviewer");
    expect(visibleDraft.response.status).toBe(200);
    expect(visibleDraft.body).toHaveLength(1);
    expect(visibleDraft.body[0]).toMatchObject({
      id: applicationId,
      categoryId: "category-1",
      emailVerified: false,
      submissionStatus: "draft",
      currentStep: 7,
      detailsComplete: true,
      hasPin: true,
      reviewReady: true,
    });
    expect(visibleDraft.body[0].evidence).toHaveLength(2);
    expect(visibleDraft.body[0].evidence.every((item: any) => item.downloadUrl)).toBe(true);

    const privateFilePath = `/admin/guest-preapplications/${applicationId}/evidence/${visibleDraft.body[0].evidence[0].id}/file`;
    expect((await request(privateFilePath)).response.status).toBe(401);
    expect((await request(privateFilePath, {}, "applicant-unverified")).response.status).toBe(403);
    expect((await request(privateFilePath, {}, "administrator")).response.status).toBe(403);
    const reviewerDownload = await fetch(`${baseUrl}${privateFilePath}`, {
      headers: { "x-test-user": "reviewer" },
    });
    expect(reviewerDownload.status).toBe(200);
    expect(reviewerDownload.headers.get("cache-control")).toContain("no-store");
    expect(Buffer.from(await reviewerDownload.arrayBuffer()).length).toBeGreaterThan(0);

    const correctedEmail = await request(`/guest/preapplications/${applicationId}/email`, {
      method: "PATCH",
      body: JSON.stringify({ reference, accessKey, email: "corrected@example.test" }),
    });
    expect(correctedEmail.response.status).toBe(200);
    expect(correctedEmail.body.email).toBe("corrected@example.test");
    mockState.users.set("applicant-corrected-verified", {
      id: "applicant-corrected-verified",
      primaryEmailAddress: {
        emailAddress: "corrected@example.test",
        verification: { status: "verified" },
      },
      publicMetadata: {},
    });

    const unverifiedSubmit = await request(
      `/guest/preapplications/${applicationId}/submit`,
      { method: "POST", body: JSON.stringify({ reference, accessKey }) },
      "applicant-unverified",
    );
    expect(unverifiedSubmit.response.status).toBe(403);

    const mismatchedSubmit = await request(
      `/guest/preapplications/${applicationId}/submit`,
      { method: "POST", body: JSON.stringify({ reference, accessKey }) },
      "applicant-mismatch",
    );
    expect(mismatchedSubmit.response.status).toBe(403);
    const originalEmailSubmit = await request(
      `/guest/preapplications/${applicationId}/submit`,
      { method: "POST", body: JSON.stringify({ reference, accessKey }) },
      "applicant-verified",
    );
    expect(originalEmailSubmit.response.status).toBe(403);
    expect(mockState.rows.get("enrollment_applications")).toHaveLength(0);

    const afterFailures = await request("/admin/guest-preapplications", {}, "reviewer");
    expect(afterFailures.response.status).toBe(200);
    expect(afterFailures.body).toHaveLength(1);
    expect(afterFailures.body[0].id).toBe(applicationId);
    expect(afterFailures.body[0].email).toBe("corrected@example.test");
    expect(afterFailures.body[0].emailVerified).toBe(false);

    const successfulSubmit = await request(
      `/guest/preapplications/${applicationId}/submit`,
      { method: "POST", body: JSON.stringify({ reference, accessKey }) },
      "applicant-corrected-verified",
    );
    expect(successfulSubmit.response.status).toBe(200);
    expect(successfulSubmit.body.status).toBe("submitted");
    const retry = await request(
      `/guest/preapplications/${applicationId}/submit`,
      { method: "POST", body: JSON.stringify({ reference, accessKey }) },
      "applicant-corrected-verified",
    );
    expect(retry.response.status).toBe(200);
    expect(retry.body.id).toBe(successfulSubmit.body.id);
    expect(mockState.rows.get("enrollment_applications")).toHaveLength(1);

    const storedDraft = mockState.rows.get("guest_preapplications")?.[0];
    expect(storedDraft).toMatchObject({
      submissionStatus: "submitted",
      emailVerified: true,
      clerkUserId: "applicant-corrected-verified",
      linkedApplicationId: successfulSubmit.body.id,
    });
    expect(String(storedDraft?.pinHash)).toMatch(/^scrypt\$/);
    const finalReviewerList = await request("/admin/guest-preapplications", {}, "reviewer");
    expect(finalReviewerList.response.status).toBe(200);
    expect(finalReviewerList.body).toHaveLength(0);
  });

  it("allows partial guest submission after verified email while keeping the category PIN mandatory", async () => {
    const created = await request("/guest/preapplications", {
      method: "POST",
      body: JSON.stringify({
        submissionId: crypto.randomUUID(),
        accessKey,
        categoryId: "category-2",
        fullName: "Partial Applicant",
        email: contactEmail,
      }),
    });
    expect(created.response.status).toBe(201);
    const { id: applicationId, reference } = created.body as { id: string; reference: string };
    const submitBody = JSON.stringify({ reference, accessKey });

    const missingPin = await request(
      `/guest/preapplications/${applicationId}/submit`,
      { method: "POST", body: submitBody },
      "applicant-verified",
    );
    expect(missingPin.response.status).toBe(400);
    expect(missingPin.body.error).toContain("category PIN");

    const initialProgress = await request(`/guest/preapplications/${applicationId}`, {
      method: "PATCH",
      body: JSON.stringify({
        reference,
        accessKey,
        currentStep: 1,
        complete: false,
        answers: {
          personalInformation: { firstName: "Initial", email: contactEmail },
        },
        pin: "739102",
      }),
    });
    expect(initialProgress.response.status).toBe(200);
    expect(initialProgress.body.detailsComplete).toBe(false);
    expect(initialProgress.body.hasPin).toBe(true);

    const savedPartial = await request(`/guest/preapplications/${applicationId}`, {
      method: "PATCH",
      body: JSON.stringify({
        reference,
        accessKey,
        currentStep: 1,
        complete: false,
        answers: {
          personalInformation: { firstName: "Partial", email: contactEmail },
        },
      }),
    });
    expect(savedPartial.response.status).toBe(200);
    expect(savedPartial.body.detailsComplete).toBe(false);
    expect(savedPartial.body.hasPin).toBe(true);
    expect(JSON.stringify(savedPartial.body)).not.toContain("739102");

    const submitted = await request(
      `/guest/preapplications/${applicationId}/submit`,
      { method: "POST", body: submitBody },
      "applicant-verified",
    );
    expect(submitted.response.status).toBe(200);
    expect(submitted.body.status).toBe("submitted");
    expect(submitted.body.outstandingRequirements.length).toBeGreaterThan(0);

    const savedRevisionRows = mockState.rows.get("guest_preapplication_revisions") ?? [];
    expect(savedRevisionRows.length).toBeGreaterThan(0);
    expect(JSON.stringify(savedRevisionRows)).not.toContain("739102");
    const reviewerHistory = await request(
      `/admin/applications/${submitted.body.id}/guest-history`,
      {},
      "reviewer",
    );
    expect(reviewerHistory.response.status).toBe(200);
    expect(JSON.stringify(reviewerHistory.body)).not.toContain("739102");
    expect(JSON.stringify(reviewerHistory.body)).toContain('"field":"Saved progress step"');
    expect(reviewerHistory.body.some((revision: any) =>
      revision.changes.some((change: any) => change.after === "Partial"),
    )).toBe(true);

    const unprivilegedHistory = await request(
      `/admin/applications/${submitted.body.id}/guest-history`,
      {},
      "applicant-unverified",
    );
    expect(unprivilegedHistory.response.status).toBe(403);

    const tracked = await request("/guest/preapplications/lookup", {
      method: "POST",
      body: JSON.stringify({ reference, accessKey }),
    });
    expect(tracked.response.status).toBe(200);
    expect(tracked.body).toMatchObject({
      submissionStatus: "submitted",
      emailVerified: true,
      reviewStatus: "submitted",
    });
    expect(tracked.body.outstandingRequirements.length).toBeGreaterThan(0);
  });

  it("preserves legacy settings and blocks only final submission on configured required fields", async () => {
    const settings = {
      hero: {
        title: "Enrollment",
        description: "Apply online.",
        getStartedLabel: "Get started",
        loginLabel: "Sign in",
      },
      cards: ["category-1", "category-2", "category-3", "category-4"].map((id, index) => ({
        id,
        title: id,
        description: "Enrollment category",
        buttonLabel: "Continue",
        backgroundColor: "#ffffff",
        logoDataUrl: null,
        cardLogoSize: 48 + index * 16,
        cardLogoFit: index % 2 === 0 ? "cover" : "contain",
        entryLogoSize: 96 + index * 16,
        entryLogoFit: index % 2 === 0 ? "contain" : "cover",
        pinLogoSize: 144 + index * 16,
        pinLogoFit: index % 2 === 0 ? "cover" : "contain",
      })),
      theme: {
        pinScreenBackground: "#ffffff",
        buttonSize: "standard",
        buttonPlacement: "center",
        categoryInputTransparent: true,
      },
      screenCopy: {
        "guest-contact": {
          title: "Start an application",
          description: "Enter the details used for this application.",
          fullNameLabel: "Applicant's legal name",
        },
        "guest-status": { title: "Check your progress" },
      },
      requiredFields: ["personalInformation.firstName"],
    };
    const unauthorizedSettingsUpdate = await request(
      "/admin/settings",
      { method: "PUT", body: JSON.stringify(settings) },
      "reviewer",
    );
    expect(unauthorizedSettingsUpdate.response.status).toBe(403);

    const legacySettings = { ...settings };
    delete (legacySettings as Partial<typeof settings>).requiredFields;
    mockState.rows.set("portal_settings", [{
      key: "portal",
      value: legacySettings,
      updatedAt: new Date(),
      updatedByUserId: "administrator",
    }]);
    const legacyRead = await request("/portal/settings");
    expect(legacyRead.response.status).toBe(200);
    expect(legacyRead.body.requiredFields).toEqual([]);

    const savedSettings = await request(
      "/admin/settings",
      { method: "PUT", body: JSON.stringify(settings) },
      "administrator",
    );
    expect(savedSettings.response.status).toBe(200);
    expect(savedSettings.body.requiredFields).toEqual(["personalInformation.firstName"]);
    expect(savedSettings.body.screenCopy["guest-contact"]).toEqual({
      title: "Start an application",
      description: "Enter the details used for this application.",
      fullNameLabel: "Applicant's legal name",
    });
    expect(savedSettings.body.screenCopy["guest-status"].title).toBe("Check your progress");
    const publicSettings = await request("/portal/settings");
    expect(publicSettings.response.status).toBe(200);
    expect(publicSettings.body.screenCopy["guest-contact"]).toEqual({
      title: "Start an application",
      description: "Enter the details used for this application.",
      fullNameLabel: "Applicant's legal name",
    });
    const blankCopySettings = {
      ...settings,
      screenCopy: {
        ...settings.screenCopy,
        "guest-contact": {
          title: " ",
          description: "",
          fullNameLabel: " ",
        },
      },
    };
    const savedBlankCopy = await request(
      "/admin/settings",
      { method: "PUT", body: JSON.stringify(blankCopySettings) },
      "administrator",
    );
    expect(savedBlankCopy.response.status).toBe(200);
    expect(savedBlankCopy.body.screenCopy["guest-contact"]).toEqual({
      title: " ",
      description: "",
      fullNameLabel: " ",
    });
    const publicBlankCopy = await request("/portal/settings");
    expect(publicBlankCopy.body.screenCopy["guest-contact"]).toEqual({
      title: " ",
      description: "",
      fullNameLabel: " ",
    });
    expect(savedSettings.body.cards.map((card: Record<string, unknown>) => [
      card.cardLogoSize,
      card.cardLogoFit,
      card.entryLogoSize,
      card.entryLogoFit,
      card.pinLogoSize,
      card.pinLogoFit,
    ])).toEqual([
      [48, "cover", 96, "contain", 144, "cover"],
      [64, "contain", 112, "cover", 160, "contain"],
      [80, "cover", 128, "contain", 176, "cover"],
      [96, "contain", 144, "cover", 192, "contain"],
    ]);

    const created = await request("/guest/preapplications", {
      method: "POST",
      body: JSON.stringify({
        submissionId: crypto.randomUUID(),
        accessKey,
        categoryId: "category-2",
        fullName: "Required Field Applicant",
        email: contactEmail,
      }),
    });
    expect(created.response.status).toBe(201);
    const { id: applicationId, reference } = created.body as { id: string; reference: string };
    const partial = await request(`/guest/preapplications/${applicationId}`, {
      method: "PATCH",
      body: JSON.stringify({
        reference,
        accessKey,
        currentStep: 0,
        complete: false,
        pin: "739102",
        answers: { personalInformation: { email: contactEmail } },
      }),
    });
    expect(partial.response.status).toBe(200);
    expect(partial.body.missingRequiredFields).toEqual(["First name"]);
    expect(partial.body.detailsComplete).toBe(false);
    const publicProgress = await request("/guest/preapplications/lookup", {
      method: "POST",
      body: JSON.stringify({ reference, accessKey }),
    });
    expect(publicProgress.response.status).toBe(200);
    expect(publicProgress.body.missingRequiredFields).toEqual(["First name"]);
    expect(publicProgress.body.applicantFollowup).toBeNull();

    const blocked = await request(
      `/guest/preapplications/${applicationId}/submit`,
      { method: "POST", body: JSON.stringify({ reference, accessKey }) },
      "applicant-verified",
    );
    expect(blocked.response.status).toBe(400);
    expect(blocked.body.error).toContain("First name");

    const completedRequirement = await request(`/guest/preapplications/${applicationId}`, {
      method: "PATCH",
      body: JSON.stringify({
        reference,
        accessKey,
        currentStep: 0,
        complete: false,
        answers: { personalInformation: { firstName: "Ada", email: contactEmail } },
      }),
    });
    expect(completedRequirement.response.status).toBe(200);
    expect(completedRequirement.body.missingRequiredFields).toEqual([]);
    const submitted = await request(
      `/guest/preapplications/${applicationId}/submit`,
      { method: "POST", body: JSON.stringify({ reference, accessKey }) },
      "applicant-verified",
    );
    expect(submitted.response.status).toBe(200);
    expect(submitted.body.status).toBe("submitted");
    const linkedApplication = mockState.rows.get("enrollment_applications")?.find(
      (row) => row.id === submitted.body.id,
    );
    if (linkedApplication) linkedApplication.reviewNote = "Internal reviewer-only note";
    const publicSubmittedStatus = await request("/guest/preapplications/lookup", {
      method: "POST",
      body: JSON.stringify({ reference, accessKey }),
    });
    expect(publicSubmittedStatus.body.applicantFollowup).toBeNull();
    expect(JSON.stringify(publicSubmittedStatus.body)).not.toContain("Internal reviewer-only note");
  });

  it("migrates legacy logos and deletes replaced or cleared public logo objects", async () => {
    const imageDataUrl = `data:image/png;base64,${privatePng.toString("base64")}`;
    const settings = {
      hero: {
        title: "Enrollment",
        description: "Apply online.",
        getStartedLabel: "Get started",
        loginLabel: "Sign in",
      },
      cards: ["category-1", "category-2", "category-3", "category-4"].map((id, index) => ({
        id,
        title: id,
        description: "Enrollment category",
        buttonLabel: "Continue",
        backgroundColor: "#ffffff",
        logoDataUrl: index === 0 ? imageDataUrl : null,
      })),
      theme: {
        pinScreenBackground: "#ffffff",
        buttonSize: "standard",
        buttonPlacement: "center",
        categoryInputTransparent: true,
      },
      screenCopy: {},
      requiredFields: [],
    };
    mockState.rows.set("portal_settings", [{
      key: "portal",
      value: settings,
      updatedAt: new Date(),
      updatedByUserId: "administrator",
    }]);

    const deniedUpload = await request("/admin/settings/logos/upload-url", {
      method: "POST",
    }, "reviewer");
    expect(deniedUpload.response.status).toBe(403);

    const migrated = await request("/admin/settings/migrate-logos", {
      method: "POST",
    }, "administrator");
    expect(migrated.response.status).toBe(200);
    const savedLogoUrl = migrated.body.cards[0].logoDataUrl as string;
    expect(savedLogoUrl).toMatch(/^\/api\/enrollment\/logos\//);
    expect(savedLogoUrl).not.toContain("base64");
    const savedObjectPath = `/objects/uploads/${savedLogoUrl.split("/").at(-1)}`;
    expect(mockState.storageObjects.has(savedObjectPath)).toBe(true);

    const publicLogoResponse = await fetch(
      `${baseUrl}${savedLogoUrl.replace("/api", "")}`,
    );
    expect(publicLogoResponse.status).toBe(200);
    expect(Buffer.from(await publicLogoResponse.arrayBuffer())).toEqual(privatePng);

    const uploadRequest = await request("/admin/settings/logos/upload-url", {
      method: "POST",
    }, "administrator");
    expect(uploadRequest.response.status).toBe(200);
    const uploadedObjectPath = uploadRequest.body.objectPath as string;
    mockState.storageObjects.set(uploadedObjectPath, {
      contentType: "image/png",
      bytes: privatePng,
    });
    const completedUpload = await request("/admin/settings/logos/complete", {
      method: "POST",
      body: JSON.stringify({
        objectPath: uploadedObjectPath,
        contentType: "image/png",
      }),
    }, "administrator");
    expect(completedUpload.response.status).toBe(200);
    const replacementUrl = completedUpload.body.logoUrl as string;

    const replacementSettings = structuredClone(migrated.body);
    replacementSettings.cards[0].logoDataUrl = replacementUrl;
    const replaced = await request("/admin/settings", {
      method: "PUT",
      body: JSON.stringify(replacementSettings),
    }, "administrator");
    expect(replaced.response.status).toBe(200);
    expect(mockState.storageObjects.has(savedObjectPath)).toBe(false);
    expect(mockState.storageObjects.has(uploadedObjectPath)).toBe(true);

    const clearedSettings = structuredClone(replaced.body);
    clearedSettings.cards[0].logoDataUrl = null;
    const cleared = await request("/admin/settings", {
      method: "PUT",
      body: JSON.stringify(clearedSettings),
    }, "administrator");
    expect(cleared.response.status).toBe(200);
    expect(mockState.storageObjects.has(uploadedObjectPath)).toBe(false);
  });

  it("cleans expired guest evidence but preserves evidence linked to submitted applications", async () => {
    const now = new Date("2026-10-12T12:00:00.000Z");
    const old = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
    const expiredAt = new Date(now.getTime() - 60 * 60 * 1000);
    const uploadDraft = newRow("guest_preapplications", {
      id: "upload-draft",
      submissionStatus: "draft",
      linkedApplicationId: null,
      updatedAt: now,
    });
    const inactiveDraft = newRow("guest_preapplications", {
      id: "inactive-draft",
      submissionStatus: "draft",
      linkedApplicationId: null,
      updatedAt: old,
      answers: { proofOfIdentity: { frontObjectPath: "/objects/test/old-complete" } },
    }) as Record<string, unknown>;
    const activeDraft = newRow("guest_preapplications", {
      id: "active-draft",
      submissionStatus: "draft",
      linkedApplicationId: null,
      updatedAt: now,
      answers: { proofOfIdentity: { frontObjectPath: "/objects/test/current-file" } },
    });
    const submittedApplication = newRow("guest_preapplications", {
      id: "submitted-draft",
      submissionStatus: "submitted",
      linkedApplicationId: "enrollment-application",
      updatedAt: old,
      answers: { proofOfIdentity: { frontObjectPath: "/objects/test/submitted-file" } },
    });
    mockState.rows.set("guest_preapplications", [
      uploadDraft,
      inactiveDraft,
      activeDraft,
      submittedApplication,
    ]);

    const pendingUpload = newRow("guest_preapplication_evidence", {
      id: "expired-upload",
      applicationId: uploadDraft.id,
      objectPath: "/objects/test/expired-upload",
      createdAt: old,
      uploadExpiresAt: expiredAt,
      uploadedAt: null,
    });
    const completeEvidence = newRow("guest_preapplication_evidence", {
      id: "expired-complete",
      applicationId: inactiveDraft.id,
      evidenceSlot: "identity_front",
      objectPath: "/objects/test/old-complete",
      createdAt: old,
      uploadExpiresAt: null,
      uploadedAt: old,
    });
    const submittedEvidence = newRow("guest_preapplication_evidence", {
      id: "active-submitted-evidence",
      applicationId: submittedApplication.id,
      evidenceSlot: "identity_front",
      objectPath: "/objects/test/submitted-file",
      createdAt: old,
      uploadExpiresAt: null,
      uploadedAt: old,
    });
    const replacedEvidence = newRow("guest_preapplication_evidence", {
      id: "replaced-guest-evidence",
      applicationId: activeDraft.id,
      evidenceSlot: "identity_front",
      objectPath: "/objects/test/replaced-file",
      createdAt: old,
      uploadExpiresAt: null,
      uploadedAt: old,
    });
    const currentEvidence = newRow("guest_preapplication_evidence", {
      id: "active-guest-evidence",
      applicationId: activeDraft.id,
      evidenceSlot: "identity_front",
      objectPath: "/objects/test/current-file",
      createdAt: now,
      uploadExpiresAt: null,
      uploadedAt: now,
    });
    mockState.rows.set("guest_preapplication_evidence", [
      pendingUpload,
      completeEvidence,
      replacedEvidence,
      currentEvidence,
      submittedEvidence,
    ]);
    for (const path of [
      "/objects/test/expired-upload",
      "/objects/test/old-complete",
      "/objects/test/replaced-file",
      "/objects/test/current-file",
      "/objects/test/submitted-file",
    ]) {
      mockState.storageObjects.set(path, {
        contentType: "image/png",
        bytes: privatePng,
      });
    }

    await cleanupExpiredGuestEvidence(now);

    expect(mockState.rows.get("guest_preapplication_evidence")).toEqual([
      currentEvidence,
      submittedEvidence,
    ]);
    expect(mockState.storageObjects.has("/objects/test/expired-upload")).toBe(false);
    expect(mockState.storageObjects.has("/objects/test/old-complete")).toBe(false);
    expect(mockState.storageObjects.has("/objects/test/replaced-file")).toBe(false);
    expect(mockState.storageObjects.has("/objects/test/current-file")).toBe(true);
    expect(mockState.storageObjects.has("/objects/test/submitted-file")).toBe(true);
    expect(inactiveDraft.answers).toEqual({ proofOfIdentity: {} });
  });

  it("restricts archive access to the primary admin, retains evidence privately, and excludes PIN values", async () => {
    const guest = newRow("guest_preapplications", {
      id: "guest-archive-case",
      submissionId: "guest-archive-submission",
      reference: "ENR-ARCHIVE-001",
      fullName: "Archive Applicant",
      email: "archive@example.test",
      phone: null,
      categoryId: "category-1",
      currentStep: 3,
      answers: {
        proofOfIdentity: { frontObjectPath: "/objects/test-private/evidence" },
        pin: "432109",
        pinHash: "scrypt$guest-pin-hash",
      },
      pinHash: "scrypt$top-level-pin-hash",
      submissionStatus: "draft",
      emailVerified: false,
    }) as Record<string, unknown>;
    tableRows("guest_preapplications").push(guest);
    mockState.storageObjects.set("/objects/test-private/evidence", {
      contentType: "image/png",
      bytes: privatePng,
    });

    const unauthenticated = await fetch(`${baseUrl}/admin/archive`);
    expect(unauthenticated.status).toBe(401);
    const reviewerResponse = await fetch(`${baseUrl}/admin/archive`, {
      headers: { "x-test-user": "reviewer" },
    });
    expect(reviewerResponse.status).toBe(403);

    const listResponse = await fetch(`${baseUrl}/admin/archive`, {
      headers: { "x-test-user": "primary-admin" },
    });
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json() as Array<{ id: string; reference: string }>;
    expect(list).toHaveLength(1);
    const recordId = list[0]!.id;

    const archiveEvidence = tableRows("applicant_master_archive_evidence");
    expect(archiveEvidence).toHaveLength(1);
    const archiveObjectPath = archiveEvidence[0]!.archiveObjectPath as string;
    expect(archiveObjectPath).toMatch(/^\/objects\/archive\//);
    expect(mockState.storageObjects.get(archiveObjectPath)?.public).toBe(false);

    const detailResponse = await fetch(`${baseUrl}/admin/archive/${recordId}`, {
      headers: { "x-test-user": "primary-admin" },
    });
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json() as {
      snapshots: Array<{ id: string; payload: Record<string, unknown> }>;
      evidence: Array<{ availability: string }>;
    };
    const detailText = JSON.stringify(detail);
    expect(detailText).not.toContain("432109");
    expect(detailText).not.toContain("scrypt$");
    expect(detail.evidence[0]?.availability).toBe("available");
    const snapshotId = detail.snapshots[0]!.id;
    expect(String(tableRows("applicant_master_archive_snapshots")[0]!.payloadEncrypted))
      .not.toContain("Archive Applicant");

    const bundleResponse = await fetch(`${baseUrl}/admin/archive/${recordId}/bundle`, {
      headers: { "x-test-user": "primary-admin" },
    });
    expect(bundleResponse.status).toBe(200);
    const tar = gunzipSync(Buffer.from(await bundleResponse.arrayBuffer()));
    const manifestLength = Number.parseInt(
      tar.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim(),
      8,
    );
    const manifest = tar.subarray(512, 512 + manifestLength).toString("utf8");
    expect(manifest).toContain("Archive Applicant");
    expect(manifest).not.toContain("432109");
    expect(manifest).not.toContain("scrypt$");
    expect(tar.includes(privatePng)).toBe(true);

    guest.fullName = "Changed Applicant";
    guest.status = "closed";
    const restoreResponse = await fetch(`${baseUrl}/admin/archive/${recordId}/restore`, {
      method: "POST",
      headers: { "x-test-user": "primary-admin", "content-type": "application/json" },
      body: JSON.stringify({ snapshotId, confirm: true }),
    });
    expect(restoreResponse.status).toBe(200);
    expect(guest.fullName).toBe("Archive Applicant");
    expect(guest.status).toBe("closed");
    expect(guest.pinHash).toBe("scrypt$top-level-pin-hash");

    const deleteResponse = await fetch(`${baseUrl}/admin/archive/${recordId}/delete`, {
      method: "POST",
      headers: { "x-test-user": "primary-admin", "content-type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    expect(deleteResponse.status).toBe(200);
    expect(mockState.rows.get("applicant_master_archive_audit")?.map((row) => row.action))
      .toContain("delete_completed");
    expect([...mockState.storageObjects.keys()].some((path) => path.startsWith("/objects/archive/")))
      .toBe(false);
  }, 15000);

  it("rewraps legacy archive data before session-secret rotation and stays readable after retiring its old archive key", async () => {
    const sessionSecretBefore = process.env.SESSION_SECRET;
    const archiveKeysBefore = process.env.APPLICANT_ARCHIVE_KEYS;
    const sessionSecret = "test-session-secret";
    const oldArchiveKey = "rotation-test-key-a-material-0123456789";
    const newArchiveKey = "rotation-test-key-b-material-0123456789";
    const archiveId = crypto.randomUUID();
    const guestId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    const accountNumberEncrypted = encryptLegacyBankFixture("001234567890");

    try {
      process.env.SESSION_SECRET = sessionSecret;
      process.env.APPLICANT_ARCHIVE_KEYS = JSON.stringify({
        activeKeyId: "archive-key-a",
        keys: { "archive-key-a": oldArchiveKey },
      });

      const guest = newRow("guest_preapplications", {
        id: guestId,
        submissionId: crypto.randomUUID(),
        reference: "ENR-ROTATION-001",
        fullName: "Rotation Applicant",
        email: "rotation@example.test",
        categoryId: "category-1",
        answers: { bankDetails: { accountNumberEncrypted } },
      }) as Record<string, unknown>;
      tableRows("guest_preapplications").push(guest);
      const proofPath = "/objects/test-private/legacy-proof";
      const archivedProofPath = `/objects/archive/${crypto.randomUUID()}`;
      const evidenceId = crypto.randomUUID();
      mockState.storageObjects.set(archivedProofPath, {
        contentType: "application/pdf",
        bytes: privatePng,
        public: false,
      });
      tableRows("applicant_master_archive_evidence").push(newRow(
        "applicant_master_archive_evidence",
        {
          id: evidenceId,
          archiveId,
          sourceFingerprint: "legacy-proof-fingerprint",
          sourcePathEncrypted: encryptLegacyFixture(
            proofPath,
            "civic-enroll-applicant-archive-v1",
          ),
          archiveObjectPath: archivedProofPath,
          fieldPath: "proofOfIdentity.front",
          fileName: encryptLegacyFixture(
            "identity-card.pdf",
            "civic-enroll-applicant-archive-v1",
          ),
          evidenceType: "identity_document",
          contentType: "application/pdf",
          sizeBytes: privatePng.length,
          availability: "available",
        },
      ));
      tableRows("applicant_master_archive_cases").push(newRow(
        "applicant_master_archive_cases",
        {
          id: archiveId,
          sourceType: "guest",
          sourceId: guestId,
          reference: "ENR-ROTATION-001",
          historyUnavailable: false,
        },
      ));
      const oldPayload = {
        recordType: "guest",
        reference: "ENR-ROTATION-001",
        categoryId: "category-1",
        currentStep: 4,
        answers: {
          bankDetails: {
            bankName: "Test Bank",
            accountNumberEncrypted,
          },
        },
        status: "received",
        fullName: "Rotation Applicant",
        email: "rotation@example.test",
        correctionHistory: [],
      };
      tableRows("applicant_master_archive_snapshots").push(newRow(
        "applicant_master_archive_snapshots",
        {
          id: snapshotId,
          archiveId,
          version: 1,
          eventType: "initial_archive_snapshot",
          actorUserId: null,
          payloadEncrypted: encryptLegacyFixture(
            oldPayload,
            "civic-enroll-applicant-archive-v1",
          ),
          changesEncrypted: encryptLegacyFixture(
            [],
            "civic-enroll-applicant-archive-v1",
          ),
        },
      ));

      const firstRead = await fetch(`${baseUrl}/admin/archive`, {
        headers: { "x-test-user": "primary-admin" },
      });
      expect(firstRead.status).toBe(200);
      let snapshot = tableRows("applicant_master_archive_snapshots")[0]!;
      expect(String(snapshot.payloadEncrypted)).toMatch(/^enc:v2:archive-key-a:/);

      process.env.APPLICANT_ARCHIVE_KEYS = JSON.stringify({
        activeKeyId: "archive-key-b",
        keys: {
          "archive-key-a": oldArchiveKey,
          "archive-key-b": newArchiveKey,
        },
      });
      process.env.SESSION_SECRET = "rotated-session-secret";

      const rotatedRead = await fetch(`${baseUrl}/admin/archive/${archiveId}`, {
        headers: { "x-test-user": "primary-admin" },
      });
      expect(rotatedRead.status).toBe(200);
      const detail = await rotatedRead.json() as {
        snapshots: Array<{ payload: { answers: { bankDetails: { accountNumber: string } } } }>;
        evidence: Array<{ fileName: string }>;
      };
      expect(detail.snapshots[0]?.payload.answers.bankDetails.accountNumber).toBe("001234567890");
      expect(detail.evidence[0]?.fileName).toBe("identity-card.pdf");
      snapshot = tableRows("applicant_master_archive_snapshots")[0]!;
      expect(String(snapshot.payloadEncrypted)).toMatch(/^enc:v2:archive-key-b:/);
      const evidence = tableRows("applicant_master_archive_evidence")[0]!;
      expect(String(evidence.sourcePathEncrypted)).toMatch(/^enc:v2:archive-key-b:/);
      expect(String(evidence.fileName)).toMatch(/^enc:v2:archive-key-b:/);

      process.env.APPLICANT_ARCHIVE_KEYS = JSON.stringify({
        activeKeyId: "archive-key-b",
        keys: { "archive-key-b": newArchiveKey },
      });
      guest.currentStep = 5;
      const progressCapture = await captureGuestApplicantArchive(
        guest as any,
        { eventType: "guest_progress_saved" },
      );
      expect(progressCapture.created).toBe(true);
      const afterRetirementRead = await fetch(`${baseUrl}/admin/archive/${archiveId}`, {
        headers: { "x-test-user": "primary-admin" },
      });
      expect(afterRetirementRead.status).toBe(200);
      const retained = await afterRetirementRead.json() as typeof detail;
      expect(retained.snapshots[0]?.payload.answers.bankDetails.accountNumber).toBe("001234567890");
      expect(retained.evidence[0]?.fileName).toBe("identity-card.pdf");
    } finally {
      if (sessionSecretBefore === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = sessionSecretBefore;
      if (archiveKeysBefore === undefined) delete process.env.APPLICANT_ARCHIVE_KEYS;
      else process.env.APPLICANT_ARCHIVE_KEYS = archiveKeysBefore;
    }
  }, 15000);
});
