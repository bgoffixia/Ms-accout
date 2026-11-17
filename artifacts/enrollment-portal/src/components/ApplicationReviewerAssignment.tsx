import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw, UserRoundCog } from "lucide-react";
import {
  getGetAdminReviewerAssignmentQueryKey,
  getListAdminUsersQueryKey,
  useGetAdminReviewerAssignment,
  useListAdminUsers,
  useSetAdminReviewerAssignment,
} from "@workspace/api-client-react";

type ApplicationType = "guest_preapplication" | "enrollment_application";

type ApplicationReviewerAssignmentProps = {
  applicationId: string;
  applicationType: ApplicationType;
};

export function ApplicationReviewerAssignment({
  applicationId,
  applicationType,
}: ApplicationReviewerAssignmentProps) {
  const queryClient = useQueryClient();
  const assignment = useGetAdminReviewerAssignment(
    applicationType,
    applicationId,
    { request: { cache: "no-store" } },
  );
  const users = useListAdminUsers(undefined, {
    query: { queryKey: getListAdminUsersQueryKey(), staleTime: 30_000 },
    request: { cache: "no-store" },
  });
  const saveAssignment = useSetAdminReviewerAssignment();
  const [selectedReviewer, setSelectedReviewer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const currentReviewer = assignment.data?.reviewerUserId ?? "";
  const reviewers = useMemo(
    () => (users.data?.users ?? []).filter(
      (user) => user.role === "sub_admin" && user.accountStatus === "active",
    ),
    [users.data?.users],
  );

  useEffect(() => {
    setSelectedReviewer(currentReviewer);
  }, [currentReviewer]);

  const isDirty = selectedReviewer !== currentReviewer;
  const save = () => {
    setError("");
    setFeedback("");
    saveAssignment.mutate(
      {
        applicationType,
        applicationId,
        data: { reviewerUserId: selectedReviewer || null },
      },
      {
        onSuccess: (result) => {
          setSelectedReviewer(result.reviewerUserId ?? "");
          setFeedback(
            result.reviewerUserId
              ? "Sub-admin reviewer assignment saved."
              : "Reviewer assignment removed.",
          );
          void queryClient.invalidateQueries({
            queryKey: getGetAdminReviewerAssignmentQueryKey(
              applicationType,
              applicationId,
            ),
          });
        },
        onError: () =>
          setError("The assignment could not be saved. The previous reviewer remains assigned."),
      },
    );
  };

  const cancel = () => {
    setSelectedReviewer(currentReviewer);
    setError("");
    setFeedback("");
  };

  return (
    <section
      className="detail-card application-reviewer-assignment"
      aria-labelledby={`reviewer-assignment-title-${applicationId}`}
      data-testid={`panel-reviewer-assignment-${applicationId}`}
    >
      <div className="detail-card-title">
        <UserRoundCog size={17} />
        <h2 id={`reviewer-assignment-title-${applicationId}`}>
          Sub-admin reviewer assignment
        </h2>
      </div>
      <p className="field-help">
        Only the assigned, verified Sub-admin can reveal this application’s
        Invitation Code. Admins retain their established review access.
      </p>
      {assignment.isError && (
        <p className="inline-error" role="alert">
          Reviewer assignment could not be loaded. Refresh and try again.
        </p>
      )}
      {users.isError && (
        <p className="inline-error" role="alert">
          Authorized Sub-admin accounts could not be loaded.
        </p>
      )}
      <label
        className="field-label"
        htmlFor={`reviewer-assignment-select-${applicationId}`}
      >
        Assigned reviewer
        <select
          id={`reviewer-assignment-select-${applicationId}`}
          className="text-input select-input"
          value={selectedReviewer}
          onChange={(event) => {
            setSelectedReviewer(event.target.value);
            setError("");
            setFeedback("");
          }}
          disabled={
            assignment.isLoading ||
            assignment.isError ||
            users.isLoading ||
            users.isError ||
            saveAssignment.isPending
          }
          data-testid={`select-reviewer-assignment-${applicationId}`}
        >
          <option value="">No Sub-admin assigned</option>
          {currentReviewer &&
            !reviewers.some((reviewer) => reviewer.userId === currentReviewer) && (
              <option value={currentReviewer}>
                Existing assignment ({currentReviewer})
              </option>
            )}
          {reviewers.map((reviewer) => (
            <option key={reviewer.userId} value={reviewer.userId}>
              {reviewer.name || reviewer.email || reviewer.userId}
              {reviewer.email && reviewer.name ? ` · ${reviewer.email}` : ""}
            </option>
          ))}
        </select>
      </label>
      {feedback && (
        <p className="success-message" role="status">
          {feedback}
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="invitation-code-settings-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={save}
          disabled={
            !isDirty ||
            assignment.isLoading ||
            assignment.isError ||
            users.isLoading ||
            saveAssignment.isPending
          }
          data-testid={`button-save-reviewer-assignment-${applicationId}`}
        >
          {saveAssignment.isPending ? "Saving…" : "Save assignment"}{" "}
          <Check size={15} />
        </button>
        <button
          type="button"
          className="button button-quiet"
          onClick={cancel}
          disabled={!isDirty || saveAssignment.isPending}
          data-testid={`button-cancel-reviewer-assignment-${applicationId}`}
        >
          Cancel <RotateCcw size={15} />
        </button>
      </div>
    </section>
  );
}
