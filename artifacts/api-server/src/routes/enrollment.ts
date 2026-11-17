import { clerkClient, getAuth } from "@clerk/express";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  type NextFunction,
  type Request,
  type Response,
  Router,
  type IRouter,
} from "express";
import {
  CreateSupportTicketBody,
  CreateSupportTicketResponse,
  CreateGuestPreapplicationBody,
  CreateGuestPreapplicationResponse,
  LookupGuestPreapplicationBody,
  LookupGuestPreapplicationResponse,
  AddAdminApplicationNoteBody,
  AddAdminApplicationNoteParams,
  AddAdminApplicationNoteResponse,
  AddApplicantSupportMessageBody,
  AddApplicantSupportMessageParams,
  AddApplicantSupportMessageResponse,
  AssignSupportTicketBody,
  AssignSupportTicketParams,
  AssignSupportTicketResponse,
  DecideApplicationBody,
  DecideApplicationParams,
  DecideApplicationResponse,
  GetAdminApplicationHistoryParams,
  GetAdminApplicationHistoryResponse,
  GetAdminGuestApplicationHistoryParams,
  GetAdminGuestApplicationHistoryResponse,
  GetAdminApplicationParams,
  GetAdminApplicationResponse,
  GetAdminOverviewResponse,
  GetAdminEmailSettingsResponse,
  RequestAdminEmailLogoUploadBody,
  RequestAdminEmailLogoUploadResponse,
  CompleteAdminEmailLogoUploadBody,
  CompleteAdminEmailLogoUploadResponse,
  ListAdminEmailOutboxResponse,
  ListAdminEmailTemplatesResponse,
  CreateAdminEmailTemplateBody,
  CreateAdminEmailTemplateResponse,
  UpdateAdminEmailTemplateBody,
  UpdateAdminEmailTemplateParams,
  UpdateAdminEmailTemplateResponse,
  DeleteAdminEmailTemplateParams,
  RetryAdminEmailParams,
  RetryAdminEmailResponse,
  SendAdminEmailBody,
  SendAdminEmailResponse,
  UpdateAdminEmailSettingsBody,
  UpdateAdminEmailSettingsResponse,
  GetAdminSmsSettingsResponse,
  UpdateAdminSmsSettingsBody,
  UpdateAdminSmsSettingsResponse,
  SendAdminSmsBody,
  SendAdminSmsResponse,
  ListAdminSmsActivityResponse,
  GetApplicationParams,
  GetApplicationResponse,
  GetApplicantSummaryResponse,
  GetPortalSettingsResponse,
  DeleteMyDraftsResponse,
  ClearApplicantRecordsBody,
  ClearApplicantRecordsResponse,
  ListAdminUsersQueryParams,
  ListAdminUsersResponse,
  ListApplicationsForReviewQueryParams,
  ListApplicationsForReviewResponse,
  ListAdminGuestPreapplicationsResponse,
  ListEnrollmentCategoriesResponse,
  ListMyApplicationsResponse,
  ListMySupportTicketsResponse,
  ListSupportTicketsForAdminResponse,
  ReplyToSupportTicketBody,
  ReplyToSupportTicketParams,
  ReplyToSupportTicketResponse,
  SubmitApplicationParams,
  SubmitApplicationResponse,
  SubmitApplicationBody,
  SubmitNewApplicationBody,
  SubmitNewApplicationResponse,
  LookupApplicationByTrackingKeyBody,
  LookupApplicationByTrackingKeyResponse,
  RecoverGuestTrackingKeyBody,
  RecoverGuestTrackingKeyResponse,
  RequestGuestApplicantEvidenceUploadBody,
  RequestGuestApplicantEvidenceUploadParams,
  RequestGuestApplicantEvidenceUploadResponse,
  CompleteGuestApplicantEvidenceUploadBody,
  CompleteGuestApplicantEvidenceUploadParams,
  CompleteGuestApplicantEvidenceUploadResponse,
  SubmitGuestPreapplicationBody,
  SubmitGuestPreapplicationParams,
  SubmitGuestPreapplicationResponse,
  LinkGuestPreapplicationAccountBody,
  LinkGuestPreapplicationAccountParams,
  LinkGuestPreapplicationAccountResponse,
  RequestGuestPreapplicationEvidenceUploadBody,
  RequestGuestPreapplicationEvidenceUploadParams,
  RequestGuestPreapplicationEvidenceUploadResponse,
  CompleteGuestPreapplicationEvidenceUploadParams,
  CompleteGuestPreapplicationEvidenceUploadResponse,
  DownloadGuestPreapplicationEvidenceParams,
  DownloadSubmittedApplicationEvidenceParams,
  AdminGuestPreapplicationEvidence,
  UpdateAdminGuestPreapplicationBody,
  UpdateAdminGuestPreapplicationParams,
  UpdateAdminGuestPreapplicationResponse,
  UpdateGuestPreapplicationProgressBody,
  UpdateGuestPreapplicationProgressParams,
  UpdateGuestPreapplicationProgressResponse,
  UpdateGuestPreapplicationEmailBody,
  UpdateGuestPreapplicationEmailParams,
  UpdateGuestPreapplicationEmailResponse,
  UpdateApplicationBody,
  UpdateApplicationParams,
  UpdateApplicationResponse,
  UpdateAdminUserStatusBody,
  UpdateAdminUserStatusParams,
  UpdateAdminUserStatusResponse,
  UpdateAdminUserRoleBody,
  UpdateAdminUserRoleParams,
  UpdateAdminUserRoleResponse,
  CreateApplicationDraftBody,
  CreateApplicationDraftResponse,
  CreateAdminUserInvitationBody,
  CreateAdminUserInvitationResponse,
  GetProviderInvitationCodePolicyParams,
  GetProviderInvitationCodePolicyResponse,
  ListAdminProviderInvitationCodeSettingsResponse,
  UpdateAdminProviderInvitationCodeSettingBody,
  UpdateAdminProviderInvitationCodeSettingParams,
  UpdateAdminProviderInvitationCodeSettingResponse,
  RevealAdminApplicationInvitationCodeResponse,
  RevealAdminGuestPreapplicationInvitationCodeResponse,
  CheckStaffRegistrationEmailBody,
  CheckStaffRegistrationEmailResponse,
  ClaimAllowlistedStaffAccessBody,
  ClaimAllowlistedStaffAccessResponse,
  UpdatePortalSettingsBody,
  UpdatePortalSettingsResponse,
} from "@workspace/api-zod";
import {
  applicationEventsTable,
  db,
  enrollmentApplicationsTable,
  guestPreapplicationEvidenceTable,
  guestPreapplicationsTable,
  guestPreapplicationRevisionsTable,
  invitationCodeRevealAuditTable,
  portalSettingsTable,
  providerInvitationCodeSettingAuditTable,
  providerInvitationCodeSettingsTable,
  supportTicketsTable,
  type StaffSmsOutboxRecord,
  staffEmailOutboxTable,
  staffEmailProviderEventsTable,
  staffEmailTemplatesTable,
  type StaffEmailOutboxRecord,
} from "@workspace/db";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";
import {
  generatePrivateTrackingKey,
  hashPrivateTrackingKey,
  verifyPrivateTrackingKey,
} from "../lib/privateTrackingKey";
import {
  DEFAULT_INVITATION_CODE_LENGTH,
  INVITATION_CODE_PROVIDER_IDS,
  isInvitationCodeProviderId,
  validateInvitationCode,
} from "../lib/providerInvitationCodes";
import {
  decryptInvitationCode,
  encryptInvitationCode,
  type InvitationCodeScope,
} from "../lib/invitationCodeCrypto";
import {
  applyInfobipDeliveryReport,
  createStaffSmsAttempt,
  getInfobipDeliveryReportUrl,
  getStaffSmsAttemptById,
  getStaffSmsConfiguration,
  isValidInfobipSenderId,
  listStaffSmsAttempts,
  markStaffSmsAccepted,
  markStaffSmsFailed,
  normalizeInfobipBaseUrl,
  reserveStaffSmsDailyQuota,
  saveStaffSmsConfiguration,
  sendInfobipSms,
  verifyInfobipDeliveryReportSignature,
} from "../lib/staffSms";
import { INCOMPLETE_GUEST_UPLOAD_RETENTION_MS } from "../lib/guestEvidenceCleanup";
import {
  sendReviewerNotification,
  type ReviewerNotification,
} from "../lib/reviewerNotifications";
import type { ApplicationAccessStatus } from "@workspace/api-zod";
import {
  dispatchStaffEmail,
  emailRecipientIdempotencyKey,
  getStaffEmailConfiguration,
  getWorkspaceMailboxAddress,
  isApprovedStaffSenderAddress,
  saveStaffEmailBranding,
  saveStaffEmailConfiguration,
  refreshWorkspaceEmailDeliveryStatuses,
  recordStaffEmailDeliveryEvent,
  type StaffEmailMessageKind,
} from "../lib/staffEmail";

type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "needs_information"
  | "approved"
  | "rejected";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

async function notifyEnrollmentReviewer(
  req: Request,
  notification: ReviewerNotification,
): Promise<void> {
  try {
    await sendReviewerNotification(notification);
  } catch (error) {
    req.log.error(
      {
        err: error,
        reference: notification.reference,
        event: notification.kind,
      },
      "Failed to send enrollment reviewer notification",
    );
  }
}

const categories = [
  {
    id: "category-1",
    name: "Account Provider One",
    description: "Complete the enrollment for Account Provider One.",
    accent: "green",
  },
  {
    id: "category-2",
    name: "Account Provider Two",
    description: "Complete the enrollment for Account Provider Two.",
    accent: "cobalt",
  },
  {
    id: "category-3",
    name: "Account Provider Three",
    description: "Complete the enrollment for Account Provider Three.",
    accent: "ocean",
  },
  {
    id: "category-4",
    name: "Account Provider Four",
    description: "Complete the enrollment for Account Provider Four.",
    accent: "white",
  },
] as const;

const PUBLIC_HERO_DESCRIPTION =
  "Stay safe. Stay secure. Complete your security verification to strengthen your account protection.";

const defaultPortalSettings = {
  hero: {
    title: "Protect Your Account from Hackers",
    description: PUBLIC_HERO_DESCRIPTION,
    getStartedLabel: "Start security process",
    loginLabel: "Log In",
  },
  cards: [
    {
      id: "category-1",
      title: "Account Provider One",
      description: "Complete the enrollment for Account Provider One.",
      buttonLabel: "Select Account Provider",
      backgroundColor: "#0EAD46",
      logoDataUrl: null,
      entryLogoDataUrl: null,
      cardLogoAlignment: "left",
      cardLogoVerticalOffset: 0,
      entryLogoAlignment: "center",
      entryLogoVerticalOffset: 0,
    },
    {
      id: "category-2",
      title: "Account Provider Two",
      description: "Complete the enrollment for Account Provider Two.",
      buttonLabel: "Select Account Provider",
      backgroundColor: "#0C4DA1",
      logoDataUrl: null,
      entryLogoDataUrl: null,
      cardLogoAlignment: "left",
      cardLogoVerticalOffset: 0,
      entryLogoAlignment: "center",
      entryLogoVerticalOffset: 0,
    },
    {
      id: "category-3",
      title: "Account Provider Three",
      description: "Complete the enrollment for Account Provider Three.",
      buttonLabel: "Select Account Provider",
      backgroundColor: "#0072AE",
      logoDataUrl: null,
      entryLogoDataUrl: null,
      cardLogoAlignment: "left",
      cardLogoVerticalOffset: 0,
      entryLogoAlignment: "center",
      entryLogoVerticalOffset: 0,
    },
    {
      id: "category-4",
      title: "Account Provider Four",
      description: "Complete the enrollment for Account Provider Four.",
      buttonLabel: "Select Account Provider",
      backgroundColor: "#FFFFFF",
      logoDataUrl: null,
      entryLogoDataUrl: null,
      cardLogoAlignment: "left",
      cardLogoVerticalOffset: 0,
      entryLogoAlignment: "center",
      entryLogoVerticalOffset: 0,
    },
  ],
  theme: {
    buttonSize: "standard",
    buttonPlacement: "right",
    categoryInputTransparent: true,
  },
  screenCopy: {},
  pageThemes: {},
};

type CategoryId = (typeof categories)[number]["id"];

const allowlistedStaffRoles = new Map<string, "admin" | "sub_admin">([
  ["agbodave807@gmail.com", "admin"],
  ["skyfashion053@gmail.com", "sub_admin"],
]);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function allowlistedStaffRole(email: string): "admin" | "sub_admin" | undefined {
  return allowlistedStaffRoles.get(normalizeEmail(email));
}

type ClerkStaffIdentity = {
  primaryEmailAddress?: {
    emailAddress?: string | null;
    verification?: { status?: string | null } | null;
  } | null;
  publicMetadata?: Record<string, unknown> | null;
};

function verifiedPrimaryStaffEmail(user: ClerkStaffIdentity): string | undefined {
  const primaryEmail = user.primaryEmailAddress;
  if (
    primaryEmail?.verification?.status !== "verified" ||
    typeof primaryEmail.emailAddress !== "string"
  ) {
    return undefined;
  }
  return normalizeEmail(primaryEmail.emailAddress);
}

function trustedStaffRole(
  user: ClerkStaffIdentity,
): "admin" | "sub_admin" | "moderator" | undefined {
  const email = verifiedPrimaryStaffEmail(user);
  if (!email) return undefined;

  // Admin and sub-admin are bound to the verified primary Clerk email, not to
  // mutable role metadata. Explicitly invited moderators retain their support
  // role, which is narrower and still checked on every protected route.
  const allowlistedRole = allowlistedStaffRole(email);
  if (allowlistedRole) return allowlistedRole;
  return user.publicMetadata?.role === "moderator" ? "moderator" : undefined;
}

async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (
    req.path === "/webhooks/infobip/sms" ||
    req.path === "/public/email/logo" ||
    req.path === "/public/email/footer-background"
  ) {
    next();
    return;
  }
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  try {
    const user = await clerkClient.users.getUser(userId);
    if (user.publicMetadata?.accountStatus === "suspended") {
      res.status(403).json({ error: "This account is suspended. Contact support." });
      return;
    }
    res.locals.userId = userId;
    res.locals.clerkUser = user;
    next();
  } catch (error) {
    req.log.error({ err: error, userId }, "Failed to verify applicant account status");
    res.status(503).json({ error: "Account access could not be verified." });
  }
}

async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = res.locals.userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  try {
    const user =
      res.locals.clerkUser ?? (await clerkClient.users.getUser(userId));
    const role = trustedStaffRole(user);
    if (!role) {
      res.status(403).json({ error: "Authorized staff access is required." });
      return;
    }
    res.locals.staffRole = role;
    next();
  } catch (error) {
    req.log.error({ err: error, userId }, "Failed to verify administrator role");
    res.status(503).json({ error: "Administrator access could not be verified." });
  }
}

function requireReviewer(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.locals.staffRole === "sub_admin" || res.locals.staffRole === "admin") {
    next();
    return;
  }
  res.status(403).json({ error: "Enrollment reviewer access is required." });
}

function requirePrimaryAdmin(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.locals.staffRole === "admin") {
    next();
    return;
  }
  res.status(403).json({ error: "Administrator access is required." });
}

function validatePublicImageDataUrl(value: string | null): boolean {
  if (value === null) return true;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2]!, "base64");
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) return false;
  const type = match[1];
  if (type === "png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (type === "jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

function categoryName(categoryId: string): string {
  return categories.find((category) => category.id === categoryId)?.name ?? "Enrollment";
}

const TRACKING_KEY_GENERIC_ERROR =
  "The application reference and private tracking key could not be verified.";

function guestTrackingCredentialsMatch(
  application: typeof guestPreapplicationsTable.$inferSelect | undefined,
  reference: string,
  trackingKey: string,
): application is typeof guestPreapplicationsTable.$inferSelect {
  const referenceMatches =
    application?.reference === reference.trim().toUpperCase();
  const keyMatches = verifyPrivateTrackingKey(
    referenceMatches ? application?.accessKeyHash : null,
    trackingKey,
  );
  return Boolean(application && referenceMatches && keyMatches);
}

function serializeGuestPreapplicationStatus(
  application: typeof guestPreapplicationsTable.$inferSelect,
) {
  const answers = application.answers ?? {};
  return {
    id: application.id,
    reference: application.reference,
    categoryId: application.categoryId,
    categoryName: categoryName(application.categoryId),
    fullName: application.fullName,
    email: application.email,
    status: application.status,
    submissionStatus: application.submissionStatus,
    emailVerified: application.emailVerified,
    emailVerificationRequired: false,
    linkedApplicationId: application.linkedApplicationId,
    currentStep: application.currentStep,
    detailsComplete: application.detailsComplete,
    answers: applicantSafeAnswers(answers),
    reviewStatus:
      application.submissionStatus !== "submitted"
        ? null
        : application.status === "received"
          ? "submitted"
          : application.status === "contacted"
            ? "under_review"
            : null,
    applicantFollowup: null,
    outstandingRequirements: outstandingApplicationRequirements(
      application.categoryId,
      answers,
    ),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt,
  };
}

async function serializeGuestPreapplicationStatusWithReview(
  application: typeof guestPreapplicationsTable.$inferSelect,
) {
  const status = serializeGuestPreapplicationStatus(application);
  if (!application.linkedApplicationId) return status;
  const [linkedApplication] = await db
    .select()
    .from(enrollmentApplicationsTable)
    .where(eq(enrollmentApplicationsTable.id, application.linkedApplicationId))
    .limit(1);
  if (!linkedApplication) return status;
  return {
    ...status,
    reviewStatus: linkedApplication.status,
    applicantFollowup: linkedApplication.reviewNote ?? null,
    outstandingRequirements: outstandingApplicationRequirements(
      linkedApplication.categoryId,
      linkedApplication.answers ?? {},
    ),
  };
}

function serializeApplicationAccessStatus(
  application: typeof enrollmentApplicationsTable.$inferSelect,
): ApplicationAccessStatus {
  const answers = application.answers ?? {};
  return {
    applicationId: application.id,
    reference: application.reference,
    applicationType: "enrollment_application",
    categoryId: application.categoryId as ApplicationAccessStatus["categoryId"],
    categoryName: categoryName(application.categoryId),
    status: application.status,
    submissionStatus: application.status === "draft" ? "draft" : "submitted",
    currentStep: application.currentStep,
    detailsComplete: validateFinalApplication(application.categoryId, answers, true) === null,
    updatedAt: application.updatedAt,
    reviewStatus: application.status,
    applicantFollowup: application.reviewNote ?? null,
    outstandingRequirements: outstandingApplicationRequirements(
      application.categoryId,
      answers,
    ),
  };
}

function serializeGuestAccessStatus(
  application: typeof guestPreapplicationsTable.$inferSelect,
): ApplicationAccessStatus {
  const answers = application.answers ?? {};
  const reviewStatus =
    application.submissionStatus !== "submitted"
      ? null
      : application.status === "received"
        ? "submitted"
        : application.status === "contacted"
          ? "under_review"
          : null;
  return {
    applicationId: application.id,
    reference: application.reference,
    applicationType: "guest_preapplication",
    categoryId: application.categoryId as ApplicationAccessStatus["categoryId"],
    categoryName: categoryName(application.categoryId),
    status: application.status,
    submissionStatus: application.submissionStatus,
    currentStep: application.currentStep,
    detailsComplete: application.detailsComplete,
    updatedAt: application.updatedAt,
    reviewStatus,
    applicantFollowup: null,
    outstandingRequirements: outstandingApplicationRequirements(
      application.categoryId,
      answers,
    ),
  };
}

function serializeAdminGuestPreapplication(
  application: typeof guestPreapplicationsTable.$inferSelect,
  evidence: Array<typeof guestPreapplicationEvidenceTable.$inferSelect> = [],
  history: Array<typeof guestPreapplicationRevisionsTable.$inferSelect> = [],
) {
  const uploadedEvidence = evidence.filter((item) => item.uploadedAt !== null);
  const hasIdentityFront = uploadedEvidence.some((item) => item.evidenceSlot === "identity_front");
  const hasVerificationVideo = uploadedEvidence.some(
    (item) => item.evidenceSlot === "verification_video",
  );
  return {
    ...serializeGuestPreapplicationStatus(application),
    answers: answersWithoutEvidencePaths(
      applicantSafeAnswers(application.answers ?? {}),
    ),
    fullName: application.fullName,
    email: application.email,
    phone: application.phone ?? nestedString(application.answers ?? {}, "personalInformation", "phone"),
    reviewReady:
      application.detailsComplete && hasIdentityFront && hasVerificationVideo,
    evidence: evidence.map(serializeGuestEvidence),
    history: history.map((revision) => ({
      id: revision.id,
      currentStep: revision.currentStep,
      changes: sanitizeStoredRevisionChanges(revision.changes),
      createdAt: revision.createdAt.toISOString(),
    })),
  };
}

async function serializeAdminGuestPreapplicationWithEvidence(
  application: typeof guestPreapplicationsTable.$inferSelect,
) {
  const evidence = await db
    .select()
    .from(guestPreapplicationEvidenceTable)
    .where(eq(guestPreapplicationEvidenceTable.applicationId, application.id))
    .orderBy(desc(guestPreapplicationEvidenceTable.createdAt));
  const history = await db
    .select()
    .from(guestPreapplicationRevisionsTable)
    .where(eq(guestPreapplicationRevisionsTable.applicationId, application.id))
    .orderBy(guestPreapplicationRevisionsTable.createdAt);
  return serializeAdminGuestPreapplication(application, evidence, history);
}

function revisionValue(value: unknown, field: string): string {
  if (/pin|password|passcode|access.?code|invitation.?code|reference.?code|verification.?code|otp|accountNumber|routingNumber|sortCode|iban|swift/i.test(field)) {
    return "Private value not stored";
  }
  if (field.toLowerCase().endsWith("objectpath")) {
    return value ? "Private evidence attached" : "No private evidence attached";
  }
  if (value === undefined || value === null || value === "") return "Not provided";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function collectGuestRevisionChanges(
  before: unknown,
  after: unknown,
  prefix = "",
  changes: Array<{ field: string; before: string; after: string }> = [],
) {
  const beforeIsRecord = before !== null && typeof before === "object" && !Array.isArray(before);
  const afterIsRecord = after !== null && typeof after === "object" && !Array.isArray(after);
  if (beforeIsRecord || afterIsRecord) {
    const previous = beforeIsRecord ? before as Record<string, unknown> : {};
    const current = afterIsRecord ? after as Record<string, unknown> : {};
    const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
    for (const key of keys) {
      if (
        key.startsWith("__") ||
         /pin|password|passcode|access.?code|invitation.?code|reference.?code|verification.?code|otp|accountNumber|routingNumber|sortCode|iban|swift/i.test(key)
      ) continue;
      collectGuestRevisionChanges(
        previous[key],
        current[key],
        prefix ? `${prefix}.${key}` : key,
        changes,
      );
    }
    return changes;
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    changes.push({
      field: prefix || "Application",
      before: revisionValue(before, prefix),
      after: revisionValue(after, prefix),
    });
  }
  return changes;
}

function sanitizeStoredRevisionChanges(changes: unknown) {
  if (!Array.isArray(changes)) return [];
  return changes.map((entry) => {
    const change = asRecord(entry);
    const field = typeof change.field === "string" ? change.field : "Application";
    return {
      field,
      before: revisionValue(change.before, field),
      after: revisionValue(change.after, field),
    };
  });
}

function guestRevisionChanges(
  application: typeof guestPreapplicationsTable.$inferSelect,
  answers: Record<string, unknown>,
  currentStep: number,
) {
  const previousSnapshot = {
    fullName: application.fullName,
    email: application.email,
    answers: applicantSafeAnswers(application.answers ?? {}),
  };
  const currentSnapshot = {
    fullName: application.fullName,
    email: application.email,
    answers: applicantSafeAnswers(answers),
  };
  const changes = collectGuestRevisionChanges(previousSnapshot, currentSnapshot);
  if (application.currentStep !== currentStep) {
    changes.push({
      field: "Saved progress step",
      before: String(application.currentStep + 1),
      after: String(currentStep + 1),
    });
  }
  return changes;
}

function serializeGuestEvidence(
  evidence: typeof guestPreapplicationEvidenceTable.$inferSelect,
): AdminGuestPreapplicationEvidence {
  return {
    id: evidence.id,
    evidenceType: evidence.evidenceType,
    evidenceSlot: evidence.evidenceSlot as AdminGuestPreapplicationEvidence["evidenceSlot"],
    fileName: evidence.fileName,
    contentType: evidence.contentType,
    sizeBytes: evidence.sizeBytes,
    uploadedAt: evidence.uploadedAt ?? null,
    downloadUrl: evidence.uploadedAt
      ? `/api/admin/guest-preapplications/${evidence.applicationId}/evidence/${evidence.id}/file`
      : null,
  };
}

function safeEvidenceFileName(fileName: string): string {
  return fileName.replace(/[\u0000-\u001f\u007f/\\]/g, "_").trim().slice(0, 160) || "evidence";
}

function isAllowedEvidenceType(
  evidenceType: "identity_document" | "verification_video" | "education_certificate",
  contentType: string,
  sizeBytes: number,
): boolean {
  if (evidenceType === "identity_document" || evidenceType === "education_certificate") {
    return (
      sizeBytes <= 20 * 1024 * 1024 &&
      ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(contentType)
    );
  }
  return (
    sizeBytes <= 200 * 1024 * 1024 &&
    ["video/mp4", "video/webm"].includes(contentType)
  );
}

function evidenceSignatureMatches(contentType: string, bytes: Buffer): boolean {
  switch (contentType) {
    case "application/pdf":
      return bytes.length >= 5 && bytes.toString("ascii", 0, 5) === "%PDF-";
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case "image/webp":
      return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    case "video/mp4":
      return bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp";
    case "video/webm":
      return bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    default:
      return false;
  }
}

function emailLogoSignatureMatches(contentType: string, bytes: Buffer): boolean {
  switch (contentType) {
    case "image/png":
      return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/webp":
      return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    case "image/gif":
      return bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6));
    default:
      return false;
  }
}

