import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

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
  savedSettings: Record<string, any> | null = null;
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
      return json(["Category One", "Category Two", "Category Three", "Category Four"].map((name, index) => ({
        id: `category-${index + 1}`,
        name,
        description: "Enrollment application category.",
        accent: ["#168341", "#2454bd", "#1688b8", "#2b7667"][index],
      })));
    }
    if (method === "GET" && path === "/api/portal/settings") {
      const defaults = {
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
      };
      return json(this.savedSettings
        ? { ...defaults, ...this.savedSettings, screenCopy: this.savedSettings.screenCopy ?? this.screenCopy }
        : defaults);
    }
    if (method === "PUT" && path === "/api/admin/settings") {
      const settings = request.postDataJSON();
      this.savedSettings = settings;
      this.screenCopy = settings.screenCopy ?? this.screenCopy;
      return json(settings);
    }
    if (method === "POST" && path === "/api/guest/preapplications") {
      const body = request.postDataJSON();
      const selectedCategoryId = typeof body.categoryId === "string" ? body.categoryId : "category-1";
      const categoryNames = ["Category One", "Category Two", "Category Three", "Category Four"];
      const selectedCategoryIndex = Number(selectedCategoryId.split("-").at(-1)) - 1;
      this.createCount += 1;
      this.accessKey = body.accessKey;
      this.draft = {
        id: applicationId,
        reference,
        categoryId: selectedCategoryId,
        categoryName: categoryNames[selectedCategoryIndex] ?? "Category One",
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

async function expectReadableLogo(locator: Locator) {
  const dimensions = await locator.evaluate((element) => {
    const image = element as HTMLImageElement;
    const bounds = image.getBoundingClientRect();
    return {
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      width: bounds.width,
      height: bounds.height,
    };
  });
  expect(dimensions.naturalWidth, "logo image must load").toBeGreaterThan(0);
  expect(dimensions.naturalHeight, "logo image must load").toBeGreaterThan(0);
  expect(dimensions.width, "logo must remain visible at a readable size").toBeGreaterThanOrEqual(24);
  expect(dimensions.height, "logo must remain visible at a readable size").toBeGreaterThanOrEqual(24);
}

async function expectNoOverlap(logo: Locator, control: Locator, message: string) {
  const logoBounds = await logo.boundingBox();
  const controlBounds = await control.boundingBox();
  expect(logoBounds).not.toBeNull();
  expect(controlBounds).not.toBeNull();
  const overlaps = logoBounds!.x < controlBounds!.x + controlBounds!.width
    && logoBounds!.x + logoBounds!.width > controlBounds!.x
    && logoBounds!.y < controlBounds!.y + controlBounds!.height
    && logoBounds!.y + logoBounds!.height > controlBounds!.y;
  expect(overlaps, `${message}; logo=${JSON.stringify(logoBounds)}, control=${JSON.stringify(controlBounds)}`).toBe(false);
}

test("keeps public guest pages inside the viewport on phone and desktop", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path === "/api/enrollment/categories"
      ? ["Category One", "Category Two", "Category Three", "Category Four"].map((name, index) => ({
          id: `category-${index + 1}`,
          name,
          description: "Enrollment category.",
          accent: ["#168341", "#2454bd", "#1688b8", "#2b7667"][index],
        }))
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
    { width: 390, height: 480 },
    { width: 320, height: 568 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of ["/", "/guest/apply", "/dashboard", "/enrollment-categories", "/guest/track"]) {
      await page.goto(path);
      await expect(page.locator(".portal-frame")).toBeVisible();
      await expectNoDocumentOverflow(page);
      if (path === "/guest/apply" || path === "/guest/track") {
        await expect(page.locator(".guest-page")).toHaveCSS("overflow-y", "hidden");
      }
    }
  }
});

