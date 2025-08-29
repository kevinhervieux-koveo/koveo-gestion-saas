import { Storage } from '@google-cloud/storage';
import { GoogleAuth, JWT } from 'google-auth-library';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { ReplitOIDCExchange } from './replit-oidc-exchange.js';

/**
 * Google Cloud Storage Document Service
 * Uses custom OIDC token exchange for Replit + Google Cloud authentication
 */
export class GCSDocumentService {
  private storage: Storage | null = null;
  private bucketName: string;
  private oidcExchange: ReplitOIDCExchange;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    this.bucketName = process.env.GCS_BUCKET_NAME || '';
    
    console.log('🔧 GCS Service Constructor - Project ID:', projectId);
    console.log('🔧 GCS Service Constructor - Bucket Name:', this.bucketName);
    
    if (!projectId || !this.bucketName) {
      throw new Error('GOOGLE_CLOUD_PROJECT and GCS_BUCKET_NAME environment variables are required');
    }

    // Initialize OIDC exchange service
    this.oidcExchange = new ReplitOIDCExchange();
    
    // Initialize storage with basic config - authentication will be done dynamically
    this.storage = new Storage({ 
      projectId: projectId,
      // We'll authenticate using access tokens dynamically
    });

    console.log('✅ GCS Service initialized with OIDC token exchange');
  }

  /**
   * Get a valid access token (cached or fresh)
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    
    // Check if we have a cached token that's still valid (with 5-minute buffer)
    if (this.cachedToken && now < (this.tokenExpiry - 5 * 60 * 1000)) {
      console.log('🔄 Using cached access token');
      return this.cachedToken;
    }

    console.log('🔄 Getting fresh access token via OIDC exchange...');
    
    try {
      this.cachedToken = await this.oidcExchange.exchangeTokenForAccessToken();
      // Tokens typically expire in 1 hour, cache for 50 minutes
      this.tokenExpiry = now + (50 * 60 * 1000);
      
      console.log('✅ Fresh access token obtained');
      return this.cachedToken;
    } catch (error: any) {
      console.error('❌ Failed to get access token:', error.message);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Get an authenticated GCS bucket instance
   */
  private async getAuthenticatedBucket() {
    if (!this.storage) {
      throw new Error('Storage client not initialized');
    }

    const accessToken = await this.getAccessToken();
    
    // For GCS operations, we need to create a new client with the access token
    const authenticatedStorage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      authClient: {
        getAccessToken: () => ({ access_token: accessToken }),
      } as any,
    });

    return authenticatedStorage.bucket(this.bucketName);
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

      const bucket = await this.getAuthenticatedBucket();
      const fileName = path.basename(filePath);
      const destinationBlobName = `prod_org_${organizationId}/${fileName}`;
      
      console.log(`📤 Uploading file: ${filePath}`);
      console.log(`📤 Destination: ${destinationBlobName}`);
      console.log(`📤 Bucket: ${this.bucketName}`);
      
      // Upload the file
      await bucket.upload(filePath, {
        destination: destinationBlobName,
        metadata: {
          cacheControl: 'public, max-age=31536000', // 1 year cache
        },
      });

      console.log(`✅ File uploaded successfully to blob: ${destinationBlobName}`);
    } catch (error: any) {
      console.error('❌ Upload failed:', error);
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
      const bucket = await this.getAuthenticatedBucket();
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

      if (!process.env.REPL_IDENTITY) {
        throw new Error('Missing REPL_IDENTITY token for OIDC authentication');
      }

      console.log('🔄 Testing OIDC token exchange...');
      
      // Test OIDC configuration
      const configCheck = await this.oidcExchange.checkConfiguration();
      if (!configCheck) {
        throw new Error('OIDC configuration check failed');
      }

      // Test authentication by trying to access the bucket
      const bucket = await this.getAuthenticatedBucket();
      await bucket.getMetadata();
      
      console.log(`✅ Environment check passed: bucket ${this.bucketName} is accessible with OIDC authentication`);
      return true;
    } catch (error: any) {
      console.error('❌ Environment check failed:', error.message);
      return false;
    }
  }
}

// Export singleton instance
export const gcsDocumentService = new GCSDocumentService();