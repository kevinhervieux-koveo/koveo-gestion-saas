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

interface BillExtractionResult {
  vendorName: string | null;
  description: string | null;
  totalAmount: number | null;
  dueDate: string | null;
  issueDate: string | null;
  billNumber: string | null;
  paymentType: 'one-time' | 'recurring' | null;
  frequency: 'monthly' | 'quarterly' | 'annually' | 'custom' | null;
  startDate: string | null;
  endDate: string | null;
  customPaymentDates: string[] | null;
  category: string;
  fieldConfidence: {
    vendorName: number;
    totalAmount: number;
    dueDate: number;
    category: number;
    paymentType: number;
    frequency: number;
  };
  overallConfidence: number;
  extractionNotes: string[];
}

export class ConsolidatedAIService extends BaseService {
  private genAI: GoogleGenAI | null = null;
  private apiKeyChecked = false;

  constructor() {
    super('ConsolidatedAIService');
    this.initializeAI();
  }

  private initializeAI(): void {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        this.genAI = new GoogleGenAI({ apiKey });
        console.log('[ConsolidatedAIService] Gemini AI initialized successfully');
      } catch (error) {
        console.error('[ConsolidatedAIService] Failed to initialize Gemini AI:', error);
        this.genAI = null;
      }
    } else {
      console.warn('[ConsolidatedAIService] GEMINI_API_KEY not found - AI features will be disabled');
    }
    this.apiKeyChecked = true;
  }

  private ensureApiKeyAvailable(): void {
    if (!this.apiKeyChecked) {
      this.initializeAI();
    }
    if (!this.genAI) {
      throw new Error('AI service is not available. Please ensure GEMINI_API_KEY is configured.');
    }
  }

  private getApiKey(): string {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('AI service is not available. Please ensure GEMINI_API_KEY is configured.');
    }
    return apiKey;
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.getApiKey()}`,
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
        model: 'gemini-2.0-flash',
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
        model: 'gemini-2.0-flash',
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
        model: 'gemini-2.0-flash',
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
   * Uses a logical question sequence to extract data in order of importance:
   * 1. Document Analysis - What type of document is this?
   * 2. Core Identity - Who is the vendor and what's the amount?
   * 3. Dates - When is it due? When was it issued?
   * 4. Category - What type of expense is this?
   * 5. Payment Structure - Is this a one-time or recurring bill?
   * 6. Frequency - If recurring, how often?
   */
  async extractBillData(fileBuffer: Buffer, mimeType: string, language: string = 'en'): Promise<BillExtractionResult> {
    return this.executeWithErrorHandling('extractBillData', async () => {
      // Ensure API key is available before proceeding
      this.ensureApiKeyAvailable();
      
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

      // Improved prompts with logical question sequence and confidence scoring
      const prompts = {
        en: `You are an expert document analysis AI for Koveo Gestion, a property management SaaS. Analyze this bill/invoice/receipt document using the following LOGICAL SEQUENCE of questions.

STEP-BY-STEP EXTRACTION (answer each in order):

**STEP 1 - DOCUMENT IDENTIFICATION**
First, identify what type of document this is (bill, invoice, receipt, statement, etc.) and note any quality issues.

**STEP 2 - CORE IDENTITY (Most Important)**
Q: Who is the vendor/company issuing this document?
Q: What is the total amount to be paid?
These are the most critical fields - extract them carefully.

**STEP 3 - DATE INFORMATION**
Q: What is the due date (when payment is expected)?
Q: What is the issue/invoice date (when it was created)?
Q: Is there an invoice/bill number?
Format all dates as YYYY-MM-DD.

**STEP 4 - CATEGORY DETERMINATION**
Based on the vendor name and service description, determine the category:
- utilities (electricity, gas, water, internet, phone)
- insurance (property, liability, contents insurance)
- maintenance (regular upkeep, HVAC service, elevator maintenance)
- repairs (fixing broken items, emergency repairs)
- cleaning (janitorial services, window cleaning)
- security (alarm monitoring, guard services)
- landscaping (lawn care, snow removal, gardening)
- professional_services (legal, accounting, consulting)
- administration (office supplies, printing, postage)
- supplies (building materials, tools, equipment)
- taxes (property tax, municipal fees)
- technology (software, IT services, equipment)
- reserves (reserve fund contributions)
- salary (employee wages)
- other (if none of the above)

