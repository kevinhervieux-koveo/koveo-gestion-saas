import { Storage } from '@google-cloud/storage';
import { GoogleAuth } from 'google-auth-library';
import * as fs from 'fs';

/**
 * Google Cloud Storage client configured with Workload Identity Federation
 * for seamless authentication using Replit OIDC tokens.
 */

let storageInstance: Storage | null = null;

/**
 * Creates and configures a Google Cloud Storage client using Workload Identity Federation.
 * This function reads the Replit OIDC token and uses it for federated authentication.
 * 
 * @returns Promise<Storage> - Configured Storage client instance
 * @throws Error if authentication configuration fails or required environment variables are missing
 */
async function createStorageClient(): Promise<Storage> {
  try {
    // Validate required environment variable
    const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
    if (!serviceAccountEmail) {
      throw new Error('GCP_SERVICE_ACCOUNT_EMAIL environment variable is required');
    }

    // Token file path for Replit OIDC token
    const tokenFilePath = '/var/run/secrets/google/token';
    
    // Verify token file exists before proceeding
    if (!fs.existsSync(tokenFilePath)) {
      throw new Error(`OIDC token file not found at ${tokenFilePath}`);
    }

    // Configuration for Workload Identity Federation
    const authConfig = {
      type: 'external_account',
      audience: '//iam.googleapis.com/projects/1064795327786/locations/global/workloadIdentityPools/replit-storage-admin-workload/providers/replit-provider',
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      token_url: 'https://sts.googleapis.com/v1/token',
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
      credential_source: {
        file: tokenFilePath,
        format: {
          type: 'text'
        }
      }
    };

    // Create auth client using the configuration
    const authClient = new GoogleAuth({
      credentials: authConfig
    });
    
    // Verify authentication works by getting credentials
    await authClient.getAccessToken();
    
    // Create and return Storage client with the configured auth
    const storage = new Storage({
      authClient: authClient
    });

    console.log('Google Cloud Storage client successfully configured with Workload Identity Federation');
    return storage;

  } catch (error) {
    console.error('Failed to configure Google Cloud Storage client:', error);
    throw new Error(`GCS client configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets or creates a singleton Storage client instance.
 * This ensures we only create one authenticated client throughout the application lifecycle.
 * 
 * @returns Promise<Storage> - The Storage client instance
 */
export async function getStorageClient(): Promise<Storage> {
  if (!storageInstance) {
    try {
      storageInstance = await createStorageClient();
    } catch (error) {
      console.warn('GCS client initialization failed, will skip GCS operations:', error);
      throw error;
    }
  }
  return storageInstance;
}

/**
 * Pre-configured Storage client instance for immediate use.
 * Note: This is an async operation, so use getStorageClient() for guaranteed initialization.
 */
export const storage = (() => {
  // Don't initialize GCS client at module load time to prevent startup errors
  return null;
})();

/**
 * Uploads a file to Google Cloud Storage.
 * 
 * @param file - The multer file object containing file data and metadata
 * @param fileName - The target filename/path in the bucket
 * @returns Promise with GCS path and public URL
 */
export async function uploadToGCS(file: any, fileName: string): Promise<{ gcsPath: string; publicUrl: string }> {
  // Check if GCS is available
  if (!process.env.GCP_SERVICE_ACCOUNT_EMAIL) {
    console.warn('GCS not configured, using local file path fallback');
    return {
      gcsPath: `local://${fileName}`,
      publicUrl: `/uploads/${fileName}`
    };
  }

  try {
    const storage = await getStorageClient();
    const bucketName = process.env.GCS_BUCKET_NAME || 'koveo-documents';
    const bucket = storage.bucket(bucketName);
    
    // Create a reference to the file in the bucket
    const gcsFile = bucket.file(fileName);
    
    // Create a write stream to upload the file
    const stream = gcsFile.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
      resumable: false, // Use simple upload for smaller files
    });

    // Return a promise that resolves when upload is complete
    return new Promise((resolve, reject) => {
      stream.on('error', (error) => {
        console.error('GCS upload error:', error);
        reject(new Error(`Failed to upload file to GCS: ${error.message}`));
      });

      stream.on('finish', () => {
        const gcsPath = `gs://${bucketName}/${fileName}`;
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
        
        console.log(`File uploaded successfully to ${gcsPath}`);
        resolve({ gcsPath, publicUrl });
      });

      // Write the file buffer to the stream
      if (file.buffer) {
        stream.end(file.buffer);
      } else if (file.path) {
        // If file is stored on disk, read and upload it
        const fs = require('fs');
        const fileStream = fs.createReadStream(file.path);
        fileStream.pipe(stream);
      } else {
        reject(new Error('File data not found - no buffer or path available'));
      }
    });
  } catch (error) {
    console.error('GCS upload setup error, falling back to local storage:', error);
    // Fallback to local file storage
    return {
      gcsPath: `local://${fileName}`,
      publicUrl: `/uploads/${fileName}`
    };
  }
}

// Export default for convenience
export default getStorageClient;