import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  ChevronDown,
  CircleHelp,
  Eye,
  FileText,
  LoaderCircle,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  getGetAdminApplicantFormContentQueryKey,
  getGetApplicantFormContentQueryKey,
  useGetAdminApplicantFormContent,
  useResetAdminApplicantFormContent,
  useUpdateAdminApplicantFormContent,
} from "@workspace/api-client-react";
import type {
  AdminApplicantFormContent as AdminFormSnapshot,
  ApplicantFormContent,
} from "@workspace/api-client-react";
import "./AdminApplicantFormContent.css";

type Props = {
  legacyCopy?: Record<string, Record<string, string>>;
};

function mergeContent(
  ...sources: Array<ApplicantFormContent | undefined>
): ApplicantFormContent {
  const merged: ApplicantFormContent = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [formId, values] of Object.entries(source)) {
      merged[formId] = { ...(merged[formId] ?? {}), ...values };
    }
  }
  return merged;
}

function initialContent(
  snapshot: AdminFormSnapshot,
  legacyCopy?: Props["legacyCopy"],
): ApplicantFormContent {
  const migratedLegacyCopy = legacyCopy
    ? {
        ...legacyCopy,
        ...(legacyCopy.dashboard
          ? { "applicant-provider-selection": legacyCopy.dashboard }
          : {}),
        ...(legacyCopy["application-status"]
          ? { "guest-status": legacyCopy["application-status"] }
          : {}),
      }
    : undefined;
  const merged = mergeContent(
    snapshot.defaults,
    migratedLegacyCopy,
    snapshot.savedContent,
  );
  return Object.fromEntries(
    snapshot.forms.map((form) => [
      form.id,
      Object.fromEntries(
        form.fields.map((field) => [
          field.key,
          merged[form.id]?.[field.key] ?? field.defaultValue,
        ]),
      ),
    ]),
  );
}

