/**
 * Consolidated AI Service
 * 
 * Consolidates all AI-related services into a single, optimized service:
 * - Feature analysis using Gemini AI
 * - Bill analysis and document processing
 * - Invoice data extraction
 * - Document understanding and structured data extraction
 * 
 * Replaces:
 * - gemini-analysis.ts
 * - gemini-bill-analyzer.ts
 * - geminiService.ts
 */

import { GoogleGenAI } from '@google/genai';
import { BaseService } from './_base/base-service';
import type { Feature, ActionableItem, AiExtractionResponse } from '@shared/schema';

// Shared interfaces for AI operations
interface AnalysisResult {
  summary: string;
  actionableItems: Array<{
    title: string;
    description: string;
    technicalDetails: string;
    implementationPrompt: string;
    testingRequirements: string;
    estimatedEffort: string;
    dependencies?: string[];
  }>;
  recommendations: string[];
  estimatedTotalEffort: string;
}

interface BillAnalysisResult {
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

export class ConsolidatedAIService extends BaseService {
  private _genAI: GoogleGenAI | null = null;

  constructor() {
    super('ConsolidatedAIService');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn(
        '[ConsolidatedAIService] GEMINI_API_KEY is not set — AI features are disabled. ' +
          'Set the GEMINI_API_KEY secret to enable Gemini-powered features.',
      );
      return;
    }

    this._genAI = new GoogleGenAI({ apiKey });
  }

  private get genAI(): GoogleGenAI {
    if (!this._genAI) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    return this._genAI;
  }

  // ====================
  // FEATURE ANALYSIS
  // ====================

