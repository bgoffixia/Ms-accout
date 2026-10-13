import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Download,
  History,
  LoaderCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import "./AdminApplicantArchive.css";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type ArchiveListItem = {
  id: string;
  reference: string;
  applicantName: string;
  applicantEmail: string;
  categoryId: string;
  status: string;
  versionCount: number;
  historyUnavailable: boolean;
  updatedAt: string;
};

type ArchiveSnapshot = {
  id: string;
  version: number;
  eventType: string;
  createdAt: string;
  payload: Record<string, unknown>;
  changes: Array<{ field: string; before: unknown; after: unknown }>;
};

type ArchiveDetail = ArchiveListItem & {
  sourceType: "guest" | "application";
  snapshots: ArchiveSnapshot[];
  evidence: Array<{
    id: string;
    fieldPath: string;
    fileName: string;
    evidenceType: string;
    contentType: string;
    sizeBytes: number;
    availability: "available" | "missing";
    createdAt: string;
  }>;
};

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${basePath}/api${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  const body = response.headers.get("content-type")?.includes("application/json")
    ? await response.json()
    : null;
  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : "The archive request failed.");
  }
  return body as T;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function flattenFields(value: unknown, prefix = ""): Array<{ field: string; value: unknown }> {
  if (Array.isArray(value) || value === null || typeof value !== "object") {
    return prefix ? [{ field: prefix, value }] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    if (key === "correctionHistory" || key === "recordType" || key === "reference") return [];
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      return flattenFields(child, path);
    }
    return [{ field: path, value: child }];
  });
}

