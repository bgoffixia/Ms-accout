import { useEffect, useState } from "react";
import { Check, RotateCcw, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetProviderInvitationCodePolicyQueryKey,
  getListAdminProviderInvitationCodeSettingsQueryKey,
  useGetPortalSettings,
  useListAdminProviderInvitationCodeSettings,
  useUpdateAdminProviderInvitationCodeSetting,
} from "@workspace/api-client-react";
import type { InvitationCodeProviderId } from "@workspace/api-client-react";

const PROVIDERS: Array<{ id: InvitationCodeProviderId; label: string }> = [
  { id: "category-1", label: "Account Provider One" },
  { id: "category-2", label: "Account Provider Two" },
  { id: "category-3", label: "Account Provider Three" },
  { id: "category-4", label: "Account Provider Four" },
];

const MIN_LENGTH = 4;
const MAX_LENGTH = 12;

export function AdminInvitationCodeSettingsPanel() {
  const queryClient = useQueryClient();
  const settings = useListAdminProviderInvitationCodeSettings();
  const portalSettings = useGetPortalSettings();
  const update = useUpdateAdminProviderInvitationCodeSetting();
  const [providerId, setProviderId] = useState<InvitationCodeProviderId>("category-1");
  const [draftLength, setDraftLength] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const active = settings.data?.providers.find((item) => item.providerId === providerId);
  const activeLength = active?.requiredLength ?? 8;
  const isValidLength =
    /^\d+$/.test(draftLength) &&
    Number.isInteger(Number(draftLength)) &&
    Number(draftLength) >= MIN_LENGTH &&
    Number(draftLength) <= MAX_LENGTH;
  const isDirty = draftLength !== String(activeLength);
  const lengthValidationError =
    !settings.isLoading && !settings.isError && !isValidLength
      ? `Enter a whole number from ${MIN_LENGTH} to ${MAX_LENGTH}.`
      : "";

  useEffect(() => {
    setDraftLength(String(activeLength));
  }, [activeLength, providerId]);

  const cancel = () => {
    setDraftLength(String(activeLength));
    setError("");
    setFeedback("");
  };

  const save = () => {
    if (!isValidLength) {
      setError(`Enter a whole number from ${MIN_LENGTH} to ${MAX_LENGTH}.`);
      return;
    }
    setError("");
    setFeedback("");
    update.mutate(
      { providerId, data: { requiredLength: Number(draftLength) } },
      {
        onSuccess: () => {
          setFeedback("Invitation Code length saved.");
          void queryClient.invalidateQueries({
            queryKey: getListAdminProviderInvitationCodeSettingsQueryKey(),
          });
          void queryClient.invalidateQueries({
            queryKey: getGetProviderInvitationCodePolicyQueryKey(providerId),
          });
        },
        onError: () => setError("The setting could not be saved. Your previous value is unchanged."),
      },
    );
  };

  return (
    <section
      className="detail-card settings-panel invitation-code-settings-panel"
      id="settings-invitation-codes"
      aria-labelledby="settings-invitation-codes-title"
      data-testid="panel-invitation-code-settings"
    >
      <div className="detail-card-title">
        <ShieldCheck size={17} />
        <h2 id="settings-invitation-codes-title">Invitation Code requirements</h2>
      </div>
      <p className="field-help">
        Set the number of digits applicants must enter for each provider. Allowed range: {MIN_LENGTH}–{MAX_LENGTH} digits.
        The field remains optional. Existing saved codes continue to work unchanged when this setting changes.
      </p>
      {settings.isError && (
        <p className="inline-error" role="alert">
          Provider settings could not be loaded. Refresh this page and try again.
        </p>
      )}
      <div className="invitation-code-settings-controls">
        <label className="field-label" htmlFor="invitation-code-provider">
          Account provider
          <select
            id="invitation-code-provider"
            className="text-input select-input"
            value={providerId}
            onChange={(event) => {
              setProviderId(event.target.value as InvitationCodeProviderId);
              setError("");
              setFeedback("");
            }}
            disabled={settings.isLoading || update.isPending}
            data-testid="select-invitation-code-provider"
          >
              {PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {portalSettings.data?.cards.find((card) => card.id === provider.id)?.title || provider.label}
              </option>
            ))}
          </select>
        </label>
        <div className="invitation-code-active-setting" aria-live="polite">
          <span>Currently active length</span>
          <strong data-testid="text-active-invitation-code-length">
            {settings.isLoading ? "Loading…" : `${activeLength} digits`}
          </strong>
          {active?.updatedAt && (
            <small>Last changed {new Date(active.updatedAt).toLocaleString()}</small>
          )}
        </div>
        <label className="field-label" htmlFor="invitation-code-length">
          Required code length
          <input
            id="invitation-code-length"
            className="text-input"
            type="number"
            inputMode="numeric"
            min={MIN_LENGTH}
            max={MAX_LENGTH}
            step={1}
            value={draftLength}
            onChange={(event) => {
              setDraftLength(event.target.value);
              setError("");
              setFeedback("");
            }}
            disabled={settings.isLoading || settings.isError || update.isPending}
            aria-describedby="invitation-code-length-help"
            aria-invalid={Boolean(lengthValidationError)}
            data-testid="input-invitation-code-length"
          />
          <small id="invitation-code-length-help" className="field-help">
            Whole numbers only, from {MIN_LENGTH} through {MAX_LENGTH}.
          </small>
        </label>
      </div>
      <p className="field-help">
        Changes apply to new or changed Invitation Codes only. Previously saved values are retained and remain valid;
        no existing application data is rewritten.
      </p>
      {(error || lengthValidationError) && <p className="inline-error" role="alert" data-testid="text-invitation-code-settings-error">{error || lengthValidationError}</p>}
      {feedback && <p className="success-message" role="status" data-testid="text-invitation-code-settings-success">{feedback}</p>}
      <div className="invitation-code-settings-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={save}
          disabled={settings.isLoading || settings.isError || update.isPending || !isDirty || !isValidLength}
          data-testid="button-save-invitation-code-length"
        >
          {update.isPending ? "Saving…" : "Save length"} <Check size={15} />
        </button>
        <button
          type="button"
          className="button button-quiet"
          onClick={cancel}
          disabled={!isDirty || update.isPending}
          data-testid="button-cancel-invitation-code-length"
        >
          Cancel <RotateCcw size={15} />
        </button>
      </div>
      <p className="field-help">
        Only the primary administrator can change this setting. Sub-admins and ordinary staff cannot access this page.
      </p>
    </section>
  );
}
