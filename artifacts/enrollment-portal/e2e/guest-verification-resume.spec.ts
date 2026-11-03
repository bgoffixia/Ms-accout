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
  hasPin: boolean;
  linkedApplicationId: string | null;
  currentStep: number;
  detailsComplete: boolean;
  answers: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

class GuestApiFixture {
  draft: GuestDraft | null = null;
  accessKey = "";
  createCount = 0;
  lookupCount = 0;
  categoryOneTitle = "Category One";
  screenCopyOverrides: Record<string, Record<string, string>> = {};
  readonly uploadedEvidence: { id: string; slot: string; objectPath: string }[] = [];
  private evidenceId = 0;

  async handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (method === "GET" && path === "/api/enrollment/categories") {
      return json(["category-1", "category-2", "category-3", "category-4"].map((id, index) => ({
        id,
        name: `Category ${index + 1}`,
        description: "Enrollment application category.",
        accent: "#168341",
      })));
    }
    if (method === "GET" && path === "/api/portal/settings") {
      return json({
        hero: { title: "Enrollment", description: "Complete your enrollment.", getStartedLabel: "Get started", loginLabel: "Sign in" },
        cards: ["category-1", "category-2", "category-3", "category-4"].map((id) => ({
          id,
          title: id === "category-1" ? this.categoryOneTitle : id,
          description: "Enrollment category.",
          buttonLabel: "Start application",
          backgroundColor: "#F5F8FA",
          logoDataUrl: null,
          entryLogoDataUrl: id === "category-1" ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Ccircle cx='5' cy='5' r='5' fill='green'/%3E%3C/svg%3E" : null,
          pinLogoDataUrl: id === "category-1" ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Crect width='10' height='10' fill='blue'/%3E%3C/svg%3E" : null,
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
          pinLogoAlignment: "right",
          pinLogoVerticalOffset: -14,
        })),
        theme: {
          pinScreenBackground: "#FFFFFF",
          buttonSize: "standard",
          buttonPlacement: "right",
          categoryInputTransparent: true,
        },
        screenCopy: {
          dashboard: {
            title: "Choose a category to begin.",
            description: "This dashboard introduction should appear once.",
            sectionIdLabel: "START ENROLLMENT",
          },
          ...this.screenCopyOverrides,
        },
        pageThemes: {},
      });
    }
    if (method === "POST" && path === "/api/guest/preapplications") {
      const body = request.postDataJSON();
      this.createCount += 1;
      this.accessKey = body.accessKey;
      const categoryId = typeof body.categoryId === "string" ? body.categoryId : "category-1";
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
        hasPin: false,
        linkedApplicationId: null,
        currentStep: 0,
        detailsComplete: false,
        answers: {},
        createdAt: "2026-10-12T12:00:00.000Z",
        updatedAt: "2026-10-12T12:00:00.000Z",
      };
      return json(this.createdResponse(), 201);
    }
    if (method === "POST" && path === "/api/guest/preapplications/lookup") {
      this.lookupCount += 1;
      return this.draft ? json(this.statusResponse()) : json({ message: "Not found" }, 404);
    }
    if (method === "PATCH" && path === `/api/guest/preapplications/${applicationId}`) {
      if (!this.draft) return json({ message: "Not found" }, 404);
      const body = request.postDataJSON();
      this.draft.answers = body.answers;
      this.draft.currentStep = body.currentStep;
      this.draft.hasPin ||= Boolean(body.pin);
      this.draft.detailsComplete = this.detailsAreComplete();
      this.draft.updatedAt = new Date().toISOString();
      return json(this.statusResponse());
    }
    if (method === "POST" && path === `/api/guest/preapplications/${applicationId}/evidence/upload-url`) {
      const body = request.postDataJSON();
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
    if (method === "POST" && path.match(new RegExp(`^/api/guest/preapplications/${applicationId}/evidence/[^/]+/complete$`))) {
      const evidenceId = path.split("/").at(-2);
      const evidence = this.uploadedEvidence.find((item) => item.id === evidenceId);
      if (!evidence) return json({ message: "Upload missing" }, 404);
      return json({
        evidenceId,
        evidenceType: evidence.slot === "verification_video" ? "verification_video" : "identity_document",
        evidenceSlot: evidence.slot,
        fileName: evidence.slot === "identity_front" ? "identity-front.png" : "verification-recording.webm",
        contentType: evidence.slot === "identity_front" ? "image/png" : "video/webm",
        sizeBytes: 16,
        objectPath: evidence.objectPath,
        uploadedAt: "2026-10-12T12:01:00.000Z",
      });
    }
    if (method === "POST" && path === `/api/guest/preapplications/${applicationId}/submit`) {
      if (!this.draft) return json({ message: "Not found" }, 404);
      this.draft.submissionStatus = "submitted";
      this.draft.emailVerified = false;
      this.draft.emailVerificationRequired = true;
      return json(this.statusResponse());
    }
    if (method === "POST" && path === `/api/guest/preapplications/${applicationId}/link`) {
      if (!this.draft) return json({ message: "Not found" }, 404);
      this.markVerifiedSubmission();
      return json({
        id: "7aed516d-1e70-41a9-a239-4568b8fbc7c2",
        reference,
        categoryId: "category-1",
        categoryName: "Category One",
        status: "submitted",
        currentStep: 7,
        hasPin: true,
        answers: this.draft.answers,
        applicantName: this.draft.fullName,
        applicantEmail: this.draft.email,
        reviewNote: null,
        createdAt: this.draft.createdAt,
        updatedAt: this.draft.updatedAt,
        submittedAt: "2026-10-12T12:05:00.000Z",
      });
    }

    return json({ message: `Unmocked API request: ${method} ${path}` }, 501);
  }

  markVerifiedSubmission() {
    if (!this.draft) throw new Error("The browser test did not create a guest draft.");
    this.draft.submissionStatus = "submitted";
    this.draft.emailVerified = true;
    this.draft.emailVerificationRequired = false;
    this.draft.linkedApplicationId = "7aed516d-1e70-41a9-a239-4568b8fbc7c2";
  }

  private detailsAreComplete() {
    const answers = this.draft?.answers as Record<string, any> | undefined;
    if (!answers || answers.categoryEntryComplete !== true || answers.reviewDeclarationAccepted !== true) return false;
    const person = answers.personalInformation ?? {};
    const nextOfKin = answers.nextOfKin ?? {};
    const education = answers.education ?? {};
    const work = answers.workInformation ?? {};
    const identity = answers.proofOfIdentity ?? {};
    const video = answers.liveVideoRecording ?? {};
    const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
    const completeFields = [
      [person, ["firstName", "surname", "dateOfBirth", "nationality", "phone", "email", "residentialAddress", "stateRegion", "city"]],
      [nextOfKin, ["fullName", "relationship", "phone", "residentialAddress", "city", "stateRegion"]],
      [education, ["highestQualification", "institution", "courseField", "startYear", "completionYear", "certificationStatus"]],
    ] as const;
    if (!completeFields.every(([section, keys]) => keys.every((key) => hasText(section[key])))) return false;
    const startYear = Number(education.startYear);
    const completionYear = Number(education.completionYear);
    if (!Number.isInteger(startYear) || !Number.isInteger(completionYear) || startYear < 1900 || completionYear < startYear) return false;
    const employmentStatus = String(work.employmentStatus ?? "").toLowerCase();
    if (!employmentStatus) return false;
    if (employmentStatus === "employed" && !["occupation", "employer", "workAddress"].every((key) => hasText(work[key]))) return false;
    if (employmentStatus === "self-employed" && !["businessName", "workAddress"].every((key) => hasText(work[key]))) return false;
    if (!hasText(identity.documentType) || !hasText(identity.frontObjectPath)) return false;
    if (["National ID", "Driver license", "Passport card"].includes(identity.documentType) && !hasText(identity.backObjectPath)) return false;
    if (video.consentAccepted !== true || video.durationSeconds !== 12 || !hasText(video.objectPath)) return false;
    return this.uploadedEvidence.some((item) => item.objectPath === identity.frontObjectPath)
      && this.uploadedEvidence.some((item) => item.objectPath === video.objectPath);
  }

  private createdResponse() {
    const { answers: _answers, ...response } = this.draft!;
    return response;
  }

  private statusResponse() {
    const emailVerificationRequired = this.draft!.submissionStatus === "submitted" && !this.draft!.emailVerified;
    return {
      ...this.draft,
      emailVerificationRequired,
      answers: emailVerificationRequired ? {} : this.draft!.answers,
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
  await page.locator("form.ew-form button[type=submit]").click();
}

async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => {
    const documentScroller = document.scrollingElement ?? document.documentElement;
    const shell = document.querySelector<HTMLElement>(".ew-shell");
    const previewScroll = document.querySelector<HTMLElement>(".ew-preview .ew-content-scroll");
    const dashboardMain = document.querySelector<HTMLElement>(".dashboard-page-content .dashboard-main");
    const singlePage = document.querySelector<HTMLElement>(".category-entry-screen")
      ?? document.querySelector<HTMLElement>(".dashboard-page-content > .dashboard-layout")
      ?? document.querySelector<HTMLElement>(".guest-dashboard-shell");
    const geometry = (element: HTMLElement | null) => element ? {
      className: element.className,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
      rectTop: element.getBoundingClientRect().top,
      rectHeight: element.getBoundingClientRect().height,
    } : null;
    const htmlStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const previousX = window.scrollX;
    const previousY = window.scrollY;
    window.scrollTo({ left: documentScroller.scrollWidth, top: documentScroller.scrollHeight, behavior: "instant" });
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
  expect(dimensions.scrollWidth, `document width overflow: ${JSON.stringify(dimensions)}`)
    .toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(["hidden", "clip"]).toContain(dimensions.htmlOverflowY);
  expect(["hidden", "clip"]).toContain(dimensions.bodyOverflowY);
  expect(dimensions.attemptedDocumentScroll, `document should not scroll: ${JSON.stringify(dimensions)}`)
    .toEqual({ x: 0, y: 0 });
  if (dimensions.shell) {
    expect(dimensions.shell.rectHeight, `application shell should fit viewport: ${JSON.stringify(dimensions)}`)
      .toBeLessThanOrEqual(dimensions.clientHeight + 1);
  }
  if (dimensions.dashboardMain) {
    expect(dimensions.dashboardMain.scrollHeight, `dashboard content should fit without clipping: ${JSON.stringify(dimensions)}`)
      .toBeLessThanOrEqual(dimensions.dashboardMain.clientHeight + 1);
  }
  if (dimensions.singlePage) {
    expect(dimensions.singlePage.scrollHeight, `applicant page should not require scrolling: ${JSON.stringify(dimensions)}`)
      .toBeLessThanOrEqual(dimensions.singlePage.clientHeight + 1);
  }
}

async function expectSquareCategoryCards(page: Page) {
  const cards = page.locator(".dashboard-page-content .category-card");
  await expect(cards.first()).toBeVisible();
  const dimensions = await cards.evaluateAll((elements) => elements.map((element) => {
    const { width, height } = element.getBoundingClientRect();
    return { width, height };
  }));
  expect(dimensions.length).toBeGreaterThan(0);
  for (const card of dimensions) {
    expect(Math.abs(card.width - card.height), `category card should be square: ${JSON.stringify(card)}`)
      .toBeLessThanOrEqual(1);
  }
}

test("keeps public guest pages inside the viewport on phone and desktop", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path === "/api/enrollment/categories"
      ? [{ id: "category-1", name: "Category One", description: "Enrollment category.", accent: "#168341" }]
      : path === "/api/portal/settings"
        ? {
            hero: { title: "Enrollment", description: "Complete your enrollment.", getStartedLabel: "Get started", loginLabel: "Sign in" },
            cards: [],
            theme: {
              pinScreenBackground: "#FFFFFF",
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

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 390, height: 568 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of ["/", "/guest/apply", "/dashboard", "/guest/track"]) {
      await page.goto(path);
      await expect(page.locator(".portal-frame")).toBeVisible();
      await expectNoDocumentOverflow(page);
      if (path === "/dashboard") {
        await expect(page.locator(".app-shell")).toHaveCSS("overflow-y", "hidden");
        await expectSquareCategoryCards(page);
        await expectNoDocumentOverflow(page);
      } else if (path !== "/") {
        await expect(page.locator(".guest-page")).toHaveCSS("overflow-y", "hidden");
      }
    }
  }
});

