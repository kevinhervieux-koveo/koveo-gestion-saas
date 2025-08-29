import { Storage } from '@google-cloud/storage';
import { GoogleAuth } from 'google-auth-library';
import * as fs from 'fs';

/**
 * Google Cloud Storage client configured with Workload Identity Federation
 */
class GCSClient {
  private static instance: Storage | null = null;
  private static initPromise: Promise<Storage> | null = null;

  /**
   * Get singleton Storage instance with authentication
   */
  static async getInstance(): Promise<Storage> {
    if (this.instance) {
      return this.instance;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initializeStorage();
    this.instance = await this.initPromise;
    return this.instance;
  }

  /**
   * Initialize Storage client with Workload Identity Federation
   */
  private static async initializeStorage(): Promise<Storage> {
    try {
      // In development, use Application Default Credentials
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Development mode: Using Application Default Credentials');
        console.log('💡 Run "gcloud auth application-default login" if authentication fails');
        
        const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
        if (!projectId) {
          throw new Error('GCP_PROJECT_ID environment variable is required');
        }
        
        // Use ADC - will automatically find credentials from gcloud
        const storage = new Storage({
          projectId: projectId
          // No credentials needed - will use ADC
        });
        
        console.log('✅ Google Cloud Storage client initialized with ADC');
        return storage;
      }
      
      // In production, use WIF
      const tokenPath = '/var/run/secrets/google/token';
      
      if (!fs.existsSync(tokenPath)) {
        throw new Error(`Production OIDC token file not found at ${tokenPath}`);
      }
      
      console.log('🚀 Using production WIF token path:', tokenPath);

      // Verify required environment variable
      const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
      if (!serviceAccountEmail) {
        throw new Error('GCP_SERVICE_ACCOUNT_EMAIL environment variable is required');
      }

      // Configure external account credentials for Workload Identity Federation
      const credentialConfig = {
        type: 'external_account',
        audience: '//iam.googleapis.com/projects/1064795327786/locations/global/workloadIdentityPools/replit-storage-admin-workload/providers/replit-provider',
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
        token_url: 'https://sts.googleapis.com/v1/token',
        service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
        credential_source: {
          file: tokenPath,
          format: {
            type: 'text'
          }
        }
      };

      // Create auth client using the configuration
      const auth = new GoogleAuth({
        credentials: credentialConfig,
        scopes: ['https://www.googleapis.com/auth/devstorage.full_control']
      });

      // Get authenticated client
      const authClient = await auth.getClient();

      // Create Storage instance with the auth client
      const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
      if (!projectId) {
        throw new Error('GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT environment variable is required');
      }
      
      const storage = new Storage({
        projectId: projectId,
        authClient: authClient
      });

      console.log('✅ Google Cloud Storage client initialized with Workload Identity Federation');
      return storage;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to initialize Google Cloud Storage client:', errorMessage);
      
      // Re-throw with more context
      throw new Error(`Google Cloud Storage initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static reset(): void {
    this.instance = null;
    this.initPromise = null;
  }
}

// Export the singleton getter function
export const getGCSClient = () => GCSClient.getInstance();

// Export the class for testing purposes
export { GCSClient };