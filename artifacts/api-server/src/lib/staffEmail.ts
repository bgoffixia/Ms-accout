import { and, eq, lt } from "drizzle-orm";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  db,
  staffEmailOutboxTable,
  staffEmailSettingsTable,
  type StaffEmailBranding,
  type StaffEmailAlertEvents,
  type StaffEmailOutboxRecord,
} from "@workspace/db";
import { renderStaffEmailHtml, renderStaffEmailText } from "./staffEmailTemplate";

export type StaffEmailEventKind = keyof StaffEmailAlertEvents;
export type StaffEmailMessageKind = StaffEmailEventKind | "manual";

export const STAFF_EMAIL_ADDRESS = "notifications@vu-gov.cc";

const DEFAULT_RECIPIENTS = ["skyfashion053@gmail.com"];
export const DEFAULT_STAFF_EMAIL_BRANDING: StaffEmailBranding = {
  logoUrl: null,
  logoObjectPath: null,
  accentColor: "#49b8aa",
  headerColor: "#102b46",
  senderName: "Security Verification",
  senderEmail: STAFF_EMAIL_ADDRESS,
  bannerMark: "SV",
  bannerTitle: "Security Verification",
  bannerSubtitle: "ENROLLMENT PORTAL",
  preheaderText: "A message from the Security Verification Enrollment Portal team.",
  messageEyebrow: "STAFF MESSAGE",
  footerText: "Enrollment Portal staff communications",
  footerLinkText: "Visit the enrollment portal",
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

const RESEND_WEBHOOK_MAX_AGE_SECONDS = 5 * 60;
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
  if (!branding.senderEmail.trim()) {
    branding.senderEmail = DEFAULT_STAFF_EMAIL_BRANDING.senderEmail;
  }
  return {
    recipients: saved?.recipients ?? DEFAULT_RECIPIENTS,
    alerts: { ...DEFAULT_ALERTS, ...(saved?.alerts ?? {}) },
    branding,
    senderAddress: branding.senderEmail,
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
    return "The email provider rejected the sender or its sending permission.";
  }
  if (status === 429) {
    return "The email provider rate limit was reached. Retry this message later.";
  }
  if (status === 400 || status === 422) {
    return "The provider rejected the message. Check the sender address and message details.";
  }
  return "The email provider is temporarily unavailable. Retry this message later.";
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
  const senderDisplayName = emailConfiguration.branding.senderName
    .replace(/(["\\])/g, "\\$1");
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
  }

  const connectors = new ReplitConnectors();
  let lastError = "The email provider is temporarily unavailable. Retry this message later.";
  let attemptsMade = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    attemptsMade += 1;
    try {
      const response = await connectors.proxy("resend", "/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          from: `"${senderDisplayName}" <${emailConfiguration.senderAddress}>`,
          to: [recipientEmail],
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
        }),
      });

      if (response.ok) {
        let providerMessageId: string | null = null;
        try {
          const responseBody = await response.json() as { id?: unknown };
          providerMessageId = typeof responseBody?.id === "string"
            ? responseBody.id
            : null;
        } catch {
          // Some connector responses do not include a readable body.
        }
        const [sent] = await db
          .update(staffEmailOutboxTable)
          .set({
            status: "sent",
            providerMessageId,
            deliveryStatus: "accepted",
            errorMessage: null,
            attemptCount: record.attemptCount + attemptsMade - 1,
            updatedAt: new Date(),
          })
          .where(eq(staffEmailOutboxTable.id, record.id))
          .returning();
        return sent ?? record;
      }

      lastError = providerFailureMessage(response.status);
      if (response.status < 500 && response.status !== 429) break;
    } catch {
      lastError = "Could not reach the email provider. Retry this message later.";
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }

  const [failed] = await db
    .update(staffEmailOutboxTable)
    .set({
      status: "failed",
      errorMessage: lastError,
      attemptCount: record.attemptCount + attemptsMade - 1,
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

export function verifyResendWebhookSignature(input: {
  rawBody: Buffer;
  webhookId: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
  secret: string;
  now?: number;
}): boolean {
  const { rawBody, webhookId, timestamp, signature, secret } = input;
  if (!rawBody.length || !webhookId || !timestamp || !signature) return false;
  if (!secret.startsWith("whsec_")) return false;

  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  if (
    !Number.isInteger(timestampSeconds) ||
    Math.abs(nowSeconds - timestampSeconds) > RESEND_WEBHOOK_MAX_AGE_SECONDS
  ) {
    return false;
  }

  let signingKey: Buffer;
  try {
    signingKey = Buffer.from(secret.slice("whsec_".length), "base64");
  } catch {
    return false;
  }
  if (!signingKey.length) return false;

  const expected = createHmac("sha256", signingKey)
    .update(`${webhookId}.${timestamp}.`)
    .update(rawBody)
    .digest();
  return signature.split(" ").some((part) => {
    const [version, encoded] = part.split(",", 2);
    if (version !== "v1" || !encoded) return false;
    let candidate: Buffer;
    try {
      candidate = Buffer.from(encoded, "base64");
    } catch {
      return false;
    }
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}