function readableEvent(eventType: string): string {
  return eventType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AdminApplicantArchive() {
  const [records, setRecords] = useState<ArchiveListItem[]>([]);
  const [selected, setSelected] = useState<ArchiveDetail | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [search, setSearch] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadList(searchValue = search) {
    setLoadingList(true);
    setError("");
    try {
      const result = await apiRequest<ArchiveListItem[]>(
        `/admin/archive?search=${encodeURIComponent(searchValue)}`,
      );
      setRecords(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The archive could not be loaded.");
    } finally {
      setLoadingList(false);
    }
  }

  async function loadDetail(id: string) {
    setLoadingDetail(true);
    setError("");
    try {
      const detail = await apiRequest<ArchiveDetail>(`/admin/archive/${id}`);
      setSelected(detail);
      setSelectedSnapshotId(detail.snapshots[0]?.id ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The archive record could not be loaded.");
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadList(search), 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  const selectedSnapshot = useMemo(
    () => selected?.snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? selected?.snapshots[0],
    [selected, selectedSnapshotId],
  );
  const fields = useMemo(
    () => flattenFields(selectedSnapshot?.payload ?? {}),
    [selectedSnapshot],
  );

  async function downloadBundle() {
    if (!selected) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch(`${basePath}/api/admin/archive/${selected.id}/bundle`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "The archive bundle could not be downloaded.");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `applicant-${selected.reference}-archive.tar.gz`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The archive bundle could not be downloaded.");
    } finally {
      setWorking(false);
    }
  }

  async function restoreSnapshot() {
    if (!selected || !selectedSnapshot) return;
    const confirmed = window.confirm(
      `Restore saved enrollment fields from version ${selectedSnapshot.version} for ${selected.reference}? This replaces the live form fields and proofs, but does not restore the PIN or change review status.`,
    );
    if (!confirmed) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/admin/archive/${selected.id}/restore`, {
        method: "POST",
        body: JSON.stringify({ snapshotId: selectedSnapshot.id, confirm: true }),
      });
      setNotice("Saved fields were restored. The PIN and review status were left unchanged.");
      await loadDetail(selected.id);
      await loadList();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The saved version could not be restored.");
    } finally {
      setWorking(false);
    }
  }

  async function deleteArchive() {
    if (!selected) return;
    const confirmed = window.confirm(
      `Permanently delete every archived version and proof copy for ${selected.reference}? This cannot be undone.`,
    );
    if (!confirmed) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/admin/archive/${selected.id}/delete`, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });
      setSelected(null);
      setSelectedSnapshotId("");
      setNotice(`Archive ${selected.reference} was permanently deleted.`);
      await loadList();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The archive could not be deleted.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="admin-page archive-page">
      <div className="page-heading archive-heading">
        <div>
          <span className="eyebrow">SUPER ADMIN ONLY</span>
          <h1>Applicant master archive</h1>
          <p>Encrypted record history and private proof copies for authorized recovery.</p>
        </div>
        <div className="archive-security-note"><ShieldCheck size={18} /> Access and exports are audited</div>
      </div>

      {error && <div className="archive-alert archive-alert-error" role="alert">{error}</div>}
      {notice && <div className="archive-alert archive-alert-success" role="status">{notice}</div>}

      <div className="archive-search-row">
        <label className="archive-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reference, name, email, or status"
            aria-label="Search applicant archive"
            data-testid="input-archive-search"
          />
        </label>
        <span className="archive-count">{records.length} archived records</span>
      </div>

      <div className="archive-layout">
        <section className="archive-record-list" aria-label="Archived applicants">
          {loadingList ? (
            <div className="archive-loading"><LoaderCircle className="archive-spinner" size={20} /> Loading archive</div>
          ) : records.length ? records.map((record) => (
            <button
              key={record.id}
              className={`archive-record ${selected?.id === record.id ? "archive-record-active" : ""}`}
              type="button"
              onClick={() => void loadDetail(record.id)}
              data-testid={`button-archive-record-${record.reference}`}
            >
              <span className="archive-record-top"><b>{record.applicantName || "Unnamed applicant"}</b><span>{record.versionCount} versions</span></span>
              <span>{record.reference} · {record.categoryId}</span>
              <span>{record.applicantEmail || "No email saved"}</span>
              <span className="archive-record-bottom"><span>{record.status.replace(/_/g, " ")}</span><time>{new Date(record.updatedAt).toLocaleDateString()}</time></span>
            </button>
          )) : (
            <div className="archive-empty"><Archive size={22} /><b>No archive records found</b><span>Applicant records appear after the archive’s initial snapshot is prepared.</span></div>
          )}
        </section>

        <section className="archive-detail" aria-label="Archive record detail">
          {!selected ? (
            <div className="archive-empty archive-empty-detail"><Archive size={24} /><b>Select an applicant record</b><span>View saved field values, correction history, and retained proof files.</span></div>
          ) : loadingDetail ? (
            <div className="archive-loading"><LoaderCircle className="archive-spinner" size={20} /> Loading record</div>
          ) : (
            <>
              <div className="archive-detail-heading">
                <div><span className="eyebrow">{selected.reference} · {selected.sourceType === "guest" ? "GUEST APPLICATION" : "ACCOUNT APPLICATION"}</span><h2>{selected.applicantName || "Unnamed applicant"}</h2><p>{selected.applicantEmail}</p></div>
                <div className="archive-actions">
                  <button type="button" className="button button-quiet" onClick={() => void downloadBundle()} disabled={working} data-testid="button-archive-download"><Download size={15} /> Download archive</button>
                  <button type="button" className="button button-quiet" onClick={() => void restoreSnapshot()} disabled={working || !selectedSnapshot} data-testid="button-archive-restore"><RotateCcw size={15} /> Restore version</button>
                  <button type="button" className="button archive-delete-button" onClick={() => void deleteArchive()} disabled={working} data-testid="button-archive-delete"><Trash2 size={15} /> Delete archive</button>
                </div>
              </div>

              {selected.historyUnavailable && (
                <div className="archive-alert archive-alert-warning">
                  Field-by-field history from before the archive began is unavailable for this older account-based record. New saved changes are tracked.
                </div>
              )}

              <div className="archive-columns">
                <section className="archive-section">
                  <div className="archive-section-heading"><h3>Saved field values</h3><span>Version {selectedSnapshot?.version ?? "—"}</span></div>
                  <div className="archive-fields">
                    {fields.map(({ field, value }) => (
                      <article className="archive-field" key={field}>
                        <b>{field.replace(/\./g, " · ").replace(/([A-Z])/g, " $1")}</b>
                        <pre>{displayValue(value)}</pre>
                      </article>
                    ))}
                    {!fields.length && <p className="archive-muted">No saved fields in this version.</p>}
                  </div>
                </section>

                <section className="archive-section">
                  <div className="archive-section-heading"><h3><History size={16} /> Correction timeline</h3><span>{selected.snapshots.length} saved versions</span></div>
                  <div className="archive-timeline">
                    {selected.snapshots.map((snapshot) => (
                      <button
                        key={snapshot.id}
                        type="button"
                        className={`archive-version ${snapshot.id === selectedSnapshot?.id ? "archive-version-active" : ""}`}
                        onClick={() => setSelectedSnapshotId(snapshot.id)}
                      >
                        <span className="archive-version-heading"><b>Version {snapshot.version} · {readableEvent(snapshot.eventType)}</b><time>{new Date(snapshot.createdAt).toLocaleString()}</time></span>
                        {snapshot.changes.length ? (
                          <span className="archive-change-list">
                            {snapshot.changes.slice(0, 8).map((change, index) => (
                              <span key={`${change.field}-${index}`}><b>{change.field}</b><small>{displayValue(change.before)} → {displayValue(change.after)}</small></span>
                            ))}
                            {snapshot.changes.length > 8 && <small>+ {snapshot.changes.length - 8} more field changes</small>}
                          </span>
                        ) : <small className="archive-muted">Initial record snapshot</small>}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <section className="archive-section archive-evidence-section">
                <div className="archive-section-heading"><h3>Retained proof files</h3><span>{selected.evidence.length} files</span></div>
                {selected.evidence.length ? (
                  <div className="archive-evidence-list">
                    {selected.evidence.map((item) => (
                      <div className="archive-evidence-row" key={item.id}>
                        <span><b>{item.fileName}</b><small>{item.fieldPath.replace(/_/g, " ")} · {item.contentType} · {Math.ceil(item.sizeBytes / 1024)} KB</small></span>
                        <span className={item.availability === "available" ? "archive-proof-available" : "archive-proof-missing"}>
                          {item.availability === "available" ? "Private copy retained" : "Original was unavailable"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : <p className="archive-muted">No proof files were attached to this record.</p>}
              </section>
              <p className="archive-pin-note">Enrollment PINs and PIN hashes are never archived, exported, or restored.</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
