import {
  dispatchStaffEmail,
  emailRecipientIdempotencyKey,
  getStaffEmailConfiguration,
} from "./staffEmail";
const productionPortalUrl = "https://security-verification-portal.enroll.website";
const stepLabels = [
  "Personal information",
  "Next of kin",
  "Education",
  "Work information",
  "Identity verification",
  "Video verification",
  "Bank details",
  "Final application review",
] as const;

export type ReviewerNotificationKind =
  | "contact_received"
  | "step_saved"
  | "contact_updated"
  | "evidence_saved"
  | "application_submitted";

export interface ReviewerNotification {
  kind: ReviewerNotificationKind;
  reference: string;
  categoryName: string;
  currentStep?: number;
  applicationId?: string;
  evidenceSlot?: string;
  idempotencyKey: string;
}

function stepLabel(currentStep: number | undefined): string {
  if (currentStep === undefined) return "Enrollment";
  return stepLabels[Math.max(0, Math.min(stepLabels.length - 1, currentStep))] ?? "Enrollment";
}

function reviewerUrl(notification: ReviewerNotification): string {
  const developmentDomain = process.env.NODE_ENV === "development"
    ? process.env.REPLIT_DEV_DOMAIN
    : undefined;
  const configuredUrl = process.env.PORTAL_PUBLIC_URL?.trim();
  const baseUrl = configuredUrl
    ? configuredUrl
    : developmentDomain
      ? `https://${developmentDomain}`
      : productionPortalUrl;
  const route = notification.kind === "application_submitted" && notification.applicationId
    ? `/admin/applications/${encodeURIComponent(notification.applicationId)}`
    : "/admin/pre-applications";
  return new URL(route, `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

function notificationTitle(notification: ReviewerNotification): string {
  switch (notification.kind) {
    case "contact_received":
      return "New applicant contact details received";
    case "step_saved":
      return `Enrollment step saved: ${stepLabel(notification.currentStep)}`;
    case "contact_updated":
      return "Applicant contact details updated";
    case "evidence_saved":
      return `Enrollment evidence saved: ${notification.evidenceSlot ?? "document"}`;
    case "application_submitted":
      return "Application submitted for review";
  }
}

export async function sendReviewerNotification(
  notification: ReviewerNotification,
): Promise<void> {
  const configuration = await getStaffEmailConfiguration();
  if (!configuration.alerts[notification.kind]) return;

  const title = notificationTitle(notification);
  const link = reviewerUrl(notification);
  const subject = `${title} · ${notification.reference}`;
  const text = [
    `Application reference: ${notification.reference}`,
    `Account Provider: ${notification.categoryName}`,
    `Saved section: ${stepLabel(notification.currentStep)}`,
    "The complete application record is available in the authenticated reviewer workspace.",
    link,
  ].join("\n\n");

  const failures: string[] = [];
  for (const recipientEmail of configuration.recipients) {
    const sent = await dispatchStaffEmail({
      idempotencyKey: emailRecipientIdempotencyKey(
        `reviewer:${notification.idempotencyKey}`,
        recipientEmail,
      ),
      recipientEmail,
      subject,
      messageText: text,
      eventKind: notification.kind,
      applicationReference: notification.reference,
    });
    if (sent.status === "failed") failures.push(recipientEmail);
  }
  if (failures.length) {
    throw new Error(`Reviewer alert failed for ${failures.length} recipient(s).`);
  }
}
