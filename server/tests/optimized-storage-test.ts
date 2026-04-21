/**
 * Comprehensive Tests for Optimized File Storage System
 * 
 * Tests the new optimized file storage architecture to ensure:
 * - Correct functionality
 * - Performance improvements
 * - Security maintenance
 * - Backward compatibility
 */

import { OptimizedFileStorageService } from '../services/optimized-file-storage';
import { FileMigrationService } from '../services/file-migration-service';
import { generateOptimizedStorageDirectory, mapLegacyToOptimizedPath } from '@shared/config/optimized-upload-config';
import type { OptimizedUploadContext } from '@shared/config/optimized-upload-config';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  details?: any;
  error?: string;
}

export class OptimizedStorageTests {
  private optimizedStorage: OptimizedFileStorageService;
  private migrationService: FileMigrationService;
  private testResults: TestResult[] = [];
  private testDir: string;

  constructor() {
    this.optimizedStorage = new OptimizedFileStorageService();
    this.migrationService = new FileMigrationService();
    this.testDir = path.join(process.cwd(), 'test_uploads');
  }

  async runAllTests(): Promise<{ success: boolean; results: TestResult[]; summary: any }> {
    console.log('🧪 Starting comprehensive file storage optimization tests...\n');

    try {
      // Setup test environment
      await this.setupTestEnvironment();

      // Run all test suites
      await this.testDirectoryStructureOptimization();
      await this.testCachingPerformance();
      await this.testFileOperations();
      await this.testSecurityMaintenance();
      await this.testMigrationFunctionality();
      await this.testPerformanceMetrics();
      await this.testBackwardCompatibility();

      // Cleanup
      await this.cleanupTestEnvironment();

      const summary = this.generateTestSummary();
      console.log('\n📊 Test Summary:');
      console.log(JSON.stringify(summary, null, 2));

      return {
        success: summary.passed === summary.total,
        results: this.testResults,
        summary
      };

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      return {
        success: false,
        results: this.testResults,
        summary: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private async testDirectoryStructureOptimization(): Promise<void> {
    console.log('📁 Testing directory structure optimization...');

    const testCases = [
      {
        name: 'Basic document context',
        context: {
          type: 'documents',
          organizationId: 'test-org-123',
          buildingId: 'test-building-456',
          userRole: 'manager'
        } as OptimizedUploadContext
      },
      {
        name: 'Complex nested context',
        context: {
          type: 'maintenance',
          organizationId: 'test-org-123',
          buildingId: 'test-building-456',
          residenceId: 'test-residence-789',
          userRole: 'tenant',
          userId: 'test-user-999'
        } as OptimizedUploadContext
      }
    ];

    for (const testCase of testCases) {
      const startTime = performance.now();
      
      try {
        const optimizedPath = generateOptimizedStorageDirectory(testCase.context);
        const pathDepth = optimizedPath.split('/').length;
        
        const success = pathDepth <= 3; // Max 3 levels
        const duration = performance.now() - startTime;

        this.testResults.push({
          name: `Directory optimization: ${testCase.name}`,
          success,
          duration,
          details: {
            path: optimizedPath,
            depth: pathDepth,
            maxDepthRespected: pathDepth <= 3
          }
        });

        console.log(`  ${success ? '✅' : '❌'} ${testCase.name}: ${optimizedPath} (depth: ${pathDepth})`);

      } catch (error) {
        this.testResults.push({
          name: `Directory optimization: ${testCase.name}`,
          success: false,
          duration: performance.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async testCachingPerformance(): Promise<void> {
    console.log('🚀 Testing caching performance...');

    const context: OptimizedUploadContext = {
      type: 'documents',
      organizationId: 'test-org-123',
      buildingId: 'test-building-456',
      userRole: 'manager',
      userId: 'test-user-123'
    };

    // Create a test file
    const testFile = await this.createTestFile('cache-test.txt', 'Test content for caching');

    try {
      // First retrieval (cache miss)
      const startTime1 = performance.now();
      const result1 = await this.optimizedStorage.retrieveFile(
        'documents/testpath/cache-test.txt',
        'test-user-123',
        'manager'
      );
      const firstRetrievalTime = performance.now() - startTime1;

      // Second retrieval (should be cache hit)
      const startTime2 = performance.now();
      const result2 = await this.optimizedStorage.retrieveFile(
        'documents/testpath/cache-test.txt',
        'test-user-123',
        'manager'
      );
      const secondRetrievalTime = performance.now() - startTime2;

      const cacheImprovement = firstRetrievalTime > secondRetrievalTime;
      const improvementRatio = secondRetrievalTime / firstRetrievalTime;

      this.testResults.push({
        name: 'Caching performance improvement',
        success: cacheImprovement,
        duration: firstRetrievalTime + secondRetrievalTime,
        details: {
          firstRetrieval: `${firstRetrievalTime.toFixed(2)}ms`,
          secondRetrieval: `${secondRetrievalTime.toFixed(2)}ms`,
          improvement: `${((1 - improvementRatio) * 100).toFixed(1)}%`,
          cacheHit: result2.fromCache
        }
      });

      console.log(`  ${cacheImprovement ? '✅' : '❌'} Cache performance: ${firstRetrievalTime.toFixed(2)}ms → ${secondRetrievalTime.toFixed(2)}ms`);

    } catch (error) {
      this.testResults.push({
        name: 'Caching performance improvement',
        success: false,
        duration: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testFileOperations(): Promise<void> {
    console.log('📄 Testing file operations...');

    const context: OptimizedUploadContext = {
      type: 'documents',
      organizationId: 'test-org-123',
      userRole: 'manager',
      userId: 'test-user-123'
    };

    const testFile = await this.createTestFile('operations-test.txt', 'File operations test content');

    try {
      const startTime = performance.now();

      // Test file storage
      const storeResult = await this.optimizedStorage.storeFile(
        testFile,
        context,
        'manager',
        'test-user-123'
      );

      // Test file retrieval
      const retrieveResult = await this.optimizedStorage.retrieveFile(
        storeResult.filePath!,
        'test-user-123',
        'manager'
      );

      // Test file listing
      const listResult = await this.optimizedStorage.listFiles(
        context,
        'test-user-123',
        'manager'
      );

      const duration = performance.now() - startTime;
      const allSuccessful = storeResult.success && retrieveResult.success && listResult.success;

      this.testResults.push({
        name: 'File operations (store/retrieve/list)',
        success: allSuccessful,
        duration,
        details: {
          store: storeResult.success,
          retrieve: retrieveResult.success,
          list: listResult.success,
          filesFound: listResult.files?.length || 0
        }
      });

      console.log(`  ${allSuccessful ? '✅' : '❌'} File operations completed in ${duration.toFixed(2)}ms`);

    } catch (error) {
      this.testResults.push({
        name: 'File operations (store/retrieve/list)',
        success: false,
        duration: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testSecurityMaintenance(): Promise<void> {
    console.log('🔐 Testing security maintenance...');

    const adminContext: OptimizedUploadContext = {
      type: 'documents',
      organizationId: 'test-org-123',
      userRole: 'admin',
      userId: 'admin-user'
    };

    const tenantContext: OptimizedUploadContext = {
      type: 'documents',
      organizationId: 'test-org-123',
      buildingId: 'test-building-456',
      residenceId: 'test-residence-789',
      userRole: 'tenant',
      userId: 'tenant-user'
    };

    try {
      const testFile = await this.createTestFile('security-test.txt', 'Security test content');

      // Admin should be able to store file
      const adminStoreResult = await this.optimizedStorage.storeFile(
        testFile,
        adminContext,
        'admin',
        'admin-user'
      );

      // Tenant should not be able to access admin file
      const tenantAccessResult = await this.optimizedStorage.retrieveFile(
        adminStoreResult.filePath!,
        'tenant-user',
        'tenant'
      );

      // Tenant should be able to store in their own context
      const tenantStoreResult = await this.optimizedStorage.storeFile(
        testFile,
        tenantContext,
        'tenant',
        'tenant-user'
      );

      const securityWorking = adminStoreResult.success && 
                             !tenantAccessResult.success && 
                             tenantStoreResult.success;

      this.testResults.push({
        name: 'Security access control',
        success: securityWorking,
        duration: 0,
        details: {
          adminCanStore: adminStoreResult.success,
          tenantCannotAccessAdmin: !tenantAccessResult.success,
          tenantCanStoreOwn: tenantStoreResult.success
        }
      });

      console.log(`  ${securityWorking ? '✅' : '❌'} Security controls maintained`);

    } catch (error) {
      this.testResults.push({
        name: 'Security access control',
        success: false,
        duration: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testMigrationFunctionality(): Promise<void> {
    console.log('🔄 Testing migration functionality...');

    try {
      // Create mock legacy structure
      await this.createMockLegacyStructure();

      const startTime = performance.now();

      // Test dry run migration
      const dryRunResult = await this.migrationService.migrateAllFiles(true);

      // Test migration verification
      const verificationResult = await this.migrationService.verifyMigration();

      const duration = performance.now() - startTime;
      const migrationWorking = dryRunResult.success && verificationResult.success;

      this.testResults.push({
        name: 'Migration functionality',
        success: migrationWorking,
        duration,
        details: {
          dryRunSuccess: dryRunResult.success,
          filesFound: dryRunResult.totalProcessed,
          verificationPassed: verificationResult.success,
          issues: verificationResult.issues
        }
      });

      console.log(`  ${migrationWorking ? '✅' : '❌'} Migration functionality working`);

    } catch (error) {
      this.testResults.push({
        name: 'Migration functionality',
        success: false,
        duration: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testPerformanceMetrics(): Promise<void> {
    console.log('📊 Testing performance metrics collection...');

    try {
      const startTime = performance.now();

      // Generate some activity
      for (let i = 0; i < 5; i++) {
        const testFile = await this.createTestFile(`perf-test-${i}.txt`, `Performance test ${i}`);
        await this.optimizedStorage.storeFile(
          testFile,
          { type: 'documents', userRole: 'admin', userId: 'perf-test' },
          'admin',
          'perf-test'
        );
      }

      // Get metrics
      const metrics = this.optimizedStorage.getPerformanceMetrics();
      const duration = performance.now() - startTime;

      const metricsValid = metrics.totalRequests > 0 && 
                          metrics.avgResponseTime > 0 &&
                          metrics.cacheSize;

      this.testResults.push({
        name: 'Performance metrics collection',
        success: metricsValid,
        duration,
        details: metrics
      });

      console.log(`  ${metricsValid ? '✅' : '❌'} Performance metrics working`);

    } catch (error) {
      this.testResults.push({
        name: 'Performance metrics collection',
        success: false,
        duration: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testBackwardCompatibility(): Promise<void> {
    console.log('🔄 Testing backward compatibility...');

    const legacyPaths = [
      'documents/org_test-org/building_test-building/role_manager/file.txt',
      'maintenance/org_test-org/building_test-building/residence_test-residence/role_tenant/user_test-user/file.txt'
    ];

    try {
      for (const legacyPath of legacyPaths) {
        const startTime = performance.now();
        
        const optimizedPath = mapLegacyToOptimizedPath(legacyPath);
        const duration = performance.now() - startTime;
        
        const isOptimized = optimizedPath.split('/').length <= 3;

        this.testResults.push({
          name: `Legacy path mapping: ${legacyPath}`,
          success: isOptimized,
          duration,
          details: {
            originalPath: legacyPath,
            optimizedPath: optimizedPath,
            depthReduced: isOptimized
          }
        });

        console.log(`  ${isOptimized ? '✅' : '❌'} ${legacyPath} → ${optimizedPath}`);
      }

    } catch (error) {
      this.testResults.push({
        name: 'Backward compatibility',
        success: false,
        duration: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Helper methods
  private async setupTestEnvironment(): Promise<void> {
    try {
      await fs.mkdir(this.testDir, { recursive: true });
      console.log('🏗️  Test environment setup completed');
    } catch (error) {
      console.error('Failed to setup test environment:', error);
      throw error;
    }
  }

  private async cleanupTestEnvironment(): Promise<void> {
    try {
      await fs.rm(this.testDir, { recursive: true, force: true });
      this.optimizedStorage.clearCaches();
      console.log('🧹 Test environment cleanup completed');
    } catch (error) {
      console.warn('Warning: Failed to cleanup test environment:', error);
    }
  }

  private async createTestFile(filename: string, content: string): Promise<Express.Multer.File> {
    const filePath = path.join(this.testDir, filename);
    await fs.writeFile(filePath, content);
    
    const stats = await fs.stat(filePath);
    
    return {
      fieldname: 'file',
      originalname: filename,
      encoding: '7bit',
      mimetype: 'text/plain',
      size: stats.size,
      destination: this.testDir,
      filename: filename,
      path: filePath,
      buffer: Buffer.from(content)
    } as Express.Multer.File;
  }

  private async createMockLegacyStructure(): Promise<void> {
    const legacyPaths = [
      'documents/org_test/building_test/residence_test/role_manager/legacy-file-1.txt',
      'maintenance/org_test/building_test/role_admin/legacy-file-2.txt'
    ];

    for (const relativePath of legacyPaths) {
      const fullPath = path.join(this.testDir, relativePath);
      const dir = path.dirname(fullPath);
      
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, `Legacy file content: ${relativePath}`);
    }
  }

  private generateTestSummary(): any {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.success).length;
    const failed = total - passed;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    return {
      total,
      passed,
      failed,
      successRate: `${(passed / total * 100).toFixed(1)}%`,
      totalDuration: `${totalDuration.toFixed(2)}ms`,
      avgDuration: `${(totalDuration / total).toFixed(2)}ms`
    };
  }
}

// Export for use in other test files
export default OptimizedStorageTests;