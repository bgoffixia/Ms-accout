import { readFile } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";

const applicationId = "1f7ad041-05af-4fcb-971b-c913287a11a8";
const reference = "GUEST-2026-TEST";
const reviewerOnlyNote = "REVIEWER_ONLY_TEST_MARKER";

type GuestDraft = {
  id: string;
  reference: string;
  categoryId: "category-1";
  categoryName: string;
  fullName: string;
  email: string;
  status: "received";
  submissionStatus: "draft" | "submitted";
  emailVerified: boolean;
  emailVerificationRequired: boolean;
  referenceCode: string | null;
  linkedApplicationId: string | null;
  currentStep: number;
  detailsComplete: boolean;
  answers: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

class GuestApiFixture {
  draft: GuestDraft | null = null;
  trackingKey = "";
  createCount = 0;
  lookupCount = 0;
  invitationCodeLength = 8;
  categoryOneTitle = "Account Provider One";
  landingTitle = "Enrollment";
  landingDescription = "Complete your enrollment.";
  landingButtonLabel = "Get started";
  screenCopyOverrides: Record<string, Record<string, string>> = {};
  formContentOverrides: Record<string, Record<string, string>> = {};
  readonly requestCounts = new Map<string, number>();
  applicantWriteCount = 0;
  readonly uploadedEvidence: {
    id: string;
    slot: string;
    objectPath: string;
  }[] = [];
  private evidenceId = 0;

  async handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    this.requestCounts.set(
      `${method} ${path}`,
      (this.requestCounts.get(`${method} ${path}`) ?? 0) + 1,
    );
    if (
      ["POST", "PATCH", "PUT", "DELETE"].includes(method) &&
      path.startsWith("/api/guest/")
    ) {
      this.applicantWriteCount += 1;
    }
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (method === "GET" && path === "/api/enrollment/categories") {
      return json(
        ["category-1", "category-2", "category-3", "category-4"].map(
          (id, index) => ({
            id,
            name: `Account Provider ${index + 1}`,
            description: "Account provider enrollment.",
            accent: "#168341",
          }),
        ),
      );
    }
    if (method === "GET" && path.startsWith("/api/invitation-code-settings/")) {
      const providerId = path.split("/").at(-1);
      return json({
        providerId,
        requiredLength: this.invitationCodeLength,
      });
    }
    if (method === "GET" && path === "/api/portal/settings") {
      return json({
        hero: {
          title: this.landingTitle,
          description: this.landingDescription,
          getStartedLabel: this.landingButtonLabel,
          loginLabel: "Sign in",
        },
        cards: ["category-1", "category-2", "category-3", "category-4"].map(
          (id) => ({
            id,
            title: id === "category-1" ? this.categoryOneTitle : id,
            description: "Enrollment category.",
            buttonLabel: "Start application",
            backgroundColor: "#F5F8FA",
            logoDataUrl: null,
            entryLogoDataUrl:
              id === "category-1"
                ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Ccircle cx='5' cy='5' r='5' fill='green'/%3E%3C/svg%3E"
                : null,
            cardLogoAlignment: "center",
            cardLogoVerticalOffset: 0,
            cardTitleFontSize: id === "category-1" ? 18 : 14,
            cardTitleHorizontalOffset: id === "category-1" ? 8 : 0,
            cardTitleVerticalOffset: id === "category-1" ? -4 : 0,
            cardDescriptionFontSize: id === "category-1" ? 13 : 11,
            cardDescriptionHorizontalOffset: id === "category-1" ? -6 : 0,
            cardDescriptionVerticalOffset: id === "category-1" ? 5 : 0,
            entryLogoAlignment: "left",
            entryLogoVerticalOffset: 14,
          }),
        ),
        theme: {
          buttonSize: "standard",
          buttonPlacement: "right",
          categoryInputTransparent: true,
        },
        screenCopy: {
          dashboard: {
            title: "Choose an account provider.",
            description: "This dashboard introduction should appear once.",
            sectionIdLabel: "START ENROLLMENT",
          },
          "category-entry-1": {
            referenceCodeVisible: "true",
            referenceCodeLabel: "Invitation Code",
          },
          ...this.screenCopyOverrides,
        },
        pageThemes: {},
      });
    }
    if (method === "GET" && path === "/api/applicant/form-content") {
      return json({
        version: 0,
        defaults: {},
        savedContent: this.formContentOverrides,
        updatedAt: null,
        persistenceAvailable: false,
      });
    }
    if (method === "POST" && path === "/api/guest/preapplications") {
      const body = request.postDataJSON();
      this.createCount += 1;
      this.trackingKey = body.trackingKey;
      const categoryId =
        typeof body.categoryId === "string" ? body.categoryId : "category-1";
      this.draft = {
        id: applicationId,
        reference,
        categoryId,
        categoryName: `Category ${categoryId.slice(-1)}`,
        fullName: body.fullName,
        email: body.email,
        status: "received",
        submissionStatus: "draft",
        emailVerified: false,
        emailVerificationRequired: false,
        referenceCode: null,
        linkedApplicationId: null,
        currentStep: 0,
        detailsComplete: false,
        answers: {},
        createdAt: "2026-10-12T12:00:00.000Z",
        updatedAt: "2026-10-12T12:00:00.000Z",
      };
      return json(this.createdResponse(), 201);
    }
    if (method === "POST" && path === "/api/applications/tracking/lookup") {
      this.lookupCount += 1;
      const body = request.postDataJSON();
      if (!this.authorized(body)) {
        return json(
          {
            error:
              "The application reference and private tracking key could not be verified.",
          },
          404,
        );
      }
      const status = this.statusResponse();
      const {
        answers: _answers,
        reviewNote: _reviewNote,
        privateReviewerDetails: _privateReviewerDetails,
        ...safe
      } = status;
      return json({
        applicationId: safe.id,
        reference: safe.reference,
        applicationType: "guest_preapplication",
        categoryId: safe.categoryId,
        categoryName: safe.categoryName,
        status: safe.status,
        submissionStatus: safe.submissionStatus,
        currentStep: safe.currentStep,
        detailsComplete: safe.detailsComplete,
        updatedAt: safe.updatedAt,
        reviewStatus: safe.reviewStatus,
        applicantFollowup: null,
        outstandingRequirements: [],
      });
    }
    if (method === "POST" && path === "/api/guest/preapplications/lookup") {
      this.lookupCount += 1;
      const body = request.postDataJSON();
      return this.authorized(body)
        ? json(this.statusResponse())
        : json(
            {
              error:
                "The application reference and private tracking key could not be verified.",
            },
            404,
          );
    }
    if (
      method === "PATCH" &&
      path === `/api/guest/preapplications/${applicationId}`
    ) {
      const body = request.postDataJSON();
      if (!this.authorized(body)) {
        return json(
          {
            error:
              "The application reference and private tracking key could not be verified.",
          },
          404,
        );
      }
      this.draft.answers = body.answers;
      this.draft.currentStep = body.currentStep;
      if (typeof body.referenceCode === "string") {
        this.draft.referenceCode = body.referenceCode.trim() || null;
      }
      this.draft.detailsComplete = this.detailsAreComplete();
      this.draft.updatedAt = new Date().toISOString();
      return json(this.statusResponse());
    }
    if (
      method === "POST" &&
      path === `/api/guest/preapplications/${applicationId}/evidence/upload-url`
    ) {
      const body = request.postDataJSON();
      if (!this.authorized(body)) {
        return json(
          {
            error:
              "The application reference and private tracking key could not be verified.",
          },
          404,
        );
      }
      const id = `evidence-${++this.evidenceId}`;
      const evidence = {
        id,
        slot: body.evidenceSlot,
        objectPath: `private/guest-evidence/${id}`,
      };
      this.uploadedEvidence.push(evidence);
      return json({
        evidenceId: id,
        uploadUrl: `${url.origin}/__test-upload/${id}`,
        expiresAt: "2026-10-12T12:15:00.000Z",
      });
    }
    if (method === "PUT" && path.startsWith("/__test-upload/")) {
      return route.fulfill({ status: 200, body: "stored" });
    }
    if (
      method === "POST" &&
      path.match(
        new RegExp(
          `^/api/guest/preapplications/${applicationId}/evidence/[^/]+/complete$`,
        ),
      )
    ) {
      if (!this.authorized(request.postDataJSON())) {
        return json(
          {
            error:
              "The application reference and private tracking key could not be verified.",
          },
          404,
        );
      }
      const evidenceId = path.split("/").at(-2);
      const evidence = this.uploadedEvidence.find(
        (item) => item.id === evidenceId,
      );
      if (!evidence) return json({ message: "Upload missing" }, 404);
      return json({
        evidenceId,
        evidenceType:
          evidence.slot === "verification_video"
            ? "verification_video"
            : "identity_document",
        evidenceSlot: evidence.slot,
        fileName:
          evidence.slot === "identity_front"
            ? "identity-front.png"
            : "verification-recording.webm",
        contentType:
          evidence.slot === "identity_front" ? "image/png" : "video/webm",
        sizeBytes: 16,
        objectPath: evidence.objectPath,
        uploadedAt: "2026-10-12T12:01:00.000Z",
      });
    }
    if (
      method === "POST" &&
      path === `/api/guest/preapplications/${applicationId}/submit`
    ) {
      if (!this.authorized(request.postDataJSON())) {
        return json(
          {
            error:
              "The application reference and private tracking key could not be verified.",
          },
          404,
        );
      }
      this.draft.submissionStatus = "submitted";
      this.draft.emailVerified = false;
      this.draft.emailVerificationRequired = false;
      return json(this.statusResponse());
    }

    return json({ message: `Unmocked API request: ${method} ${path}` }, 501);
  }

  private detailsAreComplete() {
    const answers = this.draft?.answers as Record<string, any> | undefined;
    if (!answers || answers.categoryEntryComplete !== true) return false;
    const person = answers.personalInformation ?? {};
    const nextOfKin = answers.nextOfKin ?? {};
    const education = answers.education ?? {};
    const work = answers.workInformation ?? {};
    const identity = answers.proofOfIdentity ?? {};
    const video = answers.liveVideoRecording ?? {};
    const hasText = (value: unknown) =>
      typeof value === "string" && value.trim().length > 0;
    const completeFields = [
      [
        person,
        [
          "firstName",
          "surname",
          "dateOfBirth",
          "nationality",
          "phone",
          "email",
          "residentialAddress",
          "stateRegion",
          "city",
        ],
      ],
      [nextOfKin, ["fullName", "relationship", "phone"]],
      [
        education,
        [
          "highestQualification",
          "institution",
          "courseField",
          "startYear",
          "completionYear",
          "certificationStatus",
        ],
      ],
    ] as const;
    if (
      !completeFields.every(([section, keys]) =>
        keys.every((key) => hasText(section[key])),
      )
    )
      return false;
    const startYear = Number(education.startYear);
    const completionYear = Number(education.completionYear);
    if (
      !Number.isInteger(startYear) ||
      !Number.isInteger(completionYear) ||
      startYear < 1900 ||
      completionYear < startYear
    )
      return false;
    const employmentStatus = String(work.employmentStatus ?? "").toLowerCase();
    if (!employmentStatus) return false;
    if (
      employmentStatus === "employed" &&
      !["occupation", "employer", "workAddress"].every((key) =>
        hasText(work[key]),
      )
    )
      return false;
    if (
      employmentStatus === "self-employed" &&
      !["businessName", "workAddress"].every((key) => hasText(work[key]))
    )
      return false;
    if (!hasText(identity.documentType) || !hasText(identity.frontObjectPath))
      return false;
    if (
      ["National ID", "Driver license", "Passport card"].includes(
        identity.documentType,
      ) &&
      !hasText(identity.backObjectPath)
    )
      return false;
    if (
      video.consentAccepted !== true ||
      video.durationSeconds !== 12 ||
      !hasText(video.objectPath)
    )
      return false;
    return (
      this.uploadedEvidence.some(
        (item) => item.objectPath === identity.frontObjectPath,
      ) &&
      this.uploadedEvidence.some((item) => item.objectPath === video.objectPath)
    );
  }

  private authorized(body: { reference?: unknown; trackingKey?: unknown }) {
    return Boolean(
      this.draft &&
      body.reference === this.draft.reference &&
      body.trackingKey === this.trackingKey &&
      /^[A-Za-z0-9_-]{43}$/.test(this.trackingKey),
    );
  }

  private createdResponse() {
    const {
      answers: _answers,
      referenceCode: _referenceCode,
      ...response
    } = this.draft!;
    return { ...response, trackingKey: this.trackingKey };
  }

  private statusResponse() {
    const { referenceCode: _referenceCode, ...safeDraft } = this.draft!;
    return {
      ...safeDraft,
      emailVerificationRequired: false,
      answers: this.draft!.answers,
      reviewStatus:
        this.draft!.submissionStatus === "submitted" ? "submitted" : null,
      applicantFollowup: null,
      outstandingRequirements: [],
      // Deliberately include a reviewer-only value in the fixture to ensure it
      // never becomes visible in the applicant's resumed experience.
      reviewNote: reviewerOnlyNote,
      privateReviewerDetails: { note: reviewerOnlyNote },
    };
  }
}