test("keeps every category entry and PIN screen inside a compact mobile viewport", async ({ page }) => {
  test.setTimeout(180_000);
  let api = new GuestApiFixture();
  await page.route("**/api/**", (route) => api.handle(route));

  for (const viewport of [
    { width: 390, height: 568 },
    { width: 390, height: 480 },
    { width: 320, height: 568 },
  ]) {
    for (const categoryId of ["category-1", "category-2", "category-3", "category-4"]) {
      api = new GuestApiFixture();
      const testLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv2sAAAAASUVORK5CYII=";
      api.logoOverrides[categoryId] = {
        entryLogoDataUrl: testLogo,
        pinLogoDataUrl: testLogo,
        entryLogoSize: 240,
        pinLogoSize: 240,
        entryLogoAlignment: "right",
        entryLogoVerticalOffset: 120,
        pinLogoAlignment: "left",
        pinLogoVerticalOffset: -120,
      };
      await page.setViewportSize(viewport);
      await page.goto("/");
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.goto("/guest/apply");
      await page.getByTestId("input-guest-full-name").fill("Mobile Applicant");
      await page.getByTestId("input-guest-email").fill("mobile@example.test");
      await page.getByTestId("button-continue-guest-contact").click();
      await expect(page.getByTestId("select-guest-category")).toBeVisible();
      await page.getByTestId("select-guest-category").selectOption(categoryId);
      await page.getByTestId("button-submit-guest-application").click();
      await expect(page.getByTestId("guest-tracking-key-step")).toBeVisible();
      await page.getByTestId("button-continue-to-category-details").click();

      const form = page.getByTestId(`form-entry-${categoryId}`);
      await expect(form).toBeVisible();
      await expectNoDocumentOverflow(page);
      const fields = form.locator(".entry-line-input:visible");
      for (let index = 0; index < await fields.count(); index += 1) {
        await expectControlInsideViewport(page, fields.nth(index));
      }
      const entryButton = form.locator("form button[type=submit]:visible").first();
      await expectControlInsideViewport(page, entryButton);
      const entryLogo = form.locator("img").first();
      if (await entryLogo.count()) {
        await expectNoOverlap(entryLogo, form.locator(".entry-fields"), `${categoryId} entry logo must not cover its fields`);
      }

      await entryButton.click();
      if (categoryId === "category-2") {
        await expect(form).toHaveClass(/category-two-step-1/);
        await form.locator("form button[type=submit]:visible").first().click();
      }

      await expect(page.locator(".pin-entry-screen")).toBeVisible();
      await expectNoDocumentOverflow(page);
      const keypad = page.locator(".pin-entry-keypad");
      for (const key of await page.locator(".pin-entry-key").all()) {
        const bounds = await key.boundingBox();
        expect(bounds, `${categoryId} PIN key should have a visible target`).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width, `${categoryId} PIN key exceeds ${viewport.width}px width`)
          .toBeLessThanOrEqual(viewport.width);
        expect(bounds!.y + bounds!.height, `${categoryId} PIN key exceeds ${viewport.height}px height`)
          .toBeLessThanOrEqual(viewport.height);
      }
      const pinLogo = page.locator(".pin-entry-screen img").first();
      if (await pinLogo.count()) {
        await expectNoOverlap(pinLogo, page.locator(".pin-entry-title"), `${categoryId} PIN logo must not cover its prompt`);
        await expectNoOverlap(pinLogo, page.locator(".pin-entry-indicators"), `${categoryId} PIN logo must not cover the PIN indicators`);
        await expectNoOverlap(pinLogo, keypad, `${categoryId} PIN logo must not cover its keypad`);
      }
    }
  }
});