function answerString(answers: Record<string, unknown>, key: string): string | null {
  const value = answers[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const forbiddenCredentialAnswerKeys = new Set([
  "pin",
  "pinconfirmation",
  "pinhash",
  "pinencrypted",
  "pincode",
  "pinvalue",
  "password",
  "passwordconfirmation",
  "passwordhash",
  "passcode",
  "passcodeconfirmation",
  "accesscode",
  "accesscodeconfirmation",
  "applicantaccesscode",
  "applicantaccesscodehash",
  "otp",
  "onetimecode",
  "verificationcode",
]);

function containsCredentialAnswerKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsCredentialAnswerKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => {
    const normalizedKey = key.toLowerCase().replace(/[_\s-]/g, "");
    return forbiddenCredentialAnswerKeys.has(normalizedKey) || containsCredentialAnswerKey(child);
  });
}

function stripLegacyCredentialAnswers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripLegacyCredentialAnswers);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !forbiddenCredentialAnswerKeys.has(
        key.toLowerCase().replace(/[_\s-]/g, ""),
      ))
      .map(([key, child]) => [key, stripLegacyCredentialAnswers(child)]),
  );
}

function containsLegacyPinInput(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsLegacyPinInput);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => {
    const normalizedKey = key.toLowerCase().replace(/[_\s-]/g, "");
    return normalizedKey === "pin" ||
      normalizedKey.startsWith("pinconfirmation") ||
      normalizedKey.startsWith("pinhash") ||
      normalizedKey.startsWith("pinencrypted") ||
      containsLegacyPinInput(child);
  });
}

async function getProviderInvitationCodeLength(
  providerId: string,
): Promise<number> {
  if (!isInvitationCodeProviderId(providerId)) {
    throw new Error("Unknown account provider.");
  }
  const [setting] = await db
    .select({ requiredLength: providerInvitationCodeSettingsTable.requiredLength })
    .from(providerInvitationCodeSettingsTable)
    .where(eq(providerInvitationCodeSettingsTable.providerId, providerId))
    .limit(1);
  return setting?.requiredLength ?? DEFAULT_INVITATION_CODE_LENGTH;
}

type NormalizedInvitationCode =
  | {
      valid: true;
      ciphertext: string | null;
      clearLegacyPlaintext: boolean;
    }
  | { valid: false; error: string; unavailable: boolean };

async function normalizeInvitationCode(
  providerId: string,
  value: unknown,
  existingCiphertext: string | null | undefined,
  scope: InvitationCodeScope,
  existingLegacyPlaintext?: string | null,
): Promise<NormalizedInvitationCode> {
  if (value === undefined || value === null || value === "") {
    return {
      valid: true,
      ciphertext: existingCiphertext ?? null,
      clearLegacyPlaintext: false,
    };
  }
  const existingValue = existingCiphertext
    ? decryptInvitationCode(existingCiphertext, scope)
    : existingLegacyPlaintext ?? null;
  if (existingCiphertext && !existingValue) {
    return {
      valid: false,
      error: "Invitation Code protection is temporarily unavailable.",
      unavailable: true,
    };
  }
  try {
    const requiredLength = await getProviderInvitationCodeLength(providerId);
    const validation = validateInvitationCode(value, requiredLength, existingValue);
    if (validation.error) {
      return { valid: false, error: validation.error, unavailable: false };
    }
    if (validation.value === undefined) {
      return {
        valid: true,
        ciphertext: existingCiphertext ?? null,
        clearLegacyPlaintext: false,
      };
    }
    return {
      valid: true,
      ciphertext: encryptInvitationCode(validation.value, scope),
      clearLegacyPlaintext: true,
    };
  } catch {
    return {
      valid: false,
      error: "Invitation Code settings are temporarily unavailable.",
      unavailable: true as const,
    };
  }
}

async function guestEvidencePathsAreOwned(
  applicationId: string,
  answers: Record<string, unknown>,
): Promise<boolean> {
  const evidence = await db
    .select({
      objectPath: guestPreapplicationEvidenceTable.objectPath,
      evidenceSlot: guestPreapplicationEvidenceTable.evidenceSlot,
      uploadedAt: guestPreapplicationEvidenceTable.uploadedAt,
    })
    .from(guestPreapplicationEvidenceTable)
    .where(eq(guestPreapplicationEvidenceTable.applicationId, applicationId));
  return evidenceRowsOwnAnswers(evidence, answers);
}

function evidenceRowsOwnAnswers(
  evidence: Array<{
    objectPath: string;
    evidenceSlot: string;
    uploadedAt: Date | null;
  }>,
  answers: Record<string, unknown>,
): boolean {
  const slots: Array<[string, string, string]> = [
    ["proofOfIdentity", "frontObjectPath", "identity_front"],
    ["proofOfIdentity", "backObjectPath", "identity_back"],
    ["liveVideoRecording", "objectPath", "verification_video"],
    ["education", "certificateObjectPath", "education_certificate"],
  ];
  return slots.every(([section, key, evidenceSlot]) => {
    const value = asRecord(answers[section])[key];
    if (value === undefined || value === null || value === "") return true;
    return typeof value === "string" && evidence.some(
      (item) => item.uploadedAt !== null &&
        item.evidenceSlot === evidenceSlot &&
        item.objectPath === value,
    );
  });
}

function nestedString(
  answers: Record<string, unknown>,
  section: string,
  key: string,
): string | null {
  const value = asRecord(answers[section])[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validEmail(value: string | null): boolean {
  return value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPhone(value: string | null): boolean {
  return value !== null && /^\+?[0-9][0-9\s().-]{6,19}$/.test(value);
}

function bankEncryptionKey(): Buffer | null {
  const secret = process.env.SESSION_SECRET;
  return secret
    ? createHmac("sha256", secret).update("civic-enroll-bank-v1").digest()
    : null;
}

function encryptAccountNumber(accountNumber: string): string | null {
  const key = bankEncryptionKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(accountNumber, "utf8"),
    cipher.final(),
  ]);
  return [
    "enc:v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

function decryptAccountNumber(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("enc:v1:")) return null;
  const key = bankEncryptionKey();
  if (!key) return null;
  const [, , ivPart, tagPart, ciphertextPart] = value.split(":");
  if (!ivPart || !tagPart || !ciphertextPart) return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function prepareApplicantAnswers(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): { answers: Record<string, unknown>; error?: string } {
  const answers = { ...incoming };
  const existingBank = asRecord(existing.bankDetails);
  if (Object.hasOwn(answers, "bankDetails")) {
    const suppliedBank = asRecord(answers.bankDetails);
    const bank = { ...suppliedBank };
    const enteredAccountNumber =
      typeof suppliedBank.accountNumber === "string"
        ? suppliedBank.accountNumber.replace(/\s/g, "")
        : "";
    delete bank.accountNumber;
    delete bank.accountNumberEncrypted;
    delete bank.accountNumberLast4;
    delete bank.accountNumberMasked;

    if (enteredAccountNumber) {
      if (!/^\d{8,20}$/.test(enteredAccountNumber)) {
        return {
          answers,
          error: "Enter a valid account number using 8 to 20 digits.",
        };
      }
      const encrypted = encryptAccountNumber(enteredAccountNumber);
      if (!encrypted) {
        return {
          answers,
          error: "Bank details cannot be saved securely right now.",
        };
      }
      bank.accountNumberEncrypted = encrypted;
      bank.accountNumberLast4 = enteredAccountNumber.slice(-4);
    } else {
      if (typeof existingBank.accountNumberEncrypted === "string") {
        bank.accountNumberEncrypted = existingBank.accountNumberEncrypted;
      }
      if (typeof existingBank.accountNumberLast4 === "string") {
        bank.accountNumberLast4 = existingBank.accountNumberLast4;
      }
    }
    answers.bankDetails = bank;
  }
  if (typeof existing.__requestedSections === "object") {
    answers.__requestedSections = existing.__requestedSections;
  } else {
    delete answers.__requestedSections;
  }
  return { answers };
}

function applicantSafeAnswers(answers: Record<string, unknown>) {
  const safeAnswers = stripLegacyCredentialAnswers(structuredClone(answers)) as Record<string, unknown>;
  const bank = asRecord(safeAnswers.bankDetails);
  if (Object.keys(bank).length > 0) {
    delete bank.accountNumber;
    delete bank.accountNumberEncrypted;
    bank.accountNumberMasked =
      typeof bank.accountNumberLast4 === "string"
        ? `•••• ${bank.accountNumberLast4}`
        : null;
    delete bank.accountNumberLast4;
    safeAnswers.bankDetails = bank;
  }
  return safeAnswers;
}

function answersWithoutEvidencePaths(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(answersWithoutEvidencePaths);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !key.toLowerCase().endsWith("objectpath"))
      .map(([key, child]) => [key, answersWithoutEvidencePaths(child)]),
  );
}

function privateReviewAnswers(answers: Record<string, unknown>) {
  const result = applicantSafeAnswers(answers);
  const bank = asRecord(result.bankDetails);
  const accountNumber = decryptAccountNumber(
    asRecord(answers.bankDetails).accountNumberEncrypted,
  );
  delete bank.accountNumberMasked;
  if (accountNumber) bank.accountNumber = accountNumber;
  result.bankDetails = bank;
  return result;
}

const wizardSections = [
  "personalInformation",
  "nextOfKin",
  "education",
  "workInformation",
  "proofOfIdentity",
  "liveVideoRecording",
  "bankDetails",
] as const;

function validateFinalApplication(
  categoryId: string,
  answers: Record<string, unknown>,
  requireEvidence = true,
): string | null {
  if (!categories.some((category) => category.id === categoryId)) {
    return "The selected account provider is invalid.";
  }
  if (
    answers.categoryEntryComplete !== true ||
    !hasRequiredCategoryDetails(categoryId, answers)
  ) {
    return "Complete the selected account provider's entry form first.";
  }
  const personal = asRecord(answers.personalInformation);
  for (const [key, label] of [
    ["firstName", "first name"],
    ["surname", "surname"],
    ["dateOfBirth", "date of birth"],
    ["nationality", "nationality"],
    ["phone", "phone number"],
    ["email", "email address"],
    ["residentialAddress", "residential address"],
    ["stateRegion", "state or region"],
    ["city", "city"],
  ]) {
    if (!nestedString(answers, "personalInformation", key)) {
      return `Enter your ${label}.`;
    }
  }
  const dob = nestedString(answers, "personalInformation", "dateOfBirth");
  if (!dob || Number.isNaN(Date.parse(`${dob}T00:00:00Z`)) || dob > new Date().toISOString().slice(0, 10)) {
    return "Enter a valid date of birth that is not in the future.";
  }
  if (!validPhone(nestedString(answers, "personalInformation", "phone"))) {
    return "Enter a valid personal phone number.";
  }
  if (!validEmail(nestedString(answers, "personalInformation", "email"))) {
    return "Enter a valid email address.";
  }

  for (const [key, label] of [
    ["fullName", "full name"],
    ["relationship", "relationship"],
    ["phone", "phone number"],
  ]) {
    if (!nestedString(answers, "nextOfKin", key)) {
      return `Enter the next of kin's ${label}.`;
    }
  }
  if (!validPhone(nestedString(answers, "nextOfKin", "phone"))) {
    return "Enter a valid next-of-kin phone number.";
  }
  if (!validEmail(nestedString(answers, "nextOfKin", "email"))) {
    return "Enter a valid next-of-kin email address.";
  }

  for (const [key, label] of [
    ["highestQualification", "highest educational qualification"],
    ["institution", "institution"],
    ["courseField", "course or field of study"],
    ["startYear", "education start year"],
    ["completionYear", "education completion year"],
    ["certificationStatus", "certification status"],
  ]) {
    if (!nestedString(answers, "education", key)) {
      return `Enter your ${label}.`;
    }
  }
  const startYear = Number(nestedString(answers, "education", "startYear"));
  const completionYear = Number(nestedString(answers, "education", "completionYear"));
  const currentYear = new Date().getFullYear();
  if (
    !Number.isInteger(startYear) ||
    !Number.isInteger(completionYear) ||
    startYear < 1900 ||
    completionYear < startYear ||
    completionYear > currentYear + 10
  ) {
    return "Enter valid education years in chronological order.";
  }

  const employmentStatus = nestedString(answers, "workInformation", "employmentStatus")?.toLowerCase();
  if (!employmentStatus) return "Select your employment status.";
  if (employmentStatus === "employed") {
    if (
      !nestedString(answers, "workInformation", "occupation") ||
      !nestedString(answers, "workInformation", "employer") ||
      !nestedString(answers, "workInformation", "workAddress")
    ) {
      return "Enter your occupation, employer, and work address.";
    }
  } else if (employmentStatus === "self-employed") {
    if (
      !nestedString(answers, "workInformation", "businessName") ||
      !nestedString(answers, "workInformation", "workAddress")
    ) {
      return "Enter your business name and work address.";
    }
  } else if (!["unemployed", "not currently employed", "student", "retired", "other"].includes(employmentStatus)) {
    return "Select a valid employment status.";
  }

  if (requireEvidence) {
    const identity = asRecord(answers.proofOfIdentity);
    const documentType = nestedString(answers, "proofOfIdentity", "documentType");
    if (
      !documentType ||
      typeof identity.frontObjectPath !== "string" ||
      !identity.frontObjectPath
    ) {
      return "Complete the private proof-of-identity upload.";
    }
    if (
      ["National ID", "Driver license", "Passport card"].includes(documentType) &&
      (typeof identity.backObjectPath !== "string" || !identity.backObjectPath)
    ) {
      return "Upload the back of the selected identity document.";
    }
    const video = asRecord(answers.liveVideoRecording);
    if (
      video.consentAccepted !== true ||
      video.durationSeconds !== 12 ||
      typeof video.objectPath !== "string" ||
      !video.objectPath
    ) {
      return "Confirm a 12-second video recording and complete its private upload.";
    }
  }

  const bank = asRecord(answers.bankDetails);
  const anyBankDetails = ["bankName", "accountHolder", "accountNumberEncrypted"].some(
    (key) => typeof bank[key] === "string" && String(bank[key]).trim().length > 0,
  );
  if (
    anyBankDetails &&
    (!nestedString(answers, "bankDetails", "bankName") ||
      !nestedString(answers, "bankDetails", "accountHolder") ||
      typeof bank.accountNumberEncrypted !== "string")
  ) {
    return "Complete all bank details or leave the optional bank-details section blank.";
  }
  if (personal.gender !== undefined || personal.income !== undefined) {
    // These fields are intentionally not part of this enrollment's required data.
  }
  return null;
}

function outstandingApplicationRequirements(
  categoryId: string,
  answers: Record<string, unknown>,
): string[] {
  const missing: string[] = [];
  const sectionHas = (section: string, fields: string[]) =>
    fields.every((field) => Boolean(nestedString(answers, section, field)));

  if (
    answers.categoryEntryComplete !== true ||
    !hasRequiredCategoryDetails(categoryId, answers)
  ) missing.push("Complete the account provider entry details");
  if (!sectionHas("personalInformation", [
    "firstName", "surname", "dateOfBirth", "nationality", "phone", "email",
    "residentialAddress", "stateRegion", "city",
  ])) missing.push("Complete personal information");
  if (!sectionHas("nextOfKin", [
    "fullName", "relationship", "phone",
  ])) missing.push("Complete next-of-kin information");
  if (!sectionHas("education", [
    "highestQualification", "institution", "courseField", "startYear",
    "completionYear", "certificationStatus",
  ])) missing.push("Complete education information");

  const employmentStatus = nestedString(answers, "workInformation", "employmentStatus")?.toLowerCase();
  const workComplete = employmentStatus === "employed"
    ? sectionHas("workInformation", ["occupation", "employer", "workAddress"])
    : employmentStatus === "self-employed"
      ? sectionHas("workInformation", ["businessName", "workAddress"])
      : Boolean(employmentStatus);
  if (!workComplete) missing.push("Complete work information");

  const identity = asRecord(answers.proofOfIdentity);
  const documentType = nestedString(answers, "proofOfIdentity", "documentType");
  const needsBack = ["National ID", "Driver license", "Passport card"].includes(documentType ?? "");
  if (!documentType || !identity.frontObjectPath || (needsBack && !identity.backObjectPath)) {
    missing.push("Provide the required identity document files");
  }
  const video = asRecord(answers.liveVideoRecording);
  if (
    video.consentAccepted !== true ||
    video.durationSeconds !== 12 ||
    typeof video.objectPath !== "string" ||
    !video.objectPath
  ) missing.push("Provide the 12-second verification video");

  const bank = asRecord(answers.bankDetails);
  const anyBankDetails = ["bankName", "accountHolder", "accountNumberEncrypted", "accountType"]
    .some((field) => typeof bank[field] === "string" && String(bank[field]).trim());
  if (
    anyBankDetails &&
    (!nestedString(answers, "bankDetails", "bankName") ||
      !nestedString(answers, "bankDetails", "accountHolder") ||
      typeof bank.accountNumberEncrypted !== "string")
  ) missing.push("Complete the optional bank details or clear the partial entries");
  return missing;
}

function isPrivateStorageConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.PRIVATE_OBJECT_DIR &&
    process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID,
  );
}

function hasRequiredCategoryDetails(
  categoryId: string,
  answers: Record<string, unknown>,
): boolean {
  const requiredFields =
    categoryId === "category-1" ? ["name", "nickname"] : ["name", "surname"];
  return requiredFields.every((field) => answerString(answers, field) !== null);
}

function serializeApplication(
  application: typeof enrollmentApplicationsTable.$inferSelect,
  includeSensitiveBankDetails = false,
  hideEvidenceObjectPaths = false,
) {
  const answers = application.answers ?? {};
  const contactDetails = asRecord(answers.contactDetails);
  const applicantAnswers = includeSensitiveBankDetails
    ? privateReviewAnswers(answers)
    : applicantSafeAnswers(answers);
  const personalInformation = asRecord(answers.personalInformation);
  return {
    id: application.id,
    reference: application.reference,
    categoryId: application.categoryId,
    categoryName: categoryName(application.categoryId),
    status: application.status,
    currentStep: application.currentStep,
    answers: hideEvidenceObjectPaths
      ? answersWithoutEvidencePaths(applicantAnswers)
      : applicantAnswers,
    applicantName:
      (typeof contactDetails.fullName === "string"
        ? contactDetails.fullName
        : null) ??
      answerString(answers, "fullName") ??
      ([
        answerString(answers, "name") ??
          (typeof personalInformation.firstName === "string"
            ? personalInformation.firstName
            : null),
        answerString(answers, "surname") ??
          (typeof personalInformation.surname === "string"
            ? personalInformation.surname
            : null),
      ]
        .filter(Boolean)
        .join(" ") ||
        null),
    applicantEmail:
      (typeof contactDetails.email === "string"
        ? contactDetails.email
        : null) ??
      answerString(answers, "email") ??
      (typeof personalInformation.email === "string"
        ? personalInformation.email
        : null),
    reviewNote: application.reviewNote,
    applicantFollowup: application.reviewNote,
    outstandingRequirements: outstandingApplicationRequirements(
      application.categoryId,
      answers,
    ),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
    submittedAt: application.submittedAt?.toISOString() ?? null,
  };
}

function serializeTicket(
  ticket: typeof supportTicketsTable.$inferSelect,
  applicationReference: string | null = null,
) {
  return {
    id: ticket.id,
    applicantUserId: ticket.clerkUserId,
    applicationId: ticket.applicationId,
    applicationReference,
    subject: ticket.subject,
    category: ticket.category,
    message: ticket.message,
    messages: ticket.messages ?? [],
    assignedToUserId: ticket.assignedToUserId,
    status: ticket.status,
    response: ticket.response,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

async function loadPortalSettings() {
  const [record] = await db
    .select({ value: portalSettingsTable.value })
    .from(portalSettingsTable)
    .where(eq(portalSettingsTable.key, "portal"))
    .limit(1);
  const settings = GetPortalSettingsResponse.parse(record?.value ?? defaultPortalSettings);
  const providerNames = ["One", "Two", "Three", "Four"] as const;
  for (const card of settings.cards) {
    const categoryIndex = Number(card.id.replace("category-", "")) - 1;
    const number = providerNames[categoryIndex];
    if (!number) continue;
    if (card.title === `Enrollment Category ${number}`) {
      card.title = `Account Provider ${number}`;
    }
    if (card.description === `Complete the registration process for Category ${number}.`) {
      card.description = `Complete the enrollment for Account Provider ${number}.`;
    }
    if (card.buttonLabel === "Select Category") {
      card.buttonLabel = "Select Account Provider";
    }
  }
  const dashboardCopy = settings.screenCopy?.dashboard;
  if (dashboardCopy?.title === "Choose an enrollment category.") {
    dashboardCopy.title = "Choose an account provider.";
  }
  if (dashboardCopy?.description === "Select a category to continue.") {
    dashboardCopy.description = "Select an account provider to continue.";
  }
  if (dashboardCopy?.sectionIdLabel === "ENROLLMENT CATEGORIES") {
    dashboardCopy.sectionIdLabel = "ACCOUNT PROVIDERS";
  }
  for (const [index, number] of providerNames.entries()) {
    const entryCopy = settings.screenCopy?.[`category-entry-${index + 1}`];
    if (entryCopy?.title === `Category ${number}`) {
      entryCopy.title = `Account Provider ${number}`;
    }
    if (entryCopy?.sectionIdLabel === "ENROLLMENT CATEGORY") {
      entryCopy.sectionIdLabel = "ACCOUNT PROVIDER";
    }
    if (entryCopy?.nameLabel === "Category entry name") {
      entryCopy.nameLabel = "Account Provider entry name";
    }
    if (entryCopy) {
      entryCopy.referenceCodeVisible =
        entryCopy.referenceCodeVisible === "false" ? "false" : "true";
      entryCopy.referenceCodeLabel = "Invitation Code";
    }
  }
  const previousHeroDefaults = {
    title: "Security",
    description: "We protect systems, data, and users through strong controls and monitoring.",
    buttonLabel: "Get Started",
  };
  if (settings.hero.title === previousHeroDefaults.title) settings.hero.title = defaultPortalSettings.hero.title;
  if (settings.hero.description === previousHeroDefaults.description) {
    settings.hero.description = defaultPortalSettings.hero.description;
  }
  if (settings.hero.getStartedLabel === previousHeroDefaults.buttonLabel) {
    settings.hero.getStartedLabel = defaultPortalSettings.hero.getStartedLabel;
  }
  const legacyTitle = "Welcome to the Secure Path. Authorized Security Verification System. Vanuatu - enrollment Portal";
  const legacyDescription = "Proceed with your informations and enroll your personal identity and credential authentication / encrypted safety verification.";

  if (settings.hero.title === legacyTitle) settings.hero.title = defaultPortalSettings.hero.title;
  if (settings.hero.description === legacyDescription) {
    settings.hero.description = defaultPortalSettings.hero.description;
  }
  const landingCopy = settings.screenCopy?.landing;
  if (landingCopy?.title === previousHeroDefaults.title) {
    landingCopy.title = defaultPortalSettings.hero.title;
  }
  if (landingCopy?.description === previousHeroDefaults.description) {
    landingCopy.description = defaultPortalSettings.hero.description;
  }
  if (landingCopy?.buttonLabel === previousHeroDefaults.buttonLabel) {
    landingCopy.buttonLabel = defaultPortalSettings.hero.getStartedLabel;
  }
  if (landingCopy?.title === legacyTitle) landingCopy.title = defaultPortalSettings.hero.title;
  if (landingCopy?.description === legacyDescription) {
    landingCopy.description = defaultPortalSettings.hero.description;
  }
  // Preserve administrator-configured landing copy. Public responses are read-only;
  // only the primary-admin settings endpoint can change these values.
  return settings;
}

router.get("/portal/settings", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    res.json(await loadPortalSettings());
  } catch (error) {
    req.log.error({ err: error }, "Failed to load portal settings");
    res.status(503).json({ error: "Portal settings are temporarily unavailable." });
  }
});