test("starts from the public shared dashboard and opens the selected category form after contact details", async ({ page }) => {
  const api = new GuestApiFixture();
  await page.setViewportSize({ width: 390, height: 568 });
  await page.route("**/api/**", (route) => api.handle(route));

  await page.goto("/dashboard");
  await expect(page.getByTestId("guest-applicant-dashboard-frame")).toBeVisible();
  await expect(page.getByTestId("guest-applicant-dashboard-content")).toBeVisible();
  await expect(page.getByTestId("guest-dashboard-overview")).toBeHidden();
  await expect(page.getByTestId("link-compact-guest-track")).toBeVisible();
  await expect(page.getByTestId("link-nav-track")).toHaveCount(1);
  await expect(page.getByTestId("link-nav-admin")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Admin access" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Choose a category to begin." })).toHaveCount(1);
  await expect(page.getByText("This dashboard introduction should appear once.")).toHaveCount(1);
  await expect(page.getByTestId("guest-dashboard-category-category-1")).toBeVisible();
  await expect(page.getByTestId("guest-dashboard-category-category-4")).toBeVisible();
  await expectSquareCategoryCards(page);
  const cardDescriptions = page.locator(".dashboard-page-content .category-description");
  await expect(cardDescriptions).toHaveCount(4);
  for (const description of await cardDescriptions.all()) {
    await expect(description).toBeVisible();
    await expect(description).toHaveText(/.+/);
  }
  const divider = await page.locator(".dashboard-page-content .category-grid").evaluate((grid) => {
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
  const titleLayout = await categoryOne.locator(".category-title").evaluate((element) => {
    const style = getComputedStyle(element);
    const transform = new DOMMatrixReadOnly(style.transform);
    return { fontSize: style.fontSize, x: transform.m41, y: transform.m42 };
  });
  expect(titleLayout).toEqual({ fontSize: "18px", x: 8, y: -4 });
  const descriptionLayout = await categoryOne.locator(".category-description").evaluate((element) => {
    const style = getComputedStyle(element);
    const transform = new DOMMatrixReadOnly(style.transform);
    return { fontSize: style.fontSize, x: transform.m41, y: transform.m42 };
  });
  expect(descriptionLayout).toEqual({ fontSize: "13px", x: -6, y: 5 });
  await expectNoDocumentOverflow(page);
  await page.getByTestId("guest-dashboard-category-category-1").click();
  await expect(page.getByText("Your details are shared only with authorized verification provider.")).toBeVisible();
  await page.getByTestId("input-guest-full-name").fill("Jordan Applicant");
  await page.getByTestId("input-guest-email").fill("jordan@example.test");
  await page.getByTestId("button-continue-guest-contact").click();

  await expect(page.getByTestId("input-entry-name")).toBeVisible();
  await expect(page.getByTestId("guest-tracking-key-step")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save tracking key" })).toHaveCount(0);
  await expect(page.getByTestId("select-guest-category")).toHaveCount(0);
  await expect(page.locator(".category-one-bank-brand img")).toHaveAttribute("src", /data:image\/svg\+xml/);
  await expect(page.locator(".category-entry-screen")).toHaveClass(/entry-logo-align-left/);
  await expect(page.locator(".category-entry-screen")).toHaveCSS("--entry-logo-offset-y", "14px");
  await page.locator("form button[type=submit]").click();
  await expect(page.getByTestId("guest-tracking-key-step")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save tracking key" })).toHaveCount(0);
  await expect(page.locator(".category-one-pin-brand img")).toHaveAttribute("src", /data:image\/svg\+xml/);
  await expect(page.locator(".category-entry-screen")).toHaveClass(/entry-logo-align-right/);
  await expect(page.locator(".category-entry-screen")).toHaveCSS("--entry-logo-offset-y", "-14px");
  await expectNoDocumentOverflow(page);
  expect(api.createCount).toBe(1);
  expect(api.draft?.categoryId).toBe("category-1");
});

test("keeps contact details out of same-session back navigation and returns reloads to portal home", async ({ page }) => {
  const api = new GuestApiFixture();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("**/api/**", (route) => api.handle(route));

  await page.goto("/");
  await page.getByTestId("link-get-started").click();
  await page.getByTestId("input-guest-full-name").fill("Jordan Applicant");
  await page.getByTestId("input-guest-email").fill("jordan@example.test");
  await page.getByTestId("button-continue-guest-contact").click();
  await expect(page.getByTestId("guest-applicant-dashboard-content")).toBeVisible();
  await expect(page.getByTestId("input-guest-full-name")).toHaveCount(0);
  await expect(page.getByTestId("button-change-dashboard-contact")).toHaveCount(0);
  await expect(page.getByTestId("link-nav-home")).toBeVisible();

  await page.goBack();
  await expect(page.getByTestId("link-get-started")).toBeVisible();
  await page.getByTestId("link-get-started").click();
  await expect(page.getByTestId("guest-applicant-dashboard-content")).toBeVisible();
  await expect(page.getByTestId("input-guest-full-name")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("button-open-menu").click();
  await expect(page.getByTestId("link-nav-home")).toBeVisible();
  await page.getByTestId("link-nav-home").click();
  await expect(page.getByTestId("link-get-started")).toBeVisible();
  await page.getByTestId("link-get-started").click();
  await expect(page.getByTestId("guest-applicant-dashboard-content")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("link-get-started")).toBeVisible();
});

test("keeps every guest category entry and PIN screen within one phone viewport", async ({ browser }) => {
  for (const categoryId of ["category-1", "category-2", "category-3", "category-4"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 568 } });
    const page = await context.newPage();
    const api = new GuestApiFixture();
    await page.route("**/api/**", (route) => api.handle(route));
    await page.goto("/dashboard");
    await page.getByTestId(`guest-dashboard-category-${categoryId}`).click();
    await page.getByTestId("input-guest-full-name").fill("Jordan Applicant");
    await page.getByTestId("input-guest-email").fill("jordan@example.test");
    await page.getByTestId("button-continue-guest-contact").click();

    await expect(page.locator(".category-entry-screen")).toBeVisible();
    await expectNoDocumentOverflow(page);
    const nextButton = page.locator("form button[type=submit]").first();
    await nextButton.click();
    if (categoryId === "category-2") {
      await expect(page.locator(".category-entry-screen")).not.toHaveClass(/entry-pin-stage/);
      await expectNoDocumentOverflow(page);
      await page.locator("form button[type=submit]").first().click();
    }
    await expect(page.locator(".category-entry-screen")).toHaveClass(/entry-pin-stage/);
    await expectNoDocumentOverflow(page);
    const pinKeys = page.locator(".pin-entry-key");
    for (let index = 0; index < await pinKeys.count(); index += 1) {
      const box = await pinKeys.nth(index).boundingBox();
      expect(box, `${categoryId} keypad key ${index} should be visible`).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
      expect(box!.y + box!.height).toBeLessThanOrEqual(568);
    }
    await context.close();
  }
});

test("redirects retired account-based applicant URLs to the shared dashboard", async ({ page }) => {
  const api = new GuestApiFixture();
  await page.route("**/api/**", (route) => api.handle(route));

  for (const oldPath of ["/apply/legacy-draft-id", "/applications/legacy-application-id"]) {
    await page.goto(oldPath);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("guest-dashboard-category-category-1")).toBeVisible();
  }
});