test("starts as a guest, chooses a category, and opens the selected category form", async ({ page }) => {
  const api = new GuestApiFixture();
  api.screenCopy["guest-contact"] = {
    title: "Who is applying?",
    description: "Use your own contact details.",
    fullNameLabel: "Applicant name",
    emailLabel: "Applicant email",
    continueLabel: "Choose a category",
    privacyText: "Only enrollment staff can view these details.",
    fullNamePlaceholder: "Use the name on your ID",
    fullNameValidationMessage: "Enter the applicant’s full legal name.",
    emailPlaceholder: "name@your-domain.test",
    emailValidationMessage: "Enter a working email address.",
  };
  api.screenCopy["category-entry-1"] = {
    title: "Identity details",
    description: "Enter the name associated with this category.",
    nameLabel: "Applicant record name",
    namePlaceholder: "Name exactly as printed on your card",
    pinLabel: "Create your secure PIN",
    pinValidationMessage: "Use four numbers for your PIN.",
  };
  api.screenCopy["workflow-step-1"] = {
    title: "Personal details",
    description: "Enter your legal information.",
    sectionIdLabel: "PERSONAL DETAILS",
    field_personalInformation_firstName: "Applicant given name",
    placeholder_personalInformation_firstName: "Given name on your ID",
    validation_personalInformation_firstName: "Please enter your given name.",
  };
  api.screenCopy["workflow-step-7"] = {
    validation_bankDetails_accountNumber: "Use 8–20 digits for the account number.",
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

  await page.goto("/guest/apply");
  await expect(page.getByRole("heading", { name: "Who is applying?" })).toBeVisible();
  await expect(page.getByText("Use your own contact details.", { exact: true })).toBeVisible();
  await expect(page.getByText("Applicant name", { exact: true })).toBeVisible();
  await expect(page.getByText("Applicant email", { exact: true })).toBeVisible();
  await expect(page.getByTestId("input-guest-full-name")).toHaveAttribute("placeholder", "Use the name on your ID");
  await expect(page.getByTestId("input-guest-email")).toHaveAttribute("placeholder", "name@your-domain.test");
  await page.getByTestId("button-continue-guest-contact").click();
  await expect(page.getByText("Enter the applicant’s full legal name.", { exact: true })).toBeVisible();
  await page.getByTestId("input-guest-full-name").fill("Jordan Applicant");
  await page.getByTestId("input-guest-email").fill("not-an-email");
  await page.getByTestId("button-continue-guest-contact").click();
  await expect(page.getByText("Enter a working email address.", { exact: true })).toBeVisible();
  await page.getByTestId("input-guest-email").fill("jordan@example.test");
  await page.getByTestId("button-continue-guest-contact").click();

  await expect(page.getByTestId("select-guest-category")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose your category" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Confirm your category" })).toHaveCount(0);
  await page.getByTestId("select-guest-category").selectOption("category-1");
  await page.getByTestId("button-submit-guest-application").click();
  await expect(page.getByTestId("guest-tracking-key-step")).toBeVisible();
  await page.getByTestId("button-continue-to-category-details").click();
  await expect(page.getByTestId("input-entry-name")).toBeVisible();
  await expect(page.getByTestId("entry-configured-copy")).toContainText("Identity details");
  await expect(page.getByTestId("entry-configured-copy")).toContainText("Enter the name associated with this category.");
  await expect(page.getByText("Applicant record name", { exact: true })).toBeVisible();
  await expect(page.getByTestId("input-entry-name")).toHaveAttribute("placeholder", "Name exactly as printed on your card");
  await expectNoDocumentOverflow(page);
  await expect(page.getByTestId("select-guest-category")).toHaveCount(0);
  await expectNoDocumentOverflow(page);
  await expect(page.getByRole("img", { name: "Category One entry logo" })).toHaveAttribute("src", testLogo);
  await expect(page.getByTestId("form-entry-category-1")).toHaveClass(/entry-logo-align-left/);
  await expect(page.getByTestId("form-entry-category-1")).toHaveCSS("--entry-logo-offset-y", "12px");
  expect(api.createCount).toBe(1);
  expect(api.draft?.categoryId).toBe("category-1");

  await page.getByTestId("button-entry-continue").click();
  await expect(page.locator("#pin-entry-heading")).toHaveText("Create your secure PIN");
  await page.getByTestId("button-pin-key-confirm").click();
  await expect(page.getByTestId("text-entry-error")).toContainText("Use four numbers for your PIN.");
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
  await expect(page.getByLabel("Applicant given name")).toHaveAttribute("placeholder", "Given name on your ID");
  await expect(page.getByText("Enter your legal information.", { exact: true })).toBeVisible();
  for (let step = 0; step < 6; step += 1) {
    await page.getByTestId("button-save-next").click();
  }
  await expect(page.getByTestId("input-accountNumber")).toBeVisible();
  await page.getByTestId("input-accountNumber").fill("123");
  await expect(page.getByTestId("error-accountNumber")).toHaveText("Use 8–20 digits for the account number.");
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
  await expect(page.getByText("Start with only your name and email. You’ll choose an enrollment category next.", { exact: true })).toBeVisible();
});

