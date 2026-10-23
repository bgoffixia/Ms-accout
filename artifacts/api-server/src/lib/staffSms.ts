import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  staffSmsOutboxTable,
  staffSmsSettingsTable,
  type StaffSmsOutboxRecord,
} from "@workspace/db";
import { createHmac, timingSafeEqual } from "node:crypto";

const STAFF_SMS_SETTINGS_KEY = "global";
const SENDER_ID_PATTERN = /^[A-Za-z0-9]{3,11}$/;

export type StaffSmsConfiguration = {
  baseUrl: string;
  senderId: string;
  credentialConfigured: boolean;
  deliveryReportUrl: string | null;
  deliveryReportsConfigured: boolean;
  dailyLimit: number;
  dailyUsageCount: number;
  updatedAt: string | null;
};

export type StaffSmsStatus = "sending" | "accepted" | "delivered" | "failed";

export function getInfobipDeliveryReportUrl(): string | null {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (!domain || !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(domain)) {
    return null;
  }
  return `https://${domain}/api/webhooks/infobip/sms`;
}

export function normalizeInfobipBaseUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "") ||
      !(host === "api.infobip.com" || host.endsWith(".api.infobip.com"))
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function isValidInfobipSenderId(value: string): boolean {
  return SENDER_ID_PATTERN.test(value.trim());
}

export async function getStaffSmsConfiguration(): Promise<StaffSmsConfiguration> {
  const [saved] = await db
    .select()
    .from(staffSmsSettingsTable)
    .where(eq(staffSmsSettingsTable.key, STAFF_SMS_SETTINGS_KEY))
    .limit(1);
  const deliveryReportUrl = getInfobipDeliveryReportUrl();
  const currentUtcDate = new Date().toISOString().slice(0, 10);
  return {
    baseUrl: saved?.baseUrl ?? "",
    senderId: saved?.senderId ?? "",
    credentialConfigured: Boolean(process.env.INFOBIP_API_KEY?.trim()),
    deliveryReportUrl,
    deliveryReportsConfigured: Boolean(
      deliveryReportUrl && process.env.INFOBIP_DLR_WEBHOOK_SECRET?.trim(),
    ),
    dailyLimit: saved?.dailyLimit ?? 100,
    dailyUsageCount: saved?.dailyUsageDate === currentUtcDate
      ? saved.dailyUsageCount
      : 0,
    updatedAt: saved?.updatedAt?.toISOString() ?? null,
  };
}

export async function saveStaffSmsConfiguration(
  input: {
    baseUrl?: string;
    senderId?: string;
    dailyLimit?: number;
    updatedByUserId: string;
  },
): Promise<StaffSmsConfiguration> {
  const [existing] = await db
    .select()
    .from(staffSmsSettingsTable)
    .where(eq(staffSmsSettingsTable.key, STAFF_SMS_SETTINGS_KEY))
    .limit(1);
  const updates: {
    updatedByUserId: string;
    updatedAt: Date;
    baseUrl?: string;
    senderId?: string;
    dailyLimit?: number;
  } = {
    updatedByUserId: input.updatedByUserId,
    updatedAt: new Date(),
  };
  if (input.baseUrl !== undefined) updates.baseUrl = input.baseUrl;
  if (input.senderId !== undefined) updates.senderId = input.senderId;
  if (input.dailyLimit !== undefined) updates.dailyLimit = input.dailyLimit;
  await db
    .insert(staffSmsSettingsTable)
    .values({
      key: STAFF_SMS_SETTINGS_KEY,
      baseUrl: input.baseUrl ?? existing?.baseUrl ?? "",
      senderId: input.senderId ?? existing?.senderId ?? "",
      dailyLimit: input.dailyLimit ?? existing?.dailyLimit ?? 100,
      dailyUsageDate: existing?.dailyUsageDate ?? null,
      dailyUsageCount: existing?.dailyUsageCount ?? 0,
      updatedByUserId: input.updatedByUserId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: staffSmsSettingsTable.key,
      set: updates,
    });
  return getStaffSmsConfiguration();
}

export async function reserveStaffSmsDailyQuota(): Promise<{
  allowed: boolean;
  dailyLimit: number;
  usedCount: number;
  remainingCount: number;
}> {
  return db.transaction(async (transaction) => {
    const [saved] = await transaction
      .select()
      .from(staffSmsSettingsTable)
      .where(eq(staffSmsSettingsTable.key, STAFF_SMS_SETTINGS_KEY))
      .for("update")
      .limit(1);
    if (!saved) throw new Error("SMS settings must be saved before sending.");

    const currentUtcDate = new Date().toISOString().slice(0, 10);
    const usedCount = saved.dailyUsageDate === currentUtcDate
      ? saved.dailyUsageCount
      : 0;
    if (usedCount >= saved.dailyLimit) {
      return {
        allowed: false,
        dailyLimit: saved.dailyLimit,
        usedCount,
        remainingCount: 0,
      };
    }

    const nextCount = usedCount + 1;
    await transaction
      .update(staffSmsSettingsTable)
      .set({
        dailyUsageDate: currentUtcDate,
        dailyUsageCount: nextCount,
      })
      .where(eq(staffSmsSettingsTable.key, STAFF_SMS_SETTINGS_KEY));
    return {
      allowed: true,
      dailyLimit: saved.dailyLimit,
      usedCount: nextCount,
      remainingCount: Math.max(0, saved.dailyLimit - nextCount),
    };
  });
}