test("submits before email verification and gates status access until the applicant verifies", async ({ page }) => {
  const api = new GuestApiFixture();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/**", (route) => api.handle(route));
  await page.route("**/api/__clerk/v1/client/**", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ errors: [{ message: "Test email service unavailable." }] }) }),
  );
  await page.route("**/__test-upload/**", (route) =>
    route.fulfill({ status: 200, body: "stored" }),
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => document.createElement("canvas").captureStream(1) },
    });
    class TestMediaRecorder {
      state = "inactive";
      mimeType = "video/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(_stream: MediaStream) {}
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["test video"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: TestMediaRecorder });
  });

  await page.goto("/");
  await page.getByTestId("link-get-started").click();
  await expectNoDocumentOverflow(page);
  await page.getByTestId("input-guest-full-name").fill("Jordan Applicant");
  await page.getByTestId("input-guest-email").fill("jordan@example.test");
  await page.getByTestId("button-continue-guest-contact").click();
  await expectNoDocumentOverflow(page);
  await page.getByTestId("guest-dashboard-category-category-1").click();
  await expectNoDocumentOverflow(page);
  await expect(page.getByTestId("input-entry-name")).toBeVisible();
  await expect(page.getByTestId("guest-tracking-key-step")).toHaveCount(0);
  await expect(page.getByTestId("select-guest-category")).toHaveCount(0);
  await page.getByTestId("input-entry-name").fill("Jordan");
  await page.getByTestId("input-entry-nickname").fill("Jo");
  await page.setViewportSize({ width: 390, height: 568 });
  await page.locator("form button[type=submit]").click();
  const pinInput = page.getByTestId("input-entry-pin");
  await expect(page.getByTestId("guest-tracking-key-step")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save tracking key" })).toHaveCount(0);
  await expect(page.locator("#pin-entry-heading")).toHaveCSS("font-size", "12px");
  await expectNoDocumentOverflow(page);
  const keypadButtons = await page.locator(".pin-entry-key").all();
  for (const button of keypadButtons) {
    const bounds = await button.boundingBox();
    expect(bounds, "every PIN key should have a visible bounding box").not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
  }
  await page.getByTestId("button-pin-key-4").click();
  await page.getByTestId("button-pin-key-8").click();
  await expect(pinInput).toHaveValue("48");
  await page.getByTestId("button-pin-key-confirm").click();
  await expect(page.getByTestId("text-entry-error")).toContainText("Enter exactly 4 digits.");
  await page.getByTestId("button-pin-key-clear").click();
  await expect(pinInput).toHaveValue("");
  for (const digit of ["4", "8", "2", "6"]) {
    await page.getByTestId(`button-pin-key-${digit}`).click();
  }
  await expect(pinInput).toHaveValue("4826");
  await expect(page.getByTestId("enrollment-wizard")).toHaveCount(0);
  await page.getByTestId("button-pin-key-confirm").click();
  await expect(page.getByTestId("enrollment-wizard")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
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
  await fillStage(page, {
    "input-nextOfKin.fullName": "Taylor Applicant",
    "input-nextOfKin.relationship": "Sibling",
    "input-nextOfKin.phone": "+15555550101",
    "input-nextOfKin.residentialAddress": "20 Main Street",
    "input-nextOfKin.city": "Toronto",
    "input-nextOfKin.stateRegion": "Ontario",
  });
  await page.getByTestId("select-education.highestQualification").selectOption("Diploma");
  await page.getByTestId("input-education.institution").fill("Test College");
  await page.getByTestId("input-education.courseField").fill("Business");
  await page.getByTestId("input-education.startYear").fill("2010");
  await page.getByTestId("input-education.completionYear").fill("2012");
  await page.getByTestId("select-education.certificationStatus").selectOption("Completed");
  await page.locator("form.ew-form button[type=submit]").click();
  await page.getByTestId("select-workInformation.employmentStatus").selectOption("Not currently employed");
  await page.locator("form.ew-form button[type=submit]").click();
  await page.getByTestId("select-proofOfIdentity.documentType").selectOption("Passport");
  await page.getByTestId("input-file-identityFront").setInputFiles({
    name: "identity-front.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/w0cAAAAASUVORK5CYII=", "base64"),
  });
  await expect.poll(() => api.uploadedEvidence.length).toBe(1);
  await page.locator("form.ew-form button[type=submit]").click();
  await page.getByTestId("check-video-consent").check();
  await page.getByTestId("button-enable-camera").click();
  await page.getByTestId("button-start-recording").click();
  await expect(page.getByTestId("button-confirm-recording")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("button-confirm-recording").click();
  await page.locator("form.ew-form button[type=submit]").click();
  await expect.poll(() => api.uploadedEvidence.length).toBe(2);
  await page.locator("form.ew-form button[type=submit]").click();
  await page.getByTestId("section-declaration").locator("label").click();
  await expect(page.getByTestId("check-declaration")).toBeChecked();
  await expect(page.getByTestId("modal-guest-email-otp")).toHaveCount(0);
  await expect(page.getByTestId("select-category-change")).toHaveCount(0);
  expect(api.draft?.submissionStatus).toBe("draft");
  expect(api.draft?.answers.reviewDeclarationAccepted).toBeUndefined();
  await expect(page.getByTestId("enrollment-wizard")).toBeVisible();
  const sectionStatuses = await Promise.all(
    Array.from({ length: 7 }, (_, index) =>
      page.getByTestId(`status-section-${index}`).innerText(),
    ),
  );
  expect(sectionStatuses, JSON.stringify(api.draft?.answers)).toEqual(Array(7).fill("Complete"));
  await expect(
    page.getByTestId("button-submit-enrollment"),
    `Submission readiness: ${await page.getByTestId("state-submit-readiness").innerText()}`,
    ).toBeEnabled();
  await page.getByTestId("button-submit-enrollment").click();
  await expect(page.getByTestId("modal-guest-email-otp")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await expect(page.getByTestId("input-guest-email-otp")).toBeVisible();
  await page.getByRole("button", { name: "Close email verification" }).click();
  await expect(page.getByTestId("modal-guest-email-otp")).toHaveCount(0);

  expect(api.createCount).toBe(1);
  expect(api.draft?.detailsComplete).toBe(true);
  expect(api.draft?.currentStep).toBe(7);
  expect(api.uploadedEvidence.map(({ slot }) => slot)).toEqual(["identity_front", "verification_video"]);
  expect(api.draft?.emailVerified).toBe(false);
  expect(api.draft?.submissionStatus).toBe("submitted");
  expect(api.draft?.answers.reviewDeclarationAccepted).toBe(true);
  expect(api.draft?.linkedApplicationId).toBeNull();
  await expect(page.getByTestId("guest-submission-confirmation")).toContainText("submitted");

  await page.goto("/guest/track");
  await page.getByTestId("input-track-reference").fill(reference);
  await page.getByTestId("input-track-key").fill(api.accessKey);
  await page.getByTestId("button-lookup-guest-status").click();
  await expect(page.getByTestId("guest-status-verification-required")).toBeVisible();
  await expect(page.getByTestId("guest-public-status")).toHaveCount(0);
  await expect(page.getByTestId("guest-status-verification-required")).not.toContainText("Jordan");
  await page.getByRole("button", { name: "Close email verification" }).click();

  // Reloading after an unsuccessful email verification keeps the submission,
  // while its private status remains gated.
  await page.goto("/guest/apply?resume=1");
  await expect(page.getByTestId("guest-submission-confirmation")).toBeVisible();
  await expect(page.getByTestId("guest-submission-confirmation")).toContainText("submitted");
  await expect(page.getByTestId("guest-submission-confirmation")).not.toContainText(reviewerOnlyNote);
  await expect(page.getByTestId("guest-submission-confirmation")).not.toContainText("Jordan");
  expect(api.lookupCount).toBeGreaterThanOrEqual(2);
  expect(api.createCount).toBe(1);

  // The server has now completed a verified submission for that same draft.
  // A later browser return should show the existing submitted application.
  api.markVerifiedSubmission();
  await page.goto("/guest/apply?resume=1");
  await expect(page.getByTestId("guest-submission-confirmation")).toBeVisible();
  await expect(page.getByTestId("guest-submission-confirmation")).toContainText("Your application was submitted.");
  await expect(page.getByTestId("guest-submission-confirmation")).toContainText(reference);
  await expect(page.getByTestId("guest-submission-confirmation")).not.toContainText(reviewerOnlyNote);
  expect(api.createCount).toBe(1);
  expect(api.draft?.linkedApplicationId).toBe("7aed516d-1e70-41a9-a239-4568b8fbc7c2");
});

test("lets guests skip incomplete fields but requires a PIN before enrollment details", async ({ page }) => {
  const api = new GuestApiFixture();
  api.categoryOneTitle = "Configured Category One";
  api.screenCopyOverrides = {
    "category-entry-1": {
      sectionIdLabel: "CONFIGURED CATEGORY LABEL",
      nameLabel: "Configured entry name",
      nicknameLabel: "Configured entry nickname",
    },
    "workflow-step-1": {
      title: "Configured personal details",
      field_personalInformation_firstName: "Configured first name",
    },
    "workflow-step-8": {
      title: "Configured final preview",
    },
  };
  await page.setViewportSize({ width: 390, height: 568 });
  await page.route("**/api/**", (route) => api.handle(route));
  await page.route("**/api/__clerk/v1/client/**", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ errors: [{ message: "Test email service unavailable." }] }) }),
  );

  await page.goto("/guest/apply");
  await page.getByTestId("input-guest-full-name").fill("Jordan Applicant");
  await page.getByTestId("input-guest-email").fill("jordan@example.test");
  await page.getByTestId("button-continue-guest-contact").click();
  await page.getByTestId("guest-dashboard-category-category-1").click();
  await expect(page.getByTestId("input-entry-name")).toBeVisible();
  await expect(page.getByTestId("select-guest-category")).toHaveCount(0);
  await expect(page.getByTestId("input-entry-name")).not.toHaveAttribute("placeholder");
  await expect(page.getByTestId("input-entry-nickname")).not.toHaveAttribute("placeholder");
  await expectNoDocumentOverflow(page);

  await page.locator("form button[type=submit]").click();
  await expect(page.getByTestId("input-entry-pin")).toBeVisible();
  await expect(page.getByText("Continue without a PIN")).toHaveCount(0);
  await expect(page.getByTestId("button-pin-continue")).toHaveCount(0);
  const pinInput = page.getByTestId("input-entry-pin");
  const pinLength = Number(await pinInput.getAttribute("maxlength"));
  await pinInput.fill("1".repeat(pinLength));
  await page.getByTestId("button-pin-key-confirm").click();
  await expect(page.getByTestId("enrollment-wizard")).toBeVisible();
  await expectNoDocumentOverflow(page);

  for (let step = 0; step < 7; step += 1) {
    await page.locator("form.ew-form button[type=submit]").click();
    await expectNoDocumentOverflow(page);
  }
  await expect(page.getByTestId("section-declaration")).toBeVisible();
  await expect(page.getByTestId("enrollment-preview")).toContainText("Configured final preview");
  await expect(page.getByTestId("review-section-0")).toContainText("Configured personal details");
  await expect(page.getByTestId("review-firstName")).toContainText("Configured first name");
  await expect(page.getByTestId("review-category")).toContainText("CONFIGURED CATEGORY LABEL");
  await expect(page.getByTestId("review-category")).toContainText("Configured Category One");
  await expect(page.getByTestId("review-category-name")).toContainText("Configured entry name");
  await expect(page.getByTestId("review-category-name")).toContainText("Not provided");
  await expect(page.getByTestId("review-category-nickname")).toContainText("Configured entry nickname");
  await expect(page.getByTestId("review-category-nickname")).toContainText("Not provided");
  await page.getByTestId("section-declaration").locator("label").click();
  await expect(page.getByTestId("check-declaration")).toBeChecked();
  await expect(page.getByTestId("modal-guest-email-otp")).toHaveCount(0);
  await expect(page.getByTestId("button-submit-enrollment")).toBeEnabled();
  await expectNoDocumentOverflow(page);

  expect(api.draft?.currentStep).toBe(7);
  expect(api.draft?.detailsComplete).toBe(false);
  expect(api.draft?.hasPin).toBe(true);
  expect(api.draft?.answers.reviewDeclarationAccepted).toBeUndefined();
});
