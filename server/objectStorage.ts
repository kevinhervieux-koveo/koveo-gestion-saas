import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// The object storage client is used to interact with the object storage service.
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

/**
 *
 */
export class ObjectNotFoundError extends Error {
  /**
   *
   */
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
/**
 *
 */
export class ObjectStorageService {
  /**
   *
   */
  constructor() {}

  // Gets the public object search paths.
  /**
   *
   */
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  // Gets the private object directory.
  /**
   *
   */
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  /**
   *
   * @param filePath
   */
  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  /**
   *
   * @param file
   * @param res
   * @param cacheTtlSec
   */
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      
      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for an object entity with hierarchical structure
  /**
   * Creates upload URL following the hierarchy:
   * .private/organization-{id}/building-{id}/buildings_documents/{file}
   * .private/organization-{id}/building-{id}/residence-{id}/{file}
   */
  async getObjectEntityUploadURL(options: {
    organizationId: string;
    buildingId?: string;
    residenceId?: string;
    documentType: 'building' | 'residence';
  }): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    let fullPath: string;

    if (options.documentType === 'building') {
      // Building documents: .private/organization-{id}/building-{id}/buildings_documents/{file}
      if (!options.buildingId) {
        throw new Error('Building ID is required for building documents');
      }
      fullPath = `${privateObjectDir}/organization-${options.organizationId}/building-${options.buildingId}/buildings_documents/${objectId}`;
    } else {
      // Residence documents: .private/organization-{id}/building-{id}/residence-{id}/{file}
      if (!options.buildingId || !options.residenceId) {
        throw new Error('Building ID and Residence ID are required for residence documents');
      }
      fullPath = `${privateObjectDir}/organization-${options.organizationId}/building-${options.buildingId}/residence-${options.residenceId}/${objectId}`;
    }

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  // Gets the object entity file from the object path with hierarchical structure
  /**
   * Retrieves files from hierarchical paths:
   * /objects/organization-{id}/building-{id}/buildings_documents/{file}
   * /objects/organization-{id}/building-{id}/residence-{id}/{file}
   */
  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(9).split("/"); // Remove "/objects/"
    if (parts.length < 4) {
      // Minimum: organization-id/building-id/type/file
      throw new ObjectNotFoundError();
    }

    const entityPath = parts.join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityPath}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  /**
   * Normalizes hierarchical object paths from URLs to /objects/... format
   */
  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
  
