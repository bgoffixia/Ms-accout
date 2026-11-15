// Object ACL policies are retained as a compatibility contract for the API.
// Supabase Storage access is enforced by private buckets and server-side
// authorization; callers should not expose service credentials to clients.

export enum ObjectAccessGroupType {}

export interface ObjectAccessGroup {
  type: ObjectAccessGroupType;
  id: string;
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: Array<ObjectAclRule>;
}

export interface ObjectFileLike {
  name: string;
  exists(): Promise<[boolean]>;
  getMetadata(): Promise<[{
    metadata?: Record<string, unknown>;
  }]>;
  setMetadata(options: {
    metadata: Record<string, string>;
  }): Promise<void>;
}

function isPermissionAllowed(
  requested: ObjectPermission,
  granted: ObjectPermission,
): boolean {
  if (requested === ObjectPermission.READ) {
    return [ObjectPermission.READ, ObjectPermission.WRITE].includes(granted);
  }
  return granted === ObjectPermission.WRITE;
}

export async function setObjectAclPolicy(
  objectFile: ObjectFileLike,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const [exists] = await objectFile.exists();
  if (!exists) throw new Error(\`Object not found: \${objectFile.name}\`);

  await objectFile.setMetadata({
    metadata: {
      "custom:aclPolicy": JSON.stringify(aclPolicy),
    },
  });
}

export async function getObjectAclPolicy(
  objectFile: ObjectFileLike,
): Promise<ObjectAclPolicy | null> {
  const [metadata] = await objectFile.getMetadata();
  const aclPolicy = metadata?.metadata?.["custom:aclPolicy"];
  if (typeof aclPolicy !== "string") return null;
  return JSON.parse(aclPolicy) as ObjectAclPolicy;
}

export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: ObjectFileLike;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) return false;

  if (
    aclPolicy.visibility === "public" &&
    requestedPermission === ObjectPermission.READ
  ) return true;

  if (!userId) return false;
  if (aclPolicy.owner === userId) return true;

  for (const rule of aclPolicy.aclRules || []) {
    if (
      rule.group.id === userId &&
      isPermissionAllowed(requestedPermission, rule.permission)
    ) return true;
  }

  return false;
}