async function fillStage(page: Page, fields: Record<string, string>) {
  for (const [testId, value] of Object.entries(fields)) {
    await page.getByTestId(testId).fill(value);
  }
  await continueWizard(page);
}

async function expectWizardActionVisible(page: Page, testId: string) {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const button = page.getByTestId(testId);
  await expect(button).toBeVisible();
  const buttonBox = await button.boundingBox();
  const footerBox = await page.locator(".ew-form-footer").last().boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(buttonBox!.y).toBeGreaterThanOrEqual(0);
  expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(
    viewport!.height + 1,
  );
  expect(footerBox!.y).toBeGreaterThanOrEqual(0);
  expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(
    viewport!.height + 1,
  );
}

async function continueWizard(page: Page) {
  await expectWizardActionVisible(page, "button-save-next");
  await page.locator("form.ew-form button[type=submit]").click();
}

async function seedGuestContact(page: Page) {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("guest-dashboard-contact")) {
      window.sessionStorage.setItem(
        "guest-dashboard-contact",
        JSON.stringify({
          fullName: "Jordan Applicant",
          email: "jordan@example.test",
          phone: "+678 801 234 5678",
        }),
      );
    }
  });
}

async function fillContactAndContinue(
  page: Page,
  fullName = "Jordan Applicant",
  email = "jordan@example.test",
) {
  await expect(page.getByTestId("input-guest-full-name")).toBeVisible();
  await page.getByTestId("input-guest-full-name").fill(fullName);
  await page.getByTestId("input-guest-email").fill(email);
  await page.getByTestId("button-continue-guest-contact").click();
  await expect(
    page.getByTestId("guest-applicant-dashboard-content"),
  ).toBeVisible();
}