    // Extract the path from the URL by removing query parameters and domain
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
  
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }
  
    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }
  
    // Extract the entity path from the hierarchical structure
    const entityPath = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityPath}`;
  }

  // Sets the object ACL policy and return the normalized path.
  /**
   *
   * @param rawPath
   */
  async setObjectEntityPath(rawPath: string): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    return normalizedPath;
  }

  // Create hierarchical directory structure for organization
  /**
   * Creates directory structure for an organization
   */
  async createOrganizationHierarchy(organizationId: string): Promise<void> {
    try {
      const privateDir = this.getPrivateObjectDir();
      const { bucketName } = parseObjectPath(privateDir);
      const bucket = objectStorageClient.bucket(bucketName);

      // Create organization directory marker
      const orgDir = `${privateDir.replace('/', '')}/organization-${organizationId}/.keep`;
      const orgFile = bucket.file(orgDir);
      await orgFile.save('', { metadata: { contentType: 'text/plain' } });

      console.log(`✅ Created organization hierarchy for: ${organizationId}`);
    } catch (error) {
      console.error(`❌ Failed to create organization hierarchy for ${organizationId}:`, error);
    }
  }

  // Create hierarchical directory structure for building
  /**
   * Creates directory structure for a building under an organization
   */
  async createBuildingHierarchy(organizationId: string, buildingId: string): Promise<void> {
    try {
      const privateDir = this.getPrivateObjectDir();
      const { bucketName } = parseObjectPath(privateDir);
      const bucket = objectStorageClient.bucket(bucketName);

      // Create building directory and buildings_documents subdirectory
      const buildingDir = `${privateDir.replace('/', '')}/organization-${organizationId}/building-${buildingId}`;
      const buildingsDocDir = `${buildingDir}/buildings_documents/.keep`;
      
      const buildingsDocFile = bucket.file(buildingsDocDir);
      await buildingsDocFile.save('', { metadata: { contentType: 'text/plain' } });

      console.log(`✅ Created building hierarchy for: ${buildingId} in organization ${organizationId}`);
    } catch (error) {
      console.error(`❌ Failed to create building hierarchy for ${buildingId}:`, error);
    }
  }

  // Create hierarchical directory structure for residence
  /**
   * Creates directory structure for a residence under a building
   */
  async createResidenceHierarchy(organizationId: string, buildingId: string, residenceId: string): Promise<void> {
    try {
      const privateDir = this.getPrivateObjectDir();
      const { bucketName } = parseObjectPath(privateDir);
      const bucket = objectStorageClient.bucket(bucketName);

      // Create residence directory
      const residenceDir = `${privateDir.replace('/', '')}/organization-${organizationId}/building-${buildingId}/residence-${residenceId}/.keep`;
      
      const residenceFile = bucket.file(residenceDir);
      await residenceFile.save('', { metadata: { contentType: 'text/plain' } });

      console.log(`✅ Created residence hierarchy for: ${residenceId} in building ${buildingId}`);
    } catch (error) {
      console.error(`❌ Failed to create residence hierarchy for ${residenceId}:`, error);
    }
  }

  // Delete hierarchical directory structure (with safety checks)
  /**
   * Safely deletes directory structure and all contents for an organization
   */
  async deleteOrganizationHierarchy(organizationId: string): Promise<void> {
    try {
      const privateDir = this.getPrivateObjectDir();
      const { bucketName } = parseObjectPath(privateDir);
      const bucket = objectStorageClient.bucket(bucketName);

      // List all files in the organization directory
      const prefix = `${privateDir.replace('/', '')}/organization-${organizationId}/`;
      const [files] = await bucket.getFiles({ prefix });

      // Delete all files in the organization hierarchy
      for (const file of files) {
        await file.delete();
        console.log(`🗑️ Deleted: ${file.name}`);
      }

      console.log(`✅ Deleted organization hierarchy for: ${organizationId}`);
    } catch (error) {
      console.error(`❌ Failed to delete organization hierarchy for ${organizationId}:`, error);
    }
  }

  // Delete hierarchical directory structure for building
  /**
   * Safely deletes directory structure and all contents for a building
   */
  async deleteBuildingHierarchy(organizationId: string, buildingId: string): Promise<void> {
    try {
      const privateDir = this.getPrivateObjectDir();
      const { bucketName } = parseObjectPath(privateDir);
      const bucket = objectStorageClient.bucket(bucketName);

      // List all files in the building directory
      const prefix = `${privateDir.replace('/', '')}/organization-${organizationId}/building-${buildingId}/`;
      const [files] = await bucket.getFiles({ prefix });

      // Delete all files in the building hierarchy
      for (const file of files) {
        await file.delete();
        console.log(`🗑️ Deleted: ${file.name}`);
      }

      console.log(`✅ Deleted building hierarchy for: ${buildingId} in organization ${organizationId}`);
    } catch (error) {
      console.error(`❌ Failed to delete building hierarchy for ${buildingId}:`, error);
    }
  }

  // Delete hierarchical directory structure for residence
  /**
   * Safely deletes directory structure and all contents for a residence
   */
  async deleteResidenceHierarchy(organizationId: string, buildingId: string, residenceId: string): Promise<void> {
    try {
      const privateDir = this.getPrivateObjectDir();
      const { bucketName } = parseObjectPath(privateDir);
      const bucket = objectStorageClient.bucket(bucketName);

      // List all files in the residence directory
      const prefix = `${privateDir.replace('/', '')}/organization-${organizationId}/building-${buildingId}/residence-${residenceId}/`;
      const [files] = await bucket.getFiles({ prefix });

      // Delete all files in the residence hierarchy
      for (const file of files) {
        await file.delete();
        console.log(`🗑️ Deleted: ${file.name}`);
      }

      console.log(`✅ Deleted residence hierarchy for: ${residenceId} in building ${buildingId}`);
    } catch (error) {
      console.error(`❌ Failed to delete residence hierarchy for ${residenceId}:`, error);
    }
  }
}

/**
 *
 * @param path
 */
function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

/**
 *
 * @param root0
 * @param root0.bucketName
 * @param root0.objectName
 * @param root0.method
 * @param root0.ttlSec
 */
async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}