function sameContent(left: ApplicantFormContent, right: ApplicantFormContent) {
  const normalize = (content: ApplicantFormContent) =>
    Object.fromEntries(
      Object.keys(content)
        .sort()
        .map((formId) => [
          formId,
          Object.fromEntries(
            Object.keys(content[formId] ?? {})
              .sort()
              .map((key) => [key, content[formId][key]]),
          ),
        ]),
    );
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function readableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function prettyDate(value: string | null | undefined) {
  if (!value) return "No saved changes yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Last update recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AdminApplicantFormContent({ legacyCopy }: Props) {
  const queryClient = useQueryClient();
  const query = useGetAdminApplicantFormContent({
    query: {
      queryKey: getGetAdminApplicantFormContentQueryKey(),
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
    request: { cache: "no-store" },
  });
  const saveMutation = useUpdateAdminApplicantFormContent();
  const resetMutation = useResetAdminApplicantFormContent();
  const snapshot = query.data;
  const legacyRef = useRef(legacyCopy);
  legacyRef.current = legacyCopy;
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<ApplicantFormContent>({});
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success" | "warning";
    message: string;
  } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const initializedVersion = useRef<number | null>(null);

  const selectedForm =
    snapshot?.forms.find((form) => form.id === selectedId) ??
    snapshot?.forms[0];
  const selectedDraft = selectedForm ? (draft[selectedForm.id] ?? {}) : {};
  const currentContent = useMemo(
    () => (snapshot ? initialContent(snapshot, legacyCopy) : {}),
    [snapshot, legacyCopy],
  );
  const isDirty = !!snapshot && !sameContent(draft, currentContent);

  useEffect(() => {
    if (!snapshot || initializedVersion.current !== null) return;
    initializedVersion.current = snapshot.version;
    setDraft(initialContent(snapshot, legacyRef.current));
    setBaseVersion(snapshot.version);
    setSelectedId(snapshot.forms[0]?.id ?? "");
  }, [snapshot]);

  const acceptSnapshot = (next: AdminFormSnapshot) => {
    setDraft(initialContent(next, legacyRef.current));
    setBaseVersion(next.version);
    setSelectedId((previous) =>
      next.forms.some((form) => form.id === previous)
        ? previous
        : (next.forms[0]?.id ?? ""),
    );
    initializedVersion.current = next.version;
    setFeedback(null);
    setConfirmReset(false);
  };

  const patchField = (formId: string, key: string, value: string) => {
    setDraft((previous) => ({
      ...previous,
      [formId]: { ...(previous[formId] ?? {}), [key]: value },
    }));
    setFeedback(null);
  };

  const reloadDraft = async () => {
    setFeedback(null);
    const result = await query.refetch();
    if (result.data) {
      acceptSnapshot(result.data);
    } else if (result.error) {
      setFeedback({
        type: "error",
        message: readableError(
          result.error,
          "The latest form copy could not be loaded.",
        ),
      });
    }
  };

  const saveAll = () => {
    if (
      !snapshot ||
      baseVersion === null ||
      !snapshot.persistenceAvailable ||
      !isDirty
    )
      return;
    setFeedback(null);
    saveMutation.mutate(
      { data: { expectedVersion: baseVersion, content: draft } },
      {
        onSuccess: (updated) => {
          acceptSnapshot(updated);
          queryClient.setQueryData(
            getGetAdminApplicantFormContentQueryKey(),
            updated,
          );
          void queryClient.invalidateQueries({
            queryKey: getGetApplicantFormContentQueryKey(),
          });
          setFeedback({
            type: "success",
            message: "All form content is saved and available to applicants.",
          });
        },
        onError: (error) => {
          const message = readableError(
            error,
            "The form content could not be saved.",
          );
          setFeedback({
            type: "error",
            message: `${message} Your draft is still here. Reload the latest version before trying again if another administrator saved changes.`,
          });
        },
      },
    );
  };

  const resetSelectedLocally = () => {
    if (!selectedForm || !snapshot) return;
    const defaults = snapshot.defaults[selectedForm.id] ?? {};
    const nextValues: Record<string, string> = {};
    selectedForm.fields.forEach((field) => {
      nextValues[field.key] = defaults[field.key] ?? field.defaultValue;
    });
    setDraft((previous) => ({ ...previous, [selectedForm.id]: nextValues }));
    setFeedback({
      type: "warning",
      message: `${selectedForm.label} has been restored to server defaults in this draft. Save to publish the change.`,
    });
  };

  const restoreAllDefaults = () => {
    if (!snapshot || baseVersion === null || !snapshot.persistenceAvailable)
      return;
    setFeedback(null);
    resetMutation.mutate(
      { data: { expectedVersion: baseVersion } },
      {
        onSuccess: (updated) => {
          acceptSnapshot(updated);
          queryClient.setQueryData(
            getGetAdminApplicantFormContentQueryKey(),
            updated,
          );
          void queryClient.invalidateQueries({
            queryKey: getGetApplicantFormContentQueryKey(),
          });
          setFeedback({
            type: "success",
            message:
              "Server defaults have been restored for every applicant form.",
          });
        },
        onError: (error) => {
          setFeedback({
            type: "error",
            message: `${readableError(error, "Defaults could not be restored.")} Reload the latest version before trying again if another administrator changed the content.`,
          });
        },
      },
    );
  };

  if (query.isLoading) {
    return (
      <section className="form-content-editor" data-testid="admin-form-content">
        <div className="fce-skeleton-header">
          <i />
          <i />
        </div>
        <div className="fce-skeleton-grid">
          <i />
          <i />
        </div>
        <div className="fce-skeleton-panel">
          <i />
          <i />
          <i />
        </div>
      </section>
    );
  }

  if (query.isError || !snapshot) {
    return (
      <section className="form-content-editor" data-testid="admin-form-content">
        <div
          className="fce-error-state"
          role="alert"
          data-testid="state-form-content-error"
        >
          <span className="fce-error-icon">
            <AlertCircle size={20} />
          </span>
          <div>
            <p className="fce-kicker">FORM CONTENT</p>
            <h1>Content is unavailable</h1>
            <p>
              {readableError(
                query.error,
                "The current form catalog could not be loaded.",
              )}
            </p>
          </div>
          <button
            className="fce-button fce-button-primary"
            onClick={() => void query.refetch()}
            data-testid="button-retry-form-content"
          >
            <RotateCcw size={15} /> Try again
          </button>
        </div>
      </section>
    );
  }

  if (!snapshot.forms.length) {
    return (
      <section className="form-content-editor" data-testid="admin-form-content">
        <div className="fce-empty-state" data-testid="state-form-content-empty">
          <FileText size={23} />
          <h1>No forms are available</h1>
          <p>The applicant form catalog did not include any editable forms.</p>
        </div>
      </section>
    );
  }

  const busy = saveMutation.isPending || resetMutation.isPending;
  const serverChanged = snapshot.version !== baseVersion;

  return (
    <section className="form-content-editor" data-testid="admin-form-content">
      <header className="fce-heading">
        <div className="fce-heading-copy">
          <div className="fce-kicker">
            <span className="fce-kicker-mark">
              <ShieldCheck size={13} />
            </span>{" "}
            ENROLLMENT SETTINGS <span className="fce-kicker-divider">/</span>{" "}
            FORM CONTENT
          </div>
          <h1>Applicant form copy</h1>
          <p>
            Maintain the labels and guidance applicants see while sharing
            information for authorized verification review.
          </p>
        </div>
        <div
          className={`fce-draft-state ${isDirty ? "is-dirty" : ""}`}
          data-testid="status-unsaved-changes"
        >
          <span className="fce-state-dot" />
          {isDirty ? "Unsaved changes" : "All changes saved"}
        </div>
      </header>

      <div className="fce-meta-strip">
        <div className="fce-meta-item">
          <span className="fce-meta-label">Catalog version</span>
          <strong data-testid="text-form-content-version">
            v{snapshot.version}
          </strong>
        </div>
        <div className="fce-meta-rule" />
        <div className="fce-meta-item">
          <span className="fce-meta-label">Last published</span>
          <strong data-testid="text-form-content-updated">
            {prettyDate(snapshot.updatedAt)}
          </strong>
        </div>
        <div className="fce-meta-spacer" />
        <div
          className={`fce-persistence ${snapshot.persistenceAvailable ? "available" : "unavailable"}`}
          data-testid="status-persistence"
        >
          <span />
          {snapshot.persistenceAvailable
            ? "Changes can be published"
            : "Publishing unavailable"}
        </div>
      </div>

      {!snapshot.persistenceAvailable && (
        <div
          className="fce-notice fce-notice-warning"
          role="status"
          data-testid="notice-persistence-unavailable"
        >
          <TriangleAlert size={17} />
          <span>
            Persistent form storage is not available right now. You can review
            and edit this draft, but saving and restoring defaults are disabled.
          </span>
        </div>
      )}

      {serverChanged && (
        <div
          className="fce-notice fce-notice-conflict"
          role="alert"
          data-testid="notice-version-conflict"
        >
          <TriangleAlert size={17} />
          <span>
            A newer version is on the server. Your current draft has been kept;
            reload before saving to work from the latest version.
          </span>
          <button
            onClick={() => void reloadDraft()}
            data-testid="button-reload-conflict"
          >
            Reload latest
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`fce-feedback fce-feedback-${feedback.type}`}
          role={feedback.type === "error" ? "alert" : "status"}
          data-testid={`status-form-content-${feedback.type}`}
        >
          {feedback.type === "success" ? (
            <Check size={16} />
          ) : feedback.type === "error" ? (
            <AlertCircle size={16} />
          ) : (
            <CircleHelp size={16} />
          )}
          <span>{feedback.message}</span>
          <button
            aria-label="Dismiss message"
            onClick={() => setFeedback(null)}
            data-testid="button-dismiss-feedback"
          >
            Dismiss
          </button>
        </div>
      )}

      <section className="fce-workspace" aria-label="Form content editor">
        <aside className="fce-form-rail">
          <div className="fce-rail-top">
            <div>
              <span className="fce-section-index">01</span>
              <h2>Applicant forms</h2>
            </div>
            <span className="fce-count">
              {snapshot.forms.length.toString().padStart(2, "0")}
            </span>
          </div>
          <p className="fce-rail-caption">
            Select a form to edit its applicant-facing text.
          </p>
          <div className="fce-form-list" role="list">
            {snapshot.forms.map((form, index) => (
              <button
                type="button"
                className={`fce-form-option ${selectedForm?.id === form.id ? "is-selected" : ""}`}
                key={form.id}
                onClick={() => {
                  setSelectedId(form.id);
                  setFeedback(null);
                }}
                data-testid={`button-select-form-${form.id}`}
                aria-current={selectedForm?.id === form.id ? "page" : undefined}
              >
                <span className="fce-form-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="fce-form-option-copy">
                  <strong>{form.label}</strong>
                  <small>
                    {form.fields.length} editable{" "}
                    {form.fields.length === 1 ? "item" : "items"}
                  </small>
                </span>
                <ChevronDown className="fce-option-chevron" size={15} />
              </button>
            ))}
          </div>
          <div className="fce-rail-note">
            <ShieldCheck size={15} />
            <span>Changes apply to applicant forms after they are saved.</span>
          </div>
        </aside>

        {selectedForm && (
          <section
            className="fce-editor-column"
            aria-labelledby="fce-current-form-title"
          >
            <div className="fce-editor-heading">
              <div>
                <div className="fce-section-label">
                  <span className="fce-section-index">02</span> EDIT FORM TEXT
                </div>
                <h2
                  id="fce-current-form-title"
                  data-testid="text-selected-form"
                >
                  {selectedForm.label}
                </h2>
                <p>
                  Text is saved as one catalog so published copy stays
                  consistent across the enrollment experience.
                </p>
              </div>
              <div className="fce-form-code">{selectedForm.id}</div>
            </div>

            <div className="fce-fields">
              {selectedForm.fields.map((field, index) => {
                const value =
                  draft[selectedForm.id]?.[field.key] ?? field.defaultValue;
                const inputId = `fce-field-${selectedForm.id}-${field.key}`;
                return (
                  <div
                    className="fce-field"
                    key={field.key}
                    data-testid={`field-copy-${field.key}`}
                  >
                    <div className="fce-field-heading">
                      <label htmlFor={inputId}>
                        <span className="fce-field-ordinal">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {field.label}
                      </label>
                      <code>{field.key}</code>
                    </div>
                    <div className="fce-published-copy" data-testid={`text-published-copy-${field.key}`}>
                      <span>Currently published:</span>
                      <strong>{publishedValue.length ? publishedValue : "Empty (no text displayed)"}</strong>
                    </div>
                    {field.multiline ? (
                      <textarea
                        id={inputId}
                        value={value}
                        maxLength={field.maxLength}
                        rows={3}
                        onChange={(event) =>
                          patchField(
                            selectedForm.id,
                            field.key,
                            event.target.value,
                          )
                        }
                        data-testid={`input-copy-${field.key}`}
                      />
                    ) : (
                      <input
                        id={inputId}
                        value={value}
                        maxLength={field.maxLength}
                        onChange={(event) =>
                          patchField(
                            selectedForm.id,
                            field.key,
                            event.target.value,
                          )
                        }
                        data-testid={`input-copy-${field.key}`}
                      />
                    )}
                    <div className="fce-field-foot">
                      <span>
                        {field.helpText ||
                          "Shown to applicants during enrollment."}
                      </span>
                      <span
                        className={`fce-character-count ${value.length >= field.maxLength ? "at-limit" : ""}`}
                        data-testid={`text-character-count-${field.key}`}
                      >
                        {value.length} / {field.maxLength}
                      </span>
                    </div>
                    <button
                      className="fce-clear-field"
                      type="button"
                      onClick={() => patchField(selectedForm.id, field.key, "")}
                      disabled={value.length === 0 || busy}
                      data-testid={`button-clear-copy-${field.key}`}
                    >
                      Clear this text
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="fce-local-reset">
              <div className="fce-local-reset-icon">
                <RotateCcw size={16} />
              </div>
              <div>
                <strong>Restore this form’s defaults</strong>
                <span>
                  Replaces this form’s draft copy with the server defaults.
                  Nothing is published until you save.
                </span>
              </div>
              <button
                type="button"
                onClick={resetSelectedLocally}
                data-testid={`button-reset-form-${selectedForm.id}`}
              >
                Restore form
              </button>
            </div>
          </section>
        )}

        {selectedForm && (
          <aside className="fce-preview-column">
            <div className="fce-preview-heading">
              <div>
                <div className="fce-section-label">
                  <span className="fce-section-index">03</span> LIVE DRAFT
                </div>
                <h2>
                  <Eye size={16} /> Preview
                </h2>
              </div>
              <span className="fce-preview-badge">
                <span /> LOCAL DRAFT
              </span>
            </div>
            <div className="fce-preview-card" data-testid="panel-form-preview">
              <div className="fce-preview-card-top">
                <span className="fce-preview-brand">M-soft</span>
                <span className="fce-preview-shield">
                  <ShieldCheck size={15} />
                </span>
              </div>
              <div className="fce-preview-overline">ACCOUNT PROTECTION</div>
              <h3>{selectedDraft.title ?? selectedForm.label}</h3>
              <p className="fce-preview-description">
                {selectedDraft.description ?? ""}
              </p>
              <div className="fce-preview-sample">
                {selectedForm.fields
                  .filter(
                    (field) =>
                      field.key.startsWith("field_") ||
                      field.key.endsWith("Label"),
                  )
                  .slice(0, 4)
                  .map((field) => {
                    const text = selectedDraft[field.key] ?? field.defaultValue;
                    const placeholderKey = field.key.startsWith("field_")
                      ? field.key.replace(/^field_/, "placeholder_")
                      : `${field.key.replace(/Label$/, "")}Placeholder`;
                    const placeholder = selectedDraft[placeholderKey];
                    return (
                      <div className="fce-preview-field" key={field.key}>
                        <span>{text ?? field.label}</span>
                        <i>{placeholder || ""}</i>
                      </div>
                    );
                  })}
              </div>
              <div className="fce-preview-privacy">
                <ShieldCheck size={14} />
                <span>Your information is handled securely.</span>
              </div>
            </div>
            <p className="fce-preview-caption">
              <Sparkles size={13} /> Preview reflects this local draft only. It
              is not published until saved.
            </p>
          </aside>
        )}
      </section>

      <footer className="fce-action-bar">
        <div className="fce-action-context">
          <span className={`fce-state-dot ${isDirty ? "dot-dirty" : ""}`} />
          <span>
            {isDirty
              ? "Draft differs from the published copy"
              : "Viewing the published copy"}
          </span>
          {baseVersion !== null && <code>BASE V{baseVersion}</code>}
        </div>
        <div className="fce-action-buttons">
          <button
            className="fce-button fce-button-text"
            type="button"
            onClick={() => void reloadDraft()}
            disabled={busy || query.isFetching}
            data-testid="button-cancel-reload"
          >
            {query.isFetching ? (
              <LoaderCircle className="fce-spin" size={15} />
            ) : (
              <RotateCcw size={15} />
            )}{" "}
            Cancel / reload
          </button>
          <button
            className="fce-button fce-button-reset"
            type="button"
            onClick={() => setConfirmReset(true)}
            disabled={busy || !snapshot.persistenceAvailable}
            data-testid="button-restore-all-defaults"
          >
            <ArrowDownToLine size={15} /> Restore all defaults
          </button>
          <button
            className="fce-button fce-button-primary"
            type="button"
            onClick={saveAll}
            disabled={
              busy ||
              !isDirty ||
              !snapshot.persistenceAvailable ||
              serverChanged
            }
            data-testid="button-save-form-content"
          >
            {saveMutation.isPending ? (
              <LoaderCircle className="fce-spin" size={16} />
            ) : (
              <Save size={15} />
            )}
            {saveMutation.isPending ? "Saving…" : "Save all content"}
          </button>
        </div>
      </footer>

      {confirmReset && (
        <div className="fce-confirm-backdrop" role="presentation">
          <section
            className="fce-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="fce-reset-title"
            data-testid="dialog-restore-defaults"
          >
            <span className="fce-confirm-icon">
              <TriangleAlert size={19} />
            </span>
            <p className="fce-kicker">RESET FORM CATALOG</p>
            <h2 id="fce-reset-title">Restore all defaults?</h2>
            <p>
              This replaces the saved copy for every applicant form with its
              server defaults. This action publishes immediately and cannot be
              undone here.
            </p>
            <div className="fce-confirm-actions">
              <button
                type="button"
                className="fce-button fce-button-text"
                onClick={() => setConfirmReset(false)}
                disabled={resetMutation.isPending}
                data-testid="button-cancel-restore-defaults"
              >
                Keep current copy
              </button>
              <button
                type="button"
                className="fce-button fce-button-danger"
                onClick={restoreAllDefaults}
                disabled={
                  resetMutation.isPending || !snapshot.persistenceAvailable
                }
                data-testid="button-confirm-restore-defaults"
              >
                {resetMutation.isPending ? (
                  <LoaderCircle className="fce-spin" size={15} />
                ) : (
                  <RotateCcw size={15} />
                )}{" "}
                Confirm restore
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default AdminApplicantFormContent;