router.get("/invitation-code-settings/:providerId", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const params = GetProviderInvitationCodePolicyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Choose a valid account provider." });
    return;
  }
  try {
    res.json(
      GetProviderInvitationCodePolicyResponse.parse({
        providerId: params.data.providerId,
        requiredLength: await getProviderInvitationCodeLength(params.data.providerId),
      }),
    );
  } catch (error) {
    req.log.error(
      { err: error, providerId: params.data.providerId },
      "Failed to load provider Invitation Code policy",
    );
    res.status(503).json({ error: "Invitation Code requirements are temporarily unavailable." });
  }
});

router.get("/enrollment/categories", (_req, res): void => {
  res.json(ListEnrollmentCategoriesResponse.parse(categories));
});

router.post("/guest/preapplications", async (req, res): Promise<void> => {
  if (containsLegacyPinInput(req.body)) {
    res.status(400).json({ error: "Legacy PIN inputs are no longer accepted." });
    return;
  }
  const parsed = CreateGuestPreapplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the application details and try again." });
    return;
  }
  const input = {
    ...parsed.data,
    fullName: parsed.data.fullName.trim(),
    email: parsed.data.email.trim().toLowerCase(),
    phone: parsed.data.phone?.trim() || null,
  };
  if (input.fullName.length < 2) {
    res.status(400).json({ error: "Enter your full name." });
    return;
  }

  const matchesRequest = (
    existing: typeof guestPreapplicationsTable.$inferSelect,
  ) => verifyPrivateTrackingKey(existing.accessKeyHash, input.trackingKey) &&
    existing.categoryId === input.categoryId &&
    existing.fullName === input.fullName &&
    existing.email === input.email &&
    existing.phone === input.phone;

  try {
    const [existing] = await db
      .select()
      .from(guestPreapplicationsTable)
      .where(eq(guestPreapplicationsTable.submissionId, input.submissionId))
      .limit(1);
    if (existing) {
      if (!(await matchesRequest(existing))) {
        res.status(409).json({ error: "This submission request has already been used." });
        return;
      }
      res.status(200).json(
        CreateGuestPreapplicationResponse.parse(
          {
            ...serializeGuestPreapplicationStatus(existing),
            trackingKey: input.trackingKey,
          },
        ),
      );
      return;
    }

    const [created] = await db
      .insert(guestPreapplicationsTable)
      .values({
        submissionId: input.submissionId,
        reference: `PRE-${randomBytes(6).toString("hex").toUpperCase()}`,
        accessKeyHash: hashPrivateTrackingKey(input.trackingKey),
        categoryId: input.categoryId,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      const [concurrentSubmission] = await db
        .select()
        .from(guestPreapplicationsTable)
        .where(eq(guestPreapplicationsTable.submissionId, input.submissionId))
        .limit(1);
      if (concurrentSubmission && matchesRequest(concurrentSubmission)) {
        res.status(200).json(
          CreateGuestPreapplicationResponse.parse(
            {
              ...serializeGuestPreapplicationStatus(concurrentSubmission),
              trackingKey: input.trackingKey,
            },
          ),
        );
        return;
      }
      res.status(409).json({ error: "This submission request has already been used." });
      return;
    }

    await notifyEnrollmentReviewer(req, {
      kind: "contact_received",
      reference: created.reference,
      categoryName: categoryName(created.categoryId),
      currentStep: created.currentStep,
      idempotencyKey: `guest-contact:${created.id}`,
    });
    res.status(201).json(
      CreateGuestPreapplicationResponse.parse(
        {
          ...serializeGuestPreapplicationStatus(created),
          trackingKey: input.trackingKey,
        },
      ),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to create guest pre-application");
    res.status(503).json({ error: "Guest applications are temporarily unavailable." });
  }
});

router.patch("/guest/preapplications/:applicationId", async (req, res): Promise<void> => {
  if (containsLegacyPinInput(req.body)) {
    res.status(400).json({ error: "Legacy PIN inputs are no longer accepted." });
    return;
  }
  const parsedParams = UpdateGuestPreapplicationProgressParams.safeParse(req.params);
  const parsedBody = UpdateGuestPreapplicationProgressBody.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Check the application progress and try again." });
    return;
  }

  try {
    const [application] = await db
      .select()
      .from(guestPreapplicationsTable)
      .where(eq(guestPreapplicationsTable.id, parsedParams.data.applicationId))
      .limit(1);
    const referenceMatches = application?.reference === parsedBody.data.reference.trim().toUpperCase();
    if (
      !application ||
      !referenceMatches ||
      !verifyPrivateTrackingKey(
        referenceMatches ? application.accessKeyHash : null,
        parsedBody.data.trackingKey,
      )
    ) {
      res.status(404).json({ error: TRACKING_KEY_GENERIC_ERROR });
      return;
    }
    if (application.status === "closed" || application.submissionStatus === "submitted") {
      res.status(409).json({ error: "This guest application has already been submitted or closed." });
      return;
    }
    const normalizedReferenceCode = await normalizeInvitationCode(
      application.categoryId,
      parsedBody.data.referenceCode,
      application.invitationCodeCiphertext,
      `guest:${application.id}`,
      application.referenceCode,
    );
    if (!normalizedReferenceCode.valid) {
      res
        .status(normalizedReferenceCode.unavailable ? 503 : 400)
        .json({ error: normalizedReferenceCode.error });
      return;
    }
    if (containsCredentialAnswerKey(parsedBody.data.answers)) {
      res.status(400).json({ error: "PINs and passwords cannot be saved as application answers." });
      return;
    }
    if (!(await guestEvidencePathsAreOwned(application.id, parsedBody.data.answers))) {
      res.status(400).json({ error: "Attach evidence using the private upload form before saving its reference." });
      return;
    }

    const prepared = prepareApplicantAnswers(
      application.answers ?? {},
      parsedBody.data.answers,
    );
    if (prepared.error) {
      res.status(400).json({ error: prepared.error });
      return;
    }
    const currentStep = parsedBody.data.currentStep;
    const changes = guestRevisionChanges(
      application,
      prepared.answers,
      currentStep,
    );
    const detailsComplete =
      validateFinalApplication(application.categoryId, prepared.answers, true) === null;
    const updated = await db.transaction(async (transaction) => {
      const [row] = await transaction
        .update(guestPreapplicationsTable)
        .set({
          currentStep,
          answers: prepared.answers,
          detailsComplete,
          invitationCodeCiphertext: normalizedReferenceCode.ciphertext,
          ...(normalizedReferenceCode.clearLegacyPlaintext
            ? { referenceCode: null }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(guestPreapplicationsTable.id, application.id))
        .returning();
      if (row && changes.length) {
        await transaction.insert(guestPreapplicationRevisionsTable).values({
          applicationId: application.id,
          currentStep,
          changes,
        });
      }
      return row;
    });
    if (!updated) {
      res.status(404).json({ error: "Guest application not found." });
      return;
    }
    if (changes.length > 0) {
      await notifyEnrollmentReviewer(req, {
        kind: "step_saved",
        reference: updated.reference,
        categoryName: categoryName(updated.categoryId),
        currentStep: updated.currentStep,
        idempotencyKey: `guest-step:${updated.id}:${updated.updatedAt.getTime()}`,
      });
    }
    res.json(
      UpdateGuestPreapplicationProgressResponse.parse(
        serializeGuestPreapplicationStatus(updated),
      ),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to save guest application progress");
    res.status(503).json({ error: "Guest application progress could not be saved." });
  }
});

router.post("/guest/preapplications/lookup", async (req, res): Promise<void> => {
  const parsed = LookupGuestPreapplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(404).json({ error: TRACKING_KEY_GENERIC_ERROR });
    return;
  }
  try {
    const [application] = await db
      .select()
      .from(guestPreapplicationsTable)
      .where(eq(
        guestPreapplicationsTable.reference,
        parsed.data.reference.trim().toUpperCase(),
      ))
      .limit(1);
    if (!guestTrackingCredentialsMatch(
      application,
      parsed.data.reference,
      parsed.data.trackingKey,
    )) {
      res.status(404).json({ error: TRACKING_KEY_GENERIC_ERROR });
      return;
    }
    res.json(
      LookupGuestPreapplicationResponse.parse(
        await serializeGuestPreapplicationStatusWithReview(application),
      ),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to restore a guest application");
    res.status(503).json({ error: "Guest application is temporarily unavailable." });
  }
});

router.post("/applications/tracking/lookup", async (req, res): Promise<void> => {
  const parsed = LookupApplicationByTrackingKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(404).json({ error: TRACKING_KEY_GENERIC_ERROR });
    return;
  }

  try {
    const [application] = await db
      .select()
      .from(guestPreapplicationsTable)
      .where(eq(
        guestPreapplicationsTable.reference,
        parsed.data.reference.trim().toUpperCase(),
      ))
      .limit(1);
    if (!guestTrackingCredentialsMatch(
      application,
      parsed.data.reference,
      parsed.data.trackingKey,
    )) {
      res.status(404).json({ error: TRACKING_KEY_GENERIC_ERROR });
      return;
    }

    if (application.linkedApplicationId) {
      const [linkedApplication] = await db
        .select()
        .from(enrollmentApplicationsTable)
        .where(eq(
          enrollmentApplicationsTable.id,
          application.linkedApplicationId,
        ))
        .limit(1);
      if (linkedApplication) {
        res.json(
          LookupApplicationByTrackingKeyResponse.parse(
            serializeApplicationAccessStatus(linkedApplication),
          ),
        );
        return;
      }
    }
    res.json(
      LookupApplicationByTrackingKeyResponse.parse(
        serializeGuestAccessStatus(application),
      ),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to look up application with its private tracking key");
    res.status(503).json({ error: "Application status is temporarily unavailable." });
  }
});

router.patch(
  "/guest/preapplications/:applicationId/email",
  async (req, res): Promise<void> => {
    const parsedParams = UpdateGuestPreapplicationEmailParams.safeParse(req.params);
    const parsedBody = UpdateGuestPreapplicationEmailBody.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
      res.status(400).json({ error: "Enter a valid contact email and try again." });
      return;
    }

    try {
      const [application] = await db
        .select()
        .from(guestPreapplicationsTable)
        .where(eq(guestPreapplicationsTable.id, parsedParams.data.applicationId))
        .limit(1);
      const referenceMatches = application?.reference === parsedBody.data.reference.trim().toUpperCase();
      if (
        !application ||
        !referenceMatches ||
        !verifyPrivateTrackingKey(
          referenceMatches ? application.accessKeyHash : null,
          parsedBody.data.trackingKey,
        )
      ) {
        res.status(404).json({ error: TRACKING_KEY_GENERIC_ERROR });
        return;
      }
      if (application.status === "closed" || application.submissionStatus === "submitted") {
        res.status(409).json({ error: "This guest application has already been submitted or closed." });
        return;
      }

      const email = normalizeEmail(parsedBody.data.email);
      const answers = structuredClone(application.answers ?? {});
      answers.personalInformation = {
        ...asRecord(answers.personalInformation),
        email,
      };
      const changes = guestRevisionChanges(
        application,
        answers,
        application.currentStep,
      );
      const updated = await db.transaction(async (transaction) => {
        const [row] = await transaction
          .update(guestPreapplicationsTable)
          .set({ email, answers, updatedAt: new Date() })
          .where(and(
            eq(guestPreapplicationsTable.id, application.id),
            eq(guestPreapplicationsTable.submissionStatus, "draft"),
            ne(guestPreapplicationsTable.status, "closed"),
          ))
          .returning();
        if (row && changes.length) {
          await transaction.insert(guestPreapplicationRevisionsTable).values({
            applicationId: application.id,
            currentStep: application.currentStep,
            changes,
          });
        }
        return row;
      });
      if (!updated) {
        res.status(409).json({ error: "This guest application has already been submitted or closed." });
        return;
      }
      if (changes.length > 0) {
        await notifyEnrollmentReviewer(req, {
          kind: "contact_updated",
          reference: updated.reference,
          categoryName: categoryName(updated.categoryId),
          currentStep: updated.currentStep,
          idempotencyKey: `guest-contact-update:${updated.id}:${updated.updatedAt.getTime()}`,
        });
      }
      res.json(
        UpdateGuestPreapplicationEmailResponse.parse(
          serializeGuestPreapplicationStatus(updated),
        ),
      );
    } catch (error) {
      req.log.error({ err: error }, "Failed to update guest applicant email");
      res.status(503).json({ error: "The contact email could not be updated." });
    }
  },
);

router.post(
  "/guest/preapplications/:applicationId/evidence/upload-url",
  async (req, res): Promise<void> => {
    const parsedParams = RequestGuestApplicantEvidenceUploadParams.safeParse(req.params);
    const parsedBody = RequestGuestApplicantEvidenceUploadBody.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
      res.status(400).json({ error: "Choose a supported evidence file and try again." });
      return;
    }
    const { evidenceType, evidenceSlot, contentType, sizeBytes } = parsedBody.data;
    const expectedType = evidenceSlot === "verification_video"
      ? "verification_video"
      : evidenceSlot === "education_certificate"
        ? "education_certificate"
        : "identity_document";
    if (evidenceType !== expectedType || !isAllowedEvidenceType(evidenceType, contentType, sizeBytes)) {
      res.status(400).json({
        error: evidenceType === "verification_video"
          ? "Verification videos must be MP4 or WebM files no larger than 200 MB."
          : "Documents must be PDF, JPEG, PNG, or WebP files no larger than 20 MB.",
      });
      return;
    }

    try {
      const [application] = await db
        .select()
        .from(guestPreapplicationsTable)
        .where(eq(guestPreapplicationsTable.id, parsedParams.data.applicationId))
        .limit(1);
      const referenceMatches = application?.reference === parsedBody.data.reference.trim().toUpperCase();
      if (
        !application ||
        !referenceMatches ||
        !verifyPrivateTrackingKey(
          referenceMatches ? application.accessKeyHash : null,
          parsedBody.data.trackingKey,
        )
      ) {
        res.status(404).json({ error: TRACKING_KEY_GENERIC_ERROR });
        return;
      }
      if (application.status === "closed" || application.submissionStatus === "submitted") {
        res.status(409).json({ error: "Evidence cannot be added to a submitted or closed application." });
        return;
      }
      if (!isPrivateStorageConfigured()) {
        res.status(503).json({ error: "Private evidence storage is unavailable." });
        return;
      }

      const existingEvidence = await db
        .select()
        .from(guestPreapplicationEvidenceTable)
        .where(eq(guestPreapplicationEvidenceTable.applicationId, application.id));
      const evidenceCount = existingEvidence.filter((item) =>
        item.evidenceType === evidenceType,
      ).length;
      if (evidenceCount >= 5) {
        res.status(409).json({ error: "The evidence upload limit has been reached for this application." });
        return;
      }

      const uploadUrl = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadUrl);
      if (!objectPath.startsWith("/objects/")) {
        throw new Error("Storage returned an invalid private object path.");
      }
      const uploadExpiresAt = new Date(Date.now() + INCOMPLETE_GUEST_UPLOAD_RETENTION_MS);
      const [record] = await db
        .insert(guestPreapplicationEvidenceTable)
        .values({
          applicationId: application.id,
          evidenceType,
          evidenceSlot,
          fileName: safeEvidenceFileName(parsedBody.data.fileName),
          contentType,
          sizeBytes,
          objectPath,
          uploadedByUserId: null,
          uploadExpiresAt,
        })
        .returning();
      if (!record) throw new Error("Evidence upload record could not be created.");
      res.json(RequestGuestApplicantEvidenceUploadResponse.parse({
        evidenceId: record.id,
        uploadUrl,
      }));
    } catch (error) {
      req.log.error({ err: error }, "Failed to prepare private applicant evidence upload");
      res.status(503).json({ error: "A secure evidence upload could not be prepared." });
    }
  },
);

router.post(
  "/guest/preapplications/:applicationId/evidence/:evidenceId/complete",
  async (req, res): Promise<void> => {
    const parsedParams = CompleteGuestApplicantEvidenceUploadParams.safeParse(req.params);
    const parsedBody = CompleteGuestApplicantEvidenceUploadBody.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
      res.status(400).json({ error: "Evidence could not be verified." });
      return;
    }
    const { applicationId, evidenceId } = parsedParams.data;
    try {
      const [application] = await db
        .select()
        .from(guestPreapplicationsTable)
        .where(eq(guestPreapplicationsTable.id, applicationId))
        .limit(1);
      const referenceMatches = application?.reference === parsedBody.data.reference.trim().toUpperCase();
      if (
        !application ||
        !referenceMatches ||
        !verifyPrivateTrackingKey(
          referenceMatches ? application.accessKeyHash : null,
          parsedBody.data.trackingKey,
        )
      ) {
        res.status(404).json({ error: TRACKING_KEY_GENERIC_ERROR });
        return;
      }
      if (application.status === "closed" || application.submissionStatus === "submitted") {
        res.status(409).json({ error: "Evidence cannot be added to a submitted or closed application." });
        return;
      }
      const [evidence] = await db
        .select()
        .from(guestPreapplicationEvidenceTable)
        .where(and(
          eq(guestPreapplicationEvidenceTable.id, evidenceId),
          eq(guestPreapplicationEvidenceTable.applicationId, applicationId),
          isNull(guestPreapplicationEvidenceTable.uploadedByUserId),
        ))
        .limit(1);
      if (!evidence) {
        res.status(404).json({ error: "Evidence upload not found." });
        return;
      }
      let completed = evidence;
      if (!evidence.uploadedAt) {
        const objectFile = await objectStorage.getObjectEntityFile(evidence.objectPath);
        const [metadata] = await objectFile.getMetadata();
        if (Number(metadata.size) !== evidence.sizeBytes || metadata.contentType !== evidence.contentType) {
          await objectFile.delete({ ignoreNotFound: true }).catch(() => undefined);
          await db.delete(guestPreapplicationEvidenceTable)
            .where(eq(guestPreapplicationEvidenceTable.id, evidence.id));
          res.status(400).json({ error: "The uploaded file did not match its declared type or size." });
          return;
        }
        const [signatureBytes] = await objectFile.download({
          start: 0,
          end: Math.min(evidence.sizeBytes - 1, 31),
        });
        if (!evidenceSignatureMatches(evidence.contentType, signatureBytes)) {
          await objectFile.delete({ ignoreNotFound: true }).catch(() => undefined);
          await db.delete(guestPreapplicationEvidenceTable)
            .where(eq(guestPreapplicationEvidenceTable.id, evidence.id));
          res.status(400).json({ error: "The uploaded file content is not a supported evidence format." });
          return;
        }
        const [updatedEvidence] = await db
          .update(guestPreapplicationEvidenceTable)
          .set({ uploadedAt: new Date(), uploadExpiresAt: null })
          .where(eq(guestPreapplicationEvidenceTable.id, evidence.id))
          .returning();
        if (!updatedEvidence) {
          res.status(404).json({ error: "Evidence upload not found." });
          return;
        }
        completed = updatedEvidence;
      }

      const answerLocation: Partial<Record<string, [string, string]>> = {
        identity_front: ["proofOfIdentity", "frontObjectPath"],
        identity_back: ["proofOfIdentity", "backObjectPath"],
        verification_video: ["liveVideoRecording", "objectPath"],
        education_certificate: ["education", "certificateObjectPath"],
      };
      const location = answerLocation[completed.evidenceSlot];
      if (!location) {
        res.status(400).json({ error: "The evidence is not linked to a supported application field." });
        return;
      }
      const answers = structuredClone(application.answers ?? {});
      const section = asRecord(answers[location[0]]);
      answers[location[0]] = { ...section, [location[1]]: completed.objectPath };
      const changes = guestRevisionChanges(
        application,
        answers,
        application.currentStep,
      );
      await db.transaction(async (transaction) => {
        await transaction
          .update(guestPreapplicationsTable)
          .set({ answers, updatedAt: new Date() })
          .where(eq(guestPreapplicationsTable.id, application.id));
        if (changes.length) {
          await transaction.insert(guestPreapplicationRevisionsTable).values({
            applicationId: application.id,
            currentStep: application.currentStep,
            changes,
          });
        }
      });
      if (changes.length > 0) {
        await notifyEnrollmentReviewer(req, {
          kind: "evidence_saved",
          reference: application.reference,
          categoryName: categoryName(application.categoryId),
          currentStep: application.currentStep,
          evidenceSlot: completed.evidenceSlot.replaceAll("_", " "),
          idempotencyKey: `guest-evidence:${application.id}:${completed.id}:${completed.uploadedAt?.getTime() ?? "saved"}`,
        });
      }
      res.json(CompleteGuestApplicantEvidenceUploadResponse.parse({
        evidenceId: completed.id,
        evidenceType: completed.evidenceType,
        evidenceSlot: completed.evidenceSlot,
        fileName: completed.fileName,
        objectPath: completed.objectPath,
        uploadedAt: completed.uploadedAt,
      }));
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(409).json({ error: "Upload the selected file before recording it." });
        return;
      }
      req.log.error({ err: error, applicationId, evidenceId }, "Failed to verify applicant evidence upload");
      res.status(503).json({ error: "The evidence file could not be verified." });
    }
  },
);

