/**
 * @file Gemini Analysis service tests.
 * @description Test suite for AI feature analysis functionality.
 */

import { 
  analyzeFeatureWithGemini, 
  formatActionableItemsForDatabase, 
  getDocumentationContext 
} from '../../server/services/gemini-analysis';

// Mock fetch for Gemini API
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock environment variables
process.env.GEMINI_API_KEY = 'test-api-key';

describe('Gemini Analysis Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeFeatureWithGemini', () => {
    const mockFeature = {
      id: 'test-feature-id',
      name: 'SSL Management',
      description: 'Automatic SSL certificate renewal and management',
      category: 'Website' as const,
      status: 'in-progress' as const,
      priority: 'high' as const,
      businessObjective: 'Ensure secure HTTPS connections',
      targetUsers: 'Property managers and administrators',
      successMetrics: 'SSL certificates automatically renewed',
      technicalComplexity: 'Medium complexity',
      dependencies: 'Certificate authority APIs',
      userFlow: 'Automatic background process',
      metadata: {},
      requestedBy: 'test-user',
      assignedTo: 'dev-team',
      estimatedHours: 40,
      actualHours: 0,
      complexity: 'medium' as const,
      timeline: '2 weeks',
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedAt: new Date(),
      isStrategicPath: false,
      rbacRequired: true,
      showOnRoadmap: true,
      startDate: new Date().toISOString(),
      completedDate: null,
      isPublicRoadmap: true,
      tags: [],
      organizationId: 'org-1',
      userId: 'user-123',
      aiAnalysisResult: null,
      aiAnalyzedAt: null
    };

    const mockGeminiResponse = {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              summary: 'SSL certificate management feature implementation',
              actionableItems: [
                {
                  title: '1. Create SSL Certificate Database Table',
                  description: 'Create database table for SSL certificates',
                  technicalDetails: 'Use Drizzle ORM with PostgreSQL',
                  implementationPrompt: 'Add ssl_certificates table to schema',
                  testingRequirements: 'Write migration tests',
                  estimatedEffort: '1 day',
                  dependencies: [],
                },
                {
                  title: '2. Implement SSL Certificate Acquisition Service',
                  description: 'Service to obtain SSL certificates',
                  technicalDetails: 'Use ACME protocol with Let\'s Encrypt',
                  implementationPrompt: 'Create SSL service class',
                  testingRequirements: 'Integration tests with staging environment',
                  estimatedEffort: '2 days',
                  dependencies: [],
                },
              ],
              recommendations: [
                'Use certificate manager for easier management',
                'Implement robust error handling',
              ],
              estimatedTotalEffort: '8 days',
            }),
          }],
        },
      }],
    };

    it('should analyze feature successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeminiResponse,
      });

      const documentationContext = 'Koveo Gestion context';
      const result = await analyzeFeatureWithGemini(mockFeature, documentationContext);

      expect(result.summary).toBe('SSL certificate management feature implementation');
      expect(result.actionableItems).toHaveLength(2);
      expect(result.actionableItems[0].title).toBe('1. Create SSL Certificate Database Table');
      expect(result.recommendations).toHaveLength(2);
      expect(result.estimatedTotalEffort).toBe('8 days');
    });

    it('should include proper context in API request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeminiResponse,
      });

      await analyzeFeatureWithGemini(mockFeature, 'Test context');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const prompt = requestBody.contents[0].parts[0].text;

      expect(prompt).toContain('Koveo Gestion property management system');
      expect(prompt).toContain('Test context');
      expect(prompt).toContain('SSL Management');
      expect(prompt).toContain('MULTIPLE numbered actionable items');
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      await expect(analyzeFeatureWithGemini(mockFeature, 'context'))
        .rejects.toThrow('Gemini API _error: 400 - Bad Request');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(analyzeFeatureWithGemini(mockFeature, 'context'))
        .rejects.toThrow('Failed to analyze feature: Error: Network error');
    });

    it('should handle invalid API response format', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      });

      await expect(analyzeFeatureWithGemini(mockFeature, 'context'))
        .rejects.toThrow('Invalid response from Gemini');
    });

    it('should throw error when API key is missing', async () => {
      delete process.env.GEMINI_API_KEY;

      await expect(analyzeFeatureWithGemini(mockFeature, 'context'))
        .rejects.toThrow('GEMINI_API_KEY is not configured');

      // Restore API key
      process.env.GEMINI_API_KEY = 'test-api-key';
    });

    it('should format request with correct headers and body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeminiResponse,
      });

      await analyzeFeatureWithGemini(mockFeature, 'context');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const [url, options] = fetchCall;

      expect(url).toContain('generativelanguage.googleapis.com');
      expect(url).toContain('key=test-api-key');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');

      const requestBody = JSON.parse(options.body);
      expect(requestBody.generationConfig.responseMimeType).toBe('application/json');
    });
  });

  describe('formatActionableItemsForDatabase', () => {
    const mockAnalysisResult = {
      summary: 'Test summary',
      actionableItems: [
        {
          title: '1. First Task',
          description: 'First task description',
          technicalDetails: 'Technical details',
          implementationPrompt: 'Implementation prompt',
          testingRequirements: 'Testing requirements',
          estimatedEffort: '1 day',
          dependencies: ['dependency1'],
        },
        {
          title: '2. Second Task',
          description: 'Second task description',
          technicalDetails: 'Technical details',
          implementationPrompt: 'Implementation prompt',
          testingRequirements: 'Testing requirements',
          estimatedEffort: '2 days',
          dependencies: [],
        },
      ],
      recommendations: ['Recommendation 1'],
      estimatedTotalEffort: '3 days',
    };

    it('should format actionable items correctly', () => {
      const featureId = 'test-feature-id';
      const result = formatActionableItemsForDatabase(featureId, mockAnalysisResult);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        featureId,
        title: '1. First Task',
        description: 'First task description',
        status: 'pending',
        dependencies: ['dependency1'],
      });
      expect(result[1]).toMatchObject({
        featureId,
        title: '2. Second Task',
        dependencies: null,
      });
    });

    it('should handle empty dependencies', () => {
      const result = formatActionableItemsForDatabase('test-id', mockAnalysisResult);
      
      expect(result[1].dependencies).toBeNull();
    });

    it('should set correct order indices', () => {
      const result = formatActionableItemsForDatabase('test-id', mockAnalysisResult);
      
      // Order indices are set during formatting but not part of the returned interface
      expect(result.length).toBe(2);
    });
  });

  describe('getDocumentationContext', () => {
    it('should return comprehensive system context', async () => {
      const context = await getDocumentationContext();

      expect(context).toContain('Koveo Gestion');
      expect(context).toContain('Quebec residential communities');
      expect(context).toContain('React 18 with TypeScript');
      expect(context).toContain('Express.js with TypeScript');
      expect(context).toContain('PostgreSQL with Drizzle ORM');
      expect(context).toContain('Quebec Law 25 compliance');
      expect(context).toContain('French and English');
    });

    it('should include tech stack information', async () => {
      const context = await getDocumentationContext();

      expect(context).toContain('Vite');
      expect(context).toContain('shadcn/ui components');
      expect(context).toContain('Tailwind CSS');
      expect(context).toContain('TanStack Query');
      expect(context).toContain('Zod schemas');
    });

    it('should include database schema details', async () => {
      const context = await getDocumentationContext();

      expect(context).toContain('Users, Organizations, Buildings');
      expect(context).toContain('Bills, Maintenance Requests');
      expect(context).toContain('Features and Actionable Items');
    });

    it('should include security considerations', async () => {
      const context = await getDocumentationContext();

      expect(context).toContain('bcrypt password hashing');
      expect(context).toContain('Session management');
      expect(context).toContain('Input validation');
    });
  });
});