**STEP 5 - PAYMENT STRUCTURE (CRITICAL FOR INSTALLMENT PLANS)**
Q: Is this a one-time payment or a recurring/periodic bill?
Look carefully for these indicators:

INSTALLMENT PAYMENT PATTERNS (these are "recurring" with "custom" frequency):
- "Pay in X installments" / "X payments of $Y"
- "Payment 1 of 3", "Versement 1 de 4"
- "Installment plan", "Payment schedule", "Plan de paiement"
- Tables or lists showing multiple payment dates with amounts
- "Due dates: Jan 15, Apr 15, Jul 15, Oct 15"
- Tax bills often have 2-4 installment dates
- Insurance policies may show premium installments

SEASONAL SERVICE CONTRACTS (these are "recurring" - look for payment schedule):
- Lawn care/landscaping contracts ("Entretien de pelouse", "Gazon")
- Snow removal contracts ("Déneigement")
- Pool maintenance contracts
- Contracts with service periods (e.g., "Mai à Octobre", "April-October")
- "Renouvellement" (Renewal) or "Contrat" (Contract) language
- Annual contracts with monthly or periodic payments
- If a landscaping/maintenance contract shows a total amount, it's likely paid in installments over the service period

STANDARD RECURRING PATTERNS:
- "Monthly", "Quarterly", "Annual", "Subscription"
- "Mensuel", "Trimestriel", "Annuel", "Abonnement"

ONE-TIME INDICATORS:
- Single invoice for a completed service (not a contract)
- No mention of future payments, schedules, or service periods
- "Balance due", "Amount owing" without payment plan
- One-time repair or purchase

**STEP 6 - FREQUENCY AND CUSTOM DATES (CRITICAL)**
If recurring, determine the frequency:
- "monthly" = regular monthly payments (same day each month)
- "quarterly" = every 3 months
- "annually" = once per year
- "custom" = SPECIFIC DATES that don't follow a standard pattern

SET frequency TO "custom" AND EXTRACT customPaymentDates WHEN:
- Document shows 2 or more specific payment dates
- Payment schedule with exact dates (e.g., "Jan 15, Apr 15, Jul 15")
- Installment plan with defined due dates
- Tax notices with multiple payment options/dates
- Any non-standard payment schedule

EXTRACT ALL DATES into customPaymentDates array in YYYY-MM-DD format.
Example: If document shows "Payments due: March 15, 2025 and June 15, 2025"
→ frequency: "custom", customPaymentDates: ["2025-03-15", "2025-06-15"]

**CONFIDENCE ASSESSMENT**
For each extracted field, rate your confidence from 0.0 to 1.0:
- 1.0 = Clearly visible and unambiguous
- 0.7-0.9 = Reasonably confident but some interpretation needed
- 0.5-0.7 = Partially visible or requires inference
- 0.0-0.5 = Guessing or not found

Return a single JSON object with this exact structure:
{
  "vendorName": "Company name or null",
  "description": "Brief description of what this bill is for",
  "totalAmount": 123.45,
  "dueDate": "YYYY-MM-DD or null",
  "issueDate": "YYYY-MM-DD or null",
  "billNumber": "Invoice/bill number or null",
  "paymentType": "one-time" or "recurring",
  "frequency": "monthly" | "quarterly" | "annually" | "custom" | null,
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "customPaymentDates": ["YYYY-MM-DD", ...] or null,
  "category": "category_name",
  "fieldConfidence": {
    "vendorName": 0.0-1.0,
    "totalAmount": 0.0-1.0,
    "dueDate": 0.0-1.0,
    "category": 0.0-1.0,
    "paymentType": 0.0-1.0,
    "frequency": 0.0-1.0
  },
  "extractionNotes": ["Any notes about extraction quality or issues"]
}