router.post("/staff/registration-check", (req, res): void => {
  const submittedEmail =
    req.body && typeof req.body.email === "string"
      ? req.body.email.trim()
      : req.body?.email;
  const parsed = CheckStaffRegistrationEmailBody.safeParse({
    ...req.body,
    email: submittedEmail,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(
    CheckStaffRegistrationEmailResponse.parse({
      allowed: Boolean(allowlistedStaffRole(parsed.data.email)),
      ...(allowlistedStaffRole(parsed.data.email) ? { role: allowlistedStaffRole(parsed.data.email) } : {}),
    }),
  );
});

router.post(
  "/guest/preapplications/:applicationId/submit",
  async (req, res): Promise<void> => {
    if (containsLegacyPinInput(req.body)) {
      res.status(400).json({ error: "Legacy PIN inputs are no longer accepted." });
      return;
    }
    const parsedParams = SubmitGuestPreapplicationParams.safeParse(req.params);
    const parsedBody = SubmitGuestPreapplicationBody.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
      res.status(400).json({ error: "The saved application could not be submitted." });
      return;
    }

    try {
      const [preapplication] = await db
        .select()
        .from(guestPreapplicationsTable)
        .where(eq(guestPreapplicationsTable.id, parsedParams.data.applicationId))
        .limit(1);
      const referenceMatches = preapplication?.reference === parsedBody.data.reference.trim().toUpperCase();
      if (
        !preapplication ||
        !referenceMatches ||
        !verifyPrivateTrackingKey(
          referenceMatches ? preapplication.accessKeyHash : null,
          parsedBody.data.trackingKey,
        )
      ) {
        res.status(404).json({ error: TRACKING_KEY_GENERIC_ERROR });
        return;
      }
      if (preapplication.status === "closed") {
        res.status(409).json({ error: "This application was closed and cannot be submitted." });
        return;
      }
      if (!(await guestEvidencePathsAreOwned(preapplication.id, preapplication.answers ?? {}))) {
        res.status(400).json({ error: "One or more evidence references are not attached to this application." });
        return;
      }

      const now = new Date();
      const result = await db.transaction(async (transaction) => {
        const [current] = await transaction
          .select()
          .from(guestPreapplicationsTable)
          .where(eq(guestPreapplicationsTable.id, preapplication.id))
          .for("update")
          .limit(1);
        if (!current || current.status === "closed") return { application: null, changed: false };
        if (current.submissionStatus === "submitted") {
          return { application: current, changed: false };
        }
        if (current.linkedApplicationId) {
          return { application: null, changed: false };
        }

        const [updated] = await transaction
          .update(guestPreapplicationsTable)
          .set({
            submissionStatus: "submitted",
            currentStep: 7,
            updatedAt: now,
          })
          .where(and(
            eq(guestPreapplicationsTable.id, current.id),
            eq(guestPreapplicationsTable.submissionStatus, "draft"),
            isNull(guestPreapplicationsTable.linkedApplicationId),
          ))
          .returning();
        if (updated) {
          await transaction.insert(guestPreapplicationRevisionsTable).values({
            applicationId: updated.id,
            currentStep: 7,
            changes: [{
              field: "Submission",
              before: "Not submitted",
                after: "Submitted by applicant",
            }],
          });
        }
        return { application: updated ?? null, changed: Boolean(updated) };
      });

      if (!result.application) {
        res.status(409).json({ error: "The application could not be submitted. Refresh and try again." });
        return;
      }
      if (result.changed) {
        await notifyEnrollmentReviewer(req, {
          kind: "application_submitted",
          reference: result.application.reference,
          categoryName: categoryName(result.application.categoryId),
          currentStep: result.application.currentStep,
          idempotencyKey: `guest-submit:${result.application.id}`,
        });
      }
      res.json(
        SubmitGuestPreapplicationResponse.parse(
          await serializeGuestPreapplicationStatusWithReview(result.application),
        ),
      );
    } catch (error) {
      req.log.error({ err: error, applicationId: parsedParams.data.applicationId }, "Failed to submit guest application");
      res.status(503).json({ error: "The application could not be submitted. Your saved draft remains available." });
    }
  },
);

router.use(authenticate);

router.post(
  "/guest/preapplications/tracking-key/recover",
  async (req, res): Promise<void> => {
    const parsed = RecoverGuestTrackingKeyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(404).json({ error: TRACKING_KEY_GENERIC_ERROR });
      return;
    }
    const userId = res.locals.userId as string | undefined;
    if (!userId) {
      res.status(401).json({
        error: "Sign in with the verified email used for the application to recover its tracking key.",
      });
      return;
    }

    try {
      const user = res.locals.clerkUser ?? await clerkClient.users.getUser(userId);
      const primaryEmail = user.primaryEmailAddress;
      const normalizedEmail = primaryEmail?.emailAddress
        ? normalizeEmail(primaryEmail.emailAddress)
        : "";
      if (!normalizedEmail || primaryEmail?.verification?.status !== "verified") {
        res.status(403).json({
          error: "Verify the email address used for the application before recovering its tracking key.",
        });
        return;
      }

      const normalizedReference = parsed.data.reference.trim().toUpperCase();
      const [application] = await db
        .select()
        .from(guestPreapplicationsTable)
        .where(eq(guestPreapplicationsTable.reference, normalizedReference))
        .limit(1);
      if (
        !application ||
        application.email !== normalizedEmail
      ) {
        res.status(404).json({ error: TRACKING_KEY_GENERIC_ERROR });
        return;
      }

      const trackingKey = generatePrivateTrackingKey();
      const [updated] = await db
        .update(guestPreapplicationsTable)
        .set({
          // This explicit, verified-email action replaces the previous key;
          // no plaintext or recoverable copy of either key is retained.
          accessKeyHash: hashPrivateTrackingKey(trackingKey),
          updatedAt: new Date(),
        })
        .where(and(
          eq(guestPreapplicationsTable.id, application.id),
          application.accessKeyHash
            ? eq(guestPreapplicationsTable.accessKeyHash, application.accessKeyHash)
            : isNull(guestPreapplicationsTable.accessKeyHash),
        ))
        .returning({ id: guestPreapplicationsTable.id });
      if (!updated) {
        res.status(404).json({ error: TRACKING_KEY_GENERIC_ERROR });
        return;
      }
      res.json(RecoverGuestTrackingKeyResponse.parse({ trackingKey }));
    } catch (error) {
      req.log.error({ err: error }, "Failed to replace a guest tracking key");
      res.status(503).json({ error: "The tracking key could not be recovered right now." });
    }
  },
);

router.post(
  "/guest/preapplications/:applicationId/link",
  async (req, res): Promise<void> => {
    if (containsLegacyPinInput(req.body)) {
      res.status(400).json({ error: "Legacy PIN inputs are no longer accepted." });
      return;
    }
    const parsedParams = LinkGuestPreapplicationAccountParams.safeParse(req.params);
    const parsedBody = LinkGuestPreapplicationAccountBody.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
      res.status(400).json({ error: "The saved application could not be submitted." });
      return;
    }
    const userId = res.locals.userId as string | undefined;
    if (!userId) {
      res.status(401).json({ error: "Verify your email and sign in to view application status." });
      return;
    }

    try {
      const user = res.locals.clerkUser ?? (await clerkClient.users.getUser(userId));
      const primaryEmail = user.primaryEmailAddress;
      const normalizedEmail = primaryEmail?.emailAddress
        ? normalizeEmail(primaryEmail.emailAddress)
        : "";
      if (!normalizedEmail || primaryEmail?.verification?.status !== "verified") {
        res.status(403).json({ error: "Verify your email address before opening application status." });
        return;
      }

      const [preapplication] = await db
        .select()
        .from(guestPreapplicationsTable)
        .where(eq(guestPreapplicationsTable.id, parsedParams.data.applicationId))
        .limit(1);
      const referenceMatches = preapplication?.reference === parsedBody.data.reference.trim().toUpperCase();
      if (
        !preapplication ||
        !referenceMatches ||
        !verifyPrivateTrackingKey(
          referenceMatches ? preapplication.accessKeyHash : null,
          parsedBody.data.trackingKey,
        )
      ) {
        res.status(404).json({ error: TRACKING_KEY_GENERIC_ERROR });
        return;
      }
      if (preapplication.email !== normalizedEmail) {
        res.status(403).json({ error: "Sign in with the verified email address used to start this application." });
        return;
      }
      if (preapplication.status === "closed") {
        res.status(409).json({ error: "This application was closed and cannot be submitted." });
        return;
      }

      if (preapplication.submissionStatus === "submitted") {
        if (
          preapplication.emailVerified &&
          preapplication.clerkUserId === userId &&
          preapplication.linkedApplicationId
        ) {
          const [existingApplication] = await db
            .select()
            .from(enrollmentApplicationsTable)
            .where(and(
              eq(enrollmentApplicationsTable.id, preapplication.linkedApplicationId),
              eq(enrollmentApplicationsTable.clerkUserId, userId),
            ))
            .limit(1);
          if (existingApplication) {
            res.json(LinkGuestPreapplicationAccountResponse.parse(serializeApplication(existingApplication)));
            return;
          }
        }
        if (preapplication.linkedApplicationId || preapplication.clerkUserId) {
          res.status(409).json({ error: "This application is already linked to another account." });
          return;
        }
      } else {
        res.status(409).json({ error: "Submit the application before verifying email for status access." });
        return;
      }
      const answers = preapplication.answers ?? {};
      if (!(await guestEvidencePathsAreOwned(preapplication.id, answers))) {
        res.status(400).json({ error: "One or more evidence references are not attached to this application." });
        return;
      }

      const now = new Date();
      const submitted = await db.transaction(async (transaction) => {
        const [currentPreapplication] = await transaction
          .select()
          .from(guestPreapplicationsTable)
          .where(eq(guestPreapplicationsTable.id, preapplication.id))
          .for("update")
          .limit(1);
        if (
          !currentPreapplication ||
          currentPreapplication.submissionStatus !== "submitted" ||
          currentPreapplication.email !== normalizedEmail ||
          currentPreapplication.linkedApplicationId
        ) return null;

        const currentAnswers = currentPreapplication.answers ?? {};
        const currentEvidence = await transaction
          .select({
            objectPath: guestPreapplicationEvidenceTable.objectPath,
            evidenceSlot: guestPreapplicationEvidenceTable.evidenceSlot,
            uploadedAt: guestPreapplicationEvidenceTable.uploadedAt,
          })
          .from(guestPreapplicationEvidenceTable)
          .where(eq(guestPreapplicationEvidenceTable.applicationId, preapplication.id));
        if (!evidenceRowsOwnAnswers(currentEvidence, currentAnswers)) return null;
        const reviewAnswers = {
          ...currentAnswers,
          contactDetails: {
            fullName: currentPreapplication.fullName,
            email: currentPreapplication.email,
            phone: currentPreapplication.phone,
            emailVerified: true,
          },
          __requestedSections: [],
        };

        const [created] = await transaction
          .insert(enrollmentApplicationsTable)
          .values({
            reference: preapplication.reference,
            clerkUserId: userId,
            sourceGuestPreapplicationId: preapplication.id,
            categoryId: preapplication.categoryId,
            status: "submitted",
            currentStep: 7,
            // Invitation Code remains on the guest source record and is
            // retrieved only through the separately authorized reveal route.
            referenceCode: null,
            answers: reviewAnswers,
            submittedAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing({ target: enrollmentApplicationsTable.sourceGuestPreapplicationId })
          .returning();

        let application = created;
        if (!application) {
          const [existing] = await transaction
            .select()
            .from(enrollmentApplicationsTable)
            .where(eq(enrollmentApplicationsTable.sourceGuestPreapplicationId, preapplication.id))
            .limit(1);
          if (!existing || existing.clerkUserId !== userId) return null;
          application = existing;
        } else {
          await transaction.insert(applicationEventsTable).values({
            applicationId: application.id,
            actorUserId: userId,
            eventType: "guest_email_verified",
            note: "Applicant verified their email and linked the submitted guest application.",
          });
        }

        await transaction
          .update(guestPreapplicationsTable)
          .set({
            emailVerified: true,
            clerkUserId: userId,
            linkedApplicationId: application.id,
            updatedByUserId: userId,
            updatedAt: now,
          })
          .where(and(
            eq(guestPreapplicationsTable.id, preapplication.id),
            eq(guestPreapplicationsTable.submissionStatus, "submitted"),
            isNull(guestPreapplicationsTable.linkedApplicationId),
          ));
        return application;
      });

      if (!submitted) {
        res.status(409).json({ error: "The application could not be linked to this account. Refresh and try again." });
        return;
      }
      res.json(LinkGuestPreapplicationAccountResponse.parse(serializeApplication(submitted)));
    } catch (error) {
      req.log.error({ err: error, applicationId: parsedParams.data.applicationId }, "Failed to submit verified guest application");
      res.status(503).json({ error: "The application could not be submitted. Your saved draft remains available." });
    }
  },
);

router.post("/staff/access-claim", async (req, res): Promise<void> => {
  const parsedBody = ClaimAllowlistedStaffAccessBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: "Choose the appropriate staff sign-in route." });
    return;
  }
  const userId = res.locals.userId as string;
  const user = res.locals.clerkUser;
  const primaryEmail = user?.primaryEmailAddress;
  const normalizedEmail = primaryEmail?.emailAddress
    ? normalizeEmail(primaryEmail.emailAddress)
    : "";
  const allowlistedRole = allowlistedStaffRole(normalizedEmail);
  const assignedRole =
    allowlistedRole ??
    (user?.publicMetadata?.role === "moderator" ? "moderator" : undefined);

  if (
    !normalizedEmail ||
    primaryEmail?.verification?.status !== "verified" ||
    !assignedRole ||
    (parsedBody.data.entrypoint === "admin" && assignedRole !== "admin") ||
    (parsedBody.data.entrypoint === "staff" &&
      !["sub_admin", "moderator"].includes(assignedRole))
  ) {
    res.status(403).json({
      error: "This verified email is not authorized for staff registration.",
    });
    return;
  }

  try {
    if (allowlistedRole && user.publicMetadata?.role !== allowlistedRole) {
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          role: allowlistedRole,
        },
      });
    }
    res.json(
      ClaimAllowlistedStaffAccessResponse.parse({
        role: assignedRole,
        message: "Staff access activated.",
      }),
    );
  } catch (error) {
    req.log.error({ err: error, userId }, "Failed to activate allowlisted staff access");
    res.status(503).json({ error: "Staff access could not be activated." });
  }
});

router.post("/applications/drafts", async (req, res): Promise<void> => {
  if (containsLegacyPinInput(req.body)) {
    res.status(400).json({ error: "Legacy PIN inputs are no longer accepted." });
    return;
  }
  const parsed = CreateApplicationDraftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const reference = `ENR-${randomBytes(8).toString("hex").toUpperCase()}`;
  try {
    const created = await db.transaction(async (transaction) => {
      const [application] = await transaction
        .insert(enrollmentApplicationsTable)
        .values({
          clerkUserId: res.locals.userId,
          categoryId: parsed.data.categoryId,
          reference,
          status: "draft",
          currentStep: 0,
          answers: {},
        })
        .returning();
      if (!application) return undefined;
      await transaction.insert(applicationEventsTable).values({
        applicationId: application.id,
        actorUserId: res.locals.userId,
        eventType: "applicant_draft_created",
        note: "Application draft created.",
      });
      return application;
    });
    if (!created) {
      res.status(500).json({ error: "The application draft could not be created." });
      return;
    }
    res.status(201).json(
      CreateApplicationDraftResponse.parse(serializeApplication(created)),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to create application draft");
    res.status(503).json({ error: "The application draft could not be created." });
  }
});

router.get("/me/applications", async (req, res): Promise<void> => {
  const applications = await db
    .select()
    .from(enrollmentApplicationsTable)
    .where(eq(enrollmentApplicationsTable.clerkUserId, res.locals.userId))
    .orderBy(desc(enrollmentApplicationsTable.updatedAt));
  res.json(ListMyApplicationsResponse.parse(applications.map((application) => serializeApplication(application))));
});

router.delete("/me/drafts", async (_req, res): Promise<void> => {
  const deleted = await db
    .delete(enrollmentApplicationsTable)
    .where(
      and(
        eq(enrollmentApplicationsTable.clerkUserId, res.locals.userId),
        eq(enrollmentApplicationsTable.status, "draft"),
      ),
    )
    .returning({ id: enrollmentApplicationsTable.id });
  res.json(DeleteMyDraftsResponse.parse({ deletedCount: deleted.length }));
});

router.post("/applications/submit", async (req, res): Promise<void> => {
  if (containsLegacyPinInput(req.body)) {
    res.status(400).json({ error: "Legacy PIN inputs are no longer accepted." });
    return;
  }
  const parsed = SubmitNewApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const categoryId = parsed.data.categoryId as CategoryId;
  const reference = `ENR-${parsed.data.submissionId.toUpperCase()}`;
  const [existing] = await db
    .select()
    .from(enrollmentApplicationsTable)
    .where(eq(enrollmentApplicationsTable.reference, reference))
    .limit(1);
  if (existing) {
    if (existing.clerkUserId !== res.locals.userId || existing.status !== "submitted") {
      res.status(409).json({ error: "This submission request has already been used." });
      return;
    }
    res.json(SubmitNewApplicationResponse.parse(serializeApplication(existing)));
    return;
  }

  if (containsCredentialAnswerKey(parsed.data.answers)) {
    res.status(400).json({
      error: "Credential values cannot be saved as application answers.",
    });
    return;
  }
  const applicationId = randomUUID();
  const normalizedReferenceCode = await normalizeInvitationCode(
    categoryId,
    parsed.data.referenceCode,
    null,
    `application:${applicationId}`,
  );
    if (!normalizedReferenceCode.valid) {
    res
      .status(normalizedReferenceCode.unavailable ? 503 : 400)
      .json({ error: normalizedReferenceCode.error });
    return;
  }

  const prepared = prepareApplicantAnswers({}, parsed.data.answers);
  if (prepared.error) {
    res.status(400).json({ error: prepared.error });
    return;
  }
  const answers = { ...prepared.answers, __requestedSections: [] };
  const validationError = validateFinalApplication(categoryId, answers);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }
  if (!isPrivateStorageConfigured()) {
    res.status(503).json({
      error: "Secure document and video storage is unavailable. The application was not submitted.",
      code: "PRIVATE_UPLOAD_STORAGE_UNAVAILABLE",
    });
    return;
  }

  const now = new Date();
  const outcome = await db.transaction(async (transaction) => {
    const [duplicate] = await transaction
      .select()
      .from(enrollmentApplicationsTable)
      .where(eq(enrollmentApplicationsTable.reference, reference))
      .limit(1);
    if (duplicate) return { application: duplicate, created: false };

    const [created] = await transaction
      .insert(enrollmentApplicationsTable)
      .values({
        id: applicationId,
        clerkUserId: res.locals.userId,
        categoryId,
        reference,
        status: "submitted",
        currentStep: 7,
            invitationCodeCiphertext: normalizedReferenceCode.ciphertext,
            referenceCode: null,
        answers,
        submittedAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: enrollmentApplicationsTable.reference })
      .returning();
    if (!created) {
      const [conflict] = await transaction
        .select()
        .from(enrollmentApplicationsTable)
        .where(eq(enrollmentApplicationsTable.reference, reference))
        .limit(1);
      return { application: conflict ?? null, created: false };
    }
    await transaction.insert(applicationEventsTable).values({
      applicationId: created.id,
      actorUserId: res.locals.userId,
      eventType: "application_submitted",
      note: "Submitted for review.",
    });
    return { application: created, created: true };
  });
  if (
    !outcome.application ||
    outcome.application.clerkUserId !== res.locals.userId ||
    outcome.application.status !== "submitted"
  ) {
    res.status(409).json({ error: "This submission request could not be completed." });
    return;
  }
  res
    .status(outcome.created ? 201 : 200)
    .json(SubmitNewApplicationResponse.parse(serializeApplication(outcome.application)));
});

router.get("/applications/:applicationId", async (req, res): Promise<void> => {
  const params = GetApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [application] = await db
    .select()
    .from(enrollmentApplicationsTable)
    .where(
      and(
        eq(enrollmentApplicationsTable.id, params.data.applicationId),
        eq(enrollmentApplicationsTable.clerkUserId, res.locals.userId),
      ),
    )
    .limit(1);
  if (!application) {
    res.status(404).json({ error: "Application not found." });
    return;
  }
  res.json(GetApplicationResponse.parse(serializeApplication(application)));
});

