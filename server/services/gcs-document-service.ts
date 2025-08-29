import { Storage } from '@google-cloud/storage';
import { GoogleAuth, JWT } from 'google-auth-library';
import path from 'path';
import fs from 'fs';
import os from 'os';

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
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    console.log('🔧 GCS Service Constructor - Project ID:', projectId);
    console.log('🔧 GCS Service Constructor - Bucket Name:', this.bucketName);
    console.log('🔧 GCS Service Constructor - Credentials present:', !!credentials);
    console.log('🔧 GCS Service Constructor - Credentials length:', credentials?.length || 0);
    console.log('🔧 GCS Service Constructor - Credentials preview:', credentials?.substring(0, 50) + '...');
    
    if (!projectId || !this.bucketName) {
      throw new Error('GOOGLE_CLOUD_PROJECT and GCS_BUCKET_NAME environment variables are required');
    }

    // Initialize Google Cloud Storage
    const storageConfig: any = {
      projectId: projectId
    };

    // Handle GOOGLE_APPLICATION_CREDENTIALS properly
    if (credentials) {
      try {
        // Check if it's a JSON string (starts with '{') or a file path
        if (credentials.trim().startsWith('{')) {
          // It's a JSON string - parse it for service account credentials
          const credentialsObj = JSON.parse(credentials.trim());
          console.log('🔧 Parsed credentials type:', credentialsObj.type);
          
          if (credentialsObj.type === 'service_account' && credentialsObj.private_key && credentialsObj.client_email) {
            storageConfig.credentials = credentialsObj;
            console.log('✅ Using parsed service account credentials for', credentialsObj.client_email);
          } else {
            console.warn('⚠️ Invalid service account JSON format, falling back to default auth');
          }
        } else {
          // It's a file path - try to read and validate the file
          console.log('🔧 Found credentials file path:', credentials);
          
          // WIF may not work properly in this environment, check for alternative
          // If we have service account credentials as backup, use those instead
          const serviceAccountCreds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
          if (serviceAccountCreds) {
            console.log('🔄 WIF file detected but using service account JSON instead for reliability');
            try {
              const serviceCredentialsObj = JSON.parse(serviceAccountCreds);
              if (serviceCredentialsObj.type === 'service_account') {
                storageConfig.credentials = serviceCredentialsObj;
                console.log('✅ Using service account credentials from GOOGLE_SERVICE_ACCOUNT_JSON');
              }
            } catch (e) {
              console.warn('⚠️ Could not parse GOOGLE_SERVICE_ACCOUNT_JSON, falling back to keyFilename');
              storageConfig.keyFilename = credentials;
            }
          } else {
            storageConfig.keyFilename = credentials;
            console.log('✅ Using credentials file path:', credentials);
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not process GOOGLE_APPLICATION_CREDENTIALS:', error.message);
        console.log('🔄 Falling back to environment-based authentication');
      }
    } else {
      console.log('ℹ️ No credentials provided, using default authentication');
    }

    console.log('🔧 Final storage config:', JSON.stringify(storageConfig, null, 2));
    
    // Initialize Google Cloud Storage
    this.storage = new Storage(storageConfig);
    console.log('✅ Google Cloud Storage client initialized');
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