async function expectNoApplicantContactFieldsInProviderForm(page: Page) {
  const form = page.getByTestId("provider-entry-form");
  await expect(form).toBeVisible();
  await expect(
    form.locator('input[type="email"], input[type="tel"]'),
  ).toHaveCount(0);
  await expect(
    form.locator(
      '[data-testid="input-guest-full-name"], [data-testid="input-guest-email"], [data-testid="input-guest-phone"]',
    ),
  ).toHaveCount(0);
  await expect(form.locator(".guest-field")).toHaveCount(0);
  await expect(form).not.toContainText(/contact (name|email|phone)/i);
}

async function readSessionTrackingKey(page: Page) {
  const key = await page.evaluate(() => {
    const raw = window.sessionStorage.getItem("guest-private-resume");
    return raw ? JSON.parse(raw).trackingKey : "";
  });
  expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
  await expect(page.getByTestId("tracking-key-one-time-notice")).toHaveCount(0);
  return key;
}

async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => {
    const documentScroller =
      document.scrollingElement ?? document.documentElement;
    const shell = document.querySelector<HTMLElement>(".ew-shell");
    const previewScroll = document.querySelector<HTMLElement>(
      ".ew-preview .ew-content-scroll",
    );
    const dashboardMain = document.querySelector<HTMLElement>(
      ".dashboard-page-content .dashboard-main",
    );
    const singlePage =
      document.querySelector<HTMLElement>(".category-entry-screen") ??
      document.querySelector<HTMLElement>(
        ".dashboard-page-content > .dashboard-layout",
      ) ??
      document.querySelector<HTMLElement>(".guest-dashboard-shell");
    const geometry = (element: HTMLElement | null) =>
      element
        ? {
            className: element.className,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
            overflowY: getComputedStyle(element).overflowY,
            rectTop: element.getBoundingClientRect().top,
            rectHeight: element.getBoundingClientRect().height,
          }
        : null;
    const htmlStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const previousX = window.scrollX;
    const previousY = window.scrollY;
    window.scrollTo({
      left: documentScroller.scrollWidth,
      top: documentScroller.scrollHeight,
      behavior: "instant",
    });
    const attemptedDocumentScroll = { x: window.scrollX, y: window.scrollY };
    window.scrollTo({ left: previousX, top: previousY, behavior: "instant" });
    return {
      clientHeight: documentScroller.clientHeight,
      scrollHeight: documentScroller.scrollHeight,
      clientWidth: documentScroller.clientWidth,
      scrollWidth: documentScroller.scrollWidth,
      htmlOverflowX: htmlStyle.overflowX,
      htmlOverflowY: htmlStyle.overflowY,
      bodyOverflowX: bodyStyle.overflowX,
      bodyOverflowY: bodyStyle.overflowY,
      attemptedDocumentScroll,
      shell: geometry(shell),
      dashboardMain: geometry(dashboardMain),
      previewScroll: geometry(previewScroll),
      singlePage: geometry(singlePage),
    };
  });
  expect(
    dimensions.scrollWidth,
    `document width overflow: ${JSON.stringify(dimensions)}`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(["hidden", "clip"]).toContain(dimensions.htmlOverflowY);
  expect(["hidden", "clip"]).toContain(dimensions.bodyOverflowY);
  expect(
    dimensions.attemptedDocumentScroll,
    `document should not scroll: ${JSON.stringify(dimensions)}`,
  ).toEqual({ x: 0, y: 0 });
  if (dimensions.shell) {
    expect(
      dimensions.shell.rectHeight,
      `application shell should fit viewport: ${JSON.stringify(dimensions)}`,
    ).toBeLessThanOrEqual(dimensions.clientHeight + 1);
  }
  if (dimensions.dashboardMain) {
    expect(
      dimensions.dashboardMain.scrollHeight,
      `dashboard content should fit without clipping: ${JSON.stringify(dimensions)}`,
    ).toBeLessThanOrEqual(dimensions.dashboardMain.clientHeight + 1);
  }
  if (dimensions.singlePage) {
    expect(
      dimensions.singlePage.scrollHeight,
      `applicant page should not require scrolling: ${JSON.stringify(dimensions)}`,
    ).toBeLessThanOrEqual(dimensions.singlePage.clientHeight + 1);
  }
}

async function expectSquareCategoryCards(page: Page) {
  const cards = page.locator(".dashboard-page-content .category-card");
  await expect(cards.first()).toBeVisible();
  const dimensions = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const { width, height } = element.getBoundingClientRect();
      return { width, height };
    }),
  );
  expect(dimensions.length).toBeGreaterThan(0);
  for (const card of dimensions) {
    expect(
      Math.abs(card.width - card.height),
      `category card should be square: ${JSON.stringify(card)}`,
    ).toBeLessThanOrEqual(1);
  }
}

test("keeps public guest pages inside the viewport on phone and desktop", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path === "/api/enrollment/categories"
        ? [
            {
              id: "category-1",
              name: "Account Provider One",
              description: "Account provider enrollment.",
              accent: "#168341",
            },
          ]
        : path === "/api/portal/settings"
          ? {
              hero: {
                title: "Enrollment",
                description: "Complete your enrollment.",
                getStartedLabel: "Get started",
                loginLabel: "Sign in",
              },
              cards: [],
              theme: {
                buttonSize: "standard",
                buttonPlacement: "right",
                categoryInputTransparent: true,
              },
              screenCopy: {},
              pageThemes: {},
            }
          : {};
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await seedGuestContact(page);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 390, height: 568 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of [
      "/",
      "/guest/contact",
      "/guest/apply",
      "/dashboard",
      "/guest/track",
    ]) {
      await page.goto(path);
      await expect(page.locator(".portal-frame")).toBeVisible();
      await expectNoDocumentOverflow(page);
      if (path === "/dashboard") {
        await expect(page.locator(".app-shell")).toHaveCSS(
          "overflow-y",
          "hidden",
        );
        await expectSquareCategoryCards(page);
        await expectNoDocumentOverflow(page);
      } else if (path === "/guest/apply") {
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.locator(".app-shell")).toBeVisible();
      } else if (path === "/guest/contact") {
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByTestId("contact-details-form")).toHaveCount(0);
      } else if (path !== "/") {
        await expect(page.locator(".guest-page")).toHaveCSS(
          "overflow-y",
          "hidden",
        );
      }
    }
  }
});

