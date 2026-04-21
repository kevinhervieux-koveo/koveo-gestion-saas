import { File } from "@google-cloud/storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

// The type of the access group - extend this based on your use case
export enum ObjectAccessGroupType {
  ORGANIZATION = "organization",
  BUILDING = "building",
  RESIDENCE = "residence",
}

// The logic user group that can access the object
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

// The ACL policy of the object
export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: Array<ObjectAclRule>;
}

// Check if the requested permission is allowed based on the granted permission
function isPermissionAllowed(
  requested: ObjectPermission,
  granted: ObjectPermission,
): boolean {
  if (requested === ObjectPermission.READ) {
    return [ObjectPermission.READ, ObjectPermission.WRITE].includes(granted);
  }
  return granted === ObjectPermission.WRITE;
}

// The base class for all access groups
abstract class BaseObjectAccessGroup implements ObjectAccessGroup {
  constructor(
    public readonly type: ObjectAccessGroupType,
    public readonly id: string,
  ) {}

  public abstract hasMember(userId: string): Promise<boolean>;
}

// Organization access group - users in the same organization
class OrganizationAccessGroup extends BaseObjectAccessGroup {
  constructor(organizationId: string) {
    super(ObjectAccessGroupType.ORGANIZATION, organizationId);
  }

  async hasMember(userId: string): Promise<boolean> {
    const { db } = await import('./db');
    const { userOrganizations } = await import('../shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    const result = await db.select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, this.id),
          eq(userOrganizations.isActive, true)
        )
      )
      .limit(1);
    
    return result.length > 0;
  }
}

// Building access group - users with access to a building
class BuildingAccessGroup extends BaseObjectAccessGroup {
  constructor(buildingId: string) {
    super(ObjectAccessGroupType.BUILDING, buildingId);
  }

  async hasMember(userId: string): Promise<boolean> {
    const { db } = await import('./db');
    const { buildings, userOrganizations, userResidences, residences } = await import('../shared/schema');
    const { eq, and, or } = await import('drizzle-orm');
    
    // Get building to find its organization
    const [building] = await db.select()
      .from(buildings)
      .where(eq(buildings.id, this.id))
      .limit(1);
    
    if (!building || !building.organizationId) {
      return false;
    }
    
    // Check if user has access to this building's organization
    const orgAccess = await db.select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, building.organizationId),
          eq(userOrganizations.isActive, true)
        )
      )
      .limit(1);
    
    if (orgAccess.length > 0) {
      return true;
    }
    
    // Check if user has access to any residence in this building
    const residenceAccess = await db.select()
      .from(userResidences)
      .innerJoin(residences, eq(userResidences.residenceId, residences.id))
      .where(
        and(
          eq(userResidences.userId, userId),
          eq(residences.buildingId, this.id),
          eq(userResidences.isActive, true)
        )
      )
      .limit(1);
    
    return residenceAccess.length > 0;
  }
}

// Residence access group - users with access to a residence
class ResidenceAccessGroup extends BaseObjectAccessGroup {
  constructor(residenceId: string) {
    super(ObjectAccessGroupType.RESIDENCE, residenceId);
  }

  async hasMember(userId: string): Promise<boolean> {
    const { db } = await import('./db');
    const { userResidences } = await import('../shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    const result = await db.select()
      .from(userResidences)
      .where(
        and(
          eq(userResidences.userId, userId),
          eq(userResidences.residenceId, this.id),
          eq(userResidences.isActive, true)
        )
      )
      .limit(1);
    
    return result.length > 0;
  }
}

function createObjectAccessGroup(
  group: ObjectAccessGroup,
): BaseObjectAccessGroup {
  switch (group.type) {
    case ObjectAccessGroupType.ORGANIZATION:
      return new OrganizationAccessGroup(group.id);
    case ObjectAccessGroupType.BUILDING:
      return new BuildingAccessGroup(group.id);
    case ObjectAccessGroupType.RESIDENCE:
      return new ResidenceAccessGroup(group.id);
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}

// Sets the ACL policy to the object metadata
export async function setObjectAclPolicy(
  objectFile: File,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }

  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
    },
  });
}

// Gets the ACL policy from the object metadata
export async function getObjectAclPolicy(
  objectFile: File,
): Promise<ObjectAclPolicy | null> {
  const [metadata] = await objectFile.getMetadata();
  const aclPolicy = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!aclPolicy) {
    return null;
  }
  return JSON.parse(aclPolicy as string);
}

// Checks if the user can access the object
export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: File;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) {
    return false;
  }

  // Public objects are always accessible for read
  if (
    aclPolicy.visibility === "public" &&
    requestedPermission === ObjectPermission.READ
  ) {
    return true;
  }

  // Access control requires the user id
  if (!userId) {
    return false;
  }

  // The owner of the object can always access it
  if (aclPolicy.owner === userId) {
    return true;
  }

  // Go through the ACL rules to check if the user has the required permission
  for (const rule of aclPolicy.aclRules || []) {
    const accessGroup = createObjectAccessGroup(rule.group);
    if (
      (await accessGroup.hasMember(userId)) &&
      isPermissionAllowed(requestedPermission, rule.permission)
    ) {
      return true;
    }
  }

  return false;
}
