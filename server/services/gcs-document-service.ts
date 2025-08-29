import { Storage } from '@google-cloud/storage';
import { GoogleAuth } from 'google-auth-library';
import path from 'path';
import fs from 'fs';

/**
 * Google Cloud Storage Document Service
 * Uses Node.js Google Cloud SDK with Workload Identity Federation
 */
export class GCSDocumentService {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    this.bucketName = process.env.GCS_BUCKET_NAME || '';
    
    if (!projectId || !this.bucketName) {
      throw new Error('GOOGLE_CLOUD_PROJECT and GCS_BUCKET_NAME environment variables are required');
    }

    // Create external account credentials configuration for Replit Workload Identity Federation
    const externalAccountConfig = {
      type: 'external_account',
      audience: `//iam.googleapis.com/projects/${projectId}/locations/global/workloadIdentityPools/replit-wif-pool/providers/replit-wif-provider`,
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      token_url: 'https://sts.googleapis.com/v1/token',
      credential_source: {
        format: {
          type: 'json',
          subject_token_field_name: 'token'
        },
        url: `data:application/json,{"token":"${process.env.REPL_IDENTITY}"}`
      },
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`
    };

    // Initialize GoogleAuth with external account configuration
    const auth = new GoogleAuth({
      credentials: externalAccountConfig,
      scopes: ['https://www.googleapis.com/auth/devstorage.full_control']
    });

    // Initialize Google Cloud Storage with custom auth
    this.storage = new Storage({
      projectId: projectId,
      authClient: auth
    });
  }

  /**
   * Upload a document to Google Cloud Storage
   * @param organizationId - The organization ID for file organization
   * @param filePath - Local path to the file to upload
   * @returns Promise<void>
   */
  async uploadDocument(organizationId: string, filePath: string): Promise<void> {
    try {
      // Verify file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const bucket = this.storage.bucket(this.bucketName);
      const fileName = path.basename(filePath);
      const destinationBlobName = `prod_org_${organizationId}/${fileName}`;
      
      // Upload the file
      await bucket.upload(filePath, {
        destination: destinationBlobName,
        metadata: {
          cacheControl: 'public, max-age=31536000', // 1 year cache
        },
      });

      console.log(`File uploaded successfully to blob: ${destinationBlobName}`);
    } catch (error: any) {
      throw new Error(`Failed to upload document: ${error.message}`);
    }
  }

  /**
   * Generate a secure signed URL for document access
   * @param organizationId - The organization ID for file organization
   * @param fileName - The name of the file to generate URL for
   * @returns Promise<string> - The signed URL
   */
  async getDocumentUrl(organizationId: string, fileName: string): Promise<string> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const blobName = `prod_org_${organizationId}/${fileName}`;
      const file = bucket.file(blobName);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`File not found: ${blobName}`);
      }

      // Generate signed URL (15 minutes expiration)
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      });

      return signedUrl;
    } catch (error: any) {
      throw new Error(`Failed to generate document URL: ${error.message}`);
    }
  }

  /**
   * Check if the required environment variables are set
   * @returns Promise<boolean>
   */
  async checkEnvironment(): Promise<boolean> {
    try {
      if (!process.env.GOOGLE_CLOUD_PROJECT || !process.env.GCS_BUCKET_NAME) {
        throw new Error('Missing required environment variables: GOOGLE_CLOUD_PROJECT, GCS_BUCKET_NAME');
      }

      // Test authentication by trying to access the bucket
      const bucket = this.storage.bucket(this.bucketName);
      await bucket.getMetadata();
      
      console.log('✅ Google Cloud Storage environment check passed');
      return true;
    } catch (error: any) {
      console.error('❌ Environment check failed:', error.message);
      return false;
    }
  }
}

// Export singleton instance
export const gcsDocumentService = new GCSDocumentService();