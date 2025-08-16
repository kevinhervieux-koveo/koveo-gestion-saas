import type { Feature, ActionableItem } from '@shared/schema';

/**
 *
 */
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

/**
 *
 * @param feature
 * @param documentationContext
 */
export async function analyzeFeatureWithGemini(
  feature: Feature,
  documentationContext: string
): Promise<AnalysisResult> {
  // Using fetch directly to call Gemini API
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const prompt = `You are an expert software architect analyzing a feature request for the Koveo Gestion property management system.

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

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
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
    
    // Extract the text from Gemini's response structure
    if (result.candidates && result.candidates[0] && result.candidates[0].content) {
      const text = result.candidates[0].content.parts[0].text;
      const analysis: AnalysisResult = typeof text === 'string' ? JSON.parse(text) : text;
      
      // Validate that we have multiple actionable items as required
      if (!analysis.actionableItems || analysis.actionableItems.length < 2) {
        console.warn(`⚠️ AI analysis returned only ${analysis.actionableItems?.length || 0} actionable items, but should return 3-8 items`);
        throw new Error(`AI analysis failed to generate multiple actionable items. Expected 3-8 items, got ${analysis.actionableItems?.length || 0}. Please try again.`);
      }
      
      console.log(`✅ AI analysis generated ${analysis.actionableItems.length} actionable items successfully`);
      return analysis;
    } else {
      throw new Error('Invalid response from Gemini');
    }
  } catch (error) {
    console.error('Error analyzing feature with Gemini:', error);
    throw new Error(`Failed to analyze feature: ${error}`);
  }
}

/**
 *
 * @param featureId
 * @param analysisResult
 */
export function formatActionableItemsForDatabase(
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
    dependencies: item.dependencies || null,
    status: 'pending' as const,
    orderIndex: index,
  }));
}

/**
 *
 */
export async function getDocumentationContext(): Promise<string> {
  // For now, return a summary of the system architecture
  // In production, this could read from the actual documentation file
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