IMPORTANT: Return ONLY the JSON object, no markdown formatting or explanation.`,
        
        fr: `Vous êtes un expert en analyse de documents pour Koveo Gestion, un SaaS de gestion immobilière. Analysez ce document de facture/reçu en utilisant la SÉQUENCE LOGIQUE de questions suivante.

EXTRACTION ÉTAPE PAR ÉTAPE (répondez dans l'ordre):

**ÉTAPE 1 - IDENTIFICATION DU DOCUMENT**
D'abord, identifiez le type de document (facture, reçu, relevé, etc.) et notez tout problème de qualité.

**ÉTAPE 2 - IDENTITÉ PRINCIPALE (Le Plus Important)**
Q: Qui est le fournisseur/entreprise émettant ce document?
Q: Quel est le montant total à payer?
Ce sont les champs les plus critiques - extrayez-les avec soin.

**ÉTAPE 3 - INFORMATIONS DE DATE**
Q: Quelle est la date d'échéance?
Q: Quelle est la date d'émission?
Q: Y a-t-il un numéro de facture?
Formatez toutes les dates en YYYY-MM-DD.

**ÉTAPE 4 - DÉTERMINATION DE CATÉGORIE**
Basé sur le nom du fournisseur et la description du service:
- utilities (électricité, gaz, eau, internet, téléphone)
- insurance (assurance propriété, responsabilité)
- maintenance (entretien régulier, CVAC, ascenseur)
- repairs (réparations, urgences)
- cleaning (services de nettoyage)
- security (surveillance, alarme)
- landscaping (entretien paysager, déneigement)
- professional_services (légal, comptabilité, consultation)
- administration (fournitures bureau, impression)
- supplies (matériaux, outils, équipement)
- taxes (taxes foncières, frais municipaux)
- technology (logiciels, services TI)
- reserves (contributions au fonds de réserve)
- salary (salaires employés)
- other (si aucun des précédents)

**ÉTAPE 5 - STRUCTURE DE PAIEMENT (CRITIQUE POUR LES PLANS DE VERSEMENTS)**
Q: Est-ce un paiement unique ou une facture récurrente?
Cherchez attentivement ces indicateurs:

PLANS DE VERSEMENTS/PAIEMENTS ÉCHELONNÉS (ces sont "recurring" avec fréquence "custom"):
- "Payer en X versements" / "X paiements de Y$"
- "Versement 1 de 3", "Paiement 1 sur 4"
- "Plan de paiement", "Échéancier", "Calendrier de paiements"
- Tableaux ou listes montrant plusieurs dates de paiement avec montants
- "Dates d'échéance: 15 jan, 15 avr, 15 juil, 15 oct"
- Les avis de taxes ont souvent 2-4 dates de versements
- Les polices d'assurance peuvent montrer des versements de prime

CONTRATS DE SERVICES SAISONNIERS (ces sont "recurring" - cherchez le calendrier de paiements):
- Contrats d'entretien de pelouse/gazon/paysagement
- Contrats de déneigement
- Contrats d'entretien de piscine
- Contrats avec période de service (ex: "Mai à Octobre", "Avril-Novembre")
- Langage "Renouvellement" ou "Contrat"
- Contrats annuels avec paiements mensuels ou périodiques
- Si un contrat de paysagement/entretien montre un montant total, il est probablement payé en versements sur la période de service

MODÈLES RÉCURRENTS STANDARDS:
- "Mensuel", "Trimestriel", "Annuel", "Abonnement"
- "Monthly", "Quarterly", "Annual", "Subscription"

INDICATEURS DE PAIEMENT UNIQUE:
- Facture unique pour un service complété (pas un contrat)
- Aucune mention de paiements futurs, calendrier ou période de service
- "Solde dû", "Montant à payer" sans plan de paiement
- Réparation ou achat ponctuel

**ÉTAPE 6 - FRÉQUENCE ET DATES PERSONNALISÉES (CRITIQUE)**
Si récurrent, déterminez la fréquence:
- "monthly" = paiements mensuels réguliers (même jour chaque mois)
- "quarterly" = tous les 3 mois
- "annually" = une fois par an
- "custom" = DATES SPÉCIFIQUES qui ne suivent pas un modèle standard

METTEZ frequency À "custom" ET EXTRAYEZ customPaymentDates QUAND:
- Le document montre 2 dates de paiement ou plus
- Échéancier avec dates exactes (ex: "15 jan, 15 avr, 15 juil")
- Plan de versements avec dates d'échéance définies
- Avis de taxes avec plusieurs options/dates de paiement
- Tout calendrier de paiement non-standard

EXTRAYEZ TOUTES LES DATES dans le tableau customPaymentDates au format YYYY-MM-DD.
Exemple: Si le document montre "Paiements dus: 15 mars 2025 et 15 juin 2025"
→ frequency: "custom", customPaymentDates: ["2025-03-15", "2025-06-15"]

**ÉVALUATION DE CONFIANCE**
Pour chaque champ extrait, évaluez votre confiance de 0.0 à 1.0:
- 1.0 = Clairement visible et sans ambiguïté
- 0.7-0.9 = Raisonnablement confiant mais interprétation nécessaire
- 0.5-0.7 = Partiellement visible ou nécessite inférence
- 0.0-0.5 = Supposition ou non trouvé

Retournez un seul objet JSON avec cette structure exacte:
{
  "vendorName": "Nom de l'entreprise ou null",
  "description": "Brève description en français de cette facture",
  "totalAmount": 123.45,
  "dueDate": "YYYY-MM-DD ou null",
  "issueDate": "YYYY-MM-DD ou null",
  "billNumber": "Numéro de facture ou null",
  "paymentType": "one-time" ou "recurring",
  "frequency": "monthly" | "quarterly" | "annually" | "custom" | null,
  "startDate": "YYYY-MM-DD ou null",
  "endDate": "YYYY-MM-DD ou null",
  "customPaymentDates": ["YYYY-MM-DD", ...] ou null,
  "category": "nom_catégorie",
  "fieldConfidence": {
    "vendorName": 0.0-1.0,
    "totalAmount": 0.0-1.0,
    "dueDate": 0.0-1.0,
    "category": 0.0-1.0,
    "paymentType": 0.0-1.0,
    "frequency": 0.0-1.0
  },
  "extractionNotes": ["Notes sur la qualité d'extraction ou problèmes"]
}

IMPORTANT: Retournez UNIQUEMENT l'objet JSON, sans formatage markdown ni explication.`
      };

      const prompt = prompts[language as 'en' | 'fr'] || prompts.en;

      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash',
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
        console.error('[GEMINI BILL] Raw response:', responseText);
        throw new Error(`Failed to parse AI response as JSON: ${parseError}`);
      }
      
      // Validate and structure the response with field-level confidence
      const validCategories = [
        'insurance', 'maintenance', 'salary', 'utilities', 'cleaning', 'security', 
        'landscaping', 'professional_services', 'administration', 'repairs', 
        'supplies', 'taxes', 'technology', 'reserves', 'other'
      ];
      
      // Parse and validate field confidence scores
      const defaultConfidence = {
        vendorName: 0.5,
        totalAmount: 0.5,
        dueDate: 0.5,
        category: 0.5,
        paymentType: 0.5,
        frequency: 0.5
      };
      
      const fieldConfidence = {
        vendorName: this.validateConfidenceScore(extractedData.fieldConfidence?.vendorName, defaultConfidence.vendorName),
        totalAmount: this.validateConfidenceScore(extractedData.fieldConfidence?.totalAmount, defaultConfidence.totalAmount),
        dueDate: this.validateConfidenceScore(extractedData.fieldConfidence?.dueDate, defaultConfidence.dueDate),
        category: this.validateConfidenceScore(extractedData.fieldConfidence?.category, defaultConfidence.category),
        paymentType: this.validateConfidenceScore(extractedData.fieldConfidence?.paymentType, defaultConfidence.paymentType),
        frequency: this.validateConfidenceScore(extractedData.fieldConfidence?.frequency, defaultConfidence.frequency)
      };
      
      // Calculate overall confidence as weighted average of key fields
      const overallConfidence = (
        fieldConfidence.vendorName * 0.25 +
        fieldConfidence.totalAmount * 0.25 +
        fieldConfidence.dueDate * 0.15 +
        fieldConfidence.category * 0.15 +
        fieldConfidence.paymentType * 0.1 +
        fieldConfidence.frequency * 0.1
      );
      
      // Validate dates
      const validateDate = (dateStr: string | null): string | null => {
        if (!dateStr) return null;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) return null;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;
        return dateStr;
      };
      
      // Validate amount
      const validateAmount = (amount: any): number | null => {
        if (typeof amount === 'number' && !isNaN(amount) && amount >= 0) {
          return Math.round(amount * 100) / 100; // Round to 2 decimal places
        }
        if (typeof amount === 'string') {
          const parsed = parseFloat(amount.replace(/[^0-9.-]/g, ''));
          if (!isNaN(parsed) && parsed >= 0) {
            return Math.round(parsed * 100) / 100;
          }
        }
        return null;
      };
      
      const validatedData: BillExtractionResult = {
        vendorName: extractedData.vendorName && typeof extractedData.vendorName === 'string' 
          ? extractedData.vendorName.trim().substring(0, 200) : null,
        description: extractedData.description && typeof extractedData.description === 'string' 
          ? extractedData.description.trim().substring(0, 500) : null,
        totalAmount: validateAmount(extractedData.totalAmount),
        dueDate: validateDate(extractedData.dueDate),
        issueDate: validateDate(extractedData.issueDate),
        billNumber: extractedData.billNumber && typeof extractedData.billNumber === 'string' 
          ? extractedData.billNumber.trim().substring(0, 100) : null,
        paymentType: extractedData.paymentType === 'one-time' || extractedData.paymentType === 'recurring' 
          ? extractedData.paymentType : null,
        frequency: extractedData.frequency && ['monthly', 'quarterly', 'annually', 'custom'].includes(extractedData.frequency)
          ? extractedData.frequency : null,
        startDate: validateDate(extractedData.startDate),
        endDate: validateDate(extractedData.endDate),
        customPaymentDates: Array.isArray(extractedData.customPaymentDates) 
          ? extractedData.customPaymentDates.map(validateDate).filter((d): d is string => d !== null) 
          : null,
        category: validCategories.includes(extractedData.category) ? extractedData.category : 'other',
        fieldConfidence,
        overallConfidence: Math.round(overallConfidence * 100) / 100,
        extractionNotes: Array.isArray(extractedData.extractionNotes) 
          ? extractedData.extractionNotes.filter((n: any) => typeof n === 'string').slice(0, 5)
          : []
      };
      
      // Add automatic notes for low confidence fields
      if (fieldConfidence.vendorName < 0.7 && validatedData.vendorName) {
        validatedData.extractionNotes.push('Vendor name may need verification');
      }
      if (fieldConfidence.totalAmount < 0.7 && validatedData.totalAmount) {
        validatedData.extractionNotes.push('Amount should be verified');
      }
      if (!validatedData.dueDate) {
        validatedData.extractionNotes.push('Due date could not be extracted - please enter manually');
      }
      
      console.log('[GEMINI BILL] Extraction complete:', {
        vendor: validatedData.vendorName,
        amount: validatedData.totalAmount,
        category: validatedData.category,
        overallConfidence: validatedData.overallConfidence,
        notes: validatedData.extractionNotes.length
      });
      
      return validatedData;
    });
  }

  /**
   * Validate confidence score to be between 0 and 1
   */
  private validateConfidenceScore(value: any, defaultValue: number): number {
    if (typeof value === 'number' && !isNaN(value)) {
      return Math.max(0, Math.min(1, value));
    }
    return defaultValue;
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
        model: 'gemini-2.0-flash',
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