import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>[]>(),
  users: new Map<string, Record<string, unknown>>(),
  storageObjects: new Map<string, { contentType: string; bytes: Buffer }>(),
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
      const builder: any = {
        values(input: Record<string, unknown>) {
          values = input;
          return builder;
        },
        onConflictDoNothing() {
          ignoreConflict = true;
          return builder;
        },
        returning() {
          const rows = tableRows(tableName);
          const uniqueFields: Record<string, string[]> = {
            guest_preapplications: ["submissionId", "reference", "accessKeyHash"],
            enrollment_applications: ["reference", "sourceGuestPreapplicationId"],
            guest_preapplication_evidence: ["objectPath"],
          };
          const conflict = (uniqueFields[tableName] ?? []).some((field) =>
            values[field] != null && rows.some((row) => row[field] === values[field]),
          );
          if (conflict) return Promise.resolve(ignoreConflict ? [] : (() => { throw new Error("unique constraint"); })());
          const row = newRow(tableName, values);
          rows.push(row);
          return Promise.resolve([row]);
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

vi.mock("../lib/objectStorage", () => ({
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
  ObjectStorageService: class {
    async getObjectEntityUploadURL() {
      mockState.uploadCount += 1;
      return `https://storage.test/upload/${mockState.uploadCount}`;
    }

    normalizeObjectEntityPath(uploadUrl: string) {
      return `/objects/test/${uploadUrl.split("/").at(-1)}`;
    }

    async getObjectEntityFile(path: string) {
      const object = mockState.storageObjects.get(path);
      if (!object) throw new Error(`Missing mocked object ${path}`);
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
        download: async ({ start, end }: { start: number; end: number }) => [
          object.bytes.subarray(start, end + 1),
        ],
        delete: async () => {
          mockState.storageObjects.delete(path);
        },
        createReadStream: () => stream,
      };
    }
  },
}));

import express from "express";
import router from "./enrollment";
import { cleanupExpiredGuestEvidence } from "../lib/guestEvidenceCleanup";

const accessKey = "a".repeat(43);
const contactEmail = "applicant@example.test";
const privatePng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const privateMp4 = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);

describe("guest application verification and persistence", () => {
  const app = express();
  let server: ReturnType<typeof app.listen>;
  let baseUrl = "";

  beforeAll(async () => {
    process.env.PRIVATE_OBJECT_DIR = "test-private";
    process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID = "test-bucket";
    process.env.SESSION_SECRET = "test-session-secret";
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
    mockState.rows.clear();
    for (const name of [
      "guest_preapplications",
      "guest_preapplication_evidence",
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
    const objectPath = `/objects/test/${mockState.uploadCount}`;
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
});
