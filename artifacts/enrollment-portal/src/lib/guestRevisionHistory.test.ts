import { describe, expect, it } from "vitest";
import { correctedGuestRevisions } from "./guestRevisionHistory";

describe("correctedGuestRevisions", () => {
  it("keeps corrections to populated fields and hides initial entries and progress metadata", () => {
    const result = correctedGuestRevisions([
      {
        id: "revision-1",
        changes: [
          { field: "answers.personalInformation.firstName", before: "Not provided", after: "Taylor" },
          { field: "answers.education.certificateObjectPath", before: "No private evidence attached", after: "Private evidence attached" },
          { field: "referenceCode", before: "CASE-104", after: "CASE-105" },
          { field: "Saved progress step", before: "1", after: "2" },
          { field: "answers.personalInformation.lastName", before: "Jordan", after: "Jordan-Lee" },
          { field: "answers.personalInformation.city", before: "Port Vila", after: "Not provided" },
        ],
      },
      {
        id: "revision-2",
        changes: [
          { field: "answers.personalInformation.firstName", before: "Taylor", after: "Taylor" },
          { field: "answers.workInformation.occupation", before: "Not provided", after: "Teacher" },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        id: "revision-1",
        changes: [
          { field: "answers.personalInformation.lastName", before: "Jordan", after: "Jordan-Lee" },
          { field: "answers.personalInformation.city", before: "Port Vila", after: "Not provided" },
          { field: "referenceCode", before: "CASE-104", after: "CASE-105" },
        ],
      },
    ]);
  });
});
