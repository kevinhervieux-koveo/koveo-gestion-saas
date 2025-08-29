import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Google Cloud Storage Document Service
 * Interfaces with Python functions for document upload and URL generation
 */
export class GCSDocumentService {
  private pythonScriptPath: string;

  constructor() {
    // Path to the Python script relative to the server directory
    this.pythonScriptPath = path.join(process.cwd(), 'upload_secure_document.py');
  }

  /**
   * Upload a document to Google Cloud Storage
   * @param organizationId - The organization ID for file organization
   * @param filePath - Local path to the file to upload
   * @returns Promise<void>
   */
  async uploadDocument(organizationId: string, filePath: string): Promise<void> {
    try {
      const command = `python3 -c "
from upload_secure_document import upload_secure_document
upload_secure_document('${organizationId}', '${filePath}')
"`;
      
      await execAsync(command);
    } catch (error) {
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
      const command = `python3 -c "
from upload_secure_document import get_secure_document_url
print(get_secure_document_url('${organizationId}', '${fileName}'))
"`;
      
      const { stdout } = await execAsync(command);
      return stdout.trim();
    } catch (error) {
      throw new Error(`Failed to generate document URL: ${error.message}`);
    }
  }

  /**
   * Check if the required environment variables are set
   * @returns Promise<boolean>
   */
  async checkEnvironment(): Promise<boolean> {
    try {
      const command = `python3 -c "
import os
bucket_name = os.getenv('GCS_BUCKET_NAME')
if not bucket_name:
    raise ValueError('GCS_BUCKET_NAME not set')
print('Environment OK')
"`;
      
      await execAsync(command);
      return true;
    } catch (error) {
      console.error('GCS Environment check failed:', error.message);
      return false;
    }
  }
}

// Export singleton instance
export const gcsDocumentService = new GCSDocumentService();