router.patch("/applications/:applicationId", async (req, res): Promise<void> => {
  if (containsLegacyPinInput(req.body)) {
    res.status(400).json({ error: "Legacy PIN inputs are no longer accepted." });
    return;
  }
  const params = UpdateApplicationParams.safeParse(req.params);
  const parsed = UpdateApplicationBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({
      error: !params.success
        ? params.error.message
        : parsed.success
          ? "Invalid request."
          : parsed.error.message,
    });
    return;
  }

  const [application] = await db
    .select()
    .from(enrollmentApplicationsTable)
    .where(
      and(
        eq(enrollmentApplicationsTable.id, params.data.applicationId),
        eq(enrollmentApplicationsTable.clerkUserId, res.locals.userId),
      ),
    )
    .limit(1);
  if (!application) {
    res.status(404).json({ error: "Application not found." });
    return;
  }
  if (!["draft", "needs_information"].includes(application.status)) {
    res.status(409).json({ error: "This application is locked against ordinary edits." });
    return;
  }

  const nextCategoryId = parsed.data.categoryId;
  const categoryChanged = Boolean(
    nextCategoryId && nextCategoryId !== application.categoryId,
  );
  const normalizedReferenceCode = await normalizeInvitationCode(
    categoryChanged ? (nextCategoryId ?? application.categoryId) : application.categoryId,
    parsed.data.referenceCode,
    categoryChanged ? null : application.invitationCodeCiphertext,
    `application:${application.id}`,
    categoryChanged ? null : application.referenceCode,
  );
  if (!normalizedReferenceCode.valid) {
    res
      .status(normalizedReferenceCode.unavailable ? 503 : 400)
      .json({ error: normalizedReferenceCode.error });
    return;
  }
  const invitationCodeCiphertext = categoryChanged
    ? null
    : normalizedReferenceCode.ciphertext;
  if (application.status === "needs_information" && nextCategoryId) {
    res.status(403).json({
      error: "An application under correction cannot change its selected account provider.",
    });
    return;
  }
  if (
    categoryChanged &&
    (parsed.data.answers !== undefined || parsed.data.referenceCode !== undefined)
  ) {
    res.status(400).json({
      error: "Change the account provider separately before editing the new application.",
    });
    return;
  }
  if (parsed.data.answers && containsCredentialAnswerKey(parsed.data.answers)) {
    res.status(400).json({
      error: "Credential values cannot be saved as application answers.",
    });
    return;
  }
  let submittedAnswers = parsed.data.answers;
  if (submittedAnswers && application.status === "needs_information") {
    const requested = application.answers?.__requestedSections;
    const requestedSections = Array.isArray(requested)
      ? requested.filter(
          (index): index is number =>
            Number.isInteger(index) && index >= 0 && index <= 6,
        )
      : [];
    if (requestedSections.length === 0) {
      res.status(403).json({
        error: "No application sections have been reopened for correction.",
      });
      return;
    }
    const changedSections = Object.keys(submittedAnswers).filter((key) => {
      if (key === "__requestedSections") return false;
      return JSON.stringify(submittedAnswers?.[key]) !==
        JSON.stringify(application.answers?.[key]);
    });
    const unauthorizedChange = changedSections.some((key) => {
      const sectionIndex = wizardSections.indexOf(
        key as (typeof wizardSections)[number],
      );
      return sectionIndex < 0 || !requestedSections.includes(sectionIndex);
    });
    if (unauthorizedChange) {
      res.status(403).json({
        error: "Only sections specifically reopened by a reviewer can be changed.",
      });
      return;
    }
  }
  let nextAnswers = submittedAnswers ?? application.answers ?? {};
  if (!categoryChanged && submittedAnswers) {
    const prepared = prepareApplicantAnswers(
      application.answers ?? {},
      submittedAnswers,
    );
    if (prepared.error) {
      res.status(400).json({ error: prepared.error });
      return;
    }
    nextAnswers = prepared.answers;
    submittedAnswers = nextAnswers;
  }
  const entryIsComplete = nextAnswers.categoryEntryComplete === true;
  if (
    submittedAnswers?.categoryEntryComplete === true &&
    !hasRequiredCategoryDetails(application.categoryId, nextAnswers)
  ) {
    res.status(400).json({
      error: "Enter all required account provider details before continuing.",
    });
    return;
  }
  if (entryIsComplete && !hasRequiredCategoryDetails(application.categoryId, nextAnswers)) {
    res.status(400).json({
      error: "Enter all required account provider details before saving this application.",
    });
    return;
  }
  const notificationStep = parsed.data.currentStep ?? application.currentStep;
  const shouldNotifyReviewer =
    categoryChanged ||
    notificationStep !== application.currentStep ||
    (submittedAnswers !== undefined &&
      JSON.stringify(submittedAnswers) !== JSON.stringify(application.answers ?? {})) ||
    invitationCodeCiphertext !== (application.invitationCodeCiphertext ?? null);
  const updated = await db.transaction(async (transaction) => {
    const [applicationRow] = await transaction
      .update(enrollmentApplicationsTable)
      .set({
        ...(parsed.data.currentStep !== undefined
          ? { currentStep: parsed.data.currentStep }
          : {}),
        ...(categoryChanged
          ? {
              categoryId: nextCategoryId,
              answers: {},
              currentStep: 0,
            }
          : {}),
        ...(!categoryChanged && submittedAnswers !== undefined
          ? { answers: submittedAnswers }
          : {}),
        invitationCodeCiphertext,
        ...(categoryChanged || normalizedReferenceCode.clearLegacyPlaintext
          ? { referenceCode: null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(enrollmentApplicationsTable.id, params.data.applicationId))
      .returning();
    if (!applicationRow) return undefined;
    if (categoryChanged && nextCategoryId) {
      await transaction.insert(applicationEventsTable).values({
        applicationId: applicationRow.id,
        actorUserId: res.locals.userId,
        eventType: "category_changed",
        note: `${categoryName(application.categoryId)} → ${categoryName(nextCategoryId)}`,
      });
    } else if (
      parsed.data.answers !== undefined ||
      parsed.data.currentStep !== undefined
    ) {
      const savedPosition = parsed.data.currentStep ?? application.currentStep;
      const note =
        submittedAnswers?.categoryEntryComplete === true && savedPosition === 0
          ? "Account Provider details and Invitation Code saved."
          : savedPosition === 7
            ? "Final review saved."
            : `Applicant saved progress through step ${Math.max(1, savedPosition)} of 8.`;
      await transaction.insert(applicationEventsTable).values({
        applicationId: applicationRow.id,
        actorUserId: res.locals.userId,
        eventType: "applicant_step_saved",
        note,
      });
    }
    return applicationRow;
  });
  if (!updated) {
    res.status(500).json({ error: "The application could not be saved." });
    return;
  }
  if (shouldNotifyReviewer) {
    await notifyEnrollmentReviewer(req, {
      kind: "step_saved",
      reference: updated.reference,
      categoryName: categoryName(updated.categoryId),
      currentStep: updated.currentStep,
      applicationId: updated.id,
      idempotencyKey: `application-step:${updated.id}:${updated.updatedAt.getTime()}`,
    });
  }
  res.json(UpdateApplicationResponse.parse(serializeApplication(updated)));
});

router.post("/applications/:applicationId/submit", async (req, res): Promise<void> => {
  if (containsLegacyPinInput(req.body)) {
    res.status(400).json({ error: "Legacy PIN inputs are no longer accepted." });
    return;
  }
  const params = SubmitApplicationParams.safeParse(req.params);
  const body = SubmitApplicationBody.safeParse(req.body ?? {});
  if (!params.success || !body.success) {
    res.status(400).json({
      error: !params.success ? params.error.message : body.success ? "Invalid request." : body.error.message,
    });
    return;
  }
  const [application] = await db
    .select()
    .from(enrollmentApplicationsTable)
    .where(
      and(
        eq(enrollmentApplicationsTable.id, params.data.applicationId),
        eq(enrollmentApplicationsTable.clerkUserId, res.locals.userId),
      ),
    )
    .limit(1);
  if (!application) {
    res.status(404).json({ error: "Application not found." });
    return;
  }
  if (application.status === "submitted") {
    res.json(SubmitApplicationResponse.parse(serializeApplication(application)));
    return;
  }
  if (!["draft", "needs_information"].includes(application.status)) {
    res.status(409).json({ error: "This application has already been submitted." });
    return;
  }

  let answers = application.answers ?? {};
  const normalizedReferenceCode = await normalizeInvitationCode(
    application.categoryId,
    body.data.referenceCode,
    application.invitationCodeCiphertext,
    `application:${application.id}`,
    application.referenceCode,
  );
  if (!normalizedReferenceCode.valid) {
    res
      .status(normalizedReferenceCode.unavailable ? 503 : 400)
      .json({ error: normalizedReferenceCode.error });
    return;
  }
  const invitationCodeCiphertext = normalizedReferenceCode.ciphertext;
  if (application.status === "draft") {
    if (body.data.categoryId && body.data.categoryId !== application.categoryId) {
      res.status(409).json({
        error: "The selected account provider changed. Refresh the application before submitting.",
      });
      return;
    }
    if (body.data.answers) {
      if (containsCredentialAnswerKey(body.data.answers)) {
        res.status(400).json({
          error: "Credential values cannot be saved as application answers.",
        });
        return;
      }
      const prepared = prepareApplicantAnswers(application.answers ?? {}, body.data.answers);
      if (prepared.error) {
        res.status(400).json({ error: prepared.error });
        return;
      }
      answers = prepared.answers;
    }
  }
  if (application.status === "needs_information" && application.currentStep < 7) {
    res.status(400).json({ error: "Complete all eight enrollment stages first." });
    return;
  }
  const validationError = validateFinalApplication(application.categoryId, answers);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }
  if (!isPrivateStorageConfigured()) {
    res.status(503).json({
      error:
        "Secure document and video storage is unavailable. The application was not submitted.",
      code: "PRIVATE_UPLOAD_STORAGE_UNAVAILABLE",
    });
    return;
  }

  const now = new Date();
  const submitted = await db.transaction(async (transaction) => {
    const [row] = await transaction
      .update(enrollmentApplicationsTable)
      .set({
        status: "submitted",
        answers: { ...answers, __requestedSections: [] },
        currentStep: 7,
        invitationCodeCiphertext,
        ...(normalizedReferenceCode.clearLegacyPlaintext
          ? { referenceCode: null }
          : {}),
        submittedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(enrollmentApplicationsTable.id, params.data.applicationId),
          eq(enrollmentApplicationsTable.clerkUserId, res.locals.userId),
          eq(enrollmentApplicationsTable.categoryId, application.categoryId),
          eq(enrollmentApplicationsTable.status, application.status),
        ),
      )
      .returning();
    if (!row) return null;
    await transaction.insert(applicationEventsTable).values({
      applicationId: row.id,
      actorUserId: res.locals.userId,
      eventType: `status_changed:${application.status}->submitted`,
      note:
        application.status === "needs_information"
          ? application.reviewNote
          : "Submitted for review.",
    });
    return row;
  });
  if (!submitted) {
    res.status(409).json({
      error: "The application changed while it was being submitted. Refresh and try again.",
    });
    return;
  }
  await notifyEnrollmentReviewer(req, {
    kind: "application_submitted",
    reference: submitted.reference,
    categoryName: categoryName(submitted.categoryId),
    currentStep: submitted.currentStep,
    applicationId: submitted.id,
    idempotencyKey: `application-submit:${submitted.id}`,
  });
  res.json(SubmitApplicationResponse.parse(serializeApplication(submitted)));
});

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const applications = await db
    .select({ status: enrollmentApplicationsTable.status })
    .from(enrollmentApplicationsTable)
    .where(eq(enrollmentApplicationsTable.clerkUserId, res.locals.userId));
  const summary = {
    total: applications.length,
    drafts: applications.filter((application) => application.status === "draft").length,
    inReview: applications.filter((application) =>
      ["submitted", "under_review"].includes(application.status),
    ).length,
    approved: applications.filter((application) => application.status === "approved").length,
    needsAttention: applications.filter(
      (application) => application.status === "needs_information",
    ).length,
  };
  res.json(GetApplicantSummaryResponse.parse(summary));
});

router.get("/support/tickets", async (_req, res): Promise<void> => {
  const tickets = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.clerkUserId, res.locals.userId))
    .orderBy(desc(supportTicketsTable.updatedAt));
  const applications = await db.select({
    id: enrollmentApplicationsTable.id,
    reference: enrollmentApplicationsTable.reference,
  }).from(enrollmentApplicationsTable);
  const references = new Map(applications.map((application) => [application.id, application.reference]));
  res.json(
    ListMySupportTicketsResponse.parse(
      tickets.map((ticket) =>
        serializeTicket(ticket, ticket.applicationId ? references.get(ticket.applicationId) ?? null : null),
      ),
    ),
  );
});

router.post("/support/tickets", async (req, res): Promise<void> => {
  const parsed = CreateSupportTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const applicationId = parsed.data.applicationId ?? null;
  let applicationReference: string | null = null;
  if (applicationId) {
    const [application] = await db
      .select({ id: enrollmentApplicationsTable.id })
      .from(enrollmentApplicationsTable)
      .where(
        and(
          eq(enrollmentApplicationsTable.id, applicationId),
          eq(enrollmentApplicationsTable.clerkUserId, res.locals.userId),
        ),
      )
      .limit(1);
    if (!application) {
      res.status(404).json({ error: "Application not found." });
      return;
    }
    const [record] = await db
      .select({ reference: enrollmentApplicationsTable.reference })
      .from(enrollmentApplicationsTable)
      .where(eq(enrollmentApplicationsTable.id, applicationId))
      .limit(1);
    applicationReference = record?.reference ?? null;
  }
  const createdAt = new Date().toISOString();
  const firstMessage = {
    id: randomUUID(),
    actorUserId: res.locals.userId as string,
    actorRole: "applicant" as const,
    body: parsed.data.message.trim(),
    createdAt,
  };
  const [created] = await db
    .insert(supportTicketsTable)
    .values({
      clerkUserId: res.locals.userId,
      applicationId,
      subject: parsed.data.subject,
      category: parsed.data.category,
      message: parsed.data.message,
      messages: [firstMessage],
    })
    .returning();
  if (!created) {
    res.status(500).json({ error: "The support request could not be created." });
    return;
  }
  res.status(201).json(
    CreateSupportTicketResponse.parse(
      serializeTicket(created, applicationReference),
    ),
  );
});

router.post(
  "/support/tickets/:ticketId/messages",
  async (req, res): Promise<void> => {
    const params = AddApplicantSupportMessageParams.safeParse(req.params);
    const parsed = AddApplicantSupportMessageBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success ? params.error.message : (parsed.error?.message ?? "Invalid request body"),
      });
      return;
    }
    const [ticket] = await db
      .select()
      .from(supportTicketsTable)
      .where(
        and(
          eq(supportTicketsTable.id, params.data.ticketId),
          eq(supportTicketsTable.clerkUserId, res.locals.userId),
        ),
      )
      .limit(1);
    if (!ticket) {
      res.status(404).json({ error: "Support request not found." });
      return;
    }
    if (["resolved", "closed"].includes(ticket.status)) {
      res.status(409).json({
        error: "This support request is resolved. Start a new request if needed.",
      });
      return;
    }
    const [updated] = await db
      .update(supportTicketsTable)
      .set({
        messages: [
          ...(ticket.messages ?? []),
          {
            id: randomUUID(),
            actorUserId: res.locals.userId,
            actorRole: "applicant",
            body: parsed.data.message.trim(),
            createdAt: new Date().toISOString(),
          },
        ],
        status: "open",
        updatedByUserId: res.locals.userId,
        updatedAt: new Date(),
      })
      .where(eq(supportTicketsTable.id, ticket.id))
      .returning();
    if (!updated) {
      res.status(500).json({ error: "Your message could not be saved." });
      return;
    }
    let reference: string | null = null;
    if (updated.applicationId) {
      const [application] = await db
        .select({ reference: enrollmentApplicationsTable.reference })
        .from(enrollmentApplicationsTable)
        .where(eq(enrollmentApplicationsTable.id, updated.applicationId))
        .limit(1);
      reference = application?.reference ?? null;
    }
    res.status(201).json(
      AddApplicantSupportMessageResponse.parse(
        serializeTicket(updated, reference),
      ),
    );
  },
);
router.use("/admin", requireAdmin);

