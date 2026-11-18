import type { ApplicantFormContent } from "@workspace/api-zod";
import { sanitizeApplicantFormContent } from "./applicantFormContent";

export const APPLICANT_FORM_CONTENT_PROJECT_HOST =
  "uxmuqrzapklifcmpxclr.supabase.co";
const TABLE = "applicant_form_content";
const CONFIG_KEY = "applicant-forms";
const SELECT_COLUMNS = "config_key,content,version,updated_at";

export type ApplicantFormContentRow = {
  content: ApplicantFormContent;
  version: number;
  updatedAt: string | null;
};

export type ApplicantFormContentEnvironment = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  supabase_service_role?: string;
  SUPABASE_SECRET_KEY?: string;
};

export class ApplicantFormContentPersistenceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_configured"
      | "wrong_project"
      | "request_failed"
      | "migration_missing"
      | "invalid_row"
      | "version_conflict",
  ) {
    super(message);
    this.name = "ApplicantFormContentPersistenceError";
  }
}

function getProjectConfig(environment: ApplicantFormContentEnvironment) {
  const configuredUrl = environment.SUPABASE_URL?.trim();
  const legacyServiceRoleKey =
    environment.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    environment.supabase_service_role?.trim();
  const apiKey =
    legacyServiceRoleKey || environment.SUPABASE_SECRET_KEY?.trim();
  if (!configuredUrl || !apiKey) {
    throw new ApplicantFormContentPersistenceError(
      "Production form-content persistence is not configured.",
      "not_configured",
    );
  }

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new ApplicantFormContentPersistenceError(
      "Production form-content persistence target is invalid.",
      "wrong_project",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== APPLICANT_FORM_CONTENT_PROJECT_HOST ||
    url.username ||
    url.password ||
    url.port ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new ApplicantFormContentPersistenceError(
      "Production form-content persistence target does not match the approved Supabase project.",
      "wrong_project",
    );
  }

  return {
    baseUrl: url.origin,
    apiKey,
    authorizationToken: legacyServiceRoleKey,
  };
}

function parseRow(value: unknown): ApplicantFormContentRow {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new ApplicantFormContentPersistenceError(
      "Production form-content storage is not initialized.",
      "migration_missing",
    );
  }
  const row = value[0] as Record<string, unknown> | null;
  if (
    !row ||
    row.config_key !== CONFIG_KEY ||
    !Number.isInteger(row.version) ||
    Number(row.version) < 0 ||
    typeof row.updated_at !== "string" ||
    !Number.isFinite(Date.parse(row.updated_at))
  ) {
    throw new ApplicantFormContentPersistenceError(
      "Production form-content storage returned an invalid record.",
      "invalid_row",
    );
  }

  try {
    return {
      content: sanitizeApplicantFormContent(row.content),
      version: Number(row.version),
      updatedAt: row.updated_at,
    };
  } catch {
    throw new ApplicantFormContentPersistenceError(
      "Production form-content storage returned invalid content.",
      "invalid_row",
    );
  }
}

async function requestSupabase(
  path: string,
  init: RequestInit,
  environment: ApplicantFormContentEnvironment,
  fetcher: typeof fetch,
): Promise<Response> {
  const { baseUrl, apiKey, authorizationToken } = getProjectConfig(environment);
  let response;
  try {
    const headers = new Headers(init.headers);
    headers.set("apikey", apiKey);
    headers.set("Content-Type", "application/json");
    if (authorizationToken) {
      headers.set("Authorization", `Bearer ${authorizationToken}`);
    } else {
      // Supabase sb_secret_* keys are opaque API keys, not JWTs.
      headers.delete("Authorization");
    }
    response = await fetcher(`${baseUrl}/rest/v1/${TABLE}${path}`, {
      ...init,
      cache: "no-store",
      headers,
    });
  } catch {
    throw new ApplicantFormContentPersistenceError(
      "Production form-content storage could not be reached.",
      "request_failed",
    );
  }
  if (response.status === 404) {
    throw new ApplicantFormContentPersistenceError(
      "Production form-content storage migration has not been applied.",
      "migration_missing",
    );
  }
  if (!response.ok) {
    throw new ApplicantFormContentPersistenceError(
      "Production form-content storage request failed.",
      "request_failed",
    );
  }
  return response;
}

export async function readApplicantFormContentRow(
  options: {
    environment?: ApplicantFormContentEnvironment;
    fetcher?: typeof fetch;
  } = {},
): Promise<ApplicantFormContentRow> {
  const environment = options.environment ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const response = await requestSupabase(
    `?config_key=eq.${CONFIG_KEY}&select=${SELECT_COLUMNS}&limit=1`,
    { method: "GET" },
    environment,
    fetcher,
  );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApplicantFormContentPersistenceError(
      "Production form-content storage returned an invalid response.",
      "invalid_row",
    );
  }
  return parseRow(body);
}

export async function saveApplicantFormContentRow(options: {
  expectedVersion: number;
  content: ApplicantFormContent;
  actorUserId: string;
  environment?: ApplicantFormContentEnvironment;
  fetcher?: typeof fetch;
}): Promise<ApplicantFormContentRow> {
  const environment = options.environment ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const content = sanitizeApplicantFormContent(options.content);
  const response = await requestSupabase(
    `?config_key=eq.${CONFIG_KEY}&version=eq.${options.expectedVersion}&select=${SELECT_COLUMNS}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        content,
        version: options.expectedVersion + 1,
        updated_by_user_id: options.actorUserId,
        updated_at: new Date().toISOString(),
      }),
    },
    environment,
    fetcher,
  );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApplicantFormContentPersistenceError(
      "Production form-content storage returned an invalid response.",
      "invalid_row",
    );
  }
  if (Array.isArray(body) && body.length === 0) {
    throw new ApplicantFormContentPersistenceError(
      "Applicant form content changed in another session. Reload before saving again.",
      "version_conflict",
    );
  }
  return parseRow(body);
}