test("uses the saved dashboard title and keeps its removed description hidden", async ({
  page,
}) => {
  const api = new GuestApiFixture();
  api.formContentOverrides = {
    "applicant-provider-selection": {
      title: "Saved account providers",
      description: "Saved instructions from the central form content settings.",
    },
  };
  await page.route("**/api/**", (route) => api.handle(route));
  await page.goto("/");
  await page.getByTestId("link-get-started").click();
  await fillContactAndContinue(page);
  await expect(
    page.getByRole("heading", { name: "Saved account providers" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Saved instructions from the central form content settings.",
    ),
  ).toHaveCount(0);
});

test("keeps saved public landing copy visible after a full page refresh", async ({
  page,
}) => {
  const api = new GuestApiFixture();
  api.landingTitle = "Persistent security landing";
  api.landingDescription = "Persisted public security guidance.";
  api.landingButtonLabel = "Continue securely";
  await page.route("**/api/**", (route) => api.handle(route));

  const expectLandingCopy = async () => {
    await expect(
      page.getByRole("heading", { name: "Persistent security landing" }),
    ).toBeVisible();
    await expect(
      page.getByText("Persisted public security guidance."),
    ).toBeVisible();
    await expect(page.getByTestId("link-get-started")).toContainText(
      "Continue securely",
    );
  };

  await page.goto("/");
  await expectLandingCopy();
  await page.reload();
  await expectLandingCopy();
  expect(
    api.requestCounts.get("GET /api/portal/settings"),
  ).toBeGreaterThanOrEqual(2);
});

test("reuses shared portal and form configuration while navigating", async ({
  page,
}) => {
  const api = new GuestApiFixture();
  await page.route("**/api/**", (route) => api.handle(route));
  await page.goto("/");
  await expect(page.getByTestId("link-get-started")).toBeVisible();
  await page.getByTestId("link-get-started").click();
  await fillContactAndContinue(page);
  await expect(
    page.getByTestId("guest-applicant-dashboard-content"),
  ).toBeVisible();
  await expect(page.getByTestId("guest-dashboard-overview")).toHaveCount(0);
  await expect(page.locator(".guest-applicant-dashboard-aside")).toHaveCount(0);
  await expect(page.getByTestId("link-dashboard-track")).toHaveCount(0);
  expect(api.requestCounts.get("GET /api/portal/settings")).toBe(1);
  expect(api.requestCounts.get("GET /api/applicant/form-content")).toBe(1);
  expect(api.requestCounts.get("GET /api/enrollment/categories")).toBe(1);
});

test("collects contact details before the dashboard and removes them from provider entry", async ({
  page,
}) => {
  const api = new GuestApiFixture();
  api.formContentOverrides = {
    "applicant-contact": {
      title: "Contact details",
      fullNameLabel: "Legal name",
      emailLabel: "Verified contact email",
    },
    "category-entry-1": { title: "Provider form" },
  };
  await page.route("**/api/**", (route) => api.handle(route));
  await page.goto("/guest/apply?provider=category-1");
  await expect(page).toHaveURL(/\/guest\/contact$/);
  await expect(page.getByTestId("input-guest-full-name")).toBeVisible();
  await expect(page.getByTestId("input-guest-email")).toBeVisible();
  await expect(page.getByTestId("input-guest-phone")).toBeVisible();
  await fillContactAndContinue(page, "Jordan Applicant", "jordan@example.test");
  expect(api.createCount).toBe(0);
  expect(api.applicantWriteCount).toBe(0);
  await expect(page.getByTestId("guest-dashboard-contact")).toHaveCount(0);
  await expect(
    page.getByText(
      "Start or continue your application without creating an account. Identity files and verification video are collected later.",
    ),
  ).toHaveCount(0);
  await expect(page.getByTestId("guest-dashboard-overview")).toHaveCount(0);
  const savedContact = await page.evaluate(() => {
    const value = window.sessionStorage.getItem("guest-dashboard-contact");
    return value ? JSON.parse(value) : null;
  });
  expect(savedContact).toMatchObject({
    fullName: "Jordan Applicant",
    email: "jordan@example.test",
  });
  await page.getByTestId("guest-dashboard-category-category-1").click();
  await expect(page).toHaveURL(/\/guest\/apply\?provider=category-1$/);
  await expect(
    page.getByRole("heading", { name: "Provider form" }),
  ).toBeVisible();
  await expectNoApplicantContactFieldsInProviderForm(page);
  await expect(page.getByTestId("provider-entry-contact-fields")).toHaveCount(
    0,
  );
  await expect(page.getByTestId("input-provider-contact-name")).toHaveCount(0);
  await expect(page.getByTestId("input-provider-contact-email")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your contact details" }),
  ).toHaveCount(0);
  expect(api.createCount).toBe(0);
  expect(api.applicantWriteCount).toBe(0);
});

test("requires contact details before opening the applicant dashboard directly", async ({
  page,
}) => {
  const api = new GuestApiFixture();
  await page.route("**/api/**", (route) => api.handle(route));
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/guest\/contact$/);
  await expect(page.getByTestId("input-guest-full-name")).toBeVisible();
  await expect(
    page.getByTestId("guest-applicant-dashboard-content"),
  ).toHaveCount(0);
  expect(api.createCount).toBe(0);
  expect(api.applicantWriteCount).toBe(0);
});

test("does not show the contact step again after contact details were saved", async ({
  page,
}) => {
  const api = new GuestApiFixture();
  await page.route("**/api/**", (route) => api.handle(route));
  await seedGuestContact(page);

  await page.goto("/guest/contact");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByTestId("guest-applicant-dashboard-content"),
  ).toBeVisible();
  await expect(page.getByTestId("contact-details-form")).toHaveCount(0);
  await expect(page.getByTestId("guest-dashboard-contact")).toHaveCount(0);
  expect(api.createCount).toBe(0);
  expect(api.applicantWriteCount).toBe(0);
});

test("denies signed-out Admin preview without creating applicant data", async ({
  page,
}) => {
  const api = new GuestApiFixture();
  await page.route("**/api/**", (route) => api.handle(route));
  await page.goto("/admin/preview");
  await expect(page.getByTestId("admin-preview-banner")).toHaveCount(0);
  expect(api.requestCounts.get("GET /api/admin/preview/access") ?? 0).toBe(0);
  expect(api.applicantWriteCount).toBe(0);
  expect(api.createCount).toBe(0);
});