router.get("/admin/invitation-code-settings", requirePrimaryAdmin, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const rows = await db
      .select()
      .from(providerInvitationCodeSettingsTable);
    const settingsByProvider = new Map(
      rows.map((row) => [row.providerId, row]),
    );
    res.json(
      ListAdminProviderInvitationCodeSettingsResponse.parse({
        providers: INVITATION_CODE_PROVIDER_IDS.map((providerId) => {
          const setting = settingsByProvider.get(providerId);
          return {
            providerId,
            requiredLength: setting?.requiredLength ?? DEFAULT_INVITATION_CODE_LENGTH,
            updatedAt: setting?.updatedAt.toISOString() ?? null,
          };
        }),
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to load provider Invitation Code settings");
    res.status(503).json({ error: "Invitation Code settings are temporarily unavailable." });
  }
});

router.put(
  "/admin/invitation-code-settings/:providerId",
  requirePrimaryAdmin,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const params = UpdateAdminProviderInvitationCodeSettingParams.safeParse(req.params);
    const body = UpdateAdminProviderInvitationCodeSettingBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Choose a provider and a length from 4 to 12 digits." });
      return;
    }

    const { providerId } = params.data;
    const { requiredLength } = body.data;
    const actorUserId = res.locals.userId as string;
    try {
      const saved = await db.transaction(async (transaction) => {
        await transaction.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`invitation-code-length:${providerId}`}))`,
        );
        const [previous] = await transaction
          .select()
          .from(providerInvitationCodeSettingsTable)
          .where(eq(providerInvitationCodeSettingsTable.providerId, providerId))
          .for("update")
          .limit(1);
        const previousLength =
          previous?.requiredLength ?? DEFAULT_INVITATION_CODE_LENGTH;
        if (previousLength === requiredLength) {
          return {
            providerId,
            requiredLength: previousLength,
            updatedAt: previous?.updatedAt ?? null,
          };
        }

        const now = new Date();
        const [record] = await transaction
          .insert(providerInvitationCodeSettingsTable)
          .values({
            providerId,
            requiredLength,
            updatedByUserId: actorUserId,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: providerInvitationCodeSettingsTable.providerId,
            set: {
              requiredLength,
              updatedByUserId: actorUserId,
              updatedAt: now,
            },
          })
          .returning();
        if (!record) throw new Error("Provider setting was not persisted.");

        await transaction
          .insert(providerInvitationCodeSettingAuditTable)
          .values({
            actorUserId,
            providerId,
            previousLength,
            newLength: requiredLength,
            changedAt: now,
          });

        return {
          providerId,
          requiredLength: record.requiredLength,
          updatedAt: record.updatedAt,
        };
      });
      res.json(
        UpdateAdminProviderInvitationCodeSettingResponse.parse({
          ...saved,
          updatedAt: saved.updatedAt?.toISOString() ?? null,
        }),
      );
    } catch (error) {
      req.log.error(
        { err: error, providerId, actorUserId },
        "Failed to save provider Invitation Code settings",
      );
      res.status(503).json({ error: "Invitation Code settings could not be saved." });
    }
  },
);

router.post("/admin/applicants/clear", requireReviewer, async (req, res): Promise<void> => {
  const parsed = ClearApplicantRecordsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Select at least one applicant record to clear." });
    return;
  }

  const guestIds = [...new Set(parsed.data.guestPreapplicationIds)];
  const requestedApplicationIds = [...new Set(parsed.data.enrollmentApplicationIds)];
  if (!guestIds.length && !requestedApplicationIds.length) {
    res.status(400).json({ error: "Select at least one applicant record to clear." });
    return;
  }
  if (guestIds.length + requestedApplicationIds.length > 100) {
    res.status(400).json({ error: "Clear no more than 100 applicant records at a time." });
    return;
  }

  const guestTargetKey = (id: string) => `guest_preapplication:${id}`;
  const enrollmentTargetKey = (id: string) => `enrollment_application:${id}`;
  const requestedKeys = new Set([
    ...guestIds.map(guestTargetKey),
    ...requestedApplicationIds.map(enrollmentTargetKey),
  ]);
  const failedKeys = new Set<string>();

  try {
    const selectedApplications = requestedApplicationIds.length
      ? await db.select().from(enrollmentApplicationsTable)
        .where(inArray(enrollmentApplicationsTable.id, requestedApplicationIds))
      : [];
    const selectedGuests = guestIds.length
      ? await db.select().from(guestPreapplicationsTable)
        .where(inArray(guestPreapplicationsTable.id, guestIds))
      : [];
    const selectedApplicationById = new Map(
      selectedApplications.map((application) => [application.id, application]),
    );
    const selectedGuestById = new Map(
      selectedGuests.map((application) => [application.id, application]),
    );

    for (const id of requestedApplicationIds) {
      if (!selectedApplicationById.has(id)) failedKeys.add(enrollmentTargetKey(id));
    }
    for (const id of guestIds) {
      if (!selectedGuestById.has(id)) failedKeys.add(guestTargetKey(id));
    }

    const sourceGuestIds = selectedApplications
      .map((application) => application.sourceGuestPreapplicationId)
      .filter((id): id is string => Boolean(id));
    const missingSourceGuestIds = sourceGuestIds.filter((id) => !selectedGuestById.has(id));
    const sourceGuests = missingSourceGuestIds.length
      ? await db.select().from(guestPreapplicationsTable)
        .where(inArray(guestPreapplicationsTable.id, missingSourceGuestIds))
      : [];
    const guestsToDelete = new Map([
      ...selectedGuests.map((application) => [application.id, application] as const),
      ...sourceGuests.map((application) => [application.id, application] as const),
    ]);

    const linkedApplicationIds = [...new Set(
      [...guestsToDelete.values()]
        .map((application) => application.linkedApplicationId)
        .filter((id): id is string => Boolean(id)),
    )].filter((id) => !selectedApplicationById.has(id));
    const linkedApplications = linkedApplicationIds.length
      ? await db.select().from(enrollmentApplicationsTable)
        .where(inArray(enrollmentApplicationsTable.id, linkedApplicationIds))
      : [];
    const applicationsToDelete = new Map([
      ...selectedApplications.map((application) => [application.id, application] as const),
      ...linkedApplications.map((application) => [application.id, application] as const),
    ]);

    const evidenceByGuestId = new Map<string, Array<typeof guestPreapplicationEvidenceTable.$inferSelect>>();
    const allGuestIds = [...guestsToDelete.keys()];
    const evidenceRows = allGuestIds.length
      ? await db.select().from(guestPreapplicationEvidenceTable)
        .where(inArray(guestPreapplicationEvidenceTable.applicationId, allGuestIds))
      : [];
    for (const evidence of evidenceRows) {
      const records = evidenceByGuestId.get(evidence.applicationId) ?? [];
      records.push(evidence);
      evidenceByGuestId.set(evidence.applicationId, records);
    }

    const failedGuestIds = new Set<string>();
    for (const [guestId, evidenceItems] of evidenceByGuestId) {
      for (const evidence of evidenceItems) {
        if (!evidence.objectPath.startsWith("/objects/")) {
          failedGuestIds.add(guestId);
          break;
        }
        try {
          const objectFile = await objectStorage.getObjectEntityFile(evidence.objectPath);
          await objectFile.delete({ ignoreNotFound: true });
        } catch (error) {
          if (error instanceof ObjectNotFoundError) continue;
          failedGuestIds.add(guestId);
          req.log.error(
            { err: error, applicationId: guestId, evidenceId: evidence.id },
            "Failed to remove applicant evidence while clearing a record",
          );
          break;
        }
      }
    }

    for (const guestId of failedGuestIds) {
      if (requestedKeys.has(guestTargetKey(guestId))) failedKeys.add(guestTargetKey(guestId));
      for (const application of applicationsToDelete.values()) {
        if (
          application.sourceGuestPreapplicationId === guestId &&
          requestedKeys.has(enrollmentTargetKey(application.id))
        ) {
          failedKeys.add(enrollmentTargetKey(application.id));
        }
      }
      const guest = guestsToDelete.get(guestId);
      if (
        guest?.linkedApplicationId &&
        requestedKeys.has(enrollmentTargetKey(guest.linkedApplicationId))
      ) {
        failedKeys.add(enrollmentTargetKey(guest.linkedApplicationId));
      }
    }

    const deletableApplications = [...applicationsToDelete.values()]
      .filter((application) => !failedGuestIds.has(application.sourceGuestPreapplicationId ?? ""));
    const deletableGuestIds = [...guestsToDelete.keys()]
      .filter((id) => !failedGuestIds.has(id));

    const deleted = await db.transaction(async (transaction) => {
      const removedApplications = deletableApplications.length
        ? await transaction.delete(enrollmentApplicationsTable)
          .where(inArray(
            enrollmentApplicationsTable.id,
            deletableApplications.map((application) => application.id),
          ))
          .returning({ id: enrollmentApplicationsTable.id })
        : [];
      if (deletableGuestIds.length) {
        await transaction.delete(guestPreapplicationEvidenceTable)
          .where(inArray(guestPreapplicationEvidenceTable.applicationId, deletableGuestIds));
        await transaction.delete(guestPreapplicationRevisionsTable)
          .where(inArray(guestPreapplicationRevisionsTable.applicationId, deletableGuestIds));
      }
      const removedGuests = deletableGuestIds.length
        ? await transaction.delete(guestPreapplicationsTable)
          .where(inArray(guestPreapplicationsTable.id, deletableGuestIds))
          .returning({ id: guestPreapplicationsTable.id })
        : [];
      return {
        applicationIds: new Set(removedApplications.map((application) => application.id)),
        guestIds: new Set(removedGuests.map((application) => application.id)),
      };
    });

    for (const id of guestIds) {
      if (!deleted.guestIds.has(id)) failedKeys.add(guestTargetKey(id));
    }
    for (const id of requestedApplicationIds) {
      if (!deleted.applicationIds.has(id)) failedKeys.add(enrollmentTargetKey(id));
    }
    const clearedCount = requestedKeys.size - failedKeys.size;
    const failedRecords = [...failedKeys].map((key) => {
      const [type, id] = key.split(":");
      return {
        type: type as "guest_preapplication" | "enrollment_application",
        id: id ?? "",
      };
    });
    res.json(ClearApplicantRecordsResponse.parse({ clearedCount, failedRecords }));
  } catch (error) {
    req.log.error({ err: error }, "Failed to clear selected applicant records");
    res.status(503).json({ error: "The selected applicant records could not be cleared. Please retry." });
  }
});

router.get("/admin/guest-preapplications", requireReviewer, async (req, res): Promise<void> => {
  try {
    const applications = await db
      .select()
      .from(guestPreapplicationsTable)
      .where(isNull(guestPreapplicationsTable.linkedApplicationId))
      .orderBy(desc(guestPreapplicationsTable.createdAt));
    const evidenceRows = applications.length
      ? await db
          .select()
          .from(guestPreapplicationEvidenceTable)
          .where(inArray(
            guestPreapplicationEvidenceTable.applicationId,
            applications.map((application) => application.id),
          ))
          .orderBy(desc(guestPreapplicationEvidenceTable.createdAt))
      : [];
    const evidenceByApplication = new Map<string, typeof evidenceRows>();
    for (const evidence of evidenceRows) {
      const group = evidenceByApplication.get(evidence.applicationId) ?? [];
      group.push(evidence);
      evidenceByApplication.set(evidence.applicationId, group);
    }
    const revisionRows = applications.length
      ? await db
          .select()
          .from(guestPreapplicationRevisionsTable)
          .where(inArray(
            guestPreapplicationRevisionsTable.applicationId,
            applications.map((application) => application.id),
          ))
          .orderBy(guestPreapplicationRevisionsTable.createdAt)
      : [];
    const historyByApplication = new Map<string, typeof revisionRows>();
    for (const revision of revisionRows) {
      const group = historyByApplication.get(revision.applicationId) ?? [];
      group.push(revision);
      historyByApplication.set(revision.applicationId, group);
    }
    res.json(
      ListAdminGuestPreapplicationsResponse.parse(
        applications.map((application) =>
          serializeAdminGuestPreapplication(
            application,
            evidenceByApplication.get(application.id) ?? [],
            historyByApplication.get(application.id) ?? [],
          ),
        ),
      ),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to list guest pre-applications");
    res.status(503).json({ error: "Guest pre-applications are temporarily unavailable." });
  }
});

router.get(
  "/admin/applications/:applicationId/guest-history",
  requireReviewer,
  async (req, res): Promise<void> => {
    const parsedParams = GetAdminGuestApplicationHistoryParams.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: "Application history could not be loaded." });
      return;
    }
    try {
      const [application] = await db
        .select()
        .from(enrollmentApplicationsTable)
        .where(eq(enrollmentApplicationsTable.id, parsedParams.data.applicationId))
        .limit(1);
      if (!application) {
        res.status(404).json({ error: "Application not found." });
        return;
      }
      if (!application.sourceGuestPreapplicationId) {
        res.json(GetAdminGuestApplicationHistoryResponse.parse([]));
        return;
      }
      const history = await db
        .select()
        .from(guestPreapplicationRevisionsTable)
        .where(eq(
          guestPreapplicationRevisionsTable.applicationId,
          application.sourceGuestPreapplicationId,
        ))
        .orderBy(guestPreapplicationRevisionsTable.createdAt);
      res.json(GetAdminGuestApplicationHistoryResponse.parse(history.map((revision) => ({
        id: revision.id,
        currentStep: revision.currentStep,
        changes: sanitizeStoredRevisionChanges(revision.changes),
        createdAt: revision.createdAt.toISOString(),
      }))));
    } catch (error) {
      req.log.error({ err: error, applicationId: parsedParams.data.applicationId }, "Failed to load guest application history");
      res.status(503).json({ error: "Application history is temporarily unavailable." });
    }
  },
);

router.post(
  "/admin/guest-preapplications/:applicationId/evidence/upload-url",
  requireReviewer,
  async (req, res): Promise<void> => {
    const parsedParams = RequestGuestPreapplicationEvidenceUploadParams.safeParse(req.params);
    const parsedBody = RequestGuestPreapplicationEvidenceUploadBody.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
      res.status(400).json({ error: "Choose a supported evidence file and try again." });
      return;
    }
    const { evidenceType, contentType, sizeBytes } = parsedBody.data;
    const evidenceSlot = parsedBody.data.evidenceSlot ??
      (evidenceType === "verification_video"
        ? "verification_video"
        : evidenceType === "education_certificate"
          ? "education_certificate"
          : "identity_front");
    if (!isAllowedEvidenceType(evidenceType, contentType, sizeBytes)) {
      res.status(400).json({
        error: evidenceType === "identity_document"
          ? "Identity evidence must be a PDF, JPEG, PNG, or WebP file no larger than 20 MB."
          : "Verification videos must be MP4 or WebM files no larger than 200 MB.",
      });
      return;
    }

    try {
      const [application] = await db
        .select()
        .from(guestPreapplicationsTable)
        .where(eq(guestPreapplicationsTable.id, parsedParams.data.applicationId))
        .limit(1);
      if (!application) {
        res.status(404).json({ error: "Guest application not found." });
        return;
      }
      if (application.status === "closed") {
        res.status(409).json({ error: "Evidence cannot be added to a closed application." });
        return;
      }
      if (!process.env.PRIVATE_OBJECT_DIR || !process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID) {
        res.status(503).json({ error: "Private evidence storage is unavailable." });
        return;
      }

      const existingEvidence = await db
        .select()
        .from(guestPreapplicationEvidenceTable)
        .where(eq(guestPreapplicationEvidenceTable.applicationId, application.id));
      if (evidenceType === "verification_video" && existingEvidence.some(
        (item) => item.evidenceType === "verification_video" && item.uploadedAt !== null,
      )) {
        res.status(409).json({ error: "A verification video is already recorded for this application." });
        return;
      }
      if (evidenceType === "identity_document" && existingEvidence.filter(
        (item) => item.evidenceType === "identity_document" && item.uploadedAt !== null,
      ).length >= 5) {
        res.status(409).json({ error: "No more than five identity files can be recorded." });
        return;
      }

      const uploadUrl = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadUrl);
      if (!objectPath.startsWith("/objects/")) {
        throw new Error("Storage returned an invalid private object path.");
      }
      const uploadExpiresAt = new Date(Date.now() + INCOMPLETE_GUEST_UPLOAD_RETENTION_MS);
      const [record] = await db
        .insert(guestPreapplicationEvidenceTable)
        .values({
          applicationId: application.id,
          evidenceType,
          evidenceSlot,
          fileName: safeEvidenceFileName(parsedBody.data.fileName),
          contentType,
          sizeBytes,
          objectPath,
          uploadedByUserId: res.locals.userId as string,
          uploadExpiresAt,
        })
        .returning();
      if (!record) throw new Error("Evidence upload record could not be created.");
      res.json(
        RequestGuestPreapplicationEvidenceUploadResponse.parse({
          evidenceId: record.id,
          uploadUrl,
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Failed to prepare private guest evidence upload");
      res.status(503).json({ error: "A secure evidence upload could not be prepared." });
    }
  },
);

router.post(
  "/admin/guest-preapplications/:applicationId/evidence/:evidenceId/complete",
  requireReviewer,
  async (req, res): Promise<void> => {
    const parsedParams = CompleteGuestPreapplicationEvidenceUploadParams.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: "Evidence could not be verified." });
      return;
    }
    const { applicationId, evidenceId } = parsedParams.data;
    try {
      const [evidence] = await db
        .select()
        .from(guestPreapplicationEvidenceTable)
        .where(and(
          eq(guestPreapplicationEvidenceTable.id, evidenceId),
          eq(guestPreapplicationEvidenceTable.applicationId, applicationId),
        ))
        .limit(1);
      if (!evidence) {
        res.status(404).json({ error: "Evidence upload not found." });
        return;
      }
      if (evidence.uploadedAt) {
        res.json(CompleteGuestPreapplicationEvidenceUploadResponse.parse(
          serializeGuestEvidence(evidence),
        ));
        return;
      }

      const objectFile = await objectStorage.getObjectEntityFile(evidence.objectPath);
      const [metadata] = await objectFile.getMetadata();
      if (Number(metadata.size) !== evidence.sizeBytes || metadata.contentType !== evidence.contentType) {
        await objectFile.delete({ ignoreNotFound: true }).catch(() => undefined);
        await db.delete(guestPreapplicationEvidenceTable)
          .where(eq(guestPreapplicationEvidenceTable.id, evidence.id));
        res.status(400).json({ error: "The uploaded file did not match its declared type or size." });
        return;
      }
      const [signatureBytes] = await objectFile.download({
        start: 0,
        end: Math.min(evidence.sizeBytes - 1, 31),
      });
      if (!evidenceSignatureMatches(evidence.contentType, signatureBytes)) {
        await objectFile.delete({ ignoreNotFound: true }).catch(() => undefined);
        await db.delete(guestPreapplicationEvidenceTable)
          .where(eq(guestPreapplicationEvidenceTable.id, evidence.id));
        res.status(400).json({ error: "The uploaded file content is not a supported evidence format." });
        return;
      }

      const [completed] = await db
        .update(guestPreapplicationEvidenceTable)
        .set({ uploadedAt: new Date(), uploadExpiresAt: null })
        .where(and(
          eq(guestPreapplicationEvidenceTable.id, evidence.id),
          eq(guestPreapplicationEvidenceTable.applicationId, applicationId),
        ))
        .returning();
      if (!completed) {
        res.status(404).json({ error: "Evidence upload not found." });
        return;
      }
      await db
        .update(guestPreapplicationsTable)
        .set({ updatedAt: new Date(), updatedByUserId: res.locals.userId as string })
        .where(eq(guestPreapplicationsTable.id, applicationId));
      res.json(
        CompleteGuestPreapplicationEvidenceUploadResponse.parse(
          serializeGuestEvidence(completed),
        ),
      );
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(409).json({ error: "Upload the selected file before recording it." });
        return;
      }
      req.log.error({ err: error, applicationId, evidenceId }, "Failed to verify guest evidence upload");
      res.status(503).json({ error: "The evidence file could not be verified." });
    }
  },
);

router.get(
  "/admin/guest-preapplications/:applicationId/evidence/:evidenceId/file",
  requireReviewer,
  async (req, res): Promise<void> => {
    const parsedParams = DownloadGuestPreapplicationEvidenceParams.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: "Evidence file not found." });
      return;
    }
    const { applicationId, evidenceId } = parsedParams.data;
    try {
      const [evidence] = await db
        .select()
        .from(guestPreapplicationEvidenceTable)
        .where(and(
          eq(guestPreapplicationEvidenceTable.id, evidenceId),
          eq(guestPreapplicationEvidenceTable.applicationId, applicationId),
        ))
        .limit(1);
      if (!evidence?.uploadedAt) {
        res.status(404).json({ error: "Uploaded evidence file not found." });
        return;
      }
      const objectFile = await objectStorage.getObjectEntityFile(evidence.objectPath);
      const [metadata] = await objectFile.getMetadata();
      const downloadName = safeEvidenceFileName(evidence.fileName);
      res.setHeader("Content-Type", evidence.contentType);
      res.setHeader("Content-Length", String(metadata.size));
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      );
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("X-Content-Type-Options", "nosniff");
      const stream = objectFile.createReadStream();
      stream.on("error", (error) => {
        req.log.error({ err: error, applicationId, evidenceId }, "Failed to stream private guest evidence");
        if (res.headersSent) res.destroy(error);
        else res.status(503).json({ error: "The evidence file could not be downloaded." });
      });
      stream.pipe(res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Uploaded evidence file not found." });
        return;
      }
      req.log.error({ err: error, applicationId, evidenceId }, "Failed to open private guest evidence");
      res.status(503).json({ error: "The evidence file could not be downloaded." });
    }
  },
);

router.patch("/admin/guest-preapplications/:applicationId", requireReviewer, async (req, res): Promise<void> => {
  const parsedParams = UpdateAdminGuestPreapplicationParams.safeParse(req.params);
  const parsedBody = UpdateAdminGuestPreapplicationBody.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Choose a valid follow-up status." });
    return;
  }

  try {
    const [updated] = await db
      .update(guestPreapplicationsTable)
      .set({
        status: parsedBody.data.status,
        updatedByUserId: res.locals.userId,
        updatedAt: new Date(),
      })
      .where(eq(guestPreapplicationsTable.id, parsedParams.data.applicationId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Guest pre-application not found." });
      return;
    }
    res.json(
      UpdateAdminGuestPreapplicationResponse.parse(
        await serializeAdminGuestPreapplicationWithEvidence(updated),
      ),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to update guest pre-application");
    res.status(503).json({ error: "Guest pre-application could not be updated." });
  }
});

router.put("/admin/settings", requirePrimaryAdmin, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = UpdatePortalSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ids = parsed.data.cards.map((card) => card.id);
  if (new Set(ids).size !== 4 || categories.some((category) => !ids.includes(category.id))) {
    res.status(400).json({ error: "Settings must contain each of the four enrollment cards exactly once." });
    return;
  }
  const landingCopy = parsed.data.screenCopy.landing;
  // Keep the dedicated hero field and the landing-screen copy in sync.
  if (landingCopy) {
    landingCopy.description = parsed.data.hero.description;
  }
  for (const category of categories) {
    const screenId = `category-entry-${category.id.replace("category-", "")}`;
    const entryCopy = parsed.data.screenCopy[screenId];
    if (entryCopy) entryCopy.referenceCodeLabel = "Invitation Code";
  }
  if (parsed.data.cards.some((card) =>
    !validatePublicImageDataUrl(card.logoDataUrl)
    || !validatePublicImageDataUrl(card.entryLogoDataUrl ?? null))) {
    res.status(400).json({ error: "Card and entry logos must be valid PNG, JPEG, or WebP images no larger than 2 MB." });
    return;
  }
  try {
    const [record] = await db
      .insert(portalSettingsTable)
      .values({
        key: "portal",
        value: parsed.data,
        updatedByUserId: res.locals.userId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: portalSettingsTable.key,
        set: {
          value: parsed.data,
          updatedByUserId: res.locals.userId,
          updatedAt: new Date(),
        },
      })
      .returning({ value: portalSettingsTable.value });
    res.json(UpdatePortalSettingsResponse.parse(record?.value ?? parsed.data));
  } catch (error) {
    req.log.error({ err: error }, "Failed to save portal settings");
    res.status(503).json({ error: "Portal settings could not be saved." });
  }
});

function serializeStaffEmailRecord(record: StaffEmailOutboxRecord) {
  return {
    id: record.id,
    recipientEmail: record.recipientEmail,
    subject: record.subject,
    messageText: record.messageText,
    eventKind: record.eventKind,
    applicationReference: record.applicationReference ?? null,
    status: record.status,
    providerMessageId: record.providerMessageId ?? null,
    deliveryStatus:
      record.deliveryStatus ?? (record.status === "sent" ? "accepted" : null),
    providerEventAt: record.providerEventAt ?? null,
    providerEvents: [],
    errorMessage: record.errorMessage ?? null,
    createdByUserId: record.createdByUserId ?? null,
    attemptCount: record.attemptCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

router.post("/webhooks/infobip/sms", async (req, res): Promise<void> => {
  const secret = process.env.INFOBIP_DLR_WEBHOOK_SECRET?.trim();
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!secret) {
    req.log.error("Infobip SMS delivery report secret is not configured");
    res.status(503).json({ error: "Webhook verification is not configured." });
    return;
  }
  if (!rawBody || !verifyInfobipDeliveryReportSignature({
    rawBody,
    signature: req.header("x-hub-signature"),
    secret,
  })) {
    res.status(401).json({ error: "Webhook signature is invalid." });
    return;
  }
  const body = req.body as {
    results?: Array<{
      messageId?: unknown;
      callbackData?: unknown;
      doneAt?: unknown;
      status?: {
        groupName?: unknown;
        name?: unknown;
        description?: unknown;
      };
    }>;
  };
  if (!body || !Array.isArray(body.results)) {
    res.status(400).json({ error: "Delivery report results are invalid." });
    return;
  }

  try {
    for (const result of body.results) {
      const groupName = typeof result.status?.groupName === "string"
        ? result.status.groupName.toUpperCase()
        : "";
      const statusName = typeof result.status?.name === "string"
        ? result.status.name.toUpperCase()
        : "";
      const outcome = groupName === "DELIVERED" || statusName.includes("DELIVERED")
        ? "delivered"
        : /UNDELIVERABLE|REJECTED|EXPIRED/.test(`${groupName} ${statusName}`)
          ? "failed"
          : null;
      if (!outcome) continue;
      const doneAt = typeof result.doneAt === "string"
        ? new Date(result.doneAt)
        : new Date();
      if (Number.isNaN(doneAt.getTime())) {
        res.status(400).json({ error: "Delivery report timestamp is invalid." });
        return;
      }
      await applyInfobipDeliveryReport({
        callbackData: typeof result.callbackData === "string"
          ? result.callbackData
          : undefined,
        providerMessageId: typeof result.messageId === "string"
          ? result.messageId
          : undefined,
        status: outcome,
        providerStatus: typeof result.status?.description === "string"
          ? result.status.description
          : typeof result.status?.name === "string"
            ? result.status.name
            : null,
        providerStatusGroup: typeof result.status?.groupName === "string"
          ? result.status.groupName
          : null,
        providerStatusAt: doneAt,
      });
    }
    res.status(200).json({ received: true });
  } catch (error) {
    req.log.error({ err: error }, "Failed to record Infobip SMS delivery report");
    res.status(503).json({ error: "SMS delivery outcome could not be recorded." });
  }
});

async function streamPublicEmailBrandImage(
  req: Request,
  res: Response,
  objectPath: string | null,
  label: string,
): Promise<void> {
  if (!objectPath) {
    res.status(404).end();
    return;
  }
  try {
    const objectFile = await objectStorage.getObjectEntityFile(objectPath);
    const [metadata] = await objectFile.getMetadata();
    const contentType = String(metadata.contentType ?? "");
    const sizeBytes = Number(metadata.size);
    if (
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(contentType) ||
      !Number.isInteger(sizeBytes) ||
      sizeBytes < 1 ||
      sizeBytes > 2 * 1024 * 1024
    ) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(sizeBytes));
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const stream = objectFile.createReadStream();
    stream.on("error", (error) => {
      req.log.error({ err: error, asset: label }, "Failed to stream public email branding image");
      if (res.headersSent) res.destroy(error);
      else res.status(503).end();
    });
    stream.pipe(res);
  } catch (error) {
    req.log.error({ err: error, asset: label }, "Failed to load public email branding image");
    res.status(404).end();
  }
}

router.get("/public/email/logo", async (req, res): Promise<void> => {
  const { branding } = await getStaffEmailConfiguration();
  await streamPublicEmailBrandImage(req, res, branding.logoObjectPath, "logo");
});

router.get("/public/email/footer-background", async (req, res): Promise<void> => {
  const { branding } = await getStaffEmailConfiguration();
  await streamPublicEmailBrandImage(
    req,
    res,
    branding.footerBackgroundObjectPath,
    "footer-background",
  );
});

router.post("/admin/email/logo/upload-url", requireReviewer, async (req, res): Promise<void> => {
  const parsed = RequestAdminEmailLogoUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a PNG, JPEG, WebP, or GIF logo no larger than 2 MB." });
    return;
  }
  if (!isPrivateStorageConfigured()) {
    res.status(503).json({ error: "Email logo storage is unavailable." });
    return;
  }
  try {
    const uploadUrl = await objectStorage.getObjectEntityUploadURL("email-logos");
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadUrl);
    res.json(RequestAdminEmailLogoUploadResponse.parse({ uploadUrl, objectPath }));
  } catch (error) {
    req.log.error({ err: error }, "Failed to prepare email logo upload");
    res.status(503).json({ error: "An email logo upload could not be prepared." });
  }
});

router.post("/admin/email/logo/complete", requireReviewer, async (req, res): Promise<void> => {
  const parsed = CompleteAdminEmailLogoUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "The uploaded email logo path is invalid." });
    return;
  }
  try {
    const objectFile = await objectStorage.getObjectEntityFile(parsed.data.objectPath);
    const [metadata] = await objectFile.getMetadata();
    const contentType = String(metadata.contentType ?? "");
    const sizeBytes = Number(metadata.size);
    if (
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(contentType) ||
      !Number.isInteger(sizeBytes) ||
      sizeBytes < 1 ||
      sizeBytes > 2 * 1024 * 1024
    ) {
      await objectFile.delete({ ignoreNotFound: true }).catch(() => undefined);
      res.status(400).json({ error: "The uploaded logo must be a supported image no larger than 2 MB." });
      return;
    }
    const [signatureBytes] = await objectFile.download({ start: 0, end: Math.min(sizeBytes - 1, 11) });
    if (!emailLogoSignatureMatches(contentType, signatureBytes)) {
      await objectFile.delete({ ignoreNotFound: true }).catch(() => undefined);
      res.status(400).json({ error: "The uploaded file content is not a supported image format." });
      return;
    }
    res.json(CompleteAdminEmailLogoUploadResponse.parse({ objectPath: parsed.data.objectPath }));
  } catch (error) {
    req.log.error({ err: error }, "Failed to verify email logo upload");
    res.status(400).json({ error: "Upload the selected logo before confirming it." });
  }
});

router.get("/admin/email/settings", requireReviewer, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const configuration = await getStaffEmailConfiguration();
    const isAdmin = res.locals.staffRole === "admin";
    res.json(
      GetAdminEmailSettingsResponse.parse({
        ...configuration,
        ...(isAdmin
          ? {}
          : {
              recipients: [],
              alerts: {
                contact_received: false,
                step_saved: false,
                contact_updated: false,
                evidence_saved: false,
                application_submitted: false,
              },
            }),
        updatedAt: configuration.updatedAt
          ? new Date(configuration.updatedAt)
          : null,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to load staff email settings");
    res.status(503).json({ error: "Email settings could not be loaded." });
  }
});

router.put("/admin/email/settings", requireReviewer, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = UpdateAdminEmailSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the recipient addresses and alert settings." });
    return;
  }
  const { branding } = parsed.data;
  let workspaceSenderAddress: string;
  try {
    workspaceSenderAddress = await getWorkspaceMailboxAddress();
  } catch (error) {
    req.log.error({ err: error }, "Google Workspace sender is unavailable");
    res.status(503).json({ error: "The connected Google Workspace sender is unavailable." });
    return;
  }
  if (
    !isApprovedStaffSenderAddress(workspaceSenderAddress) ||
    branding.senderEmail.trim().toLowerCase() !== workspaceSenderAddress
  ) {
    res.status(400).json({
      error: "The sender address must match the connected Google Workspace account.",
    });
    return;
  }
  if (
    (branding.logoUrl !== null && (
      branding.logoUrl.length > 2048 ||
      !/^https:\/\/[^\s]+$/i.test(branding.logoUrl)
    )) ||
    (branding.logoObjectPath !== null &&
      !/^\/objects\/email-logos\/[0-9a-f-]{36}$/i.test(branding.logoObjectPath)) ||
    (branding.footerBackgroundUrl !== null && (
      branding.footerBackgroundUrl.length > 2048 ||
      !/^https:\/\/[^\s]+$/i.test(branding.footerBackgroundUrl)
    )) ||
    (branding.footerBackgroundObjectPath !== null &&
      !/^\/objects\/email-logos\/[0-9a-f-]{36}$/i.test(branding.footerBackgroundObjectPath)) ||
    !/^#[\da-f]{6}$/i.test(branding.accentColor) ||
    !/^#[\da-f]{6}$/i.test(branding.headerColor) ||
    !/^#[\da-f]{6}$/i.test(branding.footerLinkColor) ||
    !/^#[\da-f]{6}$/i.test(branding.footerBackgroundColor) ||
    !/^#[\da-f]{6}$/i.test(branding.footerTextColor) ||
    !branding.senderName.trim() ||
    branding.senderName.trim().length > 80 ||
    /[<>\r\n]/.test(branding.senderName) ||
    branding.senderEmail.trim().length > 254 ||
    !branding.bannerTitle.trim() ||
    branding.bannerTitle.length > 100 ||
    branding.bannerMark.length > 12 ||
    branding.bannerSubtitle.length > 120 ||
    branding.preheaderText.length > 200 ||
    branding.messageEyebrow.length > 80 ||
    branding.footerText.length > 300 ||
    branding.footerLinkText.length > 80 ||
    (branding.footerLinkUrl !== null && (
      branding.footerLinkUrl.length > 2048 ||
      !/^https:\/\/[^\s]+$/i.test(branding.footerLinkUrl)
    )) ||
    (branding.footerLinkUrl !== null && !branding.footerLinkText.trim())
  ) {
    res.status(400).json({ error: "Check the email sender, banner text, colors, footer, link, and images." });
    return;
  }
  const recipients = [...new Set(
    parsed.data.recipients.map((email) => email.trim().toLowerCase()),
  )];
  try {
    const isAdmin = res.locals.staffRole === "admin";
    const normalizedBranding = {
      ...branding,
      logoUrl: branding.logoUrl?.trim() || null,
      senderName: branding.senderName.trim(),
      senderEmail: branding.senderEmail.trim().toLowerCase(),
      bannerTitle: branding.bannerTitle.trim(),
      bannerSubtitle: branding.bannerSubtitle.trim(),
      preheaderText: branding.preheaderText.trim(),
      messageEyebrow: branding.messageEyebrow.trim(),
      footerBackgroundUrl: branding.footerBackgroundUrl?.trim() || null,
    };
    const configuration = isAdmin
      ? await saveStaffEmailConfiguration(
          recipients,
          parsed.data.alerts,
          normalizedBranding,
          res.locals.userId as string,
        )
      : await saveStaffEmailBranding(
          normalizedBranding,
          res.locals.userId as string,
        );
    res.json(
      UpdateAdminEmailSettingsResponse.parse({
        ...configuration,
        ...(isAdmin
          ? {}
          : {
              recipients: [],
              alerts: {
                contact_received: false,
                step_saved: false,
                contact_updated: false,
                evidence_saved: false,
                application_submitted: false,
              },
            }),
        updatedAt: configuration.updatedAt
          ? new Date(configuration.updatedAt)
          : null,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to save staff email settings");
    res.status(503).json({ error: "Email settings could not be saved." });
  }
});

router.get("/admin/email/outbox", requireReviewer, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    let records = await db
      .select()
      .from(staffEmailOutboxTable)
      .orderBy(desc(staffEmailOutboxTable.createdAt))
      .limit(100);
    try {
      await refreshWorkspaceEmailDeliveryStatuses(records);
    } catch (error) {
      req.log.warn({ err: error }, "Could not refresh Gmail delivery notices");
    }
    records = await db
      .select()
      .from(staffEmailOutboxTable)
      .orderBy(desc(staffEmailOutboxTable.createdAt))
      .limit(100);
    const messageIds = records.map((record) => record.id);
    const providerEvents = messageIds.length
      ? await db
          .select({
            outboxId: staffEmailProviderEventsTable.outboxId,
            deliveryStatus: staffEmailProviderEventsTable.deliveryStatus,
            providerEventAt: staffEmailProviderEventsTable.providerEventAt,
          })
          .from(staffEmailProviderEventsTable)
          .where(inArray(staffEmailProviderEventsTable.outboxId, messageIds))
          .orderBy(
            asc(staffEmailProviderEventsTable.providerEventAt),
            asc(staffEmailProviderEventsTable.id),
          )
      : [];
    const eventsByMessageId = new Map<
      string,
      { deliveryStatus: string; providerEventAt: Date }[]
    >();
    for (const event of providerEvents) {
      const events = eventsByMessageId.get(event.outboxId) ?? [];
      events.push({
        deliveryStatus: event.deliveryStatus,
        providerEventAt: event.providerEventAt,
      });
      eventsByMessageId.set(event.outboxId, events);
    }
    res.json(
      ListAdminEmailOutboxResponse.parse(
        records.map((record) => ({
          ...serializeStaffEmailRecord(record),
          providerEvents: eventsByMessageId.get(record.id) ?? [],
        })),
      ),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to load staff email outbox");
    res.status(503).json({ error: "Email history could not be loaded." });
  }
});

router.get("/admin/email/templates", requireReviewer, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const templates = await db
      .select()
      .from(staffEmailTemplatesTable)
      .orderBy(asc(staffEmailTemplatesTable.name), asc(staffEmailTemplatesTable.createdAt));
    res.json(ListAdminEmailTemplatesResponse.parse(templates));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load staff email templates");
    res.status(503).json({ error: "Email templates could not be loaded." });
  }
});

router.post("/admin/email/templates", requireReviewer, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = CreateAdminEmailTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the template name, subject, and message." });
    return;
  }
  const name = parsed.data.name.trim();
  const subject = parsed.data.subject.trim();
  const messageText = parsed.data.messageText.trim();
  if (!name || !subject || !messageText) {
    res.status(400).json({ error: "Template name, subject, and message cannot be blank." });
    return;
  }
  try {
    const [template] = await db
      .insert(staffEmailTemplatesTable)
      .values({
        name,
        subject,
        messageText,
        createdByUserId: res.locals.userId as string,
      })
      .returning();
    res.status(201).json(CreateAdminEmailTemplateResponse.parse(template));
  } catch (error) {
    req.log.error({ err: error }, "Failed to create staff email template");
    res.status(503).json({ error: "Email template could not be saved." });
  }
});

router.patch(
  "/admin/email/templates/:templateId",
  requireReviewer,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const params = UpdateAdminEmailTemplateParams.safeParse(req.params);
    const parsed = UpdateAdminEmailTemplateBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Check the template identifier, name, subject, and message." });
      return;
    }
    const name = parsed.data.name.trim();
    const subject = parsed.data.subject.trim();
    const messageText = parsed.data.messageText.trim();
    if (!name || !subject || !messageText) {
      res.status(400).json({ error: "Template name, subject, and message cannot be blank." });
      return;
    }
    try {
      const [template] = await db
        .update(staffEmailTemplatesTable)
        .set({ name, subject, messageText, updatedAt: new Date() })
        .where(eq(staffEmailTemplatesTable.id, params.data.templateId))
        .returning();
      if (!template) {
        res.status(404).json({ error: "Email template not found." });
        return;
      }
      res.json(UpdateAdminEmailTemplateResponse.parse(template));
    } catch (error) {
      req.log.error({ err: error }, "Failed to update staff email template");
      res.status(503).json({ error: "Email template could not be updated." });
    }
  },
);

router.delete(
  "/admin/email/templates/:templateId",
  requireReviewer,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const params = DeleteAdminEmailTemplateParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "The email template identifier is invalid." });
      return;
    }
    try {
      const [template] = await db
        .delete(staffEmailTemplatesTable)
        .where(eq(staffEmailTemplatesTable.id, params.data.templateId))
        .returning();
      if (!template) {
        res.status(404).json({ error: "Email template not found." });
        return;
      }
      res.sendStatus(204);
    } catch (error) {
      req.log.error({ err: error }, "Failed to delete staff email template");
      res.status(503).json({ error: "Email template could not be removed." });
    }
  },
);

router.post("/admin/email/send", requireReviewer, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = SendAdminEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the recipients, subject, and message before sending." });
    return;
  }
  const subject = parsed.data.subject.trim();
  const messageText = parsed.data.messageText.trim();
  if (!subject || !messageText) {
    res.status(400).json({ error: "Subject and message cannot be blank." });
    return;
  }
  const recipients = [...new Set(
    parsed.data.recipients.map((email) => email.trim().toLowerCase()),
  )];
  try {
    const messages: StaffEmailOutboxRecord[] = [];
    for (const recipientEmail of recipients) {
      messages.push(
        await dispatchStaffEmail({
          idempotencyKey: emailRecipientIdempotencyKey(
            `manual:${parsed.data.requestId}`,
            recipientEmail,
          ),
          recipientEmail,
          subject,
          messageText,
          eventKind: "manual",
          createdByUserId: res.locals.userId as string,
        }),
      );
    }
    res.status(201).json(
      SendAdminEmailResponse.parse(messages.map(serializeStaffEmailRecord)),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to process staff email send request");
    res.status(503).json({ error: "The email request could not be recorded." });
  }
});

router.get("/admin/email/sms/settings", requireReviewer, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const configuration = await getStaffSmsConfiguration();
    res.json(
      GetAdminSmsSettingsResponse.parse({
        ...configuration,
        canConfigure: res.locals.staffRole === "admin",
        updatedAt: configuration.updatedAt
          ? new Date(configuration.updatedAt)
          : null,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to load staff SMS settings");
    res.status(503).json({ error: "SMS settings could not be loaded." });
  }
});

router.put("/admin/email/sms/settings", requireReviewer, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = UpdateAdminSmsSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter at least one valid SMS setting." });
    return;
  }
  if (
    parsed.data.baseUrl === undefined &&
    parsed.data.senderId === undefined &&
    parsed.data.dailyLimit === undefined
  ) {
    res.status(400).json({ error: "Enter at least one SMS setting to save." });
    return;
  }
  const isAdmin = res.locals.staffRole === "admin";
  if (!isAdmin && (
    parsed.data.baseUrl !== undefined ||
    parsed.data.dailyLimit !== undefined
  )) {
    res.status(403).json({
      error: "Only an administrator can change the Infobip base URL or daily SMS limit.",
    });
    return;
  }
  const normalizedBaseUrl = parsed.data.baseUrl === undefined
    ? undefined
    : normalizeInfobipBaseUrl(parsed.data.baseUrl);
  const baseUrl = normalizedBaseUrl ?? undefined;
  const senderId = parsed.data.senderId?.trim();
  if (
    (parsed.data.baseUrl !== undefined && normalizedBaseUrl === null) ||
    (senderId !== undefined && !isValidInfobipSenderId(senderId))
  ) {
    res.status(400).json({
      error: "Use the HTTPS Infobip base URL and a 3–11 character sender ID containing only letters and numbers.",
    });
    return;
  }
  try {
    const saved = await saveStaffSmsConfiguration({
      ...(baseUrl !== undefined ? { baseUrl } : {}),
      ...(senderId !== undefined ? { senderId } : {}),
      ...(parsed.data.dailyLimit !== undefined
        ? { dailyLimit: parsed.data.dailyLimit }
        : {}),
      updatedByUserId: res.locals.userId as string,
    });
    res.json(
      UpdateAdminSmsSettingsResponse.parse({
        ...saved,
        canConfigure: isAdmin,
        updatedAt: saved.updatedAt ? new Date(saved.updatedAt) : null,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to save staff SMS settings");
    res.status(503).json({ error: "SMS settings could not be saved." });
  }
});

router.post("/admin/email/sms/send", requireReviewer, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = SendAdminSmsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Enter one phone number in international format and a message of up to 1,600 characters.",
    });
    return;
  }

  const apiKey = process.env.INFOBIP_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ error: "Infobip is not connected yet. Add INFOBIP_API_KEY in Replit Secrets." });
    return;
  }

  let configuration;
  try {
    configuration = await getStaffSmsConfiguration();
  } catch (error) {
    req.log.error({ err: error }, "Failed to load staff SMS settings before sending");
    res.status(503).json({ error: "SMS settings could not be loaded." });
    return;
  }
  if (!configuration.deliveryReportUrl || !configuration.deliveryReportsConfigured) {
    res.status(503).json({
      error: "Configure a public callback URL and the Infobip HMAC-SHA256 signing secret before sending.",
    });
    return;
  }
  if (!configuration.baseUrl || !configuration.senderId) {
    res.status(400).json({ error: "Save the Infobip base URL and sender ID before sending." });
    return;
  }

  let quota;
  try {
    quota = await reserveStaffSmsDailyQuota();
  } catch (error) {
    req.log.error({ err: error }, "Failed to reserve the daily SMS allowance");
    res.status(503).json({ error: "The daily SMS allowance could not be checked." });
    return;
  }
  if (!quota.allowed) {
    res.status(429).json({
      error: `Daily SMS limit reached (${quota.usedCount}/${quota.dailyLimit}). It resets at 00:00 UTC.`,
    });
    return;
  }

  let attempt;
  try {
    attempt = await createStaffSmsAttempt({
      recipientPhone: parsed.data.recipientPhone,
      senderId: configuration.senderId,
      messageText: parsed.data.messageText,
      createdByUserId: res.locals.userId as string,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to record a staff SMS attempt");
    res.status(503).json({ error: "The SMS attempt could not be recorded, so it was not sent." });
    return;
  }

  let result: Awaited<ReturnType<typeof sendInfobipSms>>;
  try {
    result = await sendInfobipSms({
      baseUrl: configuration.baseUrl,
      apiKey,
      senderId: configuration.senderId,
      recipientPhone: parsed.data.recipientPhone,
      messageText: parsed.data.messageText,
      deliveryReportUrl: configuration.deliveryReportUrl,
      callbackData: attempt.id,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to send a staff SMS through Infobip");
    try {
      await markStaffSmsFailed(
        attempt.id,
        "The request did not return a confirmed acceptance. Check Infobip activity before manually retrying.",
      );
    } catch (recordError) {
      req.log.error({ err: recordError }, "Failed to mark the SMS attempt as uncertain");
    }
    res.status(503).json({
      error: "Could not reach Infobip. Check the connection and provider activity before retrying.",
    });
    return;
  }

  if (!result.ok) {
    req.log.warn({ providerStatus: result.status }, "Infobip rejected a staff SMS request");
    const failureMessage = result.status === 429
      ? "Infobip rate limit reached."
      : result.status === 401 || result.status === 403
        ? "Infobip rejected the API credential or sender ID."
        : result.status === 400 || result.status === 422
          ? "Infobip rejected the number, sender ID, or message."
          : "Infobip did not accept the message. Check provider activity before manually retrying.";
    try {
      await markStaffSmsFailed(attempt.id, failureMessage);
    } catch (error) {
      req.log.error({ err: error }, "Failed to record the rejected SMS attempt");
    }
    if (result.status === 429) {
      res.status(429).json({ error: "Infobip rate limit reached. Wait before sending another text." });
      return;
    }
    if (result.status === 401 || result.status === 403) {
      res.status(502).json({ error: "Infobip rejected the API credential or sender ID. Check the provider setup." });
      return;
    }
    if (result.status === 400 || result.status === 422) {
      res.status(400).json({ error: "Infobip rejected the number, sender ID, or message." });
      return;
    }
    res.status(502).json({ error: "Infobip could not accept the message. Check provider activity before retrying." });
    return;
  }

  const acceptedAt = new Date();
  try {
    await markStaffSmsAccepted({
      id: attempt.id,
      providerMessageId: result.providerMessageId,
      acceptedAt,
    });
    const savedAttempt = await getStaffSmsAttemptById(attempt.id);
    if (!savedAttempt) throw new Error("Saved SMS attempt could not be loaded.");
    res.status(201).json(
      SendAdminSmsResponse.parse(serializeStaffSmsRecord(savedAttempt)),
    );
  } catch (error) {
    req.log.error({ err: error }, "Infobip accepted the SMS but its result could not be saved");
    res.status(503).json({
      error: "Infobip accepted the message, but the local result could not be saved. Check SMS activity before manually retrying.",
    });
  }
});

function serializeStaffSmsRecord(record: StaffSmsOutboxRecord) {
  return {
    ...record,
    providerMessageId: record.providerMessageId ?? null,
    providerStatus: record.providerStatus ?? null,
    providerStatusGroup: record.providerStatusGroup ?? null,
    providerStatusAt: record.providerStatusAt ?? null,
    acceptedAt: record.acceptedAt ?? null,
    errorMessage: record.errorMessage ?? null,
    createdByUserId: record.createdByUserId ?? null,
  };
}

router.get("/admin/email/sms/activity", requireReviewer, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const records = await listStaffSmsAttempts();
    res.json(ListAdminSmsActivityResponse.parse(records.map(serializeStaffSmsRecord)));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load staff SMS activity");
    res.status(503).json({ error: "SMS activity could not be loaded." });
  }
});

router.post(
  "/admin/email/outbox/:messageId/retry",
  requireReviewer,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const parsed = RetryAdminEmailParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "The email record is invalid." });
      return;
    }
    try {
      const [record] = await db
        .select()
        .from(staffEmailOutboxTable)
        .where(eq(staffEmailOutboxTable.id, parsed.data.messageId))
        .limit(1);
      if (!record) {
        res.status(404).json({ error: "Email record not found." });
        return;
      }
      if (record.status !== "failed") {
        res.status(409).json({ error: "Only failed email attempts can be retried." });
        return;
      }
      const retried = await dispatchStaffEmail({
        idempotencyKey: record.idempotencyKey,
        recipientEmail: record.recipientEmail,
        subject: record.subject,
        messageText: record.messageText,
        eventKind: (record.eventKind ?? "manual") as StaffEmailMessageKind,
        applicationReference: record.applicationReference,
        createdByUserId: record.createdByUserId,
      });
      res.json(RetryAdminEmailResponse.parse(serializeStaffEmailRecord(retried)));
    } catch (error) {
      req.log.error({ err: error }, "Failed to retry staff email");
      res.status(503).json({ error: "Email retry could not be processed." });
    }
  },
);

router.get("/admin/overview", requireReviewer, async (req, res): Promise<void> => {
  try {
    const [users, total, submitted, underReview, approved, rejected, needsInformation, unresolved] =
      await Promise.all([
        clerkClient.users.getUserList({ limit: 1 }),
        db.select({ value: count() }).from(enrollmentApplicationsTable),
        db
          .select({ value: count() })
          .from(enrollmentApplicationsTable)
          .where(eq(enrollmentApplicationsTable.status, "submitted")),
        db
          .select({ value: count() })
          .from(enrollmentApplicationsTable)
          .where(eq(enrollmentApplicationsTable.status, "under_review")),
        db
          .select({ value: count() })
          .from(enrollmentApplicationsTable)
          .where(eq(enrollmentApplicationsTable.status, "approved")),
        db
          .select({ value: count() })
          .from(enrollmentApplicationsTable)
          .where(eq(enrollmentApplicationsTable.status, "rejected")),
        db
          .select({ value: count() })
          .from(enrollmentApplicationsTable)
          .where(eq(enrollmentApplicationsTable.status, "needs_information")),
        db
          .select({ value: count() })
          .from(supportTicketsTable)
          .where(inArray(supportTicketsTable.status, ["open", "in_progress"])),
      ]);
    const [totalUsers] = [Number(users.totalCount ?? users.data.length)];
    res.json(
      GetAdminOverviewResponse.parse({
        totalUsers,
        totalApplications: Number(total[0]?.value ?? 0),
        pendingApplications: Number(submitted[0]?.value ?? 0),
        underReviewApplications: Number(underReview[0]?.value ?? 0),
        approvedApplications: Number(approved[0]?.value ?? 0),
        rejectedApplications: Number(rejected[0]?.value ?? 0),
        needsInformationApplications: Number(needsInformation[0]?.value ?? 0),
        unresolvedSupportRequests: Number(unresolved[0]?.value ?? 0),
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to load administrator overview");
    res.status(503).json({ error: "Dashboard totals are temporarily unavailable." });
  }
});

router.get("/admin/users", requirePrimaryAdmin, async (req, res): Promise<void> => {
  const parsed = ListAdminUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [usersPage, applications] = await Promise.all([
      clerkClient.users.getUserList({ limit: 500 }),
      db
        .select()
        .from(enrollmentApplicationsTable)
        .orderBy(desc(enrollmentApplicationsTable.updatedAt)),
    ]);
    const latestByUser = new Map<string, (typeof applications)[number]>();
    for (const application of applications) {
      if (!latestByUser.has(application.clerkUserId)) {
        latestByUser.set(application.clerkUserId, application);
      }
    }
    const search = parsed.data.search?.trim().toLowerCase() ?? "";
    const users = usersPage.data
      .map((user) => {
        const application = latestByUser.get(user.id);
        const staffRole = trustedStaffRole(user);
        const accountStatus =
          user.publicMetadata?.accountStatus === "suspended"
            ? "suspended"
            : "active";
        const name =
          [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null;
        const email =
          user.emailAddresses.find(
            (address) => address.id === user.primaryEmailAddressId,
          )?.emailAddress ??
          user.emailAddresses[0]?.emailAddress ??
          null;
        const enrollmentStatus =
          application?.status === "draft" && application.currentStep > 0
            ? "in_progress"
            : application?.status ?? null;
        return {
          userId: user.id,
          name,
          username: user.username ?? null,
          email,
          role: staffRole ?? "applicant",
          accountStatus,
          applicationId: application?.id ?? null,
          categoryId: application?.categoryId ?? null,
          categoryName: application ? categoryName(application.categoryId) : null,
          applicationReference: application?.reference ?? null,
          registrationDate: new Date(user.createdAt).toISOString(),
          enrollmentStatus,
        };
      })
      .filter((user) => {
        if (
          parsed.data.accountStatus &&
          user.accountStatus !== parsed.data.accountStatus
        ) {
          return false;
        }
        return (
          !search ||
          [
            user.userId,
            user.name,
            user.username,
            user.email,
            user.categoryName,
            user.applicationReference,
            user.enrollmentStatus,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search)
        );
      });
    res.json(
      ListAdminUsersResponse.parse({
        users,
        totalCount: usersPage.totalCount ?? usersPage.data.length,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to load administrator user list");
    res.status(503).json({ error: "User accounts are temporarily unavailable." });
  }
});

router.post("/admin/users/invitations", requirePrimaryAdmin, async (req, res): Promise<void> => {
  const parsed = CreateAdminUserInvitationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const originHeader = req.get("origin");
  const rawForwardedHost = req.headers["x-forwarded-host"];
  const forwardedHost = Array.isArray(rawForwardedHost)
    ? rawForwardedHost[0]
    : rawForwardedHost;
  const requestHost = forwardedHost?.split(",")[0]?.trim() || req.get("host");
  const rawForwardedProto = req.headers["x-forwarded-proto"];
  const forwardedProto = Array.isArray(rawForwardedProto)
    ? rawForwardedProto[0]
    : rawForwardedProto;
  let trustedOrigin: URL | null = null;

  try {
    if (originHeader && requestHost) {
      const origin = new URL(originHeader);
      const requestOrigin = new URL(
        `${origin.protocol}//${requestHost}`,
      );
      const requestProtocol = forwardedProto?.split(",")[0]?.trim();
      if (
        ["http:", "https:"].includes(origin.protocol) &&
        origin.host.toLowerCase() === requestOrigin.host.toLowerCase() &&
        (!requestProtocol || `${requestProtocol}:` === origin.protocol)
      ) {
        trustedOrigin = origin;
      }
    }
  } catch {
    trustedOrigin = null;
  }

  if (!trustedOrigin) {
    res.status(403).json({ error: "Staff invitations must be sent from the portal." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const allowlistedRole = allowlistedStaffRole(email);
  if (
    (allowlistedRole && parsed.data.role !== allowlistedRole) ||
    (!allowlistedRole && parsed.data.role !== "moderator")
  ) {
    res.status(403).json({
      error:
        "Admin and sub-admin invitations are limited to their verified allowlisted email addresses.",
    });
    return;
  }
  const redirectUrl = new URL("/staff/sign-up", trustedOrigin).toString();
  try {
    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: email,
      expiresInDays: 7,
      notify: true,
      redirectUrl,
      publicMetadata: { role: parsed.data.role },
    });
    res.status(201).json(
      CreateAdminUserInvitationResponse.parse({
        invitationId: invitation.id,
        email: invitation.emailAddress,
        role: parsed.data.role,
        message: `Invitation email sent to ${invitation.emailAddress}.`,
      }),
    );
  } catch (error) {
    const errorStatus =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: unknown }).status)
        : Number.NaN;
    if ([400, 409, 422].includes(errorStatus)) {
      res.status(409).json({
        error: "This email already has an account or an active invitation.",
      });
      return;
    }
    req.log.error(
      { clerkStatus: Number.isFinite(errorStatus) ? errorStatus : undefined },
      "Failed to send staff invitation",
    );
    res.status(503).json({ error: "The staff invitation could not be sent." });
  }
});

