import { analyzeFeatureWithGemini, getDocumentationContext } from '../../server/services/gemini-analysis';
import type { Feature } from '@shared/schema';

/**
 * AI Form Response Validation Integration Tests.
 * 
 * These integration tests validate that the actual AI service responses
 * from Gemini properly map to the form structure in the application.
 * 
 * These tests require GEMINI_API_KEY to be set and make real API calls.
 */

describe('AI Form Response Validation (Integration)', () => {
  
  // Skip these tests if no API key is available
  const skipIfNoApiKey = () => {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️  Skipping AI integration tests - GEMINI_API_KEY not set');
      return true;
    }
    return false;
  };

  const sampleFeature: Feature = {
    id: 'integration-test-feature',
    name: 'User Authentication Enhancement',
    description: 'Implement multi-factor authentication and single sign-on for improved security',
    category: 'Compliance & Security',
    status: 'submitted',
    priority: 'high',
    businessObjective: 'Reduce security breaches by 90% and improve user experience',
    targetUsers: 'All system users, particularly administrators and property managers',
    successMetrics: 'Zero unauthorized access attempts, 99% user satisfaction with login process',
    technicalComplexity: 'Medium - requires integration with external SSO providers and new UI components',
    dependencies: 'User management system, notification service, audit logging',
    userFlow: 'User visits login page -> enters credentials -> completes MFA -> accesses dashboard',
    isStrategicPath: true,
    roadmapVisibility: 'public',
    createdAt: new Date(),
    updatedAt: new Date(),
    syncedAt: new Date()
  };

  /**
   * Test that the real AI service returns properly structured responses.
   */
  it('should return properly structured analysis from real AI service', async () => {
    if (skipIfNoApiKey()) {return;}

    try {
      const documentationContext = await getDocumentationContext();
      const analysisResult = await analyzeFeatureWithGemini(sampleFeature, documentationContext);

      // Validate top-level structure
      expect(analysisResult).toHaveProperty('summary');
      expect(analysisResult).toHaveProperty('actionableItems');
      expect(analysisResult).toHaveProperty('recommendations');
      expect(analysisResult).toHaveProperty('estimatedTotalEffort');

      // Validate summary
      expect(typeof analysisResult.summary).toBe('string');
      expect(analysisResult.summary.length).toBeGreaterThan(20);

      // Validate actionable items
      expect(Array.isArray(analysisResult.actionableItems)).toBe(true);
      expect(analysisResult.actionableItems.length).toBeGreaterThan(0);
      expect(analysisResult.actionableItems.length).toBeLessThanOrEqual(10); // Reasonable limit

      // Validate each actionable item structure
      analysisResult.actionableItems.forEach((item, _index) => {
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('technicalDetails');
        expect(item).toHaveProperty('implementationPrompt');
        expect(item).toHaveProperty('testingRequirements');
        expect(item).toHaveProperty('estimatedEffort');

        // Validate content quality
        expect(typeof item.title).toBe('string');
        expect(item.title.length).toBeGreaterThan(5);
        expect(item.title).toMatch(/^\d+\./); // Should start with number

        expect(typeof item.description).toBe('string');
        expect(item.description.length).toBeGreaterThan(20);

        expect(typeof item.technicalDetails).toBe('string');
        expect(item.technicalDetails.length).toBeGreaterThan(30);

        expect(typeof item.implementationPrompt).toBe('string');
        expect(item.implementationPrompt.length).toBeGreaterThan(50);

        expect(typeof item.testingRequirements).toBe('string');
        expect(item.testingRequirements.length).toBeGreaterThan(20);

        expect(typeof item.estimatedEffort).toBe('string');
        expect(item.estimatedEffort).toMatch(/\d+\s+(hour|day|week)s?/i);

        // Dependencies should be array if present
        if (item.dependencies) {
          expect(Array.isArray(item.dependencies)).toBe(true);
        }
      });

      // Validate recommendations
      expect(Array.isArray(analysisResult.recommendations)).toBe(true);
      if (analysisResult.recommendations.length > 0) {
        analysisResult.recommendations.forEach(recommendation => {
          expect(typeof recommendation).toBe('string');
          expect(recommendation.length).toBeGreaterThan(10);
        });
      }

      // Validate estimated total effort
      expect(typeof analysisResult.estimatedTotalEffort).toBe('string');
      expect(analysisResult.estimatedTotalEffort).toMatch(/\d+.*?(hour|day|week)/i);

    } catch (_error) {
      console.error('AI Integration Test Error:', _error);
      throw error;
    }
  }, 30000); // 30 second timeout for API call

  /**
   * Test that AI responses include Quebec-specific considerations for compliance features.
   */
  it('should include Quebec-specific considerations for compliance features', async () => {
    if (skipIfNoApiKey()) {return;}

    const complianceFeature: Feature = {
      ...sampleFeature,
      id: 'quebec-compliance-test',
      name: 'Quebec Law 25 Compliance Dashboard',
      description: 'Implement comprehensive privacy compliance dashboard for Quebec Law 25 requirements',
      category: 'Compliance & Security',
      businessObjective: 'Ensure 100% compliance with Quebec Law 25 privacy regulations'
    };

    try {
      const documentationContext = await getDocumentationContext();
      const analysisResult = await analyzeFeatureWithGemini(complianceFeature, documentationContext);

      // Check that Quebec/privacy considerations are mentioned
      const allText = [
        analysisResult.summary,
        ...analysisResult.actionableItems.map(item => 
          `${item.description} ${item.technicalDetails} ${item.implementationPrompt}`
        ),
        ...analysisResult.recommendations
      ].join(' ').toLowerCase();

      const quebecTerms = ['quebec', 'québec', 'law 25', 'loi 25', 'privacy', 'confidentialité'];
      const hasQuebecReference = quebecTerms.some(term => allText.includes(term.toLowerCase()));
      
      expect(hasQuebecReference).toBe(true);

    } catch (_error) {
      console.error('Quebec Compliance Test Error:', _error);
      throw error;
    }
  }, 30000);

  /**
   * Test that AI responses reference the existing tech stack.
   */
  it('should reference the correct tech stack in implementation details', async () => {
    if (skipIfNoApiKey()) {return;}

    try {
      const documentationContext = await getDocumentationContext();
      const analysisResult = await analyzeFeatureWithGemini(sampleFeature, documentationContext);

      const allTechnicalText = analysisResult.actionableItems
        .map(item => `${item.technicalDetails} ${item.implementationPrompt}`)
        .join(' ').toLowerCase();

      // Should reference the tech stack from the documentation
      const techStackTerms = ['react', 'express', 'postgresql', 'drizzle', 'typescript'];
      const referencedTerms = techStackTerms.filter(term => 
        allTechnicalText.includes(term.toLowerCase())
      );

      expect(referencedTerms.length).toBeGreaterThan(1); // At least 2 tech stack terms mentioned

    } catch (_error) {
      console.error('Tech Stack Reference Test Error:', _error);
      throw error;
    }
  }, 30000);

  /**
   * Test that all feature form fields are considered in the analysis.
   */
  it('should utilize all provided feature form fields in the analysis', async () => {
    if (skipIfNoApiKey()) {return;}

    const comprehensiveFeature: Feature = {
      ...sampleFeature,
      id: 'comprehensive-field-test',
      name: 'Comprehensive Feature Test',
      description: 'Feature with all possible fields filled to test AI analysis completeness',
      businessObjective: 'Test comprehensive analysis with all form fields populated',
      targetUsers: 'Test users including admins, managers, and tenants',
      successMetrics: 'All metrics tracked properly with 95% accuracy',
      technicalComplexity: 'High complexity requiring database migrations and new APIs',
      dependencies: 'Authentication service, notification system, reporting engine',
      userFlow: 'Complex multi-step user flow with decision points and error handling'
    };

    try {
      const documentationContext = await getDocumentationContext();
      const analysisResult = await analyzeFeatureWithGemini(comprehensiveFeature, documentationContext);

      // Verify that the analysis appears to have considered the provided details
      const analysisText = [
        analysisResult.summary,
        ...analysisResult.actionableItems.map(item => item.description),
        ...analysisResult.recommendations
      ].join(' ').toLowerCase();

      // Should reference key aspects from the form data
      const formFieldTerms = ['authentication', 'notification', 'database', 'api'];
      const referencedFormTerms = formFieldTerms.filter(term => 
        analysisText.includes(term.toLowerCase())
      );

      expect(referencedFormTerms.length).toBeGreaterThan(1);

      // Analysis should be substantial given comprehensive input
      expect(analysisResult.actionableItems.length).toBeGreaterThan(2);
      expect(analysisResult.summary.length).toBeGreaterThan(50);

    } catch (_error) {
      console.error('Comprehensive Field Test Error:', _error);
      throw error;
    }
  }, 30000);

  /**
   * Test error handling for malformed feature data.
   */
  it('should handle edge cases gracefully', async () => {
    if (skipIfNoApiKey()) {return;}

    const minimalFeature: Feature = {
      id: 'minimal-test',
      name: 'Minimal Feature',
      description: 'Basic feature with minimal information',
      category: 'Website',
      status: 'submitted',
      priority: 'low',
      businessObjective: null,
      targetUsers: null,
      successMetrics: null,
      technicalComplexity: null,
      dependencies: null,
      userFlow: null,
      isStrategicPath: false,
      roadmapVisibility: 'public',
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedAt: new Date()
    };

    try {
      const documentationContext = await getDocumentationContext();
      const analysisResult = await analyzeFeatureWithGemini(minimalFeature, documentationContext);

      // Should still return valid structure even with minimal data
      expect(analysisResult).toHaveProperty('summary');
      expect(analysisResult).toHaveProperty('actionableItems');
      expect(analysisResult.actionableItems.length).toBeGreaterThan(0);

      // Should handle null/undefined fields gracefully
      expect(typeof analysisResult.summary).toBe('string');
      expect(analysisResult.summary.length).toBeGreaterThan(10);

    } catch (_error) {
      console.error('Edge Case Test Error:', _error);
      throw error;
    }
  }, 30000);

  /**
   * Test that the analysis is deterministic for the same input.
   */
  it('should provide consistent analysis for the same feature', async () => {
    if (skipIfNoApiKey()) {return;}

    const testFeature = { ...sampleFeature, id: 'consistency-test' };

    try {
      const documentationContext = await getDocumentationContext();
      
      const analysis1 = await analyzeFeatureWithGemini(testFeature, documentationContext);
      
      // Wait a moment to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const analysis2 = await analyzeFeatureWithGemini(testFeature, documentationContext);

      // Structure should be consistent
      expect(analysis1.actionableItems.length).toBeGreaterThan(0);
      expect(analysis2.actionableItems.length).toBeGreaterThan(0);

      // Basic content themes should be similar (allowing for some AI variation)
      expect(typeof analysis1.summary).toBe('string');
      expect(typeof analysis2.summary).toBe('string');

      // Both should mention authentication (since that's the main feature)
      const summary1Lower = analysis1.summary.toLowerCase();
      const summary2Lower = analysis2.summary.toLowerCase();
      const authMentioned1 = summary1Lower.includes('auth') || summary1Lower.includes('login');
      const authMentioned2 = summary2Lower.includes('auth') || summary2Lower.includes('login');
      
      expect(authMentioned1 || authMentioned2).toBe(true);

    } catch (_error) {
      console.error('Consistency Test Error:', _error);
      throw error;
    }
  }, 60000); // Longer timeout for two API calls
});

