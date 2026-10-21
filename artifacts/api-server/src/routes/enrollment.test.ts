import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const mockState = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>[]>(),
  users: new Map<string, Record<string, unknown>>(),
  storageObjects: new Map<string, { contentType: string; bytes: Buffer }>(),
  uploadCount: 0,
  emailRequests: [] as Array<{ service: string; path: string; options: Record<string, any> }>,
  emailResponses: [] as Array<{ ok: boolean; status: number; body?: { id?: string } }>,
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
      enrollmentApplicationsTable: makeTable("enrollment_applications"),
      applicationEventsTable: makeTable("application_events"),
      portalSettingsTable: makeTable("portal_settings"),
      supportTicketsTable: makeTable("enrollment_support_tickets"),
      staffEmailSettingsTable: makeTable("staff_email_settings"),
      staffEmailOutboxTable: makeTable("staff_email_outbox"),
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
      let upsert: any;
      const run = () => {
        const rows = tableRows(tableName);
        const uniqueFields: Record<string, string[]> = {
          guest_preapplications: ["submissionId", "reference", "accessKeyHash"],
          enrollment_applications: ["reference", "sourceGuestPreapplicationId"],
          guest_preapplication_evidence: ["objectPath"],
          staff_email_settings: ["key"],
          staff_email_outbox: ["idempotencyKey"],
        };
        const conflict = (uniqueFields[tableName] ?? []).some((field) =>
          values[field] != null && rows.some((row) => row[field] === values[field]),
        );
        if (conflict) {
          if (ignoreConflict) return [];
          if (upsert) {
            const targetName = upsert.target?.name;
            const field = targetName ?? uniqueFields[tableName]?.find((name) =>
              values[name] != null && rows.some((row) => row[name] === values[name]),
            );
            const existing = field
              ? rows.find((row) => row[field] === values[field])
              : undefined;
            if (existing) {
              Object.assign(existing, upsert.set);
              return [existing];
            }
          }
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
        onConflictDoUpdate(options: any) {
          upsert = options;
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

vi.mock("@replit/connectors-sdk", () => ({
  ReplitConnectors: class {
    proxy(service: string, path: string, options: Record<string, any>) {
      mockState.emailRequests.push({ service, path, options });
      const next = mockState.emailResponses.shift() ?? {
        ok: true,
        status: 200,
        body: { id: "resend-test-id" },
      };
      return Promise.resolve({
        ok: next.ok,
        status: next.status,
        json: async () => next.body ?? {},
      });
    }
  },
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
    process.env.RESEND_WEBHOOK_SECRET =
      `whsec_${Buffer.from("test-resend-signing-key").toString("base64")}`;
    app.use(express.json({
      verify(request, _response, body) {
        if (request.url?.startsWith("/api/webhooks/resend")) {
          (request as typeof request & { rawBody?: Buffer }).rawBody = Buffer.from(body);
        }
      },
    }));
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
      "guest_preapplication_revisions",
      "enrollment_applications",
      "application_events",
      "portal_settings",
      "enrollment_support_tickets",
      "staff_email_settings",
      "staff_email_outbox",
    ]) mockState.rows.set(name, []);
    mockState.users.clear();
    mockState.storageObjects.clear();
    mockState.uploadCount = 0;
    mockState.emailRequests.length = 0;
    mockState.emailResponses.length = 0;
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
    mockState.users.set("moderator", {
      id: "moderator",
      primaryEmailAddress: {
        emailAddress: "moderator@example.test",
        verification: { status: "verified" },
      },
      publicMetadata: { role: "moderator" },
    });
  });

  async function request(path: string, init: RequestInit = {}, userId?: string): Promise<{ response: Response; body: any }> {
    const headers = new Headers(init.headers);
    if (init.body) headers.set("Content-Type", "application/json");
    if (userId) headers.set("x-test-user", userId);
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const text = response.status === 204 ? "" : await response.text();
    let body: any = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { response, body };
  }

  function signedResendEvent(
    event: Record<string, unknown>,
    signatureOverride?: string,
    timestampSeconds = Math.floor(Date.now() / 1000),
  ) {
    const body = JSON.stringify(event);
    const webhookId = crypto.randomUUID();
    const timestamp = timestampSeconds.toString();
    const signingKey = Buffer.from("test-resend-signing-key");
    const signature = createHmac("sha256", signingKey)
      .update(`${webhookId}.${timestamp}.`)
      .update(body)
      .digest("base64");
    return {
      method: "POST",
      body,
      headers: {
        "svix-id": webhookId,
        "svix-timestamp": timestamp,
        "svix-signature": signatureOverride ?? `v1,${signature}`,
      },
    };
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

  it("notifies the sub-admin when a new guest contact record is created without putting applicant PII in the email", async () => {
    const created = await createGuestDraft();
    expect(mockState.emailRequests).toHaveLength(1);
    const sent = mockState.emailRequests[0];
    expect(sent.service).toBe("resend");
    expect(sent.path).toBe("/emails");
    const message = JSON.parse(sent.options.body as string);
    expect(message.to).toEqual(["skyfashion053@gmail.com"]);
    expect(message.subject).toContain(created.body.reference);
    expect(message.text).toContain(created.body.reference);
    expect(message.text).not.toContain(contactEmail);
    expect(message.html).toContain("Security Verification");
    expect(message.html).toContain("ENROLLMENT PORTAL");
    expect(message.html).toContain(created.body.reference);
    expect(message.html).not.toContain(contactEmail);
    expect(sent.options.headers["Idempotency-Key"]).toMatch(
      new RegExp(`^reviewer:guest-contact:${created.body.id}:[a-f0-9]{32}$`),
    );
  });

  it("limits email center access to admins and sub-admin reviewers", async () => {
    const signedOut = await request("/admin/email/settings");
    const applicant = await request("/admin/email/settings", {}, "applicant-verified");
    const moderator = await request("/admin/email/settings", {}, "moderator");
    const reviewer = await request("/admin/email/settings", {}, "reviewer");

    expect(signedOut.response.status).toBe(401);
    expect(applicant.response.status).toBe(403);
    expect(moderator.response.status).toBe(403);
    expect(reviewer.response.status).toBe(200);
    expect(reviewer.body.recipients).toEqual(["skyfashion053@gmail.com"]);
    expect(reviewer.body.alerts.application_submitted).toBe(true);
  });

  it("saves alert recipients and sends one-off email separately to each recipient", async () => {
    const saved = await request("/admin/email/settings", {
      method: "PUT",
      body: JSON.stringify({
        recipients: ["reviewer@example.test", "other@example.test"],
        alerts: {
          contact_received: true,
          step_saved: false,
          contact_updated: true,
          evidence_saved: false,
          application_submitted: true,
        },
        branding: {
          logoUrl: "https://images.example.test/portal-logo.png",
          accentColor: "#167c80",
          headerColor: "#ffffff",
          senderName: "Enrollment Team",
        },
      }),
    }, "reviewer");
    expect(saved.response.status).toBe(200);
    expect(saved.body.recipients).toEqual(["reviewer@example.test", "other@example.test"]);
    expect(saved.body.alerts.step_saved).toBe(false);
    expect(saved.body.branding).toEqual({
      logoUrl: "https://images.example.test/portal-logo.png",
      accentColor: "#167c80",
      headerColor: "#ffffff",
      senderName: "Enrollment Team",
    });
    const insecureLogo = await request("/admin/email/settings", {
      method: "PUT",
      body: JSON.stringify({
        recipients: saved.body.recipients,
        alerts: saved.body.alerts,
        branding: { ...saved.body.branding, logoUrl: "http://images.example.test/logo.png" },
      }),
    }, "reviewer");
    expect(insecureLogo.response.status).toBe(400);

    const sent = await request("/admin/email/send", {
      method: "POST",
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        recipients: ["one@example.test", "two@example.test"],
        subject: "Portal <update>",
        messageText: "A short staff update & <details>.",
      }),
    }, "reviewer");
    expect(sent.response.status).toBe(201);
    expect(sent.body).toHaveLength(2);
    expect(sent.body.every((message: any) => message.status === "sent")).toBe(true);
    expect(mockState.emailRequests).toHaveLength(2);
    expect(mockState.emailRequests.map((item) => JSON.parse(item.options.body).to))
      .toEqual([["one@example.test"], ["two@example.test"]]);
    const sentPayload = JSON.parse(mockState.emailRequests[0].options.body);
    expect(sentPayload.from).toBe('"Enrollment Team" <notifications@vu-gov.cc>');
    expect(sentPayload.html).toContain("https://images.example.test/portal-logo.png");
    expect(sentPayload.html).toContain("background:#ffffff");
    expect(sentPayload.html).toContain("color:#102b46");
    expect(sentPayload.html).toContain("Enrollment Team · Enrollment Portal staff communications");
    const emailHtml = JSON.parse(mockState.emailRequests[0].options.body).html;
    expect(emailHtml).toContain("Portal &lt;update&gt;");
    expect(emailHtml).toContain("A short staff update &amp; &lt;details&gt;.");
    expect(emailHtml).not.toContain("A short staff update & <details>.");

    const outbox = await request("/admin/email/outbox", {}, "administrator");
    expect(outbox.response.status).toBe(200);
    expect(outbox.body).toHaveLength(2);
    expect(outbox.body[0].subject).toBe("Portal <update>");
    expect(outbox.body[0].deliveryStatus).toBe("accepted");
  });

  it("updates accepted email outcomes only from verified, non-stale Resend events", async () => {
    const deliveredId = "resend-delivery-lifecycle";
    const bouncedId = "resend-bounced-message";
    const accepted = (providerMessageId: string) => newRow("staff_email_outbox", {
      idempotencyKey: `webhook:${providerMessageId}`,
      recipientEmail: "person@example.test",
      subject: "Delivery status test",
      messageText: "Test",
      eventKind: "manual",
      status: "sent",
      providerMessageId,
      deliveryStatus: "accepted",
      attemptCount: 1,
    });
    mockState.rows.set("staff_email_outbox", [accepted(deliveredId), accepted(bouncedId)]);

    const invalid = await request("/webhooks/resend", signedResendEvent({
      type: "email.delivered",
      data: { email_id: deliveredId },
    }, "v1,invalid"));
    expect(invalid.response.status).toBe(400);
    expect(mockState.rows.get("staff_email_outbox")?.[0].deliveryStatus).toBe("accepted");

    const stale = await request("/webhooks/resend", signedResendEvent({
      type: "email.delivered",
      data: { email_id: deliveredId },
    }, undefined, Math.floor(Date.now() / 1000) - 360));
    expect(stale.response.status).toBe(400);

    const delivered = await request("/webhooks/resend", signedResendEvent({
      type: "email.delivered",
      data: { email_id: deliveredId },
    }));
    expect(delivered.response.status).toBe(200);
    expect(mockState.rows.get("staff_email_outbox")?.[0].deliveryStatus).toBe("delivered");

    const complained = await request("/webhooks/resend", signedResendEvent({
      type: "email.complained",
      data: { email_id: deliveredId },
    }));
    expect(complained.response.status).toBe(200);
    expect(mockState.rows.get("staff_email_outbox")?.[0].deliveryStatus).toBe("complained");

    const bounced = await request("/webhooks/resend", signedResendEvent({
      type: "email.bounced",
      data: { email_id: bouncedId },
    }));
    expect(bounced.response.status).toBe(200);
    expect(mockState.rows.get("staff_email_outbox")?.[1].deliveryStatus).toBe("bounced");

    const lateDelivered = await request("/webhooks/resend", signedResendEvent({
      type: "email.delivered",
      data: { email_id: bouncedId },
    }));
    expect(lateDelivered.response.status).toBe(200);
    expect(mockState.rows.get("staff_email_outbox")?.[1].deliveryStatus).toBe("bounced");
  });

  it("records provider failures and allows an authorized reviewer to retry them", async () => {
    mockState.emailResponses.push(
      { ok: false, status: 500 },
      { ok: false, status: 500 },
      { ok: false, status: 500 },
    );
    const sent = await request("/admin/email/send", {
      method: "POST",
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        recipients: ["retry@example.test"],
        subject: "Retry test",
        messageText: "This will be retried.",
      }),
    }, "reviewer");
    expect(sent.response.status, JSON.stringify(sent.body)).toBe(201);
    expect(sent.body[0].status).toBe("failed");
    const retried = await request(`/admin/email/outbox/${sent.body[0].id}/retry`, {
      method: "POST",
    }, "reviewer");
    expect(retried.response.status).toBe(200);
    expect(retried.body.status).toBe("sent");
    expect(retried.body.attemptCount).toBe(4);
    expect(mockState.emailRequests).toHaveLength(4);
    expect(JSON.parse(mockState.emailRequests[0].options.body).html)
      .toBe(JSON.parse(mockState.emailRequests[3].options.body).html);
  });

  it("does not send a duplicate one-off email when the same request is retried", async () => {
    const requestId = crypto.randomUUID();
    const body = {
      requestId,
      recipients: ["duplicate@example.test"],
      subject: "Idempotency check",
      messageText: "This message should only be handed to the provider once.",
    };
    const first = await request("/admin/email/send", {
      method: "POST",
      body: JSON.stringify(body),
    }, "reviewer");
    const duplicate = await request("/admin/email/send", {
      method: "POST",
      body: JSON.stringify(body),
    }, "reviewer");

    expect(first.response.status).toBe(201);
    expect(duplicate.response.status).toBe(201);
    expect(duplicate.body[0].id).toBe(first.body[0].id);
    expect(mockState.emailRequests).toHaveLength(1);
  });

  it("notifies the sub-admin for meaningful saved-step changes but not no-op retries", async () => {
    const created = await createGuestDraft();
    expect(mockState.emailRequests).toHaveLength(1);

    const progress = {
      reference: created.body.reference,
      accessKey,
      currentStep: 1,
      answers: {},
      complete: false,
    };
    const saved = await request(`/guest/preapplications/${created.body.id}`, {
      method: "PATCH",
      body: JSON.stringify(progress),
    });
    expect(saved.response.status).toBe(200);
    expect(mockState.rows.get("guest_preapplication_revisions")).toHaveLength(1);
    expect(mockState.emailRequests).toHaveLength(2);
    expect(JSON.parse(mockState.emailRequests[1].options.body as string).text)
      .toContain("Next of kin");

    const retry = await request(`/guest/preapplications/${created.body.id}`, {
      method: "PATCH",
      body: JSON.stringify(progress),
    });
    expect(retry.response.status).toBe(200);
    expect(mockState.emailRequests).toHaveLength(2);
  });

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

  it("returns reviewer lists beyond the former 300-record cap for applicants and guests", async () => {
    const guestRows = mockState.rows.get("guest_preapplications")!;
    const enrollmentRows = mockState.rows.get("enrollment_applications")!;
    const recordCount = 305;

    for (let index = 0; index < recordCount; index += 1) {
      guestRows.push(newRow("guest_preapplications", {
        id: crypto.randomUUID(),
        reference: `GUEST-${String(index).padStart(4, "0")}`,
        categoryId: "category-1",
        fullName: `Guest Applicant ${index}`,
        email: `guest-${index}@example.test`,
        status: "received",
        submissionStatus: "draft",
        answers: {},
      }));
      enrollmentRows.push(newRow("enrollment_applications", {
        id: crypto.randomUUID(),
        reference: `ENROLL-${String(index).padStart(4, "0")}`,
        categoryId: "category-1",
        status: "draft",
        currentStep: 3,
        pinHash: null,
        answers: {
          contactDetails: {
            fullName: `Enrollment Applicant ${index}`,
            email: `enrollment-${index}@example.test`,
          },
        },
        reviewNote: null,
        submittedAt: null,
        sourceGuestPreapplicationId: null,
      }));
    }

    const [guestList, enrollmentList] = await Promise.all([
      request("/admin/guest-preapplications", {}, "reviewer"),
      request("/admin/applications", {}, "reviewer"),
    ]);

    expect(guestList.response.status).toBe(200);
    expect(guestList.body).toHaveLength(recordCount);
    expect(guestList.body.some((application: any) => application.reference === "GUEST-0304")).toBe(true);
    expect(enrollmentList.response.status).toBe(200);
    expect(enrollmentList.body).toHaveLength(recordCount);
    expect(enrollmentList.body.some((application: any) => application.reference === "ENROLL-0304")).toBe(true);
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
    expect(adminReviewerCheck.response.status).toBe(200);
    expect(adminReviewerCheck.body).toHaveLength(1);
    const subAdminUserManagement = await request("/admin/users", {}, "reviewer");
    expect(subAdminUserManagement.response.status).toBe(403);
    const subAdminSettings = await request(
      "/admin/settings",
      { method: "PUT", body: JSON.stringify({}) },
      "reviewer",
    );
    expect(subAdminSettings.response.status).toBe(403);
    const visibleDraft = await request("/admin/guest-preapplications", {}, "reviewer");
    expect(visibleDraft.response.status).toBe(200);
    expect(visibleDraft.body).toHaveLength(1);
    expect(visibleDraft.body[0]).toMatchObject({
      id: applicationId,
      categoryId: "category-1",
      fullName: "Test Applicant",
      email: contactEmail,
      phone: "+1 555 555 0100",
      emailVerified: false,
      submissionStatus: "draft",
      currentStep: 7,
      detailsComplete: true,
      hasPin: true,
      reviewReady: true,
    });
    expect(visibleDraft.body[0].answers).toMatchObject({
      name: "Test Applicant",
      nickname: "TA",
      personalInformation: {
        firstName: "Test",
        email: contactEmail,
      },
      nextOfKin: { fullName: "Next Contact" },
      education: { institution: "Test College" },
      workInformation: { employmentStatus: "student" },
      reviewDeclarationAccepted: true,
    });
    expect(visibleDraft.body[0].evidence).toHaveLength(2);
    expect(visibleDraft.body[0].evidence.every((item: any) => item.downloadUrl)).toBe(true);
    expect(JSON.stringify(visibleDraft.body)).not.toContain("4826");
    const preverificationPin = await request(
      `/admin/guest-preapplications/${applicationId}/pin`,
      {},
      "reviewer",
    );
    expect(preverificationPin.response.status).toBe(200);
    expect(preverificationPin.body).toEqual({ pin: "4826", available: true });
    expect(preverificationPin.response.headers.get("cache-control")).toContain("no-store");
    expect((await request(
      `/admin/guest-preapplications/${applicationId}/pin`,
      {},
      "applicant-unverified",
    )).response.status).toBe(403);

    const privateFilePath = `/admin/guest-preapplications/${applicationId}/evidence/${visibleDraft.body[0].evidence[0].id}/file`;
    expect((await request(privateFilePath)).response.status).toBe(401);
    expect((await request(privateFilePath, {}, "applicant-unverified")).response.status).toBe(403);
    const adminDraftDownload = await fetch(`${baseUrl}${privateFilePath}`, {
      headers: { "x-test-user": "administrator" },
    });
    expect(adminDraftDownload.status).toBe(200);
    expect(Buffer.from(await adminDraftDownload.arrayBuffer()).length).toBeGreaterThan(0);
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
    );
    expect(unverifiedSubmit.response.status).toBe(200);
    expect(unverifiedSubmit.body).toMatchObject({
      submissionStatus: "submitted",
      emailVerified: false,
      emailVerificationRequired: true,
      linkedApplicationId: null,
    });

    const mismatchedSubmit = await request(
      `/guest/preapplications/${applicationId}/link`,
      { method: "POST", body: JSON.stringify({ reference, accessKey }) },
      "applicant-mismatch",
    );
    expect(mismatchedSubmit.response.status).toBe(403);
    const originalEmailSubmit = await request(
      `/guest/preapplications/${applicationId}/link`,
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
    expect(afterFailures.body[0].submissionStatus).toBe("submitted");

    const unverifiedStatusLink = await request(
      `/guest/preapplications/${applicationId}/link`,
      { method: "POST", body: JSON.stringify({ reference, accessKey }) },
      "applicant-unverified",
    );
    expect(unverifiedStatusLink.response.status).toBe(403);

    const successfulLink = await request(
      `/guest/preapplications/${applicationId}/link`,
      { method: "POST", body: JSON.stringify({ reference, accessKey }) },
      "applicant-corrected-verified",
    );
    expect(successfulLink.response.status).toBe(200);
    expect(successfulLink.body.status).toBe("submitted");
    const retry = await request(
      `/guest/preapplications/${applicationId}/link`,
      { method: "POST", body: JSON.stringify({ reference, accessKey }) },
      "applicant-corrected-verified",
    );
    expect(retry.response.status).toBe(200);
    expect(retry.body.id).toBe(successfulLink.body.id);
    expect(mockState.rows.get("enrollment_applications")).toHaveLength(1);

    const storedDraft = mockState.rows.get("guest_preapplications")?.[0];
    expect(storedDraft).toMatchObject({
      submissionStatus: "submitted",
      emailVerified: true,
      clerkUserId: "applicant-corrected-verified",
      linkedApplicationId: successfulLink.body.id,
    });
    expect(String(storedDraft?.pinHash)).toMatch(/^scrypt\$/);
    const finalReviewerList = await request("/admin/guest-preapplications", {}, "reviewer");
    expect(finalReviewerList.response.status).toBe(200);
    expect(finalReviewerList.body).toHaveLength(0);

    const finalReviewerRecord = await request(
      `/admin/applications/${successfulLink.body.id}`,
      {},
      "reviewer",
    );
    expect(finalReviewerRecord.response.status).toBe(200);
    expect(finalReviewerRecord.body.evidence).toHaveLength(2);
    expect(finalReviewerRecord.body.evidence.every((item: any) =>
      item.downloadUrl === `/api/admin/applications/${successfulLink.body.id}/evidence/${item.id}/file`,
    )).toBe(true);
    expect(JSON.stringify(finalReviewerRecord.body.evidence)).not.toContain("objectPath");
    expect(JSON.stringify(finalReviewerRecord.body)).not.toContain("/objects/test/");
    const linkedReviewerPin = await request(
      `/admin/applications/${successfulLink.body.id}/pin`,
      {},
      "reviewer",
    );
    expect(linkedReviewerPin.response.status).toBe(200);
    expect(linkedReviewerPin.body).toEqual({ pin: "4826", available: true });
    expect(linkedReviewerPin.response.headers.get("cache-control")).toContain("no-store");
    const submittedEvidencePath = finalReviewerRecord.body.evidence[0].downloadUrl.replace("/api", "");
    expect((await request(submittedEvidencePath)).response.status).toBe(401);
    expect((await request(submittedEvidencePath, {}, "applicant-verified")).response.status).toBe(403);
    const adminSubmittedEvidenceDownload = await fetch(`${baseUrl}${submittedEvidencePath}`, {
      headers: { "x-test-user": "administrator" },
    });
    expect(adminSubmittedEvidenceDownload.status).toBe(200);
    expect(Buffer.from(await adminSubmittedEvidenceDownload.arrayBuffer()).length).toBeGreaterThan(0);
    const submittedEvidenceDownload = await fetch(`${baseUrl}${submittedEvidencePath}`, {
      headers: { "x-test-user": "reviewer" },
    });
    expect(submittedEvidenceDownload.status).toBe(200);
    expect(submittedEvidenceDownload.headers.get("cache-control")).toContain("no-store");
    expect(submittedEvidenceDownload.headers.get("content-disposition")).toContain("attachment");
    expect(Buffer.from(await submittedEvidenceDownload.arrayBuffer()).length).toBeGreaterThan(0);
    const missingEvidenceDownload = await request(
      `/admin/applications/${successfulLink.body.id}/evidence/${crypto.randomUUID()}/file`,
      {},
      "reviewer",
    );
    expect(missingEvidenceDownload.response.status).toBe(404);
    const adminSubmittedRecord = await request(
      `/admin/applications/${successfulLink.body.id}`,
      {},
      "administrator",
    );
    expect(adminSubmittedRecord.response.status).toBe(200);
    expect(adminSubmittedRecord.body.applicantEmail).toBe("corrected@example.test");
    expect((await request(
      `/admin/applications/${successfulLink.body.id}`,
      {},
      "applicant-verified",
    )).response.status).toBe(403);
    expect(finalReviewerRecord.body).toMatchObject({
      applicantName: "Test Applicant",
      applicantEmail: "corrected@example.test",
      hasPin: true,
      answers: {
        contactDetails: {
          fullName: "Test Applicant",
          email: "corrected@example.test",
          phone: "+1 555 555 0100",
          emailVerified: true,
        },
        nextOfKin: { fullName: "Next Contact" },
        education: { institution: "Test College" },
        workInformation: { employmentStatus: "student" },
      },
    });
    expect(JSON.stringify(finalReviewerRecord.body)).not.toContain("4826");
  });

  it("allows partial guest submission before email verification while keeping the category PIN mandatory", async () => {
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
          reviewDeclarationAccepted: true,
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
    expect(submitted.body).toMatchObject({
      submissionStatus: "submitted",
      emailVerified: false,
      emailVerificationRequired: true,
      linkedApplicationId: null,
    });

    const linked = await request(
      `/guest/preapplications/${applicationId}/link`,
      { method: "POST", body: submitBody },
      "applicant-verified",
    );
    expect(linked.response.status).toBe(200);
    expect(linked.body.status).toBe("submitted");

    const savedRevisionRows = mockState.rows.get("guest_preapplication_revisions") ?? [];
    expect(savedRevisionRows.length).toBeGreaterThan(0);
    expect(JSON.stringify(savedRevisionRows)).not.toContain("739102");
    const reviewerHistory = await request(
      `/admin/applications/${linked.body.id}/guest-history`,
      {},
      "reviewer",
    );
    expect(reviewerHistory.response.status).toBe(200);
    expect(JSON.stringify(reviewerHistory.body)).not.toContain("739102");
    expect(JSON.stringify(reviewerHistory.body)).toContain('"field":"Saved progress step"');
    expect(reviewerHistory.body.some((revision: any) =>
      revision.changes.some((change: any) => change.after === "Partial"),
    )).toBe(true);

    const reviewerApplication = await request(
      `/admin/applications/${linked.body.id}`,
      {},
      "reviewer",
    );
    expect(reviewerApplication.response.status).toBe(200);
    expect(reviewerApplication.body).toMatchObject({
      id: linked.body.id,
      reference,
      status: "submitted",
      applicantName: "Partial Applicant",
      applicantEmail: contactEmail,
    });
    const adminApplication = await request(
      `/admin/applications/${linked.body.id}`,
      {},
      "administrator",
    );
    expect(adminApplication.response.status).toBe(200);
    expect(adminApplication.body).toMatchObject({
      id: linked.body.id,
      reference,
      applicantEmail: contactEmail,
    });
    const adminHistory = await request(
      `/admin/applications/${linked.body.id}/guest-history`,
      {},
      "administrator",
    );
    expect(adminHistory.response.status).toBe(200);

    const unprivilegedHistory = await request(
      `/admin/applications/${linked.body.id}/guest-history`,
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

  it("lets a sub-admin clear a selected applicant and removes linked evidence", async () => {
    const guestId = crypto.randomUUID();
    const enrollmentId = crypto.randomUUID();
    const evidenceId = crypto.randomUUID();
    const evidencePath = "/objects/test/clear-applicant-evidence";
    const guest = newRow("guest_preapplications", {
      id: guestId,
      submissionId: crypto.randomUUID(),
      reference: "GUEST-CLEAR-1",
      accessKeyHash: "private-key-hash",
      categoryId: "category-1",
      fullName: "Clear Test Applicant",
      email: contactEmail,
      submissionStatus: "submitted",
      linkedApplicationId: enrollmentId,
    });
    const enrollment = newRow("enrollment_applications", {
      id: enrollmentId,
      reference: "ENR-CLEAR-1",
      clerkUserId: "applicant-verified",
      sourceGuestPreapplicationId: guestId,
      categoryId: "category-1",
      status: "submitted",
      answers: {},
    });
    const evidence = newRow("guest_preapplication_evidence", {
      id: evidenceId,
      applicationId: guestId,
      evidenceType: "identity_document",
      evidenceSlot: "identity_front",
      fileName: "identity.png",
      contentType: "image/png",
      sizeBytes: privatePng.length,
      objectPath: evidencePath,
      uploadedAt: new Date(),
      uploadedByUserId: null,
    });
    mockState.rows.set("guest_preapplications", [guest]);
    mockState.rows.set("enrollment_applications", [enrollment]);
    mockState.rows.set("guest_preapplication_evidence", [evidence]);
    mockState.rows.set("guest_preapplication_revisions", []);
    mockState.storageObjects.set(evidencePath, {
      contentType: "image/png",
      bytes: privatePng,
    });

    const body = {
      guestPreapplicationIds: [],
      enrollmentApplicationIds: [enrollmentId],
    };
    const denied = await request("/admin/applicants/clear", {
      method: "POST",
      body: JSON.stringify(body),
    }, "applicant-unverified");
    expect(denied.response.status).toBe(403);

    const cleared = await request("/admin/applicants/clear", {
      method: "POST",
      body: JSON.stringify(body),
    }, "reviewer");
    expect(cleared.response.status, JSON.stringify(cleared.body)).toBe(200);
    expect(cleared.body).toEqual({ clearedCount: 1, failedRecords: [] });
    expect(mockState.rows.get("guest_preapplications")).toEqual([]);
    expect(mockState.rows.get("enrollment_applications")).toEqual([]);
    expect(mockState.rows.get("guest_preapplication_evidence")).toEqual([]);
    expect(mockState.storageObjects.has(evidencePath)).toBe(false);
  });
});
