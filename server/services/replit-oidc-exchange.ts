import axios from 'axios';

/**
 * Custom OIDC Token Exchange Service for Replit + Google Cloud
 * 
 * This service handles the conversion between Replit's PASETO tokens
 * and Google Cloud access tokens using the STS (Security Token Service) API
 */
export class ReplitOIDCExchange {
  private stsUrl = 'https://sts.googleapis.com/v1/token';
  private projectId: string;
  private audience: string;
  private serviceAccountEmail: string;
  
  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || '';
    this.audience = `//iam.googleapis.com/projects/${this.projectId}/locations/global/workloadIdentityPools/replit-storage-admin-workload/providers/replit-provider`;
    this.serviceAccountEmail = 'replit-storage-admin@koveo-gestion.iam.gserviceaccount.com';
    
    console.log('🔧 OIDC Exchange initialized');
    console.log('🔧 Project ID:', this.projectId);
    console.log('🔧 Audience:', this.audience);
  }

  /**
   * Exchange OIDC identity token for Google Cloud access token
   * Uses Google Auth Library with Workload Identity Federation
   */
  async exchangeTokenForAccessToken(): Promise<string> {
    try {
      console.log('🔄 Starting token exchange process using google-auth-library...');
      
      // Get the OIDC token from REPL_IDENTITY environment variable
      const replitToken = process.env.REPL_IDENTITY;
      if (!replitToken) {
        throw new Error('REPL_IDENTITY environment variable not found');
      }

      // Write the token to the expected file path for gcp-wif-config.json
      const tokenFilePath = '/tmp/repl-identity-token';
      const fs = await import('fs');
      fs.writeFileSync(tokenFilePath, replitToken, 'utf8');

      console.log('🔄 Written OIDC token to file for Google Auth Library');

      // Try Application Default Credentials first, then fall back to manual token exchange
      const { GoogleAuth } = await import('google-auth-library');
      
      // First attempt: Use Application Default Credentials
      try {
        const auth = new GoogleAuth({
          scopes: [
            'https://www.googleapis.com/auth/devstorage.full_control',
            'https://www.googleapis.com/auth/cloud-platform'
          ],
          projectId: this.projectId,
        });
        
        const authClient = await auth.getClient();
        const accessToken = await authClient.getAccessToken();
        
        if (accessToken.token) {
          console.log('✅ Successfully obtained access token via Application Default Credentials');
          return accessToken.token;
        }
      } catch (adcError) {
        console.log('🔄 ADC failed, trying service account impersonation...');
      }
      
      // Second attempt: Direct service account impersonation using raw HTTP
      const axios = await import('axios');
      
      // Try to use the metadata service if available
      try {
        const metadataResponse = await axios.default.get(
          'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
          {
            headers: { 'Metadata-Flavor': 'Google' },
            timeout: 5000
          }
        );
        
        if (metadataResponse.data.access_token) {
          console.log('✅ Successfully obtained access token via metadata service');
          return metadataResponse.data.access_token;
        }
      } catch (metadataError) {
        console.log('🔄 Metadata service not available, trying WIF with PASETO...');
      }
      
      // Third attempt: Try with Workload Identity Federation (might work despite token format)
      const auth = new GoogleAuth({
        scopes: [
          'https://www.googleapis.com/auth/devstorage.full_control',
          'https://www.googleapis.com/auth/cloud-platform'
        ],
        projectId: this.projectId,
        keyFilename: './gcp-wif-config.json'
      });

      const authClient = await auth.getClient();
      const accessToken = await authClient.getAccessToken();

      if (accessToken.token) {
        console.log('✅ Successfully obtained access token via Google Auth Library with Workload Identity Federation');
        return accessToken.token;
      }

      throw new Error('No access token received from Google Auth Library');

    } catch (error: any) {
      console.error('❌ Token exchange failed:', error.message);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }


  /**
   * Check if the exchange service is properly configured
   */
  async checkConfiguration(): Promise<boolean> {
    try {
      const projectId = process.env.GOOGLE_CLOUD_PROJECT;
      const replitToken = process.env.REPL_IDENTITY;

      console.log('🔧 Configuration Check:');
      console.log('  - GOOGLE_CLOUD_PROJECT present:', !!projectId);
      console.log('  - REPL_IDENTITY present:', !!replitToken);

      if (!projectId || !replitToken) {
        console.log('❌ Missing required environment variables');
        return false;
      }

      // Try to get an access token
      await this.exchangeTokenForAccessToken();
      console.log('✅ Configuration check passed');
      return true;

    } catch (error: any) {
      console.error('❌ Configuration check failed:', error.message);
      return false;
    }
  }
}