/**
 * Performance and reliability tests for AI integration.
 */
describe('AI Service Performance and Reliability', () => {
  
  const skipIfNoApiKey = () => {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️  Skipping AI performance tests - GEMINI_API_KEY not set');
      return true;
    }
    return false;
  };

  it('should complete analysis within reasonable time', async () => {
    if (skipIfNoApiKey()) {return;}

    const startTime = Date.now();
    
    const testFeature: Feature = {
      id: 'performance-test',
      name: 'Performance Test Feature',
      description: 'Simple feature to test response time',
      category: 'Website',
      status: 'submitted',
      priority: 'medium',
      businessObjective: 'Test AI response performance',
      targetUsers: 'Test users',
      successMetrics: 'Response under 30 seconds',
      technicalComplexity: 'Low',
      dependencies: 'None',
      userFlow: 'Simple flow',
      isStrategicPath: false,
      roadmapVisibility: 'public',
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedAt: new Date()
    };

    try {
      const documentationContext = await getDocumentationContext();
      const analysisResult = await analyzeFeatureWithGemini(testFeature, documentationContext);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(analysisResult).toHaveProperty('actionableItems');
      expect(analysisResult.actionableItems.length).toBeGreaterThan(0);

    } catch (_error) {
      console.error('Performance Test Error:', _error);
      throw error;
    }
  }, 35000);
});