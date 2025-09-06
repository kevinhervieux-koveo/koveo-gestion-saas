import * as fs from 'fs';
import { GoogleGenAI } from '@google/genai';

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user

// This API key is from Gemini Developer API Key, not vertex AI API Key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

/**
 *
 */
export interface BillAnalysisResult {
  title: string;
  vendor: string;
  totalAmount: string;
  category: string;
  description?: string;
  dueDate?: string;
  issueDate?: string;
  billNumber?: string;
  confidence: number;
}

/**
 *
 */
export class GeminiBillAnalyzer {
  /**
   * Analyze a bill document using Gemini 2.5 Pro.
   * @param filePath
   * @param mimeType 
   */
  async analyzeBillDocument(filePath: string, mimeType?: string): Promise<BillAnalysisResult> {
    try {
      const fileBytes = fs.readFileSync(filePath);
      
      // Detect MIME type if not provided  
      const detectedMimeType = mimeType || this.detectMimeType(filePath);

      const systemPrompt = `You are an expert bill analysis AI. Analyze this bill/invoice document and extract key information.
      
      Extract the following information and respond with JSON in this exact format:
      {
        "title": "Brief descriptive title for this bill",
        "vendor": "Company or service provider name",
        "totalAmount": "Total amount as decimal string (e.g., '1234.56')",
        "category": "One of: insurance, maintenance, salary, utilities, cleaning, security, landscaping, professional_services, administration, repairs, supplies, taxes, technology, reserves, other",
        "description": "Brief description of services/products",
        "dueDate": "Due date in YYYY-MM-DD format if found",
        "issueDate": "Issue date in YYYY-MM-DD format if found", 
        "billNumber": "Bill/invoice number if found",
        "confidence": 0.85
      }
      
      Guidelines:
      - Use clear, concise titles (e.g., "Hydro-Québec Electricity Bill", "Property Insurance Premium")
      - Map categories intelligently (electricity = utilities, legal fees = professional_services, etc.)
      - Extract exact amounts without currency symbols
      - Confidence should reflect how clear the document is (0.0-1.0)
      - If information is unclear, use best guess but lower confidence
      
      **IMPORTANT: Your response MUST be a raw JSON object only, without any Markdown formatting, backticks, or explanatory text. Do not wrap the JSON in triple backticks or any other non-JSON characters.**`;

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              {
                inlineData: {
                  mimeType: detectedMimeType,
                  data: fileBytes.toString('base64')
                }
              }
            ]
          }
        ]
      });

      const rawJson = response.text;

      if (rawJson) {
        // Sanitize the response by removing markdown code blocks
        const sanitizedJson = this.sanitizeJsonResponse(rawJson);
        
        let analysis: BillAnalysisResult;
        
        try {
          analysis = JSON.parse(sanitizedJson);
        } catch (parseError) {
          console.error('JSON parsing failed for AI response:', parseError);
          throw new Error('Failed to parse AI response as JSON');
        }

        // Validate and sanitize the results
        analysis = this.sanitizeAndValidateAnalysis(analysis);

        return analysis;
      } else {
        throw new Error('Empty response from Gemini');
      }
    } catch (error: any) {
      console.error('Error analyzing bill document:', error);
      throw new Error(`Failed to analyze bill document: ${error}`);
    }
  }

  /**
   * Sanitize JSON response by removing markdown code blocks and whitespace.
   * @param rawResponse The raw response from the AI
   * @returns Clean JSON string
   */
  private sanitizeJsonResponse(rawResponse: string): string {
    if (!rawResponse) {
      return rawResponse;
    }

    // Remove markdown code blocks (```json and ```)
    let cleaned = rawResponse
      .replace(/```json\s*/gi, '') // Remove opening ```json with optional whitespace
      .replace(/```\s*$/g, '') // Remove closing ``` at end with optional whitespace
      .replace(/^```\s*/g, '') // Remove opening ``` at start with optional whitespace
      .trim(); // Remove leading/trailing whitespace

    return cleaned;
  }

  /**
   * Detect MIME type from file path.
   * @param filePath
   */
  private detectMimeType(filePath: string): string {
    const extension = filePath.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      default:
        // Default to PDF since that's what we're trying to support
        return 'application/pdf';
    }
  }

  /**
   * Comprehensive sanitization and validation of AI analysis results
   * Prevents XSS, SQL injection, and data integrity issues
   * @param analysis Raw analysis from AI
   * @returns Sanitized and validated analysis
   */
  private sanitizeAndValidateAnalysis(analysis: BillAnalysisResult): BillAnalysisResult {
    return {
      title: this.sanitizeString(analysis.title || ''),
      vendor: this.sanitizeString(analysis.vendor || ''),
      totalAmount: this.sanitizeAmount(analysis.totalAmount || '0'),
      category: this.validateCategory(analysis.category || 'other'),
      description: this.sanitizeString(analysis.description || ''),
      dueDate: this.validateDate(analysis.dueDate),
      issueDate: this.validateDate(analysis.issueDate),
      billNumber: this.sanitizeString(analysis.billNumber || ''),
      confidence: this.validateConfidence(analysis.confidence || 0)
    };
  }

  /**
   * Sanitize string fields to prevent XSS and SQL injection
   * @param input Raw string input
   * @returns Sanitized string
   */
  private sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      // Remove HTML tags and potential XSS
      .replace(/<[^>]*>/g, '')
      // Remove script tags specifically
      .replace(/javascript:/gi, '')
      // Remove SQL injection patterns
      .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi, '')
      // Remove potential command injection
      .replace(/[;&|`$(){}[\]]/g, '')
      // Limit length to prevent DoS
      .substring(0, 1000)
      .trim();
  }

  /**
   * Sanitize and validate amount string.
   * @param amount Raw amount string
   * @returns Validated amount in decimal format
   */
  private sanitizeAmount(amount: string): string {
    if (!amount || typeof amount !== 'string') {
      return '0.00';
    }

    // Remove dangerous characters and keep only numbers, dots, commas
    const cleaned = amount.replace(/[^0-9.,-]/g, '');
    
    // Handle comma as decimal separator (European format)
    const normalizedAmount = cleaned.replace(/,/g, '.');
    
    // Remove extra dots (keep only the last one as decimal separator)
    const parts = normalizedAmount.split('.');
    const sanitized = parts.length > 1 
      ? parts.slice(0, -1).join('') + '.' + parts[parts.length - 1]
      : parts[0];

    const parsed = parseFloat(sanitized);

    // Validate range and format
    if (isNaN(parsed) || parsed < 0 || parsed > 999999.99) {
      return '0.00';
    }

    return parsed.toFixed(2);
  }

  /**
   * Validate and sanitize category
   * @param category Raw category from AI
   * @returns Valid category or 'other'
   */
  private validateCategory(category: string): string {
    const validCategories = [
      'insurance', 'maintenance', 'salary', 'utilities', 'cleaning',
      'security', 'landscaping', 'professional_services', 'administration',
      'repairs', 'supplies', 'taxes', 'technology', 'reserves', 'other'
    ];

    const sanitized = this.sanitizeString(category).toLowerCase();
    return validCategories.includes(sanitized) ? sanitized : 'other';
  }

  /**
   * Validate date format
   * @param dateString Raw date string
   * @returns Valid ISO date string or undefined
   */
  private validateDate(dateString?: string): string | undefined {
    if (!dateString || typeof dateString !== 'string') {
      return undefined;
    }

    const sanitized = this.sanitizeString(dateString);
    const date = new Date(sanitized);
    
    // Check if date is valid and within reasonable range (not too far in past/future)
    const now = new Date();
    const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);
    const fiveYearsFromNow = new Date(now.getFullYear() + 5, 11, 31);

    if (isNaN(date.getTime()) || date < tenYearsAgo || date > fiveYearsFromNow) {
      return undefined;
    }

    return date.toISOString().split('T')[0];
  }

  /**
   * Validate confidence value
   * @param confidence Raw confidence value
   * @returns Clamped confidence between 0.0 and 1.0
   */
  private validateConfidence(confidence: number): number {
    if (typeof confidence !== 'number' || isNaN(confidence)) {
      return 0.0;
    }
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get suggested payment schedule based on bill type and amount.
   * @param category
   * @param amount
   */
  async suggestPaymentSchedule(
    category: string,
    amount: number
  ): Promise<{
    paymentType: 'unique' | 'recurrent';
    schedulePayment?: 'monthly' | 'quarterly' | 'yearly';
    reasoning: string;
  }> {
    try {
      const prompt = `Based on this bill category "${category}" and amount $${amount}, suggest the most appropriate payment schedule.
      
      Common patterns:
      - Utilities: Usually monthly recurring
      - Insurance: Usually yearly recurring  
      - Maintenance: Usually unique payments
      - Professional services: Usually unique payments
      - Supplies: Usually unique payments
      - Taxes: Usually yearly recurring
      
      Respond with JSON:
      {
        "paymentType": "unique" or "recurrent",
        "schedulePayment": "monthly", "quarterly", or "yearly" (only if recurrent),
        "reasoning": "Brief explanation of the recommendation"
      }`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              paymentType: { type: 'string', enum: ['unique', 'recurrent'] },
              schedulePayment: { type: 'string', enum: ['monthly', 'quarterly', 'yearly'] },
              reasoning: { type: 'string' },
            },
            required: ['paymentType', 'reasoning'],
          },
        },
        contents: prompt,
      });

      const result = JSON.parse(response.text || '{}');
      return result;
    } catch (error: any) {
      console.error('❌ Error suggesting payment schedule:', error);
      return {
        paymentType: 'unique',
        reasoning: 'Default to unique payment due to analysis error',
      };
    }
  }
}

export const geminiBillAnalyzer = new GeminiBillAnalyzer();
