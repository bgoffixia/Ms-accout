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
  hasPin: boolean;
  missingRequiredFields?: string[];
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
  screenCopy: Record<string, Record<string, string>> = {};
  logoOverrides: Record<string, Record<string, unknown>> = {};
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
      return json([{
        id: "category-1",
        name: "Category One",
        description: "Enrollment application category.",
        accent: "#168341",
      }]);
    }
    if (method === "GET" && path === "/api/portal/settings") {
      return json({
        hero: { title: "Enrollment", description: "Complete your enrollment.", getStartedLabel: "Get started", loginLabel: "Sign in" },
        cards: ["category-1", "category-2", "category-3", "category-4"].map((id) => ({
          id,
          title: id === "category-1" ? "Category One" : id,
          description: "Enrollment category.",
          buttonLabel: "Start application",
          backgroundColor: "#F5F8FA",
          logoDataUrl: null,
          cardLogoAlignment: "left",
          cardLogoVerticalOffset: 0,
          ...this.logoOverrides[id],
        })),
        theme: {
          pinScreenBackground: "#FFFFFF",
          buttonSize: "standard",
          buttonPlacement: "right",
          categoryInputTransparent: true,
        },
        screenCopy: this.screenCopy,
        pageThemes: {},
      });
    }
    if (method === "POST" && path === "/api/guest/preapplications") {
      const body = request.postDataJSON();
      this.createCount += 1;
      this.accessKey = body.accessKey;
      this.draft = {
        id: applicationId,
        reference,
        categoryId: "category-1",
        categoryName: "Category One",
        fullName: body.fullName,
        email: body.email,
        status: "received",
        submissionStatus: "draft",
        emailVerified: false,
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
    return {
      ...this.draft,
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
    const geometry = (element: HTMLElement | null) => element ? {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
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
      previewScroll: geometry(previewScroll),
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
}

async function expectControlInsideViewport(page: Page, locator: ReturnType<Page["getByTestId"]>) {
  await locator.scrollIntoViewIfNeeded();
  const bounds = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds, "primary action should have a visible bounding box").not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height);
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
      if (path !== "/") {
        await expect(page.locator(".guest-page")).toHaveCSS("overflow-y", "hidden");
      }
    }
  }
});

