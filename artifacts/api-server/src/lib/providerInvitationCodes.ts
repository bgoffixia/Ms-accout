export const INVITATION_CODE_PROVIDER_IDS = [
  "category-1",
  "category-2",
  "category-3",
  "category-4",
] as const;

export type InvitationCodeProviderId =
  (typeof INVITATION_CODE_PROVIDER_IDS)[number];

export const DEFAULT_INVITATION_CODE_LENGTH = 8;
export const MIN_INVITATION_CODE_LENGTH = 4;
export const MAX_INVITATION_CODE_LENGTH = 12;

export function isInvitationCodeProviderId(
  value: unknown,
): value is InvitationCodeProviderId {
  return (
    typeof value === "string" &&
    INVITATION_CODE_PROVIDER_IDS.includes(value as InvitationCodeProviderId)
  );
}

export function isValidInvitationCodeLength(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_INVITATION_CODE_LENGTH &&
    value <= MAX_INVITATION_CODE_LENGTH
  );
}

export type InvitationCodeValidationResult =
  | { value: string | undefined; error?: never; isLegacy?: boolean }
  | { value?: never; error: string; isLegacy?: never };

/**
 * New values must be numeric and match the provider's active length.
 * A previously stored value is accepted unchanged so changing a provider's
 * policy never silently invalidates an existing applicant record.
 */
export function validateInvitationCode(
  input: unknown,
  requiredLength: number,
  existingValue?: string | null,
): InvitationCodeValidationResult {
  if (input === undefined || input === null || input === "") {
    return { value: undefined };
  }
  if (typeof input !== "string") {
    return { error: "Invitation Code must be plain text." };
  }

  const value = input.trim();
  if (!value) return { value: undefined };
  if (existingValue != null && value === existingValue.trim()) {
    return {
      value,
      isLegacy: !/^\d+$/.test(value) || value.length !== requiredLength,
    };
  }
  if (!isValidInvitationCodeLength(requiredLength)) {
    return { error: "Invitation Code settings are unavailable. Try again." };
  }
  if (!/^\d+$/.test(value) || value.length !== requiredLength) {
    return {
      error: `Enter a ${requiredLength}-digit Invitation Code for this provider.`,
    };
  }
  return { value };
}