test("shows updated contact copy without a manual refresh, preserves it after reload, and restores defaults for blanks", async ({ page }) => {
  const api = new GuestApiFixture();
  await page.route("**/api/**", (route) => api.handle(route));

  await page.goto("/guest/apply");
  await expect(page.getByRole("heading", { name: "Your contact details" })).toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();

  api.screenCopy["guest-contact"] = {
    title: "Applicant information",
    description: "Use the contact details associated with this request.",
    fullNameLabel: "Applicant's legal name",
  };
  await expect(page.getByRole("heading", { name: "Applicant information" })).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText("Use the contact details associated with this request.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Applicant's legal name", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Applicant information" })).toBeVisible();
  await expect(page.getByText("Use the contact details associated with this request.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Applicant's legal name", { exact: true })).toBeVisible();

  api.screenCopy["guest-contact"] = {
    title: "   ",
    description: "",
    fullNameLabel: " ",
  };
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your contact details" })).toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
  await expect(page.getByText("Start with only your name and email. You’ll choose an enrollment category next.", { exact: true })).toBeVisible();
});

test("an admin can preview entry and PIN screens at desktop and mobile sizes without saving", async ({ page }) => {
  test.skip(process.env.E2E_AUTH_MOCK !== "1", "Uses an isolated test-only administrator session.");
  const api = new GuestApiFixture();
  await page.addInitScript(() => localStorage.setItem("e2e-clerk-role", "admin"));
  await page.route("**/api/**", (route) => api.handle(route));
  let settingsWrites = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && new URL(request.url()).pathname === "/api/admin/settings") settingsWrites += 1;
  });

  await page.goto("/admin/settings");
  await expect(page.getByTestId("button-save-portal-settings")).toBeVisible();

  const entrySize = page.getByTestId("input-logo-size-entry-category-1");
  await entrySize.focus();
  await entrySize.press("ArrowRight");
  await expect(entrySize).toHaveValue("180");
  await page.getByTestId("button-preview-logo-screen-entry-category-1").click();
  const preview = page.getByRole("dialog");
  await expect(preview.getByRole("heading", { name: "Category One · Entry screen" })).toBeVisible();
  await expect(page.locator(".category-one-bank-brand img")).toHaveAttribute("style", /width: 180px/);
  const previewFrame = page.getByLabel("Category One entry screen preview");
  const desktopBounds = await previewFrame.boundingBox();
  expect(desktopBounds?.width).toBeGreaterThan(500);
  await page.getByTestId("button-preview-size-mobile").click();
  await expect(previewFrame).toHaveClass(/settings-screen-preview-viewport-mobile/);
  const mobileBounds = await previewFrame.boundingBox();
  expect(mobileBounds?.width).toBeLessThan(400);
  expect(mobileBounds?.height).toBeGreaterThan(mobileBounds?.width ?? 0);
  await page.getByTestId("button-close-logo-screen-preview").click();

  const pinSize = page.getByTestId("input-logo-size-pin-category-1");
  await pinSize.focus();
  await pinSize.press("ArrowRight");
  await expect(pinSize).toHaveValue("164");
  await page.getByTestId("button-preview-logo-screen-pin-category-1").click();
  await expect(preview.getByRole("heading", { name: "Category One · PIN screen" })).toBeVisible();
  await expect(page.locator(".category-one-pin-brand img")).toHaveAttribute("style", /width: 164px/);
  expect(settingsWrites).toBe(0);
});