router.patch("/admin/users/:userId/status", requirePrimaryAdmin, async (req, res): Promise<void> => {
  const params = UpdateAdminUserStatusParams.safeParse(req.params);
  const parsed = UpdateAdminUserStatusBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({
      error: !params.success ? params.error.message : (parsed.error?.message ?? "Invalid request body"),
    });
    return;
  }
  if (params.data.userId === res.locals.userId) {
    res.status(400).json({ error: "You cannot suspend your own staff account." });
    return;
  }
  try {
    const target = await clerkClient.users.getUser(params.data.userId);
    if (trustedStaffRole(target)) {
      res.status(403).json({ error: "Staff accounts cannot be suspended here." });
      return;
    }
    const updated = await clerkClient.users.updateUserMetadata(params.data.userId, {
      publicMetadata: { accountStatus: parsed.data.accountStatus },
    });
    const email =
      updated.emailAddresses.find(
        (address) => address.id === updated.primaryEmailAddressId,
      )?.emailAddress ??
      updated.emailAddresses[0]?.emailAddress ??
      null;
    res.json(
      UpdateAdminUserStatusResponse.parse({
        userId: updated.id,
        name:
          [updated.firstName, updated.lastName].filter(Boolean).join(" ").trim() ||
          null,
        username: updated.username ?? null,
        email,
        role: "applicant",
        accountStatus: parsed.data.accountStatus,
        applicationId: null,
        categoryId: null,
        categoryName: null,
        applicationReference: null,
        registrationDate: new Date(updated.createdAt).toISOString(),
        enrollmentStatus: null,
      }),
    );
  } catch (error) {
    req.log.error({ err: error, targetUserId: params.data.userId }, "Failed to update user account status");
    res.status(503).json({ error: "The account status could not be changed." });
  }
});

router.patch("/admin/users/:userId/role", requirePrimaryAdmin, async (req, res): Promise<void> => {
  const params = UpdateAdminUserRoleParams.safeParse(req.params);
  const parsed = UpdateAdminUserRoleBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: !params.success ? params.error.message : (parsed.error?.message ?? "Invalid request body") });
    return;
  }
  if (params.data.userId === res.locals.userId) {
    res.status(400).json({ error: "You cannot change your own staff role." });
    return;
  }
  try {
    const target = await clerkClient.users.getUser(params.data.userId);
    const targetEmail = verifiedPrimaryStaffEmail(target);
    const allowlistedRole = targetEmail
      ? allowlistedStaffRole(targetEmail)
      : undefined;
    const requestedRole = parsed.data.role;
    const isPrivilegedStaffRole =
      requestedRole === "admin" || requestedRole === "sub_admin";
    const primaryEmailIsVerified =
      target.primaryEmailAddress?.verification?.status === "verified";
    if (
      (allowlistedRole !== undefined && requestedRole !== allowlistedRole) ||
      (isPrivilegedStaffRole && requestedRole !== allowlistedRole) ||
      (requestedRole !== "applicant" && !primaryEmailIsVerified)
    ) {
      res.status(403).json({
        error:
          "Admin and sub-admin roles are fixed to verified allowlisted accounts; other staff access requires a verified, explicit support invitation.",
      });
      return;
    }
    const updated = await clerkClient.users.updateUserMetadata(params.data.userId, {
      publicMetadata: {
        ...target.publicMetadata,
        role: requestedRole === "applicant" ? null : requestedRole,
      },
    });
    const email =
      updated.emailAddresses.find((address) => address.id === updated.primaryEmailAddressId)?.emailAddress ??
      updated.emailAddresses[0]?.emailAddress ??
      null;
    res.json(UpdateAdminUserRoleResponse.parse({
      userId: updated.id,
      name: [updated.firstName, updated.lastName].filter(Boolean).join(" ").trim() || null,
      username: updated.username ?? null,
      email,
      role: parsed.data.role,
      accountStatus: updated.publicMetadata?.accountStatus === "suspended" ? "suspended" : "active",
      applicationId: null,
      categoryId: null,
      categoryName: null,
      applicationReference: null,
      registrationDate: new Date(updated.createdAt).toISOString(),
      enrollmentStatus: null,
    }));
  } catch (error) {
    req.log.error({ err: error, targetUserId: params.data.userId }, "Failed to assign staff role");
    res.status(503).json({ error: "The user role could not be changed." });
  }
});

