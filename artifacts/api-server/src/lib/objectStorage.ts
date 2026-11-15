import { randomUUID } from "crypto";
import { Readable } from "stream";

type StorageApiError = Error & { status: number };

type SupabaseFileMetadata = {
  size?: number | string;
  contentType?: string;
  mimetype?: string;
  metadata?: Record<string, unknown>;
};

function getStorageConfig(): { projectUrl: string; serviceKey: string } {
  const projectUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!projectUrl || !serviceKey) {
    throw new Error(
      "Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return { projectUrl, serviceKey };
}

async function storageFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const { projectUrl, serviceKey } = getStorageConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", serviceKey);
  headers.set("Authorization", \`Bearer \${serviceKey}\`);

  return fetch(\`\${projectUrl}/storage/v1\${path}\`, {
    ...init,
    headers,
  });
}

async function storageRequest<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await storageFetch(path, init);
  const responseText = await response.text();

  if (!response.ok) {
    const error = new Error(
      \`Supabase Storage request failed (\${response.status}): \${responseText || response.statusText}\`,
    ) as StorageApiError;
    error.status = response.status;
    throw error;
  }

  return (responseText ? JSON.parse(responseText) : null) as T;
}

function isNotFound(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "status" in error &&
      (error as StorageApiError).status === 404,
  );
}

function encodeObjectPath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function decodeObjectPath(path: string): string {
  return path
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  const [bucketName, ...objectParts] = normalized.split("/");

  if (!bucketName || objectParts.length === 0 || objectParts.some((part) => part === "..")) {
    throw new Error("Invalid object path. Expected bucket/object-name.");
  }

  return {
    bucketName,
    objectName: objectParts.join("/"),
  };
}

async function ensurePrivateBucket(bucketName: string): Promise<void> {
  try {
    const bucket = await storageRequest<{ public?: boolean }>(
      \`/bucket/\${encodeURIComponent(bucketName)}\`,
    );

    if (bucket?.public === true) {
      throw new Error(
        \`Supabase bucket "\${bucketName}" is public. Private applicant evidence must use a private bucket.\`,
      );
    }
    return;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  try {
    await storageRequest("/bucket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: bucketName,
        name: bucketName,
        public: false,
        fileSizeLimit: 209715200,
        allowedMimeTypes: [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "video/mp4",
          "video/webm",
        ],
      }),
    });
  } catch (error) {
    // A parallel first upload may have created the bucket after the GET.
    if (!(error && typeof error === "object" && "status" in error &&
      (error as StorageApiError).status === 409)) {
      throw error;
    }
  }
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

/**
 * A small adapter preserving the file operations used by the enrollment API.
 * All object reads and writes go through the Supabase Storage HTTP API.
 */
export class SupabaseObjectFile {
  readonly name: string;

  constructor(
    readonly bucketName: string,
    readonly objectName: string,
  ) {
    this.name = \`\${bucketName}/\${objectName}\`;
  }

  async exists(): Promise<[boolean]> {
    const response = await storageFetch(
      \`/object/\${encodeURIComponent(this.bucketName)}/\${encodeObjectPath(this.objectName)}\`,
      { method: "HEAD" },
    );

    if (response.ok) return [true];
    if (response.status === 404) return [false];

    const message = await response.text();
    const error = new Error(
      \`Supabase Storage existence check failed (\${response.status}): \${message}\`,
    ) as StorageApiError;
    error.status = response.status;
    throw error;
  }

  async getMetadata(): Promise<[SupabaseFileMetadata]> {
    try {
      const info = await storageRequest<any>(
        \`/object/info/\${encodeURIComponent(this.bucketName)}/\${encodeObjectPath(this.objectName)}\`,
      );
      return [{
        size: info.size,
        contentType: info.mimetype || info.contentType || "application/octet-stream",
        metadata: info.userMetadata || {},
      }];
    } catch (error) {
      if (isNotFound(error)) throw new ObjectNotFoundError();
      throw error;
    }
  }

  async download(options?: { start?: number; end?: number }): Promise<[Buffer]> {
    const headers: Record<string, string> = {};
    if (options?.start !== undefined || options?.end !== undefined) {
      const start = options.start ?? 0;
      const end = options.end === undefined ? "" : String(options.end);
      headers.Range = \`bytes=\${start}-\${end}\`;
    }

    const response = await storageFetch(
      \`/object/authenticated/\${encodeURIComponent(this.bucketName)}/\${encodeObjectPath(this.objectName)}\`,
      { method: "GET", headers },
    );

    if (response.status === 404) throw new ObjectNotFoundError();
    if (!response.ok) {
      const message = await response.text();
      const error = new Error(
        \`Supabase Storage download failed (\${response.status}): \${message}\`,
      ) as StorageApiError;
      error.status = response.status;
      throw error;
    }

    return [Buffer.from(await response.arrayBuffer())];
  }

  createReadStream(): Readable {
    const file = this;
    return Readable.from((async function* () {
      const response = await storageFetch(
        \`/object/authenticated/\${encodeURIComponent(file.bucketName)}/\${encodeObjectPath(file.objectName)}\`,
        { method: "GET" },
      );

      if (response.status === 404) throw new ObjectNotFoundError();
      if (!response.ok) {
        const message = await response.text();
        throw new Error(
          \`Supabase Storage stream failed (\${response.status}): \${message}\`,
        );
      }
      if (!response.body) return;

      for await (const chunk of response.body as any) {
        yield Buffer.from(chunk);
      }
    })());
  }

  async delete(options: { ignoreNotFound?: boolean } = {}): Promise<void> {
    try {
      await storageRequest(
        \`/object/\${encodeURIComponent(this.bucketName)}\`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefixes: [this.objectName] }),
        },
      );
    } catch (error) {
      if (options.ignoreNotFound && isNotFound(error)) return;
      if (isNotFound(error)) throw new ObjectNotFoundError();
      throw error;
    }
  }
}

export class ObjectStorageService {
  getPublicObjectSearchPaths(): string[] {
    const paths = Array.from(
      new Set(
        (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "")
          .split(",")
          .map((path) => path.trim())
          .filter(Boolean),
      ),
    );

    if (paths.length === 0) {
      throw new Error("PUBLIC_OBJECT_SEARCH_PATHS is not configured.");
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const directory = process.env.PRIVATE_OBJECT_DIR || "";
    if (!directory) {
      throw new Error("PRIVATE_OBJECT_DIR is not configured.");
    }
    return directory.replace(/^\/+|\/+$/g, "");
  }

  async searchPublicObject(filePath: string): Promise<SupabaseObjectFile | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const { bucketName, objectName } = parseObjectPath(
        \`\${searchPath.replace(/\/+$/g, "")}/\${filePath.replace(/^\/+/g, "")}\`,
      );
      const file = new SupabaseObjectFile(bucketName, objectName);
      if ((await file.exists())[0]) return file;
    }
    return null;
  }

  async downloadObject(
    file: SupabaseObjectFile,
    cacheTtlSec: number = 3600,
  ): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;
    const headers: Record<string, string> = {
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Cache-Control": \`private, max-age=\${cacheTtlSec}\`,
    };
    if (metadata.size !== undefined) {
      headers["Content-Length"] = String(metadata.size);
    }
    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(directory: string = "uploads"): Promise<string> {
    if (!/^[a-z0-9-]{1,64}$/i.test(directory)) {
      throw new Error("Invalid object upload directory.");
    }

    const privateDirectory = this.getPrivateObjectDir();
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID is not configured.");
    }

    const relativePrefix = privateDirectory.startsWith(\`\${bucketId}/\`)
      ? privateDirectory.slice(bucketId.length + 1)
      : privateDirectory;
    const finalObjectName = \`\${relativePrefix.replace(/^\/+|\/+$/g, "")}/\${directory}/\${randomUUID()}\`;

    await ensurePrivateBucket(bucketId);

    const signed = await storageRequest<{ url?: string }>(
      \`/object/upload/sign/\${encodeURIComponent(bucketId)}/\${encodeObjectPath(finalObjectName)}\`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    if (!signed?.url) {
      throw new Error("Supabase Storage did not return a signed upload URL.");
    }

    const { projectUrl } = getStorageConfig();
    const storageBase = \`\${projectUrl}/storage/v1\`;
    return signed.url.startsWith("http")
      ? signed.url
      : \`\${storageBase}\${signed.url.startsWith("/") ? signed.url : \`/\${signed.url}\`}\`;
  }

  async getObjectEntityFile(objectPath: string): Promise<SupabaseObjectFile> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const entityId = objectPath.slice("/objects/".length);
    if (!entityId || entityId.split("/").some((part) => part === "..")) {
      throw new ObjectNotFoundError();
    }

    const privateDirectory = this.getPrivateObjectDir();
    const { bucketName, objectName } = parseObjectPath(
      \`\${privateDirectory}/\${entityId}\`,
    );
    const file = new SupabaseObjectFile(bucketName, objectName);
    if (!(await file.exists())[0]) {
      throw new ObjectNotFoundError();
    }
    return file;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("/objects/")) return rawPath;

    const { projectUrl } = getStorageConfig();
    const url = new URL(rawPath, projectUrl);
    const marker = "/storage/v1/object/upload/sign/";
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex >= 0) {
      const signedObjectPath = url.pathname.slice(markerIndex + marker.length);
      const [bucketName, ...objectParts] = signedObjectPath.split("/");
      const configuredBucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketName || !objectParts.length || bucketName !== configuredBucket) {
        throw new Error("Supabase returned an invalid signed upload path.");
      }

      const privateDirectory = this.getPrivateObjectDir();
      const prefix = privateDirectory.startsWith(\`\${bucketName}/\`)
        ? privateDirectory.slice(bucketName.length + 1).replace(/^\/+|\/+$/g, "")
        : privateDirectory.replace(/^\/+|\/+$/g, "");
      const objectName = decodeObjectPath(objectParts.join("/"));
      if (prefix && !objectName.startsWith(\`\${prefix}/\`)) {
        throw new Error("Supabase signed upload path is outside the configured private directory.");
      }
      const entityId = prefix ? objectName.slice(prefix.length + 1) : objectName;
      return \`/objects/\${entityId}\`;
    }

    // Historical Google Cloud objects are not copied by this adapter. Their
    // bytes must be migrated separately if any are still referenced in the DB.
    return rawPath;
  }
}
