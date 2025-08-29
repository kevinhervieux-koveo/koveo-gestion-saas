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
   * Exchange Replit PASETO token for Google Cloud access token
   * Uses the external identity token exchange flow
   */
  async exchangeTokenForAccessToken(): Promise<string> {
    try {
      const replitToken = process.env.REPL_IDENTITY;
      if (!replitToken) {
        throw new Error('REPL_IDENTITY token not found in environment');
      }

      console.log('🔄 Starting token exchange process...');
      console.log('🔄 Replit token length:', replitToken.length);
      console.log('🔄 Token preview:', replitToken.substring(0, 50) + '...');

      // Step 1: Exchange external token for federated token
      const stsRequest = {
        audience: this.audience,
        grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        subjectToken: replitToken,
        subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt', // Try treating PASETO as JWT
      };

      console.log('🔄 Attempting direct STS token exchange...');
      
      const stsResponse = await axios.post(this.stsUrl, stsRequest, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      });

      const federatedToken = stsResponse.data.access_token;
      console.log('✅ Successfully obtained federated token');

      // Step 2: Impersonate service account to get final access token
      console.log('🔄 Impersonating service account...');
      
      const impersonateUrl = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${this.serviceAccountEmail}:generateAccessToken`;
      
      const impersonateRequest = {
        scope: [
          'https://www.googleapis.com/auth/devstorage.full_control',
          'https://www.googleapis.com/auth/cloud-platform'
        ],
        lifetime: '3600s'
      };

      const impersonateResponse = await axios.post(impersonateUrl, impersonateRequest, {
        headers: {
          'Authorization': `Bearer ${federatedToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      const finalAccessToken = impersonateResponse.data.accessToken;
      console.log('✅ Successfully obtained service account access token');
      console.log('🔄 Token expires at:', impersonateResponse.data.expireTime);

      return finalAccessToken;

    } catch (error: any) {
      console.error('❌ Token exchange failed:', error.message);
      
      if (error.response?.data) {
        console.error('❌ API Error Details:', JSON.stringify(error.response.data, null, 2));
      }
      
      // Try alternative approach: direct service account impersonation
      return await this.tryDirectServiceAccountAuth();
    }
  }

  /**
   * Alternative approach: Try direct service account authentication
   * This bypasses the token exchange and uses application default credentials
   */
  private async tryDirectServiceAccountAuth(): Promise<string> {
    try {
      console.log('🔄 Attempting alternative: direct service account authentication...');
      
      // Use Google Auth Library for application default credentials
      const { GoogleAuth } = await import('google-auth-library');
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
        console.log('✅ Successfully obtained access token via Google Auth Library');
        return accessToken.token;
      }

      throw new Error('No access token received from Google Auth Library');

    } catch (error: any) {
      console.error('❌ Direct service account auth also failed:', error.message);
      throw new Error(`All authentication methods failed: ${error.message}`);
    }
  }

  /**
   * Check if the exchange service is properly configured
   */
  async checkConfiguration(): Promise<boolean> {
    try {
      const replitToken = process.env.REPL_IDENTITY;
      const projectId = process.env.GOOGLE_CLOUD_PROJECT;
      const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

      console.log('🔧 Configuration Check:');
      console.log('  - REPL_IDENTITY present:', !!replitToken);
      console.log('  - GOOGLE_CLOUD_PROJECT present:', !!projectId);
      console.log('  - GOOGLE_APPLICATION_CREDENTIALS present:', !!credentials);

      if (!replitToken || !projectId) {
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