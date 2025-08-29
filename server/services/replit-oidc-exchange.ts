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
      
      // Create dynamic configuration using the OIDC token from REPLIT_ID_TOKEN_PATH
      const oidcTokenPath = process.env.REPLIT_ID_TOKEN_PATH;
      if (!oidcTokenPath) {
        throw new Error('REPLIT_ID_TOKEN_PATH environment variable not found');
      }

      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({
        scopes: [
          'https://www.googleapis.com/auth/devstorage.full_control',
          'https://www.googleapis.com/auth/cloud-platform'
        ],
        projectId: this.projectId,
        // Use external account credentials with dynamic token path
        credentials: {
          type: 'external_account',
          audience: this.audience,
          subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
          token_url: 'https://sts.googleapis.com/v1/token',
          service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${this.serviceAccountEmail}:generateAccessToken`,
          credential_source: {
            file: oidcTokenPath,
            format: {
              type: 'text'
            }
          }
        }
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
      const oidcTokenPath = process.env.REPLIT_ID_TOKEN_PATH;

      console.log('🔧 Configuration Check:');
      console.log('  - GOOGLE_CLOUD_PROJECT present:', !!projectId);
      console.log('  - REPLIT_ID_TOKEN_PATH present:', !!oidcTokenPath);

      if (!projectId || !oidcTokenPath) {
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