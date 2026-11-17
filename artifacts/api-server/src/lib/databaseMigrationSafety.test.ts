import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readMigration(name: string) {
  return readFileSync(
    new URL(`../../../../lib/db/migrations/${name}`, import.meta.url),
    "utf8",
  );
}

describe("reviewed additive database migrations", () => {
  it("keeps Invitation Code settings and reveal audit migrations transactional and guarded", () => {
    const providerSettings = readMigration(
      "0003_provider_invitation_code_lengths.sql",
    );
    const revealAudit = readMigration("0004_invitation_code_reveal_audit.sql");

    for (const migration of [providerSettings, revealAudit]) {
      expect(migration).toMatch(/BEGIN\s*;/i);
      expect(migration).toMatch(/COMMIT\s*;/i);
      expect(migration).toMatch(/information_schema\.columns/i);
      expect(migration).not.toMatch(/\b(DROP|TRUNCATE|DELETE\s+FROM)\b/i);
    }

    expect(providerSettings).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(providerSettings).toMatch(/REVOKE ALL PRIVILEGES[\s\S]*FROM PUBLIC/i);
    expect(providerSettings).toMatch(/FROM anon/i);
    expect(providerSettings).toMatch(/FROM authenticated/i);
    expect(revealAudit).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(revealAudit).toMatch(/REVOKE ALL PRIVILEGES[\s\S]*FROM PUBLIC/i);
    expect(revealAudit).toMatch(/FROM anon/i);
    expect(revealAudit).toMatch(/FROM authenticated/i);
  });

  it("adds reviewer assignment columns without deriving assignments from old activity", () => {
    const assignments = readMigration(
      "0005_application_reviewer_assignments.sql",
    );
    expect(assignments).toMatch(/ADD COLUMN IF NOT EXISTS assigned_reviewer_user_id text/i);
    expect(assignments).toMatch(/assigned_reviewer_user_id[\s\S]*data_type = 'text'/i);
    expect(assignments).toMatch(/assigned_reviewer_user_id[\s\S]*is_nullable = 'YES'/i);
    expect(assignments).toMatch(/BEGIN\s*;/i);
    expect(assignments).toMatch(/COMMIT\s*;/i);
    expect(assignments).not.toMatch(/\b(DROP|TRUNCATE|DELETE\s+FROM)\b|UPDATE\s+public\./i);
  });

  it("requires schema, database-role, and explicit target checks before legacy backfill", () => {
    const backfill = readFileSync(
      new URL("../scripts/backfill-legacy-invitation-codes.ts", import.meta.url),
      "utf8",
    );
    expect(backfill).toMatch(/current_database\(\)/);
    expect(backfill).toMatch(/inet_server_addr\(\)/);
    expect(backfill).toMatch(/current_user/);
    expect(backfill).toMatch(/has_table_privilege/);
    expect(backfill).toMatch(/--confirm-database=/);
    expect(backfill).toMatch(/--confirm-server=/);
    expect(backfill).toMatch(/--confirm-user=/);
    expect(backfill).toMatch(/SESSION_SECRET/);
    expect(backfill).not.toMatch(/console\.(log|info)\([^)]*referenceCode/);
  });
});
