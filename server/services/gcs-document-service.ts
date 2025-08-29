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
          // It's a file path - check if it's WIF or service account
          console.log('🔧 Found credentials file path:', credentials);
          
          try {
            // Read the file to determine its type
            const credFileContent = fs.readFileSync(credentials, 'utf8');
            const credFileObj = JSON.parse(credFileContent);
            
            if (credFileObj.type === 'external_account') {
              console.log('🔧 Detected Workload Identity Federation config');
              console.log('🔄 WIF detected - Google Cloud SDK will use GOOGLE_APPLICATION_CREDENTIALS env var directly');
              // Don't set keyFilename for WIF - let the SDK handle it via environment variable
            } else if (credFileObj.type === 'service_account') {
              console.log('🔧 Detected service account key file');
              storageConfig.keyFilename = credentials;
              console.log('✅ Using service account key file:', credentials);
            } else {
              console.warn('⚠️ Unknown credential file type:', credFileObj.type);
              // Fall back to letting SDK handle it
            }
          } catch (fileError) {
            console.warn('⚠️ Could not read/parse credentials file:', fileError.message);
            console.log('🔄 Letting Google Cloud SDK handle credentials directly');
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