test("Admin preview uses the same provider-only entry form as the public portal", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const previewStart = appSource.indexOf("function AdminPortalPreviewPage()");
  const previewEnd = appSource.indexOf("function GuestEmailVerificationDialog");
  const previewSource = appSource.slice(previewStart, previewEnd);
  const providerEntrySource = await readFile(
    new URL("../src/components/CategoryEntryForm.tsx", import.meta.url),
    "utf8",
  );

  expect(previewStart).toBeGreaterThanOrEqual(0);
  expect(previewEnd).toBeGreaterThan(previewStart);
  expect(previewSource).toContain("<CategoryEntryForm");
  expect(previewSource).toContain("previewMode");
  expect(providerEntrySource).not.toMatch(
    /input-provider-contact-(?:name|email|phone)/,
  );
});

test("opens provider entry after contact details without repeating them", async ({
  page,
}) => {
  const api = new GuestApiFixture();
  api.formContentOverrides = {
    "category-entry-1": {
      title: "Provider account details",
      description: "Enter information linked to the selected account provider.",
      nameLabel: "Account holder name",
      namePlaceholder: "Enter the account holder name",
      nicknameLabel: "",
    },
  };
  await page.setViewportSize({ width: 390, height: 568 });
  await seedGuestContact(page);
  await page.route("**/api/**", (route) => api.handle(route));

  await page.goto("/dashboard");
  await expect(
    page.getByTestId("guest-applicant-dashboard-frame"),
  ).toBeVisible();
  await expect(
    page.getByTestId("guest-applicant-dashboard-content"),
  ).toBeVisible();
  await expect(page.getByTestId("guest-dashboard-overview")).toHaveCount(0);
  await expect(page.getByTestId("link-compact-guest-track")).toBeVisible();
  await expect(page.getByTestId("link-nav-track")).toHaveCount(1);
  await expect(page.getByTestId("link-nav-admin")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Admin access" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Choose an account provider." }),
  ).toHaveCount(1);
  await expect(
    page.getByText("This dashboard introduction should appear once."),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("guest-dashboard-category-category-1"),
  ).toBeVisible();
  await expect(
    page.getByTestId("guest-dashboard-category-category-4"),
  ).toBeVisible();
  await expectSquareCategoryCards(page);
  const cardDescriptions = page.locator(
    ".dashboard-page-content .category-description",
  );
  await expect(cardDescriptions).toHaveCount(4);
  for (const description of await cardDescriptions.all()) {
    await expect(description).toBeVisible();
    await expect(description).toHaveText(/.+/);
  }
  const divider = await page
    .locator(".dashboard-page-content .category-grid")
    .evaluate((grid) => {
      const style = getComputedStyle(grid, "::after");
      return {
        content: style.content,
        height: Number.parseFloat(style.height),
        rowGap: Number.parseFloat(getComputedStyle(grid).rowGap),
      };
    });
  expect(divider.content).not.toBe("none");
  expect(divider.height).toBeGreaterThanOrEqual(2);
  expect(divider.rowGap).toBeGreaterThanOrEqual(16);
  const categoryOne = page.getByTestId("guest-dashboard-category-category-1");
  const titleLayout = await categoryOne
    .locator(".category-title")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const transform = new DOMMatrixReadOnly(style.transform);
      return { fontSize: style.fontSize, x: transform.m41, y: transform.m42 };
    });
  expect(titleLayout).toEqual({ fontSize: "18px", x: 8, y: -4 });
  const descriptionLayout = await categoryOne
    .locator(".category-description")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const transform = new DOMMatrixReadOnly(style.transform);
      return { fontSize: style.fontSize, x: transform.m41, y: transform.m42 };
    });
  expect(descriptionLayout).toEqual({ fontSize: "13px", x: -6, y: 5 });
  await expectNoDocumentOverflow(page);
  await page.getByTestId("guest-dashboard-category-category-1").click();
  await expect(page).toHaveURL(/\/guest\/apply\?provider=category-1$/);
  await expect(
    page.getByRole("heading", { name: "Provider account details" }),
  ).toBeVisible();
  await expect(page.getByTestId("provider-entry-contact-fields")).toHaveCount(
    0,
  );
  await expectNoApplicantContactFieldsInProviderForm(page);
  await page.getByTestId("input-entry-name").fill("Jordan");
  await page.getByTestId("input-entry-nickname").fill("Jo");
  await expect(page.getByText("Nickname", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Account holder name")).toBeVisible();
  await expect(page.getByLabel("Account holder name")).toHaveJSProperty(
    "placeholder",
    "",
  );
  await expect(page.getByTestId("input-entry-name")).toBeVisible();
  await expect(page.getByTestId("select-guest-category")).toHaveCount(0);
  await expect(page.locator(".category-one-bank-brand img")).toHaveAttribute(
    "src",
    /data:image\/svg\+xml/,
  );
  await expect(page.locator(".category-entry-screen")).toHaveClass(
    /entry-logo-align-left/,
  );
  await expect(page.locator(".category-entry-screen")).toHaveCSS(
    "--entry-logo-offset-y",
    "14px",
  );
  await expect(page.locator(".entry-form-description")).toHaveCount(0);
  await expect(page.locator(".entry-field-helper")).toHaveCount(0);
  await expect(page.locator(".entry-field-label")).toHaveCount(2);
  for (const fieldLabel of await page.locator(".entry-field-label").all()) {
    await expect(fieldLabel).toBeVisible();
    await expect(fieldLabel).toHaveText(/.+/);
  }
  await expect(page.getByTestId("input-entry-name")).toHaveJSProperty(
    "placeholder",
    "",
  );
  expect(
    await page
      .getByTestId("input-entry-name")
      .evaluate((input) => getComputedStyle(input).color),
  ).toBe("rgb(255, 255, 255)");
  await page.locator("form button[type=submit]").click();
  await expect(page.locator(".entry-reference-code-brand img")).toHaveAttribute(
    "src",
    /data:image\/svg\+xml/,
  );
  await expect(page.locator(".category-entry-screen")).toHaveClass(
    /entry-reference-code-stage/,
  );
  await expect(page.getByTestId("input-reference-code")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Invitation Code" }),
  ).toBeVisible();
  await expect(page.locator(".reference-code-entry-explanation")).toHaveCount(
    0,
  );
  await expect(page.locator(".reference-code-field-label")).toHaveCount(0);
  await expect(page.getByTestId("text-invitation-code-status")).toHaveCSS(
    "clip-path",
    "inset(50%)",
  );
  const keypadStyle = await page
    .locator(".invitation-code-keypad")
    .evaluate((keypad) => {
      const button = keypad.querySelector("button")!;
      const buttonStyle = getComputedStyle(button);
      const codeInput =
        document.querySelector<HTMLInputElement>("#reference-code")!;
      return {
        width: getComputedStyle(keypad).width,
        gap: getComputedStyle(keypad).columnGap,
        rowGap: getComputedStyle(keypad).rowGap,
        borderWidth: buttonStyle.borderTopWidth,
        background: buttonStyle.backgroundColor,
        keyHeight: Number.parseFloat(buttonStyle.minHeight),
        codeInputWidth: Number.parseFloat(getComputedStyle(codeInput).width),
      };
    });
  expect(Number.parseFloat(keypadStyle.width)).toBeLessThanOrEqual(248);
  expect(keypadStyle.gap).toBe("2px");
  expect(keypadStyle.rowGap).toBe("5px");
  expect(keypadStyle.borderWidth).toBe("0px");
  expect(keypadStyle.background).toBe("rgba(0, 0, 0, 0)");
  expect(keypadStyle.keyHeight).toBeCloseTo(33.6, 1);
  expect(keypadStyle.codeInputWidth).toBeLessThanOrEqual(240);
  const continueButton = await page
    .locator(".entry-actions .entry-primary-button")
    .boundingBox();
  expect(continueButton).not.toBeNull();
  expect(continueButton!.width).toBeLessThanOrEqual(220);
  expect(continueButton!.height).toBeLessThanOrEqual(44);
  await expect(page.locator(".pin-entry-keypad")).toHaveCount(0);
  await expect(page.getByTestId("input-entry-pin")).toHaveCount(0);
  await expectNoDocumentOverflow(page);
  await page.locator("form").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
    (form as HTMLFormElement).requestSubmit();
  });
  await expect(page.getByTestId("button-save-next")).toBeVisible();
  expect(api.createCount).toBe(1);
  expect(api.draft?.categoryId).toBe("category-1");
});

