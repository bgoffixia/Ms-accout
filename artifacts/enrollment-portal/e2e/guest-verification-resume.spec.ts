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
        })),
        theme: {
          pinScreenBackground: "#FFFFFF",
          buttonSize: "standard",
          buttonPlacement: "right",
          categoryInputTransparent: true,
        },
        screenCopy: {},
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
      this.draft.detailsComplete ||= Boolean(body.complete);
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

test("preserves the same guest application across verification failure, reload, and verified return", async ({ page }) => {
  const api = new GuestApiFixture();
  await page.route("**/api/**", (route) => api.handle(route));
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
  await page.getByTestId("input-guest-full-name").fill("Jordan Applicant");
  await page.getByTestId("input-guest-email").fill("jordan@example.test");
  await page.getByTestId("button-continue-guest-contact").click();
  await page.getByTestId("guest-dashboard-category-category-1").click();
  await page.getByTestId("select-guest-category").selectOption("category-1");
  await page.locator("form.guest-form button[type=submit]").click();
  await expect(page.getByTestId("guest-tracking-key-step")).toBeVisible();
  await page.getByTestId("button-continue-to-category-details").click();
  await page.getByTestId("input-entry-name").fill("Jordan");
  await page.getByTestId("input-entry-nickname").fill("Jo");
  await page.locator("form button[type=submit]").click();
  await page.getByTestId("input-entry-pin").fill("4826");
  await expect(page.getByTestId("enrollment-wizard")).toBeVisible();

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

  await expect(page).toHaveURL(/\/sign-up\?guestApplication=1/);
  expect(api.createCount).toBe(1);
  expect(api.draft?.detailsComplete).toBe(true);
  expect(api.draft?.currentStep).toBe(7);
  expect(api.uploadedEvidence.map(({ slot }) => slot)).toEqual(["identity_front", "verification_video"]);
  const storedContext = await page.evaluate(() => JSON.parse(
    sessionStorage.getItem("guest-application-auth-context") ?? "null",
  ));
  expect(storedContext).toMatchObject({
    applicationId,
    reference,
    email: "jordan@example.test",
  });
  expect(storedContext.accessKey).toBe(api.accessKey);

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