test("publishes independent logo settings for every category and keeps applicant controls clear on mobile", async ({ page }) => {
  test.skip(process.env.E2E_AUTH_MOCK !== "1", "Uses an isolated test-only administrator session.");
  const api = new GuestApiFixture();
  await page.addInitScript(() => {
    if (location.pathname === "/admin/settings") localStorage.setItem("e2e-clerk-role", "admin");
  });
  await page.route("**/api/**", (route) => api.handle(route));

  const categoryIds = ["category-1", "category-2", "category-3", "category-4"];
  const slots = ["card", "entry", "pin"] as const;
  const settingsFor = (categoryId: string, slot: typeof slots[number]) => ({
    size: page.getByTestId(`input-logo-size-${slot}-${categoryId}`),
    fit: page.getByTestId(`select-logo-fit-${slot}-${categoryId}`),
  });
  const readSlot = async (categoryId: string, slot: typeof slots[number]) => {
    const controls = settingsFor(categoryId, slot);
    return { size: await controls.size.inputValue(), fit: await controls.fit.inputValue() };
  };

  await page.goto("/admin/settings");
  await expect(page.getByTestId("button-save-portal-settings")).toBeVisible();
  for (const categoryId of categoryIds) {
    for (const slot of slots) {
      const before = Object.fromEntries(await Promise.all(
        slots.map(async (otherSlot) => [otherSlot, await readSlot(categoryId, otherSlot)] as const),
      )) as Record<typeof slots[number], { size: string; fit: string }>;
      const target = settingsFor(categoryId, slot);
      await target.size.focus();
      await target.size.press("ArrowRight");
      await target.fit.selectOption("cover");
      await expect(target.size).toHaveValue(String(Number(before[slot].size) + 4));
      await expect(target.fit).toHaveValue("cover");
      for (const otherSlot of slots.filter((candidate) => candidate !== slot)) {
        expect(await readSlot(categoryId, otherSlot), `${categoryId} ${slot} edits must not change ${otherSlot}`)
          .toEqual(before[otherSlot]);
      }
    }
  }

  // Leave the PIN setting on contain so the published values demonstrate that
  // each slot retains its own crop mode.
  await settingsFor("category-1", "pin").fit.selectOption("contain");
  const saveResponse = page.waitForResponse((response) =>
    response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/admin/settings",
  );
  await page.getByTestId("button-save-portal-settings").click();
  expect((await saveResponse).ok()).toBe(true);
  const savedValues = Object.fromEntries(await Promise.all(
    categoryIds.map(async (categoryId) => Promise.all(
      slots.map(async (slot) => [slot, await readSlot(categoryId, slot)] as const),
    ).then((slotValues) => [categoryId, Object.fromEntries(slotValues)] as const)),
  )) as Record<string, Record<typeof slots[number], { size: string; fit: string }>>;

  await page.reload();
  await expect(page.getByTestId("button-save-portal-settings")).toBeVisible();
  for (const categoryId of categoryIds) {
    for (const slot of slots) {
      const controls = settingsFor(categoryId, slot);
      await expect(controls.size).toHaveValue(savedValues[categoryId][slot].size);
      await expect(controls.fit).toHaveValue(savedValues[categoryId][slot].fit);
    }
  }

  for (const categoryId of categoryIds) {
    for (const screen of ["entry", "pin"] as const) {
      await page.getByTestId(`button-preview-logo-screen-${screen}-${categoryId}`).click();
      const dialog = page.getByRole("dialog");
      await page.getByTestId("button-preview-size-mobile").click();
      const previewScreen = page.locator(".settings-screen-preview-viewport-mobile .category-entry-screen");
      const logo = previewScreen.locator("img").first();
      await expect(logo).toHaveCSS("object-fit", savedValues[categoryId][screen].fit);
      await expect(logo).toHaveAttribute("style", new RegExp(`width: ${savedValues[categoryId][screen].size}px`));
      await expectReadableLogo(logo);
      if (screen === "entry") {
        await expectNoOverlap(logo, previewScreen.locator(".entry-line-input").first(), `${categoryId} entry logo must not cover its field`);
        await expectNoOverlap(logo, previewScreen.locator(".entry-primary-button"), `${categoryId} entry logo must not cover its continue button`);
      } else {
        await expectNoOverlap(logo, previewScreen.locator(".pin-entry-keypad"), `${categoryId} PIN logo must not cover its keypad`);
      }
      await page.getByTestId("button-close-logo-screen-preview").click();
      await expect(dialog).toHaveCount(0);
    }
  }

  await page.evaluate(() => localStorage.removeItem("e2e-clerk-role"));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await expect(page.getByTestId("guest-dashboard-category-category-1")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 568 });
  await page.goto("/guest/apply");
  await page.getByTestId("input-guest-full-name").fill("Jordan Applicant");
  await page.getByTestId("input-guest-email").fill("jordan@example.test");
  await page.getByTestId("button-continue-guest-contact").click();
  await page.getByTestId("select-guest-category").selectOption("category-1");
  await page.getByTestId("button-submit-guest-application").click();
  await page.getByTestId("button-continue-to-category-details").click();
  await expect(page.getByTestId("input-entry-name")).toBeVisible();
  const entryLogo = page.getByRole("img", { name: "Category One entry logo" });
  await expect(entryLogo).toHaveCSS("object-fit", "cover");
  await expect(entryLogo).toHaveAttribute("style", new RegExp(`width: ${savedValues["category-1"].entry.size}px`));
  await expectReadableLogo(entryLogo);
  await expectNoOverlap(entryLogo, page.getByTestId("input-entry-name"), "entry logo must not cover applicant form fields");
  await expectNoOverlap(entryLogo, page.getByTestId("button-entry-continue"), "entry logo must not cover applicant form actions");

  await page.getByTestId("input-entry-name").fill("Jordan Applicant");
  await page.getByTestId("button-entry-continue").click();
  await expect(page.getByTestId("button-pin-key-confirm")).toBeVisible();
  const pinLogo = page.getByRole("img", { name: "Category One PIN logo" });
  await expect(pinLogo).toHaveCSS("object-fit", "contain");
  await expect(pinLogo).toHaveAttribute("style", new RegExp(`width: ${savedValues["category-1"].pin.size}px`));
  await expectReadableLogo(pinLogo);
  await expectNoOverlap(pinLogo, page.locator(".pin-entry-keypad"), "PIN logo must not cover the applicant keypad");
});

