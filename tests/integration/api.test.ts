import { storage } from '../../server/storage';

describe('API Integration Tests', () => {
  beforeEach(() => {
    // Reset storage state before each test
    // In a real scenario, you'd use a test database
  });

  describe('Development Pillars', () => {
    it('should retrieve all pillars', async () => {
      const pillars = await storage.getPillars();
      
      expect(Array.isArray(pillars)).toBe(true);
      expect(pillars.length).toBeGreaterThan(0);
      
      // Check for required pillars
      const pillarNames = pillars.map(p => p.name);
      expect(pillarNames).toContain('Validation & QA Pillar');
      expect(pillarNames).toContain('Testing Pillar');
      expect(pillarNames).toContain('Security Pillar');
    });

    it('should create a new pillar', async () => {
      const newPillar = {
        name: 'Test Pillar',
        description: 'A test pillar for validation',
        status: 'pending' as const,
        order: '4',
        configuration: { testMode: true }
      };

      const created = await storage.createPillar(newPillar);
      
      expect(created.id).toBeDefined();
      expect(created.name).toBe(newPillar.name);
      expect(created.description).toBe(newPillar.description);
      expect(created.status).toBe(newPillar.status);
      expect(created.createdAt).toBeDefined();
    });
  });

  describe('Workspace Status', () => {
    it('should track workspace component statuses', async () => {
      const statuses = await storage.getWorkspaceStatuses();
      
      expect(Array.isArray(statuses)).toBe(true);
      expect(statuses.length).toBeGreaterThan(0);
      
      // Check for default status components
      const components = statuses.map(s => s.component);
      expect(components).toContain('Environment Setup');
      expect(components).toContain('Dependencies Installation');
    });
  });

  describe('Quality Metrics', () => {
    it('should retrieve quality metrics', async () => {
      const metrics = await storage.getQualityMetrics();
      
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
      
      // Check for expected metrics
      const metricTypes = metrics.map(m => m.metricType);
      expect(metricTypes).toContain('Code Coverage');
      expect(metricTypes).toContain('Code Quality');
    });
  });
});