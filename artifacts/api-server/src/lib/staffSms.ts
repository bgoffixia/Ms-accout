import { eq } from "drizzle-orm";
import { db, staffSmsSettingsTable } from "@workspace/db";

const STAFF_SMS_SETTINGS_KEY = "global";
const SENDER_ID_PATTERN = /^[A-Za-z0-9]{3,11}$/;

export type StaffSmsConfiguration = {
  baseUrl: string;
  senderId: string;
  credentialConfigured: boolean;
  updatedAt: string | null;
};

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
  return {
    baseUrl: saved?.baseUrl ?? "",
    senderId: saved?.senderId ?? "",
    credentialConfigured: Boolean(process.env.INFOBIP_API_KEY?.trim()),
    updatedAt: saved?.updatedAt?.toISOString() ?? null,
  };
}

export async function saveStaffSmsConfiguration(
  baseUrl: string,
  senderId: string,
  updatedByUserId: string,
): Promise<StaffSmsConfiguration> {
  await db
    .insert(staffSmsSettingsTable)
    .values({
      key: STAFF_SMS_SETTINGS_KEY,
      baseUrl,
      senderId,
      updatedByUserId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: staffSmsSettingsTable.key,
      set: {
        baseUrl,
        senderId,
        updatedByUserId,
        updatedAt: new Date(),
      },
    });
  return getStaffSmsConfiguration();
}

export async function sendInfobipSms(input: {
  baseUrl: string;
  apiKey: string;
  senderId: string;
  recipientPhone: string;
  messageText: string;
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
