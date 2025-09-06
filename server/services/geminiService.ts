import { GoogleGenerativeAI } from '@google/genai';
import { AiExtractionResponse } from '@shared/schema';

/**
 * Gemini AI service for invoice data extraction.
 * Handles secure file processing and structured data extraction from invoice documents.
 */
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  }

  /**
   * Extract invoice data from uploaded file using Gemini Pro Vision.
   * 
   * @param fileBuffer - The uploaded file buffer
   * @param mimeType - MIME type of the uploaded file
   * @returns Promise<AiExtractionResponse> - Structured invoice data
   */
  async extractInvoiceData(fileBuffer: Buffer, mimeType: string): Promise<AiExtractionResponse> {
    try {
      // Validate file type
      const supportedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif'
      ];

      if (!supportedTypes.includes(mimeType)) {
        throw new Error(`Unsupported file type: ${mimeType}. Supported types: ${supportedTypes.join(', ')}`);
      }

      // Convert buffer to base64 for Gemini API
      const base64Data = fileBuffer.toString('base64');
      
      // Prepare the image part for Gemini
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      };

      // Enhanced prompt for invoice data extraction as specified in requirements
      const prompt = `You are an intelligent accounting assistant for Koveo Gestion, a property management SaaS. Your task is to accurately extract information from the provided invoice document and return a single, minified JSON object with no additional text, explanations, or markdown.

Follow these steps in order:
1. First, analyze the document to determine the payment structure. Set the 'paymentType' field to either "one-time" or "recurring". This is the most critical step.
2. Extract the following primary fields and format them exactly as specified:
  - 'vendorName': string
  - 'invoiceNumber': string
  - 'totalAmount': number (use a floating-point number, no currency symbols)
  - 'dueDate': string (format as "YYYY-MM-DD")
3. If 'paymentType' is "recurring", determine the frequency.
  - If it is a standard period, set 'frequency' to one of: "monthly", "quarterly", or "annually" and extract the 'startDate' (format "YYYY-MM-DD").
  - If you identify a list of specific, non-standard payment dates, set 'frequency' to "custom".
4. If, and only if, 'frequency' is "custom", extract all individual payment dates into a 'customPaymentDates' array of strings, each formatted as "YYYY-MM-DD".
5. If any field cannot be found, its value must be null.

Your final output must be only the JSON object.
Example for a custom frequency: {"vendorName":"Hydro Quebec","invoiceNumber":"HQ-123","totalAmount":450.75,"dueDate":"2025-10-15","paymentType":"recurring","frequency":"custom","startDate":null,"customPaymentDates":["2025-10-15", "2025-11-15", "2026-01-15"]}`;

      // Generate content with image and prompt
      const result = await this.model.generateContent([prompt, imagePart]);
      
      // Get the response text
      const responseText = result.response.text();
      
      // Log raw response for debugging
      console.log('[GEMINI] Raw response:', responseText);
      
      // Clean the response - remove any markdown formatting or extra text
      let cleanedResponse = responseText.trim();
      
      // Remove code block markers if present
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Try to find JSON object in the response
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      // Parse JSON response
      let extractedData: any;
      try {
        extractedData = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('[GEMINI] JSON parse error:', parseError);
        console.error('[GEMINI] Cleaned response:', cleanedResponse);
        throw new Error(`Failed to parse AI response as JSON: ${parseError}`);
      }
      
      // Validate and structure the response
      const validatedData: AiExtractionResponse = {
        vendorName: extractedData.vendorName || null,
        invoiceNumber: extractedData.invoiceNumber || null,
        totalAmount: typeof extractedData.totalAmount === 'number' ? extractedData.totalAmount : null,
        dueDate: extractedData.dueDate || null,
        paymentType: extractedData.paymentType === 'one-time' || extractedData.paymentType === 'recurring' 
          ? extractedData.paymentType : null,
        frequency: extractedData.frequency && ['monthly', 'quarterly', 'annually', 'custom'].includes(extractedData.frequency)
          ? extractedData.frequency : null,
        startDate: extractedData.startDate || null,
        customPaymentDates: Array.isArray(extractedData.customPaymentDates) 
          ? extractedData.customPaymentDates : null,
      };
      
      console.log('[GEMINI] Validated extraction:', validatedData);
      return validatedData;
      
    } catch (error) {
      console.error('[GEMINI] Invoice extraction error:', error);
      
      // Return null response in case of extraction failure
      return {
        vendorName: null,
        invoiceNumber: null,
        totalAmount: null,
        dueDate: null,
        paymentType: null,
        frequency: null,
        startDate: null,
        customPaymentDates: null,
      };
    }
  }

  /**
   * Calculate confidence score based on how many fields were successfully extracted.
   * 
   * @param extractionData - The AI extraction response
   * @returns number - Confidence score between 0 and 1
   */
  calculateConfidenceScore(extractionData: AiExtractionResponse): number {
    const coreFields = ['vendorName', 'invoiceNumber', 'totalAmount', 'dueDate', 'paymentType'];
    const extractedCoreFields = coreFields.filter(field => extractionData[field as keyof AiExtractionResponse] !== null);
    
    let baseScore = extractedCoreFields.length / coreFields.length;
    
    // Bonus for having consistent recurring payment data
    if (extractionData.paymentType === 'recurring' && extractionData.frequency) {
      if (extractionData.frequency === 'custom' && extractionData.customPaymentDates) {
        baseScore += 0.1; // Bonus for custom dates
      } else if (extractionData.frequency !== 'custom' && extractionData.startDate) {
        baseScore += 0.1; // Bonus for standard frequency with start date
      }
    }
    
    // Cap at 1.0
    return Math.min(baseScore, 1.0);
  }

  /**
   * Validate that the API key is properly configured.
   * 
   * @returns Promise<boolean> - True if API key is valid
   */
  async validateApiKey(): Promise<boolean> {
    try {
      // Make a simple test call to validate the API key
      const testModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      await testModel.generateContent('Test');
      return true;
    } catch (error) {
      console.error('[GEMINI] API key validation failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const geminiService = new GeminiService();