  /**
   * Analyze a feature request using Gemini AI to generate implementation plan
   */
  async analyzeFeatureWithGemini(
    feature: Feature,
    documentationContext: string
  ): Promise<AnalysisResult> {
    return this.executeWithErrorHandling('analyzeFeatureWithGemini', async () => {
      const prompt = this.buildFeatureAnalysisPrompt(feature, documentationContext);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'object',
                properties: {
                  summary: { type: 'string' },
                  actionableItems: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        technicalDetails: { type: 'string' },
                        implementationPrompt: { type: 'string' },
                        testingRequirements: { type: 'string' },
                        estimatedEffort: { type: 'string' },
                        dependencies: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                      required: [
                        'title',
                        'description',
                        'technicalDetails',
                        'implementationPrompt',
                        'testingRequirements',
                        'estimatedEffort',
                      ],
                    },
                  },
                  recommendations: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  estimatedTotalEffort: { type: 'string' },
                },
                required: ['summary', 'actionableItems', 'recommendations', 'estimatedTotalEffort'],
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates[0] && result.candidates[0].content) {
        const text = result.candidates[0].content.parts[0].text;
        const analysis: AnalysisResult = typeof text === 'string' ? JSON.parse(text) : text;

        // Validate that we have multiple actionable items as required
        if (!analysis.actionableItems || analysis.actionableItems.length < 2) {
          throw new Error(
            `AI analysis failed to generate multiple actionable items. Expected 3-8 items, got ${analysis.actionableItems?.length || 0}. Please try again.`
          );
        }

        console.log(`✅ AI analysis generated ${analysis.actionableItems.length} actionable items successfully`);
        return analysis;
      } else {
        throw new Error('Invalid response from Gemini');
      }
    });
  }

  /**
   * Transform AI-generated actionable items into database-ready format
   */
  formatActionableItemsForDatabase(
    featureId: string,
    analysisResult: AnalysisResult
  ): Omit<ActionableItem, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>[] {
    return analysisResult.actionableItems.map((item, index) => ({
      featureId,
      title: item.title,
      description: item.description,
      technicalDetails: item.technicalDetails,
      implementationPrompt: item.implementationPrompt,
      testingRequirements: item.testingRequirements,
      estimatedEffort: item.estimatedEffort,
      dependencies: item.dependencies || [],
      status: 'pending' as const,
      orderIndex: index,
      acceptanceCriteria: '',
      implementation_notes: '',
      startedAt: null
    }));
  }

  /**
   * Get comprehensive system documentation context for AI analysis
   */
  async getDocumentationContext(): Promise<string> {
    return `
Koveo Gestion is a comprehensive property management platform for Quebec residential communities.

Tech Stack:
- Frontend: React 18 with TypeScript, Vite, shadcn/ui components, Tailwind CSS
- Backend: Express.js with TypeScript, RESTful API
- Database: PostgreSQL with Drizzle ORM
- Authentication: Express sessions with PostgreSQL session store
- Validation: Zod schemas for runtime type validation
- State Management: TanStack Query for server state, React Hook Form for forms

Key Patterns:
- Monorepo structure with shared types between frontend and backend
- Type-safe database operations with Drizzle ORM
- Comprehensive validation with Zod schemas
- Internationalization supporting French and English
- Role-based access control (admin, manager, owner, tenant)

Database Schema includes:
- Users, Organizations, Buildings, Residences
- Bills, Maintenance Requests, Budgets
- Documents, Notifications
- Features and Actionable Items for roadmap management

API Structure:
- RESTful endpoints under /api/
- Consistent error handling and status codes
- Request validation with Zod
- Response typing with TypeScript

UI Components:
- Shadcn/ui component library
- Responsive design with Tailwind CSS
- Dark mode support
- Accessibility compliance (WCAG 2.1 AA)

Security Considerations:
- Quebec Law 25 compliance required
- Secure authentication with bcrypt password hashing
- Session management with secure cookies
- Input validation and sanitization
- Role-based access control

Testing Requirements:
- Unit tests with Jest
- Integration tests for API endpoints
- Component testing with React Testing Library
- 90% code coverage target
`;
  }

  private buildFeatureAnalysisPrompt(feature: Feature, documentationContext: string): string {
    return `You are an expert software architect analyzing a feature request for the Koveo Gestion property management system.

# Context
${documentationContext}

# Feature Details
Name: ${feature.name}
Description: ${feature.description}
Category: ${feature.category}
Priority: ${feature.priority}

Business Objective: ${feature.businessObjective || 'Not specified'}
Target Users: ${feature.targetUsers || 'Not specified'}
Success Metrics: ${feature.successMetrics || 'Not specified'}
Technical Complexity: ${feature.technicalComplexity || 'Not specified'}
Dependencies: ${feature.dependencies || 'None specified'}
User Flow: ${feature.userFlow || 'Not specified'}

# Task
Analyze this feature and create a comprehensive implementation plan. Break it down into specific, actionable items that can be implemented by a developer or AI assistant.

# Output Format
Provide your response in the following JSON format:
{
  "summary": "Brief summary of the feature and its implementation approach",
  "actionableItems": [
    {
      "title": "1. Clear, specific title for the action item (include step number)",
      "description": "Detailed description of what needs to be done",
      "technicalDetails": "Technical implementation details, including specific files, components, and patterns to use",
      "implementationPrompt": "A detailed prompt that could be given to an AI assistant to implement this specific item",
      "testingRequirements": "Specific tests that should be written or performed",
      "estimatedEffort": "Estimated time to complete (e.g., '2 hours', '1 day', '3 days')",
      "dependencies": ["List of other actionable item titles this depends on, if any"]
    }
  ],
  "recommendations": ["List of recommendations or considerations for implementation"],
  "estimatedTotalEffort": "Total estimated effort for all items combined"
}

# Guidelines for Actionable Items:
1. **IMPORTANT**: Create MULTIPLE actionable items (typically 3-8 items) that break down the feature into distinct, manageable tasks
2. **NUMBER ALL TITLES**: Each actionable item title must start with a number (e.g., "1. Create database schema", "2. Build API endpoints", "3. Add UI components")
3. Each item should be independently implementable (except for explicit dependencies)
4. Include specific technical details about the Koveo Gestion architecture (React, Express, PostgreSQL, Drizzle ORM)
5. Reference existing patterns and components from the codebase
6. **Implementation prompts must be complete, standalone prompts** that a Replit AI agent can execute directly without needing additional context
7. Each implementation prompt should:
   - Start with a clear objective (e.g., "Add SSL certificate management table to the database schema")
   - Include specific file paths to modify or create
   - Reference existing patterns in the codebase
   - Include validation requirements
   - Specify exact TypeScript types and Zod schemas needed
8. Testing requirements should include unit tests, integration tests, and manual testing steps
9. Order items logically, with database changes first, then backend, then frontend
10. Consider security, performance, and maintainability in every item
11. Follow Quebec-specific requirements and Law 25 compliance where relevant

Generate a comprehensive analysis with MULTIPLE numbered actionable items for this feature. Each actionable item should be a distinct task with its own implementation prompt.`;
  }

  // ====================
  // BILL ANALYSIS
  // ====================

  /**
   * Analyze a bill document using Gemini Pro Vision
   */
  async analyzeBillDocument(filePath: string, mimeType?: string): Promise<BillAnalysisResult> {
    return this.executeWithErrorHandling('analyzeBillDocument', async () => {
      const fs = await import('fs');
      const fileBytes = fs.readFileSync(filePath);
      
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

      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
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
    });
  }

  /**
   * Suggest payment schedule based on bill type and amount
   */
  async suggestPaymentSchedule(
    category: string,
    amount: number
  ): Promise<{
    paymentType: 'unique' | 'recurrent';
    schedulePayment?: 'monthly' | 'quarterly' | 'yearly';
    reasoning: string;
  }> {
    return this.executeWithErrorHandling('suggestPaymentSchedule', async () => {
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

      const response = await this.genAI.models.generateContent({
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
    });
  }

  // ====================
  // INVOICE DATA EXTRACTION
  // ====================

  /**
   * Extract invoice data from uploaded file using Gemini Pro Vision
   */
  async extractInvoiceData(fileBuffer: Buffer, mimeType: string): Promise<AiExtractionResponse> {
    return this.executeWithErrorHandling('extractInvoiceData', async () => {
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
      
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      };

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

      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            imagePart
          ]
        }]
      });
      
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Clean the response
      let cleanedResponse = responseText.trim();
      
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      let extractedData: any;
      try {
        extractedData = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('[GEMINI] JSON parse error:', parseError);
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
    });
  }

  /**
   * Extract bill data from uploaded file (specialized for bills/receipts)
   */
  async extractBillData(fileBuffer: Buffer, mimeType: string): Promise<any> {
    return this.executeWithErrorHandling('extractBillData', async () => {
      // Similar implementation to extractInvoiceData but specialized for bills
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

      const base64Data = fileBuffer.toString('base64');
      
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      };

      const prompt = `You are an intelligent accounting assistant for Koveo Gestion, a property management SaaS. Your task is to accurately extract information from the provided bill or receipt document and return a single, minified JSON object with no additional text, explanations, or markdown.

Follow these steps in order:
1. First, analyze the document to determine the payment structure. Set the 'paymentType' field to either "one-time" or "recurring". This is the most critical step.
2. Extract the following primary fields and format them exactly as specified:
  - 'vendorName': string (company/vendor name)
  - 'description': string (what the bill is for)
  - 'totalAmount': number (use a floating-point number, no currency symbols)
  - 'dueDate': string (format as "YYYY-MM-DD")
3. If 'paymentType' is "recurring", determine the frequency.
  - If it is a standard period, set 'frequency' to one of: "monthly", "quarterly", or "annually" and extract the 'startDate' (format "YYYY-MM-DD").
  - If you identify a list of specific, non-standard payment dates, set 'frequency' to "custom".
4. If, and only if, 'frequency' is "custom", extract all individual payment dates into a 'customPaymentDates' array of strings, each formatted as "YYYY-MM-DD".
5. Try to determine the bill category based on the vendor/service type and set 'category' to one of: "insurance", "maintenance", "salary", "utilities", "cleaning", "security", "landscaping", "professional_services", "administration", "repairs", "supplies", "taxes", "technology", "reserves", "other"
6. If any field cannot be found, its value must be null.

Your final output must be only the JSON object.
Example for utilities: {"vendorName":"Hydro Quebec","description":"Monthly electricity bill","totalAmount":127.45,"dueDate":"2025-01-15","paymentType":"recurring","frequency":"monthly","startDate":"2025-01-15","customPaymentDates":null,"category":"utilities"}
Example for one-time: {"vendorName":"ABC Repairs","description":"Emergency plumbing repair","totalAmount":350.00,"dueDate":"2025-01-30","paymentType":"one-time","frequency":null,"startDate":null,"customPaymentDates":null,"category":"repairs"}`;

      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            imagePart
          ]
        }]
      });
      
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Clean and parse response
      let cleanedResponse = responseText.trim();
      
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      let extractedData: any;
      try {
        extractedData = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('[GEMINI BILL] JSON parse error:', parseError);
        throw new Error(`Failed to parse AI response as JSON: ${parseError}`);
      }
      
      // Validate and structure the response for bills
      const validatedData = {
        vendorName: extractedData.vendorName || null,
        description: extractedData.description || null,
        totalAmount: typeof extractedData.totalAmount === 'number' ? extractedData.totalAmount : null,
        dueDate: extractedData.dueDate || null,
        paymentType: extractedData.paymentType === 'one-time' || extractedData.paymentType === 'recurring' 
          ? extractedData.paymentType : null,
        frequency: extractedData.frequency && ['monthly', 'quarterly', 'annually', 'custom'].includes(extractedData.frequency)
          ? extractedData.frequency : null,
        startDate: extractedData.startDate || null,
        customPaymentDates: Array.isArray(extractedData.customPaymentDates) 
          ? extractedData.customPaymentDates : null,
        category: extractedData.category && [
          'insurance', 'maintenance', 'salary', 'utilities', 'cleaning', 'security', 
          'landscaping', 'professional_services', 'administration', 'repairs', 
          'supplies', 'taxes', 'technology', 'reserves', 'other'
        ].includes(extractedData.category) ? extractedData.category : 'other',
      };
      
      console.log('[GEMINI BILL] Validated extraction:', validatedData);
      return validatedData;
    });
  }

  // ====================
  // UTILITY METHODS
  // ====================

  /**
   * Calculate confidence score based on extraction results
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
    
    return Math.min(baseScore, 1.0);
  }

  /**
   * Validate API key configuration
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{
          role: 'user',
          parts: [{ text: 'Test connection' }]
        }]
      });
      return true;
    } catch (error) {
      console.error('[GEMINI] API key validation failed:', error);
      return false;
    }
  }

  // ====================
  // PRIVATE HELPERS
  // ====================

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
        return 'application/pdf';
    }
  }

  private sanitizeJsonResponse(rawResponse: string): string {
    if (!rawResponse) {
      return rawResponse;
    }

    let cleaned = rawResponse
      .replace(/```json\s*/gi, '')
      .replace(/```\s*$/g, '')
      .replace(/^```\s*/g, '')
      .trim();

    return cleaned;
  }

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

  private sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/<[^>]*>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi, '')
      .replace(/[;&|`$(){}[\]]/g, '')
      .substring(0, 1000)
      .trim();
  }

  private sanitizeAmount(amount: string): string {
    if (!amount || typeof amount !== 'string') {
      return '0.00';
    }

    const cleaned = amount.replace(/[^0-9.,-]/g, '');
    const normalizedAmount = cleaned.replace(/,/g, '.');
    
    const parts = normalizedAmount.split('.');
    const sanitized = parts.length > 1 
      ? parts.slice(0, -1).join('') + '.' + parts[parts.length - 1]
      : parts[0];

    const parsed = parseFloat(sanitized);

    if (isNaN(parsed) || parsed < 0 || parsed > 999999.99) {
      return '0.00';
    }

    return parsed.toFixed(2);
  }

  private validateCategory(category: string): string {
    const validCategories = [
      'insurance', 'maintenance', 'salary', 'utilities', 'cleaning',
      'security', 'landscaping', 'professional_services', 'administration',
      'repairs', 'supplies', 'taxes', 'technology', 'reserves', 'other'
    ];

    const sanitized = this.sanitizeString(category).toLowerCase();
    return validCategories.includes(sanitized) ? sanitized : 'other';
  }

  private validateDate(dateString?: string): string | undefined {
    if (!dateString || typeof dateString !== 'string') {
      return undefined;
    }

    const sanitized = this.sanitizeString(dateString);
    const date = new Date(sanitized);
    
    const now = new Date();
    const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);
    const fiveYearsFromNow = new Date(now.getFullYear() + 5, 11, 31);

    if (isNaN(date.getTime()) || date < tenYearsAgo || date > fiveYearsFromNow) {
      return undefined;
    }

    return date.toISOString().split('T')[0];
  }

  private validateConfidence(confidence: number): number {
    if (typeof confidence !== 'number' || isNaN(confidence)) {
      return 0.0;
    }
    return Math.max(0, Math.min(1, confidence));
  }
}

// Export singleton instance
export const aiService = new ConsolidatedAIService();

// Export backward compatibility aliases
export const geminiAnalysisService = aiService;
export const geminiBillAnalyzer = aiService;
export const geminiService = aiService;