test("preserves provider-entry progress across back navigation and reload", async ({
  page,
}) => {
  const api = new GuestApiFixture();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("**/api/**", (route) => api.handle(route));

  await page.goto("/");
  await page.getByTestId("link-get-started").click();
  await fillContactAndContinue(page);
  await expect(
    page.getByTestId("guest-applicant-dashboard-content"),
  ).toBeVisible();
  await page.getByTestId("guest-dashboard-category-category-1").click();
  await page.getByTestId("input-entry-name").fill("Jordan");
  await page.getByTestId("input-entry-nickname").fill("Jo");
  await page.goBack();
  await expect(
    page.getByTestId("guest-applicant-dashboard-content"),
  ).toBeVisible();
  await page.getByTestId("guest-dashboard-category-category-1").click();
  await expect(page.getByTestId("provider-entry-contact-fields")).toHaveCount(
    0,
  );
  await expect(page.getByTestId("input-entry-name")).toHaveValue("Jordan");
  await expect(page.getByTestId("input-entry-nickname")).toHaveValue("Jo");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByTestId("link-get-started")).toBeVisible();
  await page.getByTestId("link-get-started").click();
  await expect(
    page.getByTestId("guest-applicant-dashboard-content"),
  ).toBeVisible();
  await expect(page.getByTestId("contact-details-form")).toHaveCount(0);
  await page.getByTestId("guest-dashboard-category-category-1").click();
  await expectNoApplicantContactFieldsInProviderForm(page);
  await expect(page.getByTestId("input-entry-name")).toHaveValue("Jordan");
  expect(api.createCount).toBe(0);
});

test("keeps every guest category entry and Reference Code screen within one phone viewport", async ({
  browser,
}) => {
  for (const categoryId of [
    "category-1",
    "category-2",
    "category-3",
    "category-4",
  ]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 568 },
    });
    const page = await context.newPage();
    const api = new GuestApiFixture();
    await page.route("**/api/**", (route) => api.handle(route));
    await seedGuestContact(page);
    await page.goto("/dashboard");
    await page.getByTestId(`guest-dashboard-category-${categoryId}`).click();
    await expectNoApplicantContactFieldsInProviderForm(page);
    await expect(page.getByTestId("provider-entry-contact-fields")).toHaveCount(
      0,
    );
    await expect(page.locator(".entry-field-label").first()).toBeVisible();
    await expect(page.locator(".entry-field-label").first()).toHaveText(/.+/);
    await page.getByTestId("input-entry-name").fill("Jordan");
    expect(
      await page
        .getByTestId("input-entry-name")
        .evaluate((input) => getComputedStyle(input).color),
    ).toBe(
      categoryId === "category-4" ? "rgb(21, 63, 53)" : "rgb(255, 255, 255)",
    );
    await expect(page.locator(".category-entry-screen")).toBeVisible();
    await expectNoDocumentOverflow(page);
    const nextButton = page.locator("form button[type=submit]").first();
    await nextButton.click();
    if (categoryId === "category-2") {
      await expect(page.locator(".category-entry-screen")).not.toHaveClass(
        /entry-reference-code-stage/,
      );
      await expectNoDocumentOverflow(page);
      await expect(page.locator(".entry-field-label").first()).toBeVisible();
      await expect(page.locator(".entry-field-label").first()).toHaveText(
        "Surname",
      );
      await page.getByTestId("input-entry-surname").fill("Applicant");
      await page.locator("form button[type=submit]").first().click();
    }
    await expect(page.locator(".category-entry-screen")).toHaveClass(
      /entry-reference-code-stage/,
    );
    await expectNoDocumentOverflow(page);
    const field = page.getByTestId("input-reference-code");
    await expect(field).toBeVisible();
    expect(await field.getAttribute("type")).toBe("password");
    await expect(page.locator(".invitation-code-keypad")).toBeVisible();
    await expect(page.locator("#reference-code-heading")).toBeVisible();
    await expect(page.locator(".reference-code-field-label")).toHaveCount(0);
    await expect(page.getByTestId("input-entry-pin")).toHaveCount(0);
    const box = await field.boundingBox();
    expect(
      box,
      `${categoryId} Reference Code field should be visible`,
    ).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(568);
    await context.close();
  }
});

test("routes retired applicant URLs through contact details before the dashboard", async ({
  page,
}) => {
  const api = new GuestApiFixture();
  await page.route("**/api/**", (route) => api.handle(route));

  for (const oldPath of [
    "/apply/legacy-draft-id",
    "/applications/legacy-application-id",
  ]) {
    await page.goto(oldPath);
    await expect(page).toHaveURL(/\/guest\/contact$/);
    await expect(page.getByTestId("input-guest-full-name")).toBeVisible();
  }
});

test("submits without email OTP and opens status with the private tracking key", async ({
  page,
}) => {
  const api = new GuestApiFixture();
  api.invitationCodeLength = 10;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/**", (route) => api.handle(route));
  await page.route("**/__test-upload/**", (route) =>
    route.fulfill({ status: 200, body: "stored" }),
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () =>
          document.createElement("canvas").captureStream(1),
      },
    });
    class TestMediaRecorder {
      state = "inactive";
      mimeType = "video/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(_stream: MediaStream) {}
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["test video"], { type: this.mimeType }),
        });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: TestMediaRecorder,
    });
  });

  await page.goto("/");
  await page.getByTestId("link-get-started").click();
  await fillContactAndContinue(page);
  await expectNoDocumentOverflow(page);
  await page.getByTestId("guest-dashboard-category-category-1").click();
  await expectNoDocumentOverflow(page);
  await expect(page.getByTestId("provider-entry-contact-fields")).toHaveCount(
    0,
  );
  await expect(page.getByTestId("input-entry-name")).toBeVisible();
  await expect(page.getByTestId("select-guest-category")).toHaveCount(0);
  await page.getByTestId("input-entry-name").fill("Jordan");
  await page.getByTestId("input-entry-nickname").fill("Jo");
  await page.locator("form button[type=submit]").click();
  const referenceCodeInput = page.getByTestId("input-reference-code");
  await expect(referenceCodeInput).toBeVisible();
  await expect(referenceCodeInput).toHaveAttribute("readonly", "");
  await expect(referenceCodeInput).toHaveAttribute("type", "password");
  await expect(page.getByTestId("input-entry-pin")).toHaveCount(0);
  await expect(page.getByTestId("text-invitation-code-status")).toHaveText(
    "0 of 10 digits entered",
  );
  for (const digit of "8042135769") {
    await page.getByTestId(`button-invitation-code-digit-${digit}`).click();
  }
  await expect(referenceCodeInput).toHaveValue("8042135769");
  await expect(page.getByTestId("text-invitation-code-status")).toHaveText(
    "10 of 10 digits entered",
  );
  await expect(
    page.getByTestId("button-invitation-code-digit-0"),
  ).toBeDisabled();
  await page.getByTestId("button-invitation-code-backspace").click();
  await expect(referenceCodeInput).toHaveValue("804213576");
  await page.getByTestId("button-invitation-code-digit-9").click();
  await page.getByTestId("button-invitation-code-clear").click();
  await expect(referenceCodeInput).toHaveValue("");
  for (const digit of "8042135769") {
    await page.getByTestId(`button-invitation-code-digit-${digit}`).click();
  }
  await expectNoDocumentOverflow(page);
  await expect(page.getByTestId("enrollment-wizard")).toHaveCount(0);
  await page.locator("form button[type=submit]").click();
  await expect(page.getByTestId("enrollment-wizard")).toBeVisible();
  const trackingKey = await readSessionTrackingKey(page);
  await page.setViewportSize({ width: 390, height: 568 });
  await expectWizardActionVisible(page, "button-save-next");
  await expectNoDocumentOverflow(page);

  await fillStage(page, {
    "input-personalInformation.firstName": "Jordan",
    "input-personalInformation.surname": "Applicant",
    "input-personalInformation.dateOfBirth": "1990-01-01",
    "input-personalInformation.nationality": "Canadian",
    "input-personalInformation.phone": "+15555550100",
    "input-personalInformation.email": "jordan@example.test",
    "input-personalInformation.residentialAddress": "10 Main Street",
    "input-personalInformation.stateRegion": "Ontario",
    "input-personalInformation.city": "Toronto",
  });
  await expect(
    page.getByTestId("input-nextOfKin.residentialAddress"),
  ).toHaveCount(0);
  await expect(page.getByTestId("input-nextOfKin.city")).toHaveCount(0);
  await expect(page.getByTestId("input-nextOfKin.stateRegion")).toHaveCount(0);
  await fillStage(page, {
    "input-nextOfKin.fullName": "Taylor Applicant",
    "input-nextOfKin.relationship": "Sibling",
    "input-nextOfKin.phone": "+15555550101",
  });
  await page
    .getByTestId("select-education.highestQualification")
    .selectOption("Diploma");
  await page.getByTestId("input-education.institution").fill("Test College");
  await page.getByTestId("input-education.courseField").fill("Business");
  await page.getByTestId("input-education.startYear").fill("2010");
  await page.getByTestId("input-education.completionYear").fill("2012");
  await page
    .getByTestId("select-education.certificationStatus")
    .selectOption("Completed");
  await continueWizard(page);
  await page
    .getByTestId("select-workInformation.employmentStatus")
    .selectOption("Not currently employed");
  await continueWizard(page);
  await page
    .getByTestId("select-proofOfIdentity.documentType")
    .selectOption("Passport");
  await page.getByTestId("input-file-identityFront").setInputFiles({
    name: "identity-front.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/w0cAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect.poll(() => api.uploadedEvidence.length).toBe(1);
  await continueWizard(page);
  await page.getByTestId("check-video-consent").check();
  await page.getByTestId("button-enable-camera").click();
  await page.getByTestId("button-start-recording").click();
  await expect(page.getByTestId("button-confirm-recording")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByTestId("button-confirm-recording").click();
  await continueWizard(page);
  await expect.poll(() => api.uploadedEvidence.length).toBe(2);
  await continueWizard(page);
  await expect(page.getByTestId("section-declaration")).toHaveCount(0);
  await expect(page.getByTestId("modal-guest-email-otp")).toHaveCount(0);
  await expect(page.getByTestId("select-category-change")).toHaveCount(0);
  expect(api.draft?.submissionStatus).toBe("draft");
  expect(api.draft?.answers.reviewDeclarationAccepted).toBeUndefined();
  await expect(page.getByTestId("enrollment-wizard")).toBeVisible();
  await expect(page.getByTestId("enrollment-preview")).toBeVisible();
  expect(pageErrors).toEqual([]);
  const sectionStatuses = await Promise.all(
    Array.from({ length: 7 }, (_, index) =>
      page.getByTestId(`status-section-${index}`).innerText(),
    ),
  );
  expect(sectionStatuses, JSON.stringify(api.draft?.answers)).toEqual(
    Array(7).fill("Complete"),
  );
  await expect(
    page.getByTestId("button-submit-enrollment"),
    `Submission readiness: ${await page.getByTestId("state-submit-readiness").innerText()}`,
  ).toBeEnabled();
  await expectWizardActionVisible(page, "button-submit-enrollment");
  await page.getByTestId("button-submit-enrollment").click();
  await expect(page.getByTestId("modal-guest-email-otp")).toHaveCount(0);

  expect(api.createCount).toBe(1);
  expect(api.draft?.detailsComplete).toBe(true);
  expect(api.draft?.currentStep).toBe(7);
  expect(api.uploadedEvidence.map(({ slot }) => slot)).toEqual([
    "identity_front",
    "verification_video",
  ]);
  expect(api.draft?.emailVerified).toBe(false);
  expect(api.draft?.submissionStatus).toBe("submitted");
  expect(api.draft?.referenceCode).toBe("8042135769");
  await expect(page.getByText("8042135769", { exact: true })).toHaveCount(0);
  expect(api.draft?.answers.reviewDeclarationAccepted).toBeUndefined();
  expect(api.draft?.linkedApplicationId).toBeNull();
  await expect(page.getByTestId("guest-submission-confirmation")).toContainText(
    "Enrollment submitted",
  );
  await expect(
    page.getByTestId("guest-submission-confirmation"),
  ).not.toContainText(trackingKey);
  await expect(
    page.getByTestId("guest-submission-confirmation"),
  ).toHaveAttribute("role", "dialog");
  await expect(
    page.getByTestId("link-track-created-application"),
  ).toContainText("Track Security Verification Status");

  await page.getByTestId("link-track-created-application").click();
  await expect(page.getByTestId("input-track-reference")).toHaveValue(
    reference,
  );
  await expect(page.getByTestId("input-track-private-key")).toHaveValue(
    trackingKey,
  );
  await page.getByTestId("input-track-private-key").fill(trackingKey);
  await page.getByTestId("button-lookup-guest-status").click();
  await expect(page.getByTestId("guest-public-status")).toBeVisible();
  await expect(page.getByText("8042135769", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("status-guest-application")).toContainText(
    "Pending Review",
  );
  await expect(page.getByTestId("guest-public-status")).not.toContainText(
    reviewerOnlyNote,
  );
  await expect(page.getByTestId("modal-guest-email-otp")).toHaveCount(0);

  // The key is retained only for this browser session, not local storage.
  const savedTrackingKey = await page.evaluate(() => ({
    local: Object.entries(localStorage)
      .map(([key, value]) => `${key}:${value}`)
      .join("\n"),
    session: Object.entries(sessionStorage)
      .map(([key, value]) => `${key}:${value}`)
      .join("\n"),
  }));
  expect(savedTrackingKey.local).not.toContain(trackingKey);
  expect(savedTrackingKey.session).toContain(trackingKey);
  await page.reload();
  await expect(page.getByTestId("link-get-started")).toBeVisible();
  await page.goto("/guest/track");
  await expect(page.getByTestId("input-track-private-key")).toHaveValue(
    trackingKey,
  );
  await page.getByTestId("input-track-reference").fill(reference);
  await page.getByTestId("input-track-private-key").fill(trackingKey);
  await page.getByTestId("button-lookup-guest-status").click();
  await expect(page.getByTestId("guest-public-status")).toBeVisible();
  await expect(page.getByTestId("guest-public-status")).not.toContainText(
    trackingKey,
  );
  expect(api.lookupCount).toBeGreaterThanOrEqual(2);
  expect(api.createCount).toBe(1);
});

test("lets guests continue with incomplete details and an optional Invitation Code", async ({
  page,
}) => {
  const api = new GuestApiFixture();
  api.categoryOneTitle = "Configured Account Provider One";
  api.screenCopyOverrides = {
    "category-entry-1": {
      sectionIdLabel: "LEGACY ACCOUNT PROVIDER LABEL",
      nameLabel: "Legacy entry name",
    },
    "workflow-step-1": {
      title: "Legacy personal details",
    },
    "workflow-step-8": {
      title: "Legacy final preview",
    },
  };
  api.formContentOverrides = {
    "category-entry-1": {
      sectionIdLabel: "CONFIGURED ACCOUNT PROVIDER LABEL",
      nameLabel: "Configured entry name",
      nicknameLabel: "Configured entry nickname",
      codeTitle: "Configured Invitation Code",
      codeLabel: "Provider invitation digits",
      codePlaceholder: "Enter code",
      codeStatus: "{entered} of {length} configured digits",
    },
    "workflow-step-1": {
      title: "Configured personal details",
      field_personalInformation_firstName: "Configured first name",
      placeholder_personalInformation_firstName: "Enter your given name",
    },
    "workflow-step-8": {
      title: "Configured final preview",
    },
  };
  await page.setViewportSize({ width: 390, height: 568 });
  await seedGuestContact(page);
  await page.route("**/api/**", (route) => api.handle(route));
  await page.route("**/api/__clerk/v1/client/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        errors: [{ message: "Test email service unavailable." }],
      }),
    }),
  );

  await page.goto("/dashboard");
  await page.getByTestId("guest-dashboard-category-category-1").click();
  await expect(page.getByTestId("provider-entry-contact-fields")).toHaveCount(
    0,
  );
  await expect(page.getByTestId("input-entry-name")).toBeVisible();
  await expect(page.getByTestId("select-guest-category")).toHaveCount(0);
  await expect(page.getByTestId("input-entry-name")).not.toHaveAttribute(
    "placeholder",
  );
  await expect(page.getByTestId("input-entry-nickname")).not.toHaveAttribute(
    "placeholder",
  );
  await expect(page.getByText("Configured entry name")).toBeVisible();
  await expect(page.getByText("Configured entry nickname")).toBeVisible();
  await expectNoDocumentOverflow(page);

  await page.locator("form button[type=submit]").click();
  await expect(page.getByTestId("input-reference-code")).toBeVisible();
  await expect(page.getByTestId("input-reference-code")).toHaveAttribute(
    "type",
    "password",
  );
  await expect(page.locator(".reference-code-entry-screen")).toContainText(
    "Configured Invitation Code",
  );
  await expect(page.locator(".reference-code-field-label")).toHaveText(
    "Provider invitation digits",
  );
  await expect(page.getByTestId("text-invitation-code-status")).toContainText(
    "0 of 8 configured digits",
  );
  await expect(page.locator(".reference-code-entry-screen")).toContainText(
    "not used to sign in",
  );
  await expect(page.getByTestId("input-entry-pin")).toHaveCount(0);
  await page.locator("form button[type=submit]").click();
  await expect(page.getByTestId("enrollment-wizard")).toBeVisible();
  await readSessionTrackingKey(page);
  await expect(
    page.getByTestId("input-personalInformation.firstName"),
  ).toHaveAttribute("placeholder", "Enter your given name");
  await expectNoDocumentOverflow(page);

  for (let step = 0; step < 7; step += 1) {
    await continueWizard(page);
    await expectNoDocumentOverflow(page);
  }
  await expect(page.getByTestId("section-declaration")).toHaveCount(0);
  await expect(page.getByTestId("enrollment-preview")).toContainText(
    "Configured final preview",
  );
  await expect(page.getByTestId("review-section-0")).toContainText(
    "Configured personal details",
  );
  await expect(page.getByTestId("review-firstName")).toContainText(
    "Configured first name",
  );
  await expect(page.getByTestId("review-category")).toContainText(
    "CONFIGURED ACCOUNT PROVIDER LABEL",
  );
  await expect(page.getByTestId("review-category")).toContainText(
    "Configured Account Provider One",
  );
  await expect(page.getByTestId("review-category-name")).toContainText(
    "Configured entry name",
  );
  await expect(page.getByTestId("review-category-name")).toContainText(
    "Not provided",
  );
  await expect(page.getByTestId("review-category-nickname")).toContainText(
    "Configured entry nickname",
  );
  await expect(page.getByTestId("review-category-nickname")).toContainText(
    "Not provided",
  );
  await expect(page.getByTestId("review-category")).not.toContainText(
    "Invitation Code",
  );
  await expect(page.getByTestId("modal-guest-email-otp")).toHaveCount(0);
  await expect(page.getByTestId("button-submit-enrollment")).toBeEnabled();
  await expectNoDocumentOverflow(page);

  expect(api.draft?.currentStep).toBe(7);
  expect(api.draft?.detailsComplete).toBe(false);
  expect(api.draft?.referenceCode).toBeNull();
  expect(api.draft?.answers.reviewDeclarationAccepted).toBeUndefined();
});