test("an admin can publish applicant copy, and blank overrides restore built-in text", async ({ page }) => {
  test.skip(process.env.E2E_AUTH_MOCK !== "1", "Uses an isolated test-only administrator session.");
  const api = new GuestApiFixture();
  await page.addInitScript(() => localStorage.setItem("e2e-clerk-role", "admin"));
  await page.route("**/api/**", (route) => api.handle(route));

  await page.goto("/admin/settings");
  await expect(page.getByTestId("button-save-portal-settings")).toBeVisible();
  await page.locator("#settings-workflow-copy details").filter({ hasText: "guest-contact" }).locator("summary").click();
  await page.getByTestId("input-copy-guest-contact-title").fill("Applicant information");
  await page.getByTestId("input-copy-guest-contact-description").fill("Use the contact details associated with this request.");
  await page.getByTestId("input-copy-guest-contact-fullNameLabel").fill("Applicant's legal name");
  const publishResponse = page.waitForResponse((response) =>
    response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/admin/settings",
  );
  await page.getByTestId("button-save-portal-settings").click();
  expect((await publishResponse).ok()).toBe(true);
  expect(api.screenCopy["guest-contact"]).toMatchObject({
    title: "Applicant information",
    description: "Use the contact details associated with this request.",
    fullNameLabel: "Applicant's legal name",
  });

  await page.evaluate(() => localStorage.removeItem("e2e-clerk-role"));
  await page.goto("/guest/apply");
  await expect(page.getByRole("heading", { name: "Applicant information" })).toBeVisible();
  await expect(page.getByText("Use the contact details associated with this request.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Applicant's legal name", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Applicant information" })).toBeVisible();
  await expect(page.getByText("Use the contact details associated with this request.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Applicant's legal name", { exact: true })).toBeVisible();

  await page.evaluate(() => localStorage.setItem("e2e-clerk-role", "admin"));
  await page.goto("/admin/settings");
  await page.locator("#settings-workflow-copy details").filter({ hasText: "guest-contact" }).locator("summary").click();
  await page.getByTestId("input-copy-guest-contact-title").fill("");
  await page.getByTestId("input-copy-guest-contact-description").fill("");
  await page.getByTestId("input-copy-guest-contact-fullNameLabel").fill("");
  const resetResponse = page.waitForResponse((response) =>
    response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/admin/settings",
  );
  await page.getByTestId("button-save-portal-settings").click();
  expect((await resetResponse).ok()).toBe(true);

  await page.evaluate(() => localStorage.removeItem("e2e-clerk-role"));
  await page.goto("/guest/apply");
  await expect(page.getByRole("heading", { name: "Your contact details" })).toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
  await expect(page.getByText("Start with only your name and email. You’ll choose an enrollment category next.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your contact details" })).toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
});

test("keeps the applicant dashboard private and does not expose the retired guest dashboard", async ({ page }) => {
  const api = new GuestApiFixture();
  api.screenCopy.dashboard = {
    title: "Choose your enrollment path",
    description: "This configured description should appear once.",
    sectionIdLabel: "PUBLIC CATEGORY SELECTION",
  };
  await page.route("**/api/**", (route) => api.handle(route));

  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose your enrollment path" })).toHaveCount(0);
  await expect(page.getByTestId("guest-dashboard-category-category-1")).toHaveCount(0);
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

test("redirects retired account-based applicant URLs to the private applicant dashboard", async ({ page }) => {
  const api = new GuestApiFixture();
  await page.route("**/api/**", (route) => api.handle(route));

  for (const oldPath of ["/apply/legacy-draft-id", "/applications/legacy-application-id"]) {
    await page.goto(oldPath);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
    await expect(page.getByTestId("guest-dashboard-category-category-1")).toHaveCount(0);
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
  await page.getByTestId("select-guest-category").selectOption("category-1");
  await page.getByTestId("button-submit-guest-application").click();
  await page.getByTestId("button-continue-to-category-details").click();
  await expectNoDocumentOverflow(page);
  await expect(page.getByTestId("input-entry-name")).toBeVisible();
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
  await page.getByTestId("select-guest-category").selectOption("category-1");
  await page.getByTestId("button-submit-guest-application").click();
  await page.getByTestId("button-continue-to-category-details").click();
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