export async function sendInfobipSms(input: {
  baseUrl: string;
  apiKey: string;
  senderId: string;
  recipientPhone: string;
  messageText: string;
  deliveryReportUrl: string;
  callbackData: string;
}): Promise<{ ok: boolean; status: number; providerMessageId: string | null }> {
  const response = await fetch(`${input.baseUrl}/sms/3/messages`, {
    method: "POST",
    headers: {
      Authorization: `App ${input.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      messages: [{
        sender: input.senderId,
        destinations: [{ to: input.recipientPhone.replace(/^\+/, "") }],
        content: { text: input.messageText },
        webhooks: {
          delivery: {
            url: input.deliveryReportUrl,
            intermediateReport: false,
          },
          contentType: "application/json",
          callbackData: input.callbackData,
        },
      }],
    }),
    signal: AbortSignal.timeout(15_000),
  });

  let providerMessageId: string | null = null;
  try {
    const result = await response.json() as {
      messages?: Array<{ messageId?: unknown }>;
    };
    const candidate = result.messages?.[0]?.messageId;
    if (typeof candidate === "string") providerMessageId = candidate;
  } catch {
    // Infobip may return an empty body for accepted requests.
  }
  return { ok: response.ok, status: response.status, providerMessageId };
}

export async function createStaffSmsAttempt(input: {
  recipientPhone: string;
  senderId: string;
  messageText: string;
  createdByUserId: string;
}): Promise<StaffSmsOutboxRecord> {
  const [record] = await db
    .insert(staffSmsOutboxTable)
    .values({
      ...input,
      status: "sending",
    })
    .returning();
  if (!record) throw new Error("SMS attempt could not be recorded.");
  return record;
}

export async function listStaffSmsAttempts(): Promise<StaffSmsOutboxRecord[]> {
  return db
    .select()
    .from(staffSmsOutboxTable)
    .orderBy(desc(staffSmsOutboxTable.createdAt))
    .limit(100);
}

export async function getStaffSmsAttemptById(
  id: string,
): Promise<StaffSmsOutboxRecord | undefined> {
  const [record] = await db
    .select()
    .from(staffSmsOutboxTable)
    .where(eq(staffSmsOutboxTable.id, id))
    .limit(1);
  return record;
}

export async function markStaffSmsAccepted(input: {
  id: string;
  providerMessageId: string | null;
  acceptedAt: Date;
}): Promise<void> {
  await db
    .update(staffSmsOutboxTable)
    .set({
      status: "accepted",
      providerMessageId: input.providerMessageId,
      acceptedAt: input.acceptedAt,
      updatedAt: input.acceptedAt,
    })
    .where(
      and(
        eq(staffSmsOutboxTable.id, input.id),
        eq(staffSmsOutboxTable.status, "sending"),
      ),
    );
}

export async function markStaffSmsFailed(
  id: string,
  errorMessage: string,
): Promise<void> {
  await db
    .update(staffSmsOutboxTable)
    .set({
      status: "failed",
      errorMessage,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(staffSmsOutboxTable.id, id),
        eq(staffSmsOutboxTable.status, "sending"),
      ),
    );
}

export function verifyInfobipDeliveryReportSignature(input: {
  rawBody: Buffer;
  signature: string | undefined;
  secret: string;
}): boolean {
  if (!input.signature) return false;
  const supplied = input.signature.trim().replace(/^sha256=/i, "");
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac("sha256", input.secret)
    .update(input.rawBody)
    .digest();
  const actual = Buffer.from(supplied, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function applyInfobipDeliveryReport(input: {
  callbackData?: string;
  providerMessageId?: string;
  status: "delivered" | "failed";
  providerStatus: string | null;
  providerStatusGroup: string | null;
  providerStatusAt: Date;
}): Promise<boolean> {
  let attemptId: string | null = null;
  if (
    input.callbackData &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.callbackData,
    )
  ) {
    const [attempt] = await db
      .select({ id: staffSmsOutboxTable.id })
      .from(staffSmsOutboxTable)
      .where(eq(staffSmsOutboxTable.id, input.callbackData))
      .limit(1);
    attemptId = attempt?.id ?? null;
  }
  if (!attemptId && input.providerMessageId) {
    const [attempt] = await db
      .select({ id: staffSmsOutboxTable.id })
      .from(staffSmsOutboxTable)
      .where(eq(staffSmsOutboxTable.providerMessageId, input.providerMessageId))
      .limit(1);
    attemptId = attempt?.id ?? null;
  }
  if (!attemptId) return false;

  await db
    .update(staffSmsOutboxTable)
    .set({
      status: input.status,
      providerMessageId: input.providerMessageId,
      providerStatus: input.providerStatus,
      providerStatusGroup: input.providerStatusGroup,
      providerStatusAt: input.providerStatusAt,
      errorMessage: input.status === "failed"
        ? input.providerStatus ?? "Infobip reported that the message was not delivered."
        : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(staffSmsOutboxTable.id, attemptId),
        inArray(staffSmsOutboxTable.status, ["sending", "accepted"]),
      ),
    );
  return true;
}