test("starts from the public shared dashboard and opens the selected category form after contact details", async ({ page }) => {
  const api = new GuestApiFixture();
  api.screenCopy["guest-contact"] = {
    title: "Who is applying?",
    description: "Use your own contact details.",
    fullNameLabel: "Applicant name",
    emailLabel: "Applicant email",
    continueLabel: "Choose a category",
    privacyText: "Only enrollment staff can view these details.",
  };
  api.screenCopy["category-entry-1"] = {
    title: "Identity details",
    description: "Enter the name associated with this category.",
    nameLabel: "Applicant record name",
    pinLabel: "Create your secure PIN",
  };
  api.screenCopy["workflow-step-1"] = {
    title: "Personal details",
    description: "Enter your legal information.",
    sectionIdLabel: "PERSONAL DETAILS",
    field_personalInformation_firstName: "Applicant given name",
  };
  const testLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv2sAAAAASUVORK5CYII=";
  api.logoOverrides["category-1"] = {
    entryLogoDataUrl: testLogo,
    pinLogoDataUrl: testLogo,
    entryLogoAlignment: "left",
    entryLogoVerticalOffset: 12,
    pinLogoAlignment: "right",
    pinLogoVerticalOffset: -14,
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/**", (route) => api.handle(route));

  await page.goto("/dashboard");
  await expect(page.getByTestId("guest-dashboard-category-category-1")).toBeVisible();
  await page.getByTestId("guest-dashboard-category-category-1").click();
  await expect(page.getByRole("heading", { name: "Who is applying?" })).toBeVisible();
  await expect(page.getByText("Use your own contact details.", { exact: true })).toBeVisible();
  await expect(page.getByText("Applicant name", { exact: true })).toBeVisible();
  await expect(page.getByText("Applicant email", { exact: true })).toBeVisible();
  await page.getByTestId("input-guest-full-name").fill("Jordan Applicant");
  await page.getByTestId("input-guest-email").fill("jordan@example.test");
  await page.getByTestId("button-continue-guest-contact").click();

  await expect(page.getByTestId("input-entry-name")).toBeVisible();
  await expect(page.getByTestId("entry-configured-copy")).toContainText("Identity details");
  await expect(page.getByTestId("entry-configured-copy")).toContainText("Enter the name associated with this category.");
  await expect(page.getByText("Applicant record name", { exact: true })).toBeVisible();
  await expectNoDocumentOverflow(page);
  await expect(page.getByTestId("guest-tracking-key-step")).toBeVisible();
  await expect(page.getByTestId("select-guest-category")).toHaveCount(0);
  await expectNoDocumentOverflow(page);
  await expect(page.getByRole("img", { name: "Category One entry logo" })).toHaveAttribute("src", testLogo);
  await expect(page.getByTestId("form-entry-category-1")).toHaveClass(/entry-logo-align-left/);
  await expect(page.getByTestId("form-entry-category-1")).toHaveCSS("--entry-logo-offset-y", "12px");
  expect(api.createCount).toBe(1);
  expect(api.draft?.categoryId).toBe("category-1");

  await page.getByTestId("button-entry-continue").click();
  await expect(page.locator("#pin-entry-heading")).toHaveText("Create your secure PIN");
  await expectNoDocumentOverflow(page);
  await expect(page.getByRole("img", { name: "Category One PIN logo" })).toHaveAttribute("src", testLogo);
  await expect(page.getByTestId("form-entry-category-1")).toHaveClass(/entry-logo-align-right/);
  await expect(page.getByTestId("form-entry-category-1")).toHaveCSS("--entry-logo-offset-y", "-14px");
  for (const digit of ["4", "8", "2", "6"]) {
    await page.getByTestId(`button-pin-key-${digit}`).click();
  }
  await page.getByTestId("button-pin-key-confirm").click();
  await expect(page.getByTestId("enrollment-wizard")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Personal details" })).toBeVisible();
  await expect(page.locator(".ew-stage-heading .ew-stage-number")).toContainText("PERSONAL DETAILS");
  await expect(page.getByLabel("Applicant given name")).toBeVisible();
  await expect(page.getByText("Enter your legal information.", { exact: true })).toBeVisible();
});

test("falls back to built-in contact copy when configured text is blank", async ({ page }) => {
  const api = new GuestApiFixture();
  api.screenCopy["guest-contact"] = {
    title: "   ",
    description: "",
    fullNameLabel: " ",
  };
  await page.route("**/api/**", (route) => api.handle(route));

  await page.goto("/guest/apply");

  await expect(page.getByRole("heading", { name: "Your contact details" })).toBeVisible();
  await expect(page.getByText("Full name", { exact: true })).toBeVisible();
  await expect(page.getByText("Start with only your name and email. You’ll continue to the applicant dashboard to choose a category.", { exact: true })).toBeVisible();
});

test("shows configured dashboard copy once in its designated locations", async ({ page }) => {
  const api = new GuestApiFixture();
  api.screenCopy.dashboard = {
    title: "Choose your enrollment path",
    description: "This configured description should appear once.",
    sectionIdLabel: "PUBLIC CATEGORY SELECTION",
  };
  await page.route("**/api/**", (route) => api.handle(route));

  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Choose your enrollment path" })).toBeVisible();
  await expect(page.getByText("This configured description should appear once.", { exact: true })).toHaveCount(1);
  await expect(page.getByText("PUBLIC CATEGORY SELECTION", { exact: true })).toHaveCount(1);
});

test("shows a private application status without reviewer-only details", async ({ page }) => {
  const api = new GuestApiFixture();
  api.screenCopy["guest-status"] = {
    title: "Your enrollment progress",
    description: "Enter your secure details to check the application.",
    referenceLabel: "File reference",
    keyLabel: "Private access key",
    lookupButtonLabel: "Check my progress",
    currentStatusLabel: "Review stage",
  };
  api.screenCopy["workflow-step-1"] = {
    field_personalInformation_firstName: "Applicant given name",
  };
  api.accessKey = "test-private-tracking-key";
  api.draft = {
    id: applicationId,
    reference,
    categoryId: "category-1",
    categoryName: "Category One",
    fullName: "Jordan Applicant",
    email: "jordan@example.test",
    status: "received",
    submissionStatus: "draft",
    emailVerified: false,
    hasPin: true,
    linkedApplicationId: null,
    currentStep: 3,
    detailsComplete: false,
    answers: {},
    createdAt: "2026-10-12T12:00:00.000Z",
    updatedAt: "2026-10-12T12:02:00.000Z",
    missingRequiredFields: ["First name"],
  };
  await page.setViewportSize({ width: 390, height: 568 });
  await page.route("**/api/**", (route) => api.handle(route));

  await page.goto("/guest/track");
  await expect(page.getByRole("heading", { name: "Your enrollment progress" })).toBeVisible();
  await expect(page.getByText("Enter your secure details to check the application.", { exact: true })).toBeVisible();
  await expect(page.getByText("File reference", { exact: true })).toBeVisible();
  await expect(page.getByText("Private access key", { exact: true })).toBeVisible();
  await page.getByTestId("input-track-reference").fill(reference);
  await page.getByTestId("input-track-key").fill(api.accessKey);
  await page.getByRole("button", { name: /Check my progress/ }).click();

  const status = page.getByTestId("guest-public-status");
  await expect(status).toBeVisible();
  await expect(status).toContainText(reference);
  await expect(status).toContainText("Not verified");
  await expect(status).toContainText("Applicant given name");
  await expect(status).not.toContainText(reviewerOnlyNote);
  await expectControlInsideViewport(page, page.getByTestId("button-resume-guest-application"));
  await expectNoDocumentOverflow(page);
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

test("preserves the same guest application across verification failure, reload, and verified return", async ({ page }) => {
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
  await expect(page.getByTestId("guest-tracking-key-step")).toBeVisible();
  await expect(page.getByTestId("select-guest-category")).toHaveCount(0);
  await page.getByTestId("input-entry-name").fill("Jordan");
  await page.getByTestId("input-entry-nickname").fill("Jo");
  await page.setViewportSize({ width: 390, height: 568 });
  await page.locator("form button[type=submit]").click();
  const pinInput = page.getByTestId("input-entry-pin");
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
  await page.setViewportSize({ width: 390, height: 568 });
  await expectNoDocumentOverflow(page);
  await expectControlInsideViewport(page, page.getByTestId("button-save-next"));
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
  await expectControlInsideViewport(page, page.getByTestId("button-submit-enrollment"));
  await page.getByTestId("section-declaration").locator("label").click();
  await expect(page.getByTestId("check-declaration")).toBeChecked();
  const sectionStatuses = await Promise.all(
    Array.from({ length: 7 }, (_, index) =>
      page.getByTestId(`status-section-${index}`).innerText(),
    ),
  );
  expect(sectionStatuses, JSON.stringify(api.draft?.answers)).toEqual(Array(7).fill("Complete"));
  await expect(
    page.getByTestId("button-submit-enrollment"),
    `Submission readiness: ${await page.getByTestId("state-submit-readiness").innerText()}`,
  ).toBeDisabled();
  await expect(page.getByTestId("modal-guest-email-otp")).toBeVisible();
  await expect(page.getByTestId("input-guest-email-otp")).toBeVisible();
  await page.getByRole("button", { name: "Close email verification" }).click();
  await expect(page.getByTestId("modal-guest-email-otp")).toHaveCount(0);

  expect(api.createCount).toBe(1);
  expect(api.draft?.detailsComplete).toBe(true);
  expect(api.draft?.currentStep).toBe(7);
  expect(api.uploadedEvidence.map(({ slot }) => slot)).toEqual(["identity_front", "verification_video"]);
  expect(api.draft?.emailVerified).toBe(false);

  // Returning without a verified session models a failed/cancelled verification.
  // A reload must restore the saved draft from the server, not create another one.
  await page.goto("/guest/apply?resume=1");
  await expect(page.getByTestId("enrollment-wizard")).toBeVisible();
  await expect(page.getByTestId("text-application-reference")).toHaveText(reference);
  await page.reload();
  await expect(page.getByTestId("enrollment-wizard")).toBeVisible();
  await expect(page.getByTestId("text-application-reference")).toHaveText(reference);
  await expect(page.getByTestId("review-section-0")).toContainText("Jordan");
  await expect(page.getByTestId("review-identityFront")).toContainText("Uploaded reference attached");
  await expect(page.getByTestId("review-liveVideoReference")).toContainText("Reference attached");
  await expect(page.getByTestId("enrollment-wizard")).not.toContainText(api.accessKey);
  await expect(page.getByTestId("enrollment-wizard")).not.toContainText("private/guest-evidence/");
  await expect(page.getByTestId("enrollment-wizard")).not.toContainText(reviewerOnlyNote);
  expect(api.lookupCount).toBeGreaterThanOrEqual(2);
  expect(api.createCount).toBe(1);

  // The server has now completed a verified submission for that same draft.
  // A later browser return should show the existing submitted application.
  api.markVerifiedSubmission();
  await page.goto("/guest/apply?resume=1");
  await expect(page.getByTestId("guest-application-success")).toBeVisible();
  await expect(page.getByTestId("guest-application-success")).toContainText("Your application was submitted.");
  await expect(page.getByTestId("text-guest-reference")).toHaveText(reference);
  await expect(page.getByTestId("guest-application-success")).not.toContainText(reviewerOnlyNote);
  expect(api.createCount).toBe(1);
  expect(api.draft?.linkedApplicationId).toBe("7aed516d-1e70-41a9-a239-4568b8fbc7c2");
});

test("lets guests skip incomplete fields and the PIN while keeping final submission gated", async ({ page }) => {
  const api = new GuestApiFixture();
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
  await expectNoDocumentOverflow(page);

  await page.locator("form button[type=submit]").click();
  await expect(page.getByTestId("input-entry-pin")).toBeVisible();
  await page.getByTestId("button-continue-without-pin").click();
  await expect(page.getByTestId("enrollment-wizard")).toBeVisible();
  await expectNoDocumentOverflow(page);

  for (let step = 0; step < 7; step += 1) {
    await page.locator("form.ew-form button[type=submit]").click();
    await expectNoDocumentOverflow(page);
  }
  await expect(page.getByTestId("section-declaration")).toBeVisible();
  await page.getByTestId("section-declaration").locator("label").click();
  await expect(page.getByTestId("check-declaration")).toBeChecked();
  await expect(page.getByTestId("modal-guest-email-otp")).toBeVisible();
  await expect(page.getByTestId("button-submit-enrollment")).toBeDisabled();
  await expectNoDocumentOverflow(page);

  expect(api.draft?.currentStep).toBe(7);
  expect(api.draft?.detailsComplete).toBe(false);
  expect(api.draft?.hasPin).toBe(false);
  expect(api.draft?.answers.reviewDeclarationAccepted).toBe(true);
});