router.get("/admin/applications/:applicationId", requireReviewer, async (req, res): Promise<void> => {
  const params = GetAdminApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [application] = await db
    .select()
    .from(enrollmentApplicationsTable)
    .where(eq(enrollmentApplicationsTable.id, params.data.applicationId))
    .limit(1);
  if (!application) {
    res.status(404).json({ error: "Application not found." });
    return;
  }
  let reviewApplication = application;
  let sourceGuestSubmissionStatus: string | null = null;
  if (application.sourceGuestPreapplicationId) {
    const [sourceGuestApplication] = await db
      .select({
        fullName: guestPreapplicationsTable.fullName,
        email: guestPreapplicationsTable.email,
        phone: guestPreapplicationsTable.phone,
        emailVerified: guestPreapplicationsTable.emailVerified,
        submissionStatus: guestPreapplicationsTable.submissionStatus,
      })
      .from(guestPreapplicationsTable)
      .where(eq(guestPreapplicationsTable.id, application.sourceGuestPreapplicationId))
      .limit(1);
    if (sourceGuestApplication) {
      sourceGuestSubmissionStatus = sourceGuestApplication.submissionStatus;
      reviewApplication = {
        ...application,
        answers: {
          ...(application.answers ?? {}),
          contactDetails: {
            fullName: sourceGuestApplication.fullName,
            email: sourceGuestApplication.email,
            phone: sourceGuestApplication.phone,
            emailVerified: sourceGuestApplication.emailVerified,
          },
        },
      };
    }
  }
  const response: Record<string, unknown> = serializeApplication(reviewApplication, true, true);
  if (
    application.sourceGuestPreapplicationId &&
    sourceGuestSubmissionStatus === "submitted"
  ) {
    const evidence = await db
      .select()
      .from(guestPreapplicationEvidenceTable)
      .where(eq(
        guestPreapplicationEvidenceTable.applicationId,
        application.sourceGuestPreapplicationId,
      ))
      .orderBy(desc(guestPreapplicationEvidenceTable.createdAt));
    response.evidence = evidence.map((item) => ({
      ...serializeGuestEvidence(item),
      downloadUrl: item.uploadedAt
        ? `/api/admin/applications/${application.id}/evidence/${item.id}/file`
        : null,
    }));
  }
  res.json(GetAdminApplicationResponse.parse(response));
});

type InvitationCodeRevealResult =
  | { kind: "revealed"; code: string; revealedAt: Date }
  | { kind: "not_found" }
  | { kind: "unavailable" };

async function revealInvitationCodeForReview(
  applicationType: "guest_preapplication" | "enrollment_application",
  applicationId: string,
  actorUserId: string,
): Promise<InvitationCodeRevealResult> {
  return db.transaction(async (transaction) => {
    let storedCode: string | null | undefined;
    let scope: InvitationCodeScope;
    let storageType = applicationType;
    let storageId = applicationId;
    let hasLegacyPlaintext = false;
    let hasCiphertext = false;

    if (applicationType === "guest_preapplication") {
      const [application] = await transaction
        .select({
          id: guestPreapplicationsTable.id,
          invitationCodeCiphertext: guestPreapplicationsTable.invitationCodeCiphertext,
          referenceCode: guestPreapplicationsTable.referenceCode,
        })
        .from(guestPreapplicationsTable)
        .where(eq(guestPreapplicationsTable.id, applicationId))
        .for("update")
        .limit(1);
      if (!application) return { kind: "not_found" };
      storedCode = application.invitationCodeCiphertext ?? application.referenceCode;
      hasLegacyPlaintext = Boolean(application.referenceCode);
      hasCiphertext = Boolean(application.invitationCodeCiphertext);
      scope = `guest:${application.id}`;
    } else {
      const [application] = await transaction
        .select({
          id: enrollmentApplicationsTable.id,
          invitationCodeCiphertext: enrollmentApplicationsTable.invitationCodeCiphertext,
          referenceCode: enrollmentApplicationsTable.referenceCode,
          sourceGuestPreapplicationId: enrollmentApplicationsTable.sourceGuestPreapplicationId,
        })
        .from(enrollmentApplicationsTable)
        .where(eq(enrollmentApplicationsTable.id, applicationId))
        .for("update")
        .limit(1);
      if (!application) return { kind: "not_found" };
      storedCode = application.invitationCodeCiphertext ?? application.referenceCode;
      hasLegacyPlaintext = Boolean(application.referenceCode);
      hasCiphertext = Boolean(application.invitationCodeCiphertext);
      scope = `application:${application.id}`;
      if (!storedCode && application.sourceGuestPreapplicationId) {
        const [sourceGuest] = await transaction
          .select({
            id: guestPreapplicationsTable.id,
            invitationCodeCiphertext: guestPreapplicationsTable.invitationCodeCiphertext,
            referenceCode: guestPreapplicationsTable.referenceCode,
          })
          .from(guestPreapplicationsTable)
          .where(eq(
            guestPreapplicationsTable.id,
            application.sourceGuestPreapplicationId,
          ))
          .for("update")
          .limit(1);
        if (sourceGuest) {
          storedCode = sourceGuest.invitationCodeCiphertext ?? sourceGuest.referenceCode;
          hasLegacyPlaintext = Boolean(sourceGuest.referenceCode);
          hasCiphertext = Boolean(sourceGuest.invitationCodeCiphertext);
          scope = `guest:${sourceGuest.id}`;
          storageType = "guest_preapplication";
          storageId = sourceGuest.id;
        }
      }
    }

    if (!storedCode) return { kind: "not_found" };
    const code = hasCiphertext
      ? decryptInvitationCode(storedCode, scope)
      : storedCode;
    if (!code) {
      return { kind: "unavailable" };
    }

    if (hasLegacyPlaintext || !hasCiphertext) {
      const encryptedCode = hasCiphertext
        ? storedCode
        : encryptInvitationCode(code, scope);
      if (storageType === "guest_preapplication") {
        await transaction
          .update(guestPreapplicationsTable)
          .set({
            invitationCodeCiphertext: encryptedCode,
            referenceCode: null,
          })
          .where(eq(guestPreapplicationsTable.id, storageId));
      } else {
        await transaction
          .update(enrollmentApplicationsTable)
          .set({
            invitationCodeCiphertext: encryptedCode,
            referenceCode: null,
          })
          .where(eq(enrollmentApplicationsTable.id, storageId));
      }
    }

    const [audit] = await transaction
      .insert(invitationCodeRevealAuditTable)
      .values({
        applicationType,
        applicationId,
        actorUserId,
        action: "view_invitation_code",
      })
      .returning({ createdAt: invitationCodeRevealAuditTable.createdAt });
    if (!audit) return { kind: "unavailable" };
    return { kind: "revealed", code, revealedAt: audit.createdAt };
  });
}

router.post(
  "/admin/applications/:applicationId/invitation-code/reveal",
  requireReviewer,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const params = GetAdminApplicationParams.safeParse(req.params);
    if (!params.success) {
      res.status(404).json({ error: "Invitation Code is unavailable for this application." });
      return;
    }
    try {
      const result = await revealInvitationCodeForReview(
        "enrollment_application",
        params.data.applicationId,
        res.locals.userId as string,
      );
      if (result.kind === "not_found") {
        res.status(404).json({ error: "Invitation Code is unavailable for this application." });
        return;
      }
      if (result.kind === "unavailable") {
        res.status(503).json({ error: "Invitation Code is temporarily unavailable." });
        return;
      }
      res.json(RevealAdminApplicationInvitationCodeResponse.parse({
        applicationId: params.data.applicationId,
        code: result.code,
        revealedAt: result.revealedAt.toISOString(),
      }));
    } catch {
      res.status(503).json({ error: "Invitation Code is temporarily unavailable." });
    }
  },
);

router.post(
  "/admin/guest-preapplications/:applicationId/invitation-code/reveal",
  requireReviewer,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const params = UpdateAdminGuestPreapplicationParams.safeParse(req.params);
    if (!params.success) {
      res.status(404).json({ error: "Invitation Code is unavailable for this application." });
      return;
    }
    try {
      const result = await revealInvitationCodeForReview(
        "guest_preapplication",
        params.data.applicationId,
        res.locals.userId as string,
      );
      if (result.kind === "not_found") {
        res.status(404).json({ error: "Invitation Code is unavailable for this application." });
        return;
      }
      if (result.kind === "unavailable") {
        res.status(503).json({ error: "Invitation Code is temporarily unavailable." });
        return;
      }
      res.json(RevealAdminGuestPreapplicationInvitationCodeResponse.parse({
        applicationId: params.data.applicationId,
        code: result.code,
        revealedAt: result.revealedAt.toISOString(),
      }));
    } catch {
      res.status(503).json({ error: "Invitation Code is temporarily unavailable." });
    }
  },
);

router.get(
  "/admin/applications/:applicationId/evidence/:evidenceId/file",
  requireReviewer,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    const params = DownloadSubmittedApplicationEvidenceParams.safeParse(req.params);
    if (!params.success) {
      res.status(404).json({ error: "Uploaded evidence file not found." });
      return;
    }
    const { applicationId, evidenceId } = params.data;
    try {
      const [application] = await db
        .select()
        .from(enrollmentApplicationsTable)
        .where(eq(enrollmentApplicationsTable.id, applicationId))
        .limit(1);
      if (!application?.sourceGuestPreapplicationId) {
        res.status(404).json({ error: "Uploaded evidence file not found." });
        return;
      }
      const [sourceGuestApplication] = await db
        .select({
          submissionStatus: guestPreapplicationsTable.submissionStatus,
        })
        .from(guestPreapplicationsTable)
        .where(eq(
          guestPreapplicationsTable.id,
          application.sourceGuestPreapplicationId,
        ))
        .limit(1);
      if (sourceGuestApplication?.submissionStatus !== "submitted") {
        res.status(404).json({ error: "Uploaded evidence file not found." });
        return;
      }
      const [evidence] = await db
        .select()
        .from(guestPreapplicationEvidenceTable)
        .where(and(
          eq(guestPreapplicationEvidenceTable.id, evidenceId),
          eq(
            guestPreapplicationEvidenceTable.applicationId,
            application.sourceGuestPreapplicationId,
          ),
        ))
        .limit(1);
      if (!evidence?.uploadedAt) {
        res.status(404).json({ error: "Uploaded evidence file not found." });
        return;
      }
      const objectFile = await objectStorage.getObjectEntityFile(evidence.objectPath);
      const [metadata] = await objectFile.getMetadata();
      res.setHeader("Content-Type", evidence.contentType);
      res.setHeader("Content-Length", String(metadata.size));
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(safeEvidenceFileName(evidence.fileName))}`,
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      const stream = objectFile.createReadStream();
      stream.on("error", (error) => {
        req.log.error(
          { err: error, applicationId, evidenceId },
          "Failed to stream submitted application evidence",
        );
        if (res.headersSent) res.destroy(error);
        else res.status(503).json({ error: "The evidence file could not be downloaded." });
      });
      stream.pipe(res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Uploaded evidence file not found." });
        return;
      }
      req.log.error(
        { err: error, applicationId, evidenceId },
        "Failed to open submitted application evidence",
      );
      res.status(503).json({ error: "The evidence file could not be downloaded." });
    }
  },
);

router.get(
  "/admin/applications/:applicationId/history",
  requireReviewer,
  async (req, res): Promise<void> => {
    const params = GetAdminApplicationHistoryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const events = await db
      .select()
      .from(applicationEventsTable)
      .where(eq(applicationEventsTable.applicationId, params.data.applicationId))
      .orderBy(desc(applicationEventsTable.createdAt));
    res.json(
      GetAdminApplicationHistoryResponse.parse(
        events.map((event) => ({
          id: event.id,
          eventType: event.eventType,
          note: event.note,
          createdAt: event.createdAt.toISOString(),
          actorUserId: event.actorUserId,
        })),
      ),
    );
  },
);

router.post(
  "/admin/applications/:applicationId/notes",
  requireReviewer,
  async (req, res): Promise<void> => {
    const params = AddAdminApplicationNoteParams.safeParse(req.params);
    const parsed = AddAdminApplicationNoteBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success ? params.error.message : (parsed.error?.message ?? "Invalid request body"),
      });
      return;
    }
    const [application] = await db
      .select({ id: enrollmentApplicationsTable.id })
      .from(enrollmentApplicationsTable)
      .where(eq(enrollmentApplicationsTable.id, params.data.applicationId))
      .limit(1);
    if (!application) {
      res.status(404).json({ error: "Application not found." });
      return;
    }
    const [event] = await db
      .insert(applicationEventsTable)
      .values({
        applicationId: application.id,
        actorUserId: res.locals.userId,
        eventType: "internal_note",
        note: parsed.data.note.trim(),
      })
      .returning();
    if (!event) {
      res.status(500).json({ error: "The internal note could not be saved." });
      return;
    }
    res.status(201).json(
      AddAdminApplicationNoteResponse.parse({
        id: event.id,
        eventType: event.eventType,
        note: event.note,
        createdAt: event.createdAt.toISOString(),
        actorUserId: event.actorUserId,
      }),
    );
  },
);

router.get("/admin/review/queue", requireReviewer, async (req, res): Promise<void> => {
  const rawStatus = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const search = typeof req.query.search === "string"
    ? req.query.search.trim().toLowerCase().slice(0, 200)
    : "";
  const allowedStatuses = new Set([
    "draft",
    "submitted",
    "under_review",
    "needs_information",
    "approved",
    "rejected",
    "received",
    "contacted",
    "closed",
  ]);
  if (rawStatus && !allowedStatuses.has(rawStatus)) {
    res.status(400).json({ error: "Unsupported review status." });
    return;
  }

  try {
    const [applications, guestApplications] = await Promise.all([
      db.select()
        .from(enrollmentApplicationsTable)
        .orderBy(desc(enrollmentApplicationsTable.updatedAt))
        .limit(500),
      db.select()
        .from(guestPreapplicationsTable)
        .where(isNull(guestPreapplicationsTable.linkedApplicationId))
        .orderBy(desc(guestPreapplicationsTable.updatedAt))
        .limit(500),
    ]);

    const applicationItems = applications
      .filter((application) => !rawStatus || application.status === rawStatus)
      .map((application) => ({
        recordType: "enrollment_application" as const,
        id: application.id,
        reference: application.reference,
        status: application.status,
        categoryId: application.categoryId,
        categoryName: categoryName(application.categoryId),
        applicantName: nestedString(application.answers ?? {}, "contactDetails", "fullName") || null,
        applicantEmail: nestedString(application.answers ?? {}, "contactDetails", "email") || null,
        submittedAt: application.submittedAt?.toISOString() ?? null,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
        reviewUrl: `/admin/applications/${application.id}`,
      }));

    const guestItems = guestApplications
      .filter((application) =>
        !rawStatus ||
        application.status === rawStatus ||
        application.submissionStatus === rawStatus,
      )
      .map((application) => ({
        recordType: "guest_preapplication" as const,
        id: application.id,
        reference: application.reference,
        status: application.status,
        submissionStatus: application.submissionStatus,
        categoryId: application.categoryId,
        categoryName: categoryName(application.categoryId),
        applicantName: application.fullName,
        applicantEmail: application.email,
        emailVerified: application.emailVerified,
        detailsComplete: application.detailsComplete,
        currentStep: application.currentStep,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
        reviewUrl: `/admin/guest-preapplications/${application.id}`,
      }));

    const items = [...applicationItems, ...guestItems]
      .filter((item) => {
        if (!search) return true;
        return [
          item.reference,
          item.categoryName,
          item.applicantName ?? "",
          item.applicantEmail ?? "",
          item.status,
          item.recordType,
          "submissionStatus" in item ? item.submissionStatus : "",
        ].join(" ").toLowerCase().includes(search);
      })
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 500);

    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.json({
      items,
      total: items.length,
      counts: {
        enrollmentApplications: applicationItems.length,
        guestPreapplications: guestItems.length,
      },
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load unified staff review queue");
    res.status(503).json({ error: "The review queue is temporarily unavailable." });
  }
});

router.get("/admin/applications", requireReviewer, async (req, res): Promise<void> => {
  const parsed = ListApplicationsForReviewQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const filters = [];
  if (parsed.data.status) {
    filters.push(
      eq(enrollmentApplicationsTable.status, parsed.data.status as ApplicationStatus),
    );
  }
  const applications = await db
    .select()
    .from(enrollmentApplicationsTable)
    .where(and(...filters))
    .orderBy(desc(enrollmentApplicationsTable.updatedAt));
  const serialized = applications.map((application) =>
    serializeApplication(application, false, true),
  );
  const search = parsed.data.search?.trim().toLowerCase();
  const results = search
    ? serialized.filter((application) =>
        [
          application.reference,
          application.categoryName,
          application.applicantName ?? "",
          application.applicantEmail ?? "",
          application.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search),
      )
    : serialized;
  res.json(ListApplicationsForReviewResponse.parse(results));
});

router.post(
  "/admin/applications/:applicationId/decision",
  requireReviewer,
  async (req, res): Promise<void> => {
    const params = DecideApplicationParams.safeParse(req.params);
    const parsed = DecideApplicationBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.success
            ? "Invalid request."
            : parsed.error.message,
      });
      return;
    }
    const [application] = await db
      .select()
      .from(enrollmentApplicationsTable)
      .where(eq(enrollmentApplicationsTable.id, params.data.applicationId))
      .limit(1);
    if (!application) {
      res.status(404).json({ error: "Application not found." });
      return;
    }
    if (!["submitted", "under_review", "needs_information"].includes(application.status)) {
      res.status(409).json({ error: "This application is not available for review." });
      return;
    }
    if (
      ["reject", "request_information"].includes(parsed.data.decision) &&
      !parsed.data.note?.trim()
    ) {
      res.status(400).json({ error: "Add a note for this decision." });
      return;
    }
    if (
      parsed.data.decision === "request_information" &&
      (!parsed.data.reopenSections || parsed.data.reopenSections.length === 0)
    ) {
      res.status(400).json({
        error: "Select at least one application section to reopen.",
      });
      return;
    }

    const nextStatus =
      parsed.data.decision === "approve"
        ? "approved"
        : parsed.data.decision === "reject"
          ? "rejected"
          : parsed.data.decision === "mark_under_review"
            ? "under_review"
            : "needs_information";
    const now = new Date();
    const nextAnswers = {
      ...(application.answers ?? {}),
      __requestedSections:
        parsed.data.decision === "request_information"
          ? parsed.data.reopenSections ?? []
          : [],
    };
    const updated = await db.transaction(async (transaction) => {
      const [row] = await transaction
        .update(enrollmentApplicationsTable)
        .set({
          status: nextStatus,
          answers: nextAnswers,
          reviewNote: parsed.data.note?.trim() || null,
          reviewerUserId: res.locals.userId,
          updatedAt: now,
        })
        .where(
          and(
            eq(enrollmentApplicationsTable.id, params.data.applicationId),
            eq(enrollmentApplicationsTable.status, application.status),
          ),
        )
        .returning();
      if (!row) return null;
      await transaction.insert(applicationEventsTable).values({
        applicationId: row.id,
        actorUserId: res.locals.userId,
        eventType: `status_changed:${application.status}->${nextStatus}`,
        note: parsed.data.note?.trim() || null,
      });
      return row;
    });
    if (!updated) {
      res.status(409).json({
        error: "The application changed while this decision was being recorded.",
      });
      return;
    }
    res.json(DecideApplicationResponse.parse(serializeApplication(updated, false, true)));
  },
);

router.get("/admin/support/tickets", async (req, res): Promise<void> => {
  const tickets = await db
    .select()
    .from(supportTicketsTable)
    .orderBy(desc(supportTicketsTable.updatedAt))
    .limit(300);
  const [applications, userPage] = await Promise.all([
    db
      .select({
        id: enrollmentApplicationsTable.id,
        reference: enrollmentApplicationsTable.reference,
      })
      .from(enrollmentApplicationsTable),
    clerkClient.users.getUserList({ limit: 500 }),
  ]);
  const references = new Map(applications.map((application) => [application.id, application.reference]));
  const usersById = new Map(userPage.data.map((user) => [
    user.id,
    [
      user.id,
      user.username ?? "",
      user.firstName ?? "",
      user.lastName ?? "",
      ...user.emailAddresses.map((address) => address.emailAddress),
    ].join(" ").toLowerCase(),
  ]));
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const serialized = tickets.map((ticket) =>
    serializeTicket(
      ticket,
      ticket.applicationId ? references.get(ticket.applicationId) ?? null : null,
    ),
  );
  const filtered = serialized.filter((ticket) => {
    if (status && ticket.status !== status) return false;
    if (!search) return true;
    return [
      ticket.applicantUserId,
      ticket.applicationReference,
      ticket.subject,
      ticket.category,
      ticket.message,
      usersById.get(ticket.applicantUserId) ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
  res.json(ListSupportTicketsForAdminResponse.parse(filtered));
});

router.post(
  "/admin/support/tickets/:ticketId/reply",
  async (req, res): Promise<void> => {
    const params = ReplyToSupportTicketParams.safeParse(req.params);
    const parsed = ReplyToSupportTicketBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.success
            ? "Invalid request."
            : parsed.error.message,
      });
      return;
    }
    const [ticket] = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, params.data.ticketId))
      .limit(1);
    if (!ticket) {
      res.status(404).json({ error: "Support request not found." });
      return;
    }
    const now = new Date();
    const [updated] = await db
      .update(supportTicketsTable)
      .set({
        response: parsed.data.response,
        status: parsed.data.status,
        messages: [
          ...(ticket.messages ?? []),
          {
            id: randomUUID(),
            actorUserId: res.locals.userId,
            actorRole: "administrator",
            body: parsed.data.response.trim(),
            createdAt: now.toISOString(),
          },
        ],
        updatedByUserId: res.locals.userId,
        updatedAt: now,
      })
      .where(eq(supportTicketsTable.id, params.data.ticketId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Support request not found." });
      return;
    }
    let reference: string | null = null;
    if (updated.applicationId) {
      const [application] = await db
        .select({ reference: enrollmentApplicationsTable.reference })
        .from(enrollmentApplicationsTable)
        .where(eq(enrollmentApplicationsTable.id, updated.applicationId))
        .limit(1);
      reference = application?.reference ?? null;
    }
    res.json(
      ReplyToSupportTicketResponse.parse(serializeTicket(updated, reference)),
    );
  },
);

router.patch(
  "/admin/support/tickets/:ticketId/assignment",
  async (req, res): Promise<void> => {
    const params = AssignSupportTicketParams.safeParse(req.params);
    const parsed = AssignSupportTicketBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success ? params.error.message : (parsed.error?.message ?? "Invalid request body"),
      });
      return;
    }
    if (parsed.data.assigneeUserId) {
      try {
        const assignee = await clerkClient.users.getUser(
          parsed.data.assigneeUserId,
        );
        if (!trustedStaffRole(assignee)) {
          res.status(403).json({
            error: "Support requests can only be assigned to authorized staff.",
          });
          return;
        }
      } catch (error) {
        req.log.error(
          { err: error, assigneeUserId: parsed.data.assigneeUserId },
          "Failed to verify support assignee",
        );
        res.status(404).json({ error: "Authorized staff member not found." });
        return;
      }
    }
    const [updated] = await db
      .update(supportTicketsTable)
      .set({
        assignedToUserId: parsed.data.assigneeUserId,
        updatedByUserId: res.locals.userId,
        updatedAt: new Date(),
      })
      .where(eq(supportTicketsTable.id, params.data.ticketId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Support request not found." });
      return;
    }
    let reference: string | null = null;
    if (updated.applicationId) {
      const [application] = await db
        .select({ reference: enrollmentApplicationsTable.reference })
        .from(enrollmentApplicationsTable)
        .where(eq(enrollmentApplicationsTable.id, updated.applicationId))
        .limit(1);
      reference = application?.reference ?? null;
    }
    res.json(
      AssignSupportTicketResponse.parse(serializeTicket(updated, reference)),
    );
  },
);

export default router;
