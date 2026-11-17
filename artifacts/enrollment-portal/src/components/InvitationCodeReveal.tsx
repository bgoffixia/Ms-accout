import { useEffect, useState } from "react";
import {
  useRevealAdminApplicationInvitationCode,
  useRevealAdminGuestPreapplicationInvitationCode,
} from "@workspace/api-client-react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";

type InvitationCodeRevealProps = {
  applicationId: string;
  applicationType: "enrollment_application" | "guest_preapplication";
  canReveal: boolean;
};

export function InvitationCodeReveal({
  applicationId,
  applicationType,
  canReveal,
}: InvitationCodeRevealProps) {
  const applicationReveal = useRevealAdminApplicationInvitationCode({
    mutation: { gcTime: 0 },
  });
  const guestReveal = useRevealAdminGuestPreapplicationInvitationCode({
    mutation: { gcTime: 0 },
  });
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const revealMutation =
    applicationType === "guest_preapplication"
      ? guestReveal
      : applicationReveal;
  const isPending = applicationReveal.isPending || guestReveal.isPending;

  useEffect(
    () => () => {
      applicationReveal.reset();
      guestReveal.reset();
    },
    [applicationReveal.reset, guestReveal.reset],
  );

  const toggleReveal = () => {
    if (revealedCode !== null) {
      setRevealedCode(null);
      setError("");
      applicationReveal.reset();
      guestReveal.reset();
      return;
    }
    setError("");
    revealMutation.mutate(
      { applicationId },
      {
        onSuccess: (result) => setRevealedCode(result.code),
        onError: () =>
          setError(
            "The Invitation Code could not be revealed. Confirm reviewer access and try again.",
          ),
      },
    );
  };

  return (
    <section
      className="invitation-code-reveal"
      aria-label="Reviewer-only Invitation Code"
      data-testid={`invitation-code-reveal-${applicationType}-${applicationId}`}
    >
      <div className="invitation-code-reveal-copy">
        <span className="invitation-code-reveal-icon" aria-hidden="true">
          <LockKeyhole size={16} />
        </span>
        <div>
          <b>Invitation Code</b>
          <p>Reviewer-only. Each successful reveal is recorded.</p>
        </div>
      </div>
      {canReveal ? (
        <button
          type="button"
          className="button button-quiet invitation-code-reveal-button"
          onClick={toggleReveal}
          disabled={isPending}
          aria-expanded={revealedCode !== null}
          aria-controls={
            revealedCode !== null
              ? `invitation-code-value-${applicationId}`
              : undefined
          }
          aria-label={
            revealedCode === null
              ? "View Invitation Code"
              : "Hide Invitation Code"
          }
          data-testid={`button-invitation-code-${revealedCode === null ? "show" : "hide"}-${applicationId}`}
        >
          {isPending ? (
            <LoaderCircle
              size={16}
              className="invitation-code-spinner"
              aria-hidden="true"
            />
          ) : revealedCode === null ? (
            <Eye size={16} aria-hidden="true" />
          ) : (
            <EyeOff size={16} aria-hidden="true" />
          )}
          {isPending
            ? "Loading code…"
            : revealedCode === null
              ? "View code"
              : "Hide code"}
        </button>
      ) : (
        <p className="field-help" role="status">
          Only the assigned reviewer or an Admin may reveal this code.
        </p>
      )}
      {revealedCode !== null && (
        <output
          id={`invitation-code-value-${applicationId}`}
          className="invitation-code-revealed-value mono"
          aria-live="polite"
          data-testid={`text-invitation-code-${applicationId}`}
        >
          {revealedCode}
        </output>
      )}
      {error && (
        <p className="inline-error invitation-code-reveal-error" role="status">
          {error}
        </p>
      )}
    </section>
  );
}
