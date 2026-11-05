export type GuestRevisionChange = {
  field: string;
  before: string;
  after: string;
};

export function correctedGuestRevisions<
  T extends { changes: GuestRevisionChange[] },
>(revisions: T[]): Array<Omit<T, "changes"> & { changes: GuestRevisionChange[] }> {
  const emptyPriorValues = new Set([
    "Not provided",
    "No private evidence attached",
    "Not set",
  ]);
  return revisions
    .map((revision) => ({
      ...revision,
      changes: revision.changes.filter((change) =>
        change.field !== "Saved progress step"
        && change.before !== change.after
        && !emptyPriorValues.has(change.before),
      ),
    }))
    .filter((revision) => revision.changes.length > 0);
}
