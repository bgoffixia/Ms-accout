import { describe, expect, it, vi } from "vitest";
import {
  APPLICANT_FORM_DEFAULTS,
  isApplicantFormContent,
} from "./applicantFormContent";
import {
  ApplicantFormContentPersistenceError,
  readApplicantFormContentRow,
  saveApplicantFormContentRow,
} from "./supabaseApplicantFormContent";

const productionEnvironment = {
  SUPABASE_URL: "https://uxmuqrzapklifcmpxclr.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "unit-test-only-key",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Supabase applicant form content persistence", () => {
  it("rejects missing or non-approved Supabase targets before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      readApplicantFormContentRow({
        environment: {},
        fetcher,
      }),
    ).rejects.toMatchObject<Partial<ApplicantFormContentPersistenceError>>({
      code: "not_configured",
    });
    await expect(
      readApplicantFormContentRow({
        environment: {
          ...productionEnvironment,
          SUPABASE_URL: "https://another-project.supabase.co",
        },
        fetcher,
      }),
    ).rejects.toMatchObject<Partial<ApplicantFormContentPersistenceError>>({
      code: "wrong_project",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reads without caching and validates the persisted form content", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse([
        {
          config_key: "applicant-forms",
          content: { "applicant-contact": { title: "Contact copy" } },
          version: 4,
          updated_at: "2026-11-17T12:00:00.000Z",
        },
      ]),
    );

    const row = await readApplicantFormContentRow({
      environment: productionEnvironment,
      fetcher,
    });
    expect(row).toEqual({
      content: { "applicant-contact": { title: "Contact copy" } },
      version: 4,
      updatedAt: "2026-11-17T12:00:00.000Z",
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toContain(
      "https://uxmuqrzapklifcmpxclr.supabase.co/rest/v1/applicant_form_content",
    );
    expect(init?.cache).toBe("no-store");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer unit-test-only-key",
    );
  });

  it("uses SUPABASE_SECRET_KEY as an apikey without a JWT bearer header", async () => {
    const opaqueSecret = "unit-test-opaque-secret";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse([
        {
          config_key: "applicant-forms",
          content: {},
          version: 0,
          updated_at: "2026-11-17T12:00:00.000Z",
        },
      ]),
    );

    const row = await readApplicantFormContentRow({
      environment: {
        SUPABASE_URL: productionEnvironment.SUPABASE_URL,
        SUPABASE_SECRET_KEY: opaqueSecret,
      },
      fetcher,
    });

    const [, init] = fetcher.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get("apikey")).toBe(opaqueSecret);
    expect(headers.get("Authorization")).toBeNull();
    expect(JSON.stringify(row)).not.toContain(opaqueSecret);
  });

  it("uses the existing lowercase legacy service-role JWT for bearer auth", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse([
        {
          config_key: "applicant-forms",
          content: {},
          version: 0,
          updated_at: "2026-11-17T12:00:00.000Z",
        },
      ]),
    );

    await readApplicantFormContentRow({
      environment: {
        SUPABASE_URL: productionEnvironment.SUPABASE_URL,
        SUPABASE_SECRET_KEY: "unit-test-secret-fallback",
        supabase_service_role: "unit-test-legacy-jwt",
      },
      fetcher,
    });

    const [, init] = fetcher.mock.calls[0]!;
    expect(new Headers(init?.headers).get("apikey")).toBe(
      "unit-test-legacy-jwt",
    );
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer unit-test-legacy-jwt",
    );
  });

  it("prefers SUPABASE_SERVICE_ROLE_KEY when both credentials are configured", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse([
        {
          config_key: "applicant-forms",
          content: {},
          version: 0,
          updated_at: "2026-11-17T12:00:00.000Z",
        },
      ]),
    );

    await readApplicantFormContentRow({
      environment: {
        ...productionEnvironment,
        SUPABASE_SERVICE_ROLE_KEY: "unit-test-service-role-jwt",
        supabase_service_role: "unit-test-legacy-jwt",
        SUPABASE_SECRET_KEY: "unit-test-secret-fallback",
      },
      fetcher,
    });

    const [, init] = fetcher.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get("apikey")).toBe("unit-test-service-role-jwt");
    expect(headers.get("Authorization")).toBe(
      "Bearer unit-test-service-role-jwt",
    );
    expect(headers.get("Authorization")).not.toContain(
      "unit-test-secret-fallback",
    );
  });

  it("does not expose selected credentials in persistence errors", async () => {
    const opaqueSecret = "unit-test-error-secret";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error(`network failure ${opaqueSecret}`));

    try {
      await expect(
        readApplicantFormContentRow({
          environment: {
            SUPABASE_URL: productionEnvironment.SUPABASE_URL,
            SUPABASE_SECRET_KEY: opaqueSecret,
          },
          fetcher,
        }),
      ).rejects.toThrow(
        "Production form-content storage could not be reached.",
      );
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("uses a version-checked update and rejects unknown form fields", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse([
        {
          config_key: "applicant-forms",
          content: { "applicant-contact": { title: "Saved copy" } },
          version: 5,
          updated_at: "2026-11-17T12:01:00.000Z",
        },
      ]),
    );
    const result = await saveApplicantFormContentRow({
      expectedVersion: 4,
      content: { "applicant-contact": { title: "Saved copy" } },
      actorUserId: "admin-test-user",
      environment: productionEnvironment,
      fetcher,
    });
    expect(result.version).toBe(5);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toContain("version=eq.4");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      content: { "applicant-contact": { title: "Saved copy" } },
      version: 5,
      updated_by_user_id: "admin-test-user",
    });

    await expect(
      saveApplicantFormContentRow({
        expectedVersion: 4,
        content: {
          "applicant-contact": { unexpected: "not allowed" },
        } as never,
        actorUserId: "admin-test-user",
        environment: productionEnvironment,
        fetcher,
      }),
    ).rejects.toThrow("unknown key or invalid text");
  });

  it("recognizes the server-owned defaults used for reset", () => {
    expect(APPLICANT_FORM_DEFAULTS["workflow-step-8"].description).toContain(
      "private tracking key",
    );
    expect(APPLICANT_FORM_DEFAULTS["applicant-contact"].title).toBe(
      "Your contact details",
    );
    expect(Object.keys(APPLICANT_FORM_DEFAULTS)).toEqual(
      expect.arrayContaining([
        "applicant-contact",
        "applicant-provider-selection",
        "category-entry-1",
        "category-entry-2",
        "category-entry-3",
        "category-entry-4",
        "workflow-step-1",
        "workflow-step-8",
        "guest-status",
        "submission-success",
      ]),
    );
    expect(
      isApplicantFormContent({
        "applicant-contact": { title: "Editable" },
      }),
    ).toBe(true);
    expect(
      isApplicantFormContent({
        "applicant-contact": { unknownField: "Rejected" },
      }),
    ).toBe(false);
  });
});
