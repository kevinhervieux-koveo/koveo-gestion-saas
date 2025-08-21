import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MoneyFlowJob } from '../../server/jobs/money_flow_job';
import { moneyFlowAutomationService } from '../../server/services/money-flow-automation';

// Mock the money flow automation service
jest.mock('../../server/services/money-flow-automation', () => ({
  moneyFlowAutomationService: {
    generateFutureMoneyFlowEntries: jest.fn(),
    generateForBill: jest.fn(),
    generateForResidence: jest.fn(),
    getMoneyFlowStatistics: jest.fn()
  }
}));

// Mock node-cron
const mockCronTask = {
  start: jest.fn(),
  stop: jest.fn(),
  destroy: jest.fn()
};

jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue(mockCronTask),
  validate: jest.fn().mockReturnValue(true)
}));

describe('MoneyFlowJob Integration Tests', () => {
  let moneyFlowJob: MoneyFlowJob;

  beforeEach(() => {
    moneyFlowJob = new MoneyFlowJob();
    jest.clearAllMocks();
    
    // Set environment variables for testing
    process.env.MONEY_FLOW_ENABLED = 'true';
    process.env.MONEY_FLOW_SCHEDULE = '0 3 * * *';
    process.env.MONEY_FLOW_LOG_LEVEL = 'info';
    process.env.MONEY_FLOW_RETRY_ATTEMPTS = '3';
    process.env.MONEY_FLOW_RETRY_DELAY = '1000';
  });

  afterEach(() => {
    moneyFlowJob.stop();
    jest.clearAllMocks();
  });

  describe('Job initialization', () => {
    it('should initialize with correct configuration', () => {
      const status = moneyFlowJob.getStatus();
      
      expect(status.enabled).toBe(true);
      expect(status.schedule).toBe('0 3 * * *');
      expect(status.running).toBe(false);
    });

    it('should respect disabled configuration', () => {
      process.env.MONEY_FLOW_ENABLED = 'false';
      const disabledJob = new MoneyFlowJob();
      
      const status = disabledJob.getStatus();
      expect(status.enabled).toBe(false);
    });

    it('should use default configuration when env vars are missing', () => {
      delete process.env.MONEY_FLOW_SCHEDULE;
      delete process.env.MONEY_FLOW_LOG_LEVEL;
      
      const defaultJob = new MoneyFlowJob();
      const status = defaultJob.getStatus();
      
      expect(status.schedule).toBe('0 3 * * *'); // Default schedule
    });
  });

  describe('Job execution', () => {
    it('should execute money flow generation successfully', async () => {
      const mockResult = {
        billEntriesCreated: 150,
        residenceEntriesCreated: 75,
        totalEntriesCreated: 225
      };

      const mockStats = {
        totalEntries: 1000,
        billEntries: 600,
        residenceEntries: 400,
        futureEntries: 800,
        oldestEntry: '2024-01-01',
        newestEntry: '2049-12-31'
      };

      (moneyFlowAutomationService.generateFutureMoneyFlowEntries as jest.Mock)
        .mockResolvedValue(mockResult);
      (moneyFlowAutomationService.getMoneyFlowStatistics as jest.Mock)
        .mockResolvedValue(mockStats);

      await moneyFlowJob.executeMoneyFlowJob();

      expect(moneyFlowAutomationService.generateFutureMoneyFlowEntries).toHaveBeenCalledTimes(1);
      expect(moneyFlowAutomationService.getMoneyFlowStatistics).toHaveBeenCalledTimes(1);
    });

    it('should prevent concurrent job execution', async () => {
      const mockResult = {
        billEntriesCreated: 50,
        residenceEntriesCreated: 25,
        totalEntriesCreated: 75
      };

      (moneyFlowAutomationService.generateFutureMoneyFlowEntries as jest.Mock)
        .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResult), 100)));

      // Start first execution
      const execution1 = moneyFlowJob.executeMoneyFlowJob();
      
      // Try to start second execution while first is running
      const execution2 = moneyFlowJob.executeMoneyFlowJob();

      await Promise.all([execution1, execution2]);

      // Should only execute once
      expect(moneyFlowAutomationService.generateFutureMoneyFlowEntries).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure up to configured attempts', async () => {
      const error = new Error('Database connection failed');
      
      (moneyFlowAutomationService.generateFutureMoneyFlowEntries as jest.Mock)
        .mockRejectedValue(error);

      await moneyFlowJob.executeMoneyFlowJob();

      // Should attempt 3 times (default retry attempts)
      expect(moneyFlowAutomationService.generateFutureMoneyFlowEntries).toHaveBeenCalledTimes(3);
    });

    it('should succeed after initial failures', async () => {
      const error = new Error('Temporary failure');
      const mockResult = {
        billEntriesCreated: 10,
        residenceEntriesCreated: 5,
        totalEntriesCreated: 15
      };

      const mockStats = {
        totalEntries: 100,
        billEntries: 60,
        residenceEntries: 40,
        futureEntries: 80,
        oldestEntry: '2024-01-01',
        newestEntry: '2049-12-31'
      };

      (moneyFlowAutomationService.generateFutureMoneyFlowEntries as jest.Mock)
        .mockRejectedValueOnce(error) // First attempt fails
        .mockRejectedValueOnce(error) // Second attempt fails
        .mockResolvedValueOnce(mockResult); // Third attempt succeeds

      (moneyFlowAutomationService.getMoneyFlowStatistics as jest.Mock)
        .mockResolvedValue(mockStats);

      await moneyFlowJob.executeMoneyFlowJob();

      expect(moneyFlowAutomationService.generateFutureMoneyFlowEntries).toHaveBeenCalledTimes(3);
      expect(moneyFlowAutomationService.getMoneyFlowStatistics).toHaveBeenCalledTimes(1);
    });
  });

  describe('Bill-specific generation', () => {
    it('should generate money flow for a specific bill', async () => {
      const billId = 'bill-123';
      const entriesCreated = 24; // 2 years of monthly payments

      (moneyFlowAutomationService.generateForBill as jest.Mock)
        .mockResolvedValue(entriesCreated);

      const result = await moneyFlowJob.generateForBill(billId);

      expect(result).toBe(entriesCreated);
      expect(moneyFlowAutomationService.generateForBill).toHaveBeenCalledWith(billId);
    });

    it('should handle bill generation errors', async () => {
      const billId = 'invalid-bill';
      const error = new Error('Bill not found');

      (moneyFlowAutomationService.generateForBill as jest.Mock)
        .mockRejectedValue(error);

      await expect(moneyFlowJob.generateForBill(billId)).rejects.toThrow('Bill not found');
    });
  });

  describe('Residence-specific generation', () => {
    it('should generate money flow for a specific residence', async () => {
      const residenceId = 'residence-456';
      const entriesCreated = 300; // 25 years of monthly fees

      (moneyFlowAutomationService.generateForResidence as jest.Mock)
        .mockResolvedValue(entriesCreated);

      const result = await moneyFlowJob.generateForResidence(residenceId);

      expect(result).toBe(entriesCreated);
      expect(moneyFlowAutomationService.generateForResidence).toHaveBeenCalledWith(residenceId);
    });

    it('should handle residence generation errors', async () => {
      const residenceId = 'invalid-residence';
      const error = new Error('Residence not found');

      (moneyFlowAutomationService.generateForResidence as jest.Mock)
        .mockRejectedValue(error);

      await expect(moneyFlowJob.generateForResidence(residenceId)).rejects.toThrow('Residence not found');
    });
  });

  describe('Statistics retrieval', () => {
    it('should retrieve money flow statistics', async () => {
      const mockStats = {
        totalEntries: 5000,
        billEntries: 3000,
        residenceEntries: 2000,
        futureEntries: 4500,
        oldestEntry: '2024-01-01',
        newestEntry: '2049-12-31'
      };

      (moneyFlowAutomationService.getMoneyFlowStatistics as jest.Mock)
        .mockResolvedValue(mockStats);

      const stats = await moneyFlowJob.getStatistics();

      expect(stats).toEqual(mockStats);
      expect(moneyFlowAutomationService.getMoneyFlowStatistics).toHaveBeenCalledTimes(1);
    });

    it('should handle statistics errors', async () => {
      const error = new Error('Database query failed');

      (moneyFlowAutomationService.getMoneyFlowStatistics as jest.Mock)
        .mockRejectedValue(error);

      await expect(moneyFlowJob.getStatistics()).rejects.toThrow('Database query failed');
    });
  });

  describe('Manual triggers', () => {
    it('should trigger full regeneration manually', async () => {
      const mockResult = {
        billEntriesCreated: 500,
        residenceEntriesCreated: 250,
        totalEntriesCreated: 750
      };

      const mockStats = {
        totalEntries: 2000,
        billEntries: 1200,
        residenceEntries: 800,
        futureEntries: 1800,
        oldestEntry: '2024-01-01',
        newestEntry: '2049-12-31'
      };

      (moneyFlowAutomationService.generateFutureMoneyFlowEntries as jest.Mock)
        .mockResolvedValue(mockResult);
      (moneyFlowAutomationService.getMoneyFlowStatistics as jest.Mock)
        .mockResolvedValue(mockStats);

      await moneyFlowJob.triggerFullRegeneration();

      expect(moneyFlowAutomationService.generateFutureMoneyFlowEntries).toHaveBeenCalledTimes(1);
      expect(moneyFlowAutomationService.getMoneyFlowStatistics).toHaveBeenCalledTimes(1);
    });

    it('should prevent manual trigger when job is running', async () => {
      const mockResult = {
        billEntriesCreated: 100,
        residenceEntriesCreated: 50,
        totalEntriesCreated: 150
      };

      (moneyFlowAutomationService.generateFutureMoneyFlowEntries as jest.Mock)
        .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResult), 100)));

      // Start job execution
      const execution = moneyFlowJob.executeMoneyFlowJob();

      // Try to trigger manual regeneration while job is running
      await expect(moneyFlowJob.triggerFullRegeneration()).rejects.toThrow('Job is already running, please wait for completion');

      await execution;
    });
  });

  describe('Performance considerations', () => {
    it('should complete job execution within reasonable time', async () => {
      const mockResult = {
        billEntriesCreated: 1000,
        residenceEntriesCreated: 500,
        totalEntriesCreated: 1500
      };

      const mockStats = {
        totalEntries: 10000,
        billEntries: 6000,
        residenceEntries: 4000,
        futureEntries: 9000,
        oldestEntry: '2024-01-01',
        newestEntry: '2049-12-31'
      };

      (moneyFlowAutomationService.generateFutureMoneyFlowEntries as jest.Mock)
        .mockResolvedValue(mockResult);
      (moneyFlowAutomationService.getMoneyFlowStatistics as jest.Mock)
        .mockResolvedValue(mockStats);

      const startTime = Date.now();
      await moneyFlowJob.executeMoneyFlowJob();
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large numbers of entries efficiently', async () => {
      const mockResult = {
        billEntriesCreated: 50000, // Large number of bill entries
        residenceEntriesCreated: 25000, // Large number of residence entries
        totalEntriesCreated: 75000
      };

      const mockStats = {
        totalEntries: 100000,
        billEntries: 60000,
        residenceEntries: 40000,
        futureEntries: 95000,
        oldestEntry: '2024-01-01',
        newestEntry: '2049-12-31'
      };

      (moneyFlowAutomationService.generateFutureMoneyFlowEntries as jest.Mock)
        .mockResolvedValue(mockResult);
      (moneyFlowAutomationService.getMoneyFlowStatistics as jest.Mock)
        .mockResolvedValue(mockStats);

      await expect(moneyFlowJob.executeMoneyFlowJob()).resolves.not.toThrow();
    });
  });

  describe('Logging and monitoring', () => {
    it('should log job execution details', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const mockResult = {
        billEntriesCreated: 100,
        residenceEntriesCreated: 50,
        totalEntriesCreated: 150
      };

      const mockStats = {
        totalEntries: 1000,
        billEntries: 600,
        residenceEntries: 400,
        futureEntries: 900,
        oldestEntry: '2024-01-01',
        newestEntry: '2049-12-31'
      };

      (moneyFlowAutomationService.generateFutureMoneyFlowEntries as jest.Mock)
        .mockResolvedValue(mockResult);
      (moneyFlowAutomationService.getMoneyFlowStatistics as jest.Mock)
        .mockResolvedValue(mockStats);

      await moneyFlowJob.executeMoneyFlowJob();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MONEY-FLOW]')
      );

      consoleSpy.mockRestore();
    });

    it('should log errors appropriately', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const error = new Error('Test error');
      
      (moneyFlowAutomationService.generateFutureMoneyFlowEntries as jest.Mock)
        .mockRejectedValue(error);

      await moneyFlowJob.executeMoneyFlowJob();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      );

      consoleSpy.mockRestore();
    });
  });
});