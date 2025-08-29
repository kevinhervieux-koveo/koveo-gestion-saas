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
    storageInstance = await createStorageClient();
  }
  return storageInstance;
}

/**
 * Pre-configured Storage client instance for immediate use.
 * Note: This is an async operation, so use getStorageClient() for guaranteed initialization.
 */
export const storage = getStorageClient();

// Export default for convenience
export default getStorageClient;