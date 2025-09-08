/**
 * Debug Logging Standards Test
 * 
 * Ensures all new features and components have appropriate debug logging
 * based on their complexity level. This test helps maintain code quality
 * and debugging standards across the application.
 */

import { describe, test, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

interface ComplexityMetrics {
  functions: number;
  conditionals: number;
  loops: number;
  asyncOperations: number;
  databaseQueries: number;
  apiCalls: number;
  errorHandling: number;
  complexityScore: number;
}

interface LoggingCheck {
  hasDebugLogger: boolean;
  hasLogStatements: number;
  hasErrorLogging: boolean;
  hasPerformanceLogging: boolean;
  hasSecurityLogging: boolean;
  requiredLogLevel: 'none' | 'basic' | 'detailed' | 'comprehensive';
}

class CodeComplexityAnalyzer {
  /**
   * Analyze code complexity metrics
   */
  analyzeComplexity(content: string, filePath: string): ComplexityMetrics {
    // Count functions and methods
    const functionMatches = content.match(/(function\s+\w+|const\s+\w+\s*=\s*\(?.*?\)?\s*=>|async\s+function|\w+\s*\([^)]*\)\s*{|class\s+\w+)/g) || [];
    
    // Count conditionals (if, switch, ternary)
    const conditionalMatches = content.match(/(if\s*\(|switch\s*\(|\?\s*\w+\s*:/g) || [];
    
    // Count loops (for, while, forEach, map, filter, etc.)
    const loopMatches = content.match(/(for\s*\(|while\s*\(|\.forEach|\.map\s*\(|\.filter\s*\(|\.reduce\s*\()/g) || [];
    
    // Count async operations
    const asyncMatches = content.match(/(async\s+|await\s+|\.then\s*\(|\.catch\s*\(|Promise\.)/g) || [];
    
    // Count database queries (common ORM patterns)
    const dbQueryMatches = content.match(/(db\.|sql`|\.select\(|\.insert\(|\.update\(|\.delete\(|SELECT\s+|INSERT\s+|UPDATE\s+|DELETE\s+)/g) || [];
    
    // Count API calls
    const apiCallMatches = content.match(/(fetch\s*\(|axios\.|apiRequest|\.get\s*\(|\.post\s*\(|\.put\s*\(|\.patch\s*\(|\.delete\s*\()/g) || [];
    
    // Count error handling
    const errorHandlingMatches = content.match(/(try\s*{|catch\s*\(|throw\s+|Error\s*\()/g) || [];
    
    // Calculate weighted complexity score
    const complexityScore = 
      (functionMatches.length * 1) +
      (conditionalMatches.length * 2) +
      (loopMatches.length * 2) +
      (asyncMatches.length * 3) +
      (dbQueryMatches.length * 4) +
      (apiCallMatches.length * 3) +
      (errorHandlingMatches.length * 1);
    
    return {
      functions: functionMatches.length,
      conditionals: conditionalMatches.length,
      loops: loopMatches.length,
      asyncOperations: asyncMatches.length,
      databaseQueries: dbQueryMatches.length,
      apiCalls: apiCallMatches.length,
      errorHandling: errorHandlingMatches.length,
      complexityScore,
    };
  }

  /**
   * Check existing logging in the code
   */
  checkLogging(content: string, filePath: string): LoggingCheck {
    // Check for debug logger imports
    const hasDebugLogger = /import.*debug.*logger|debugLogger|logDebug|logInfo|logError|logWarn/.test(content);
    
    // Count log statements
    const logMatches = content.match(/(console\.|debugLogger\.|logDebug|logInfo|logError|logWarn|logSecurityEvent)/g) || [];
    
    // Check for error logging
    const hasErrorLogging = /logError|console\.error|catch.*log/.test(content);
    
    // Check for performance logging
    const hasPerformanceLogging = /startTiming|logSqlQuery|performance|executionTime/.test(content);
    
    // Check for security logging
    const hasSecurityLogging = /logSecurityEvent|SECURITY|AUDIT/.test(content);
    
    return {
      hasDebugLogger,
      hasLogStatements: logMatches.length,
      hasErrorLogging,
      hasPerformanceLogging,
      hasSecurityLogging,
      requiredLogLevel: 'none', // Will be determined based on complexity
    };
  }

  /**
   * Determine required logging level based on complexity
   */
  getRequiredLogLevel(metrics: ComplexityMetrics, filePath: string): 'none' | 'basic' | 'detailed' | 'comprehensive' {
    const isServerFile = filePath.includes('/server/');
    const isApiRoute = filePath.includes('/api/') || filePath.includes('routes');
    const isAuthFile = filePath.includes('auth') || filePath.includes('security');
    const isDbFile = filePath.includes('storage') || filePath.includes('db');
    
    // High complexity or critical files need comprehensive logging
    if (metrics.complexityScore >= 20 || isAuthFile || isDbFile) {
      return 'comprehensive';
    }
    
    // Medium complexity or API routes need detailed logging
    if (metrics.complexityScore >= 10 || isApiRoute || isServerFile) {
      return 'detailed';
    }
    
    // Low complexity but has some operations need basic logging
    if (metrics.complexityScore >= 5 || metrics.asyncOperations > 0 || metrics.databaseQueries > 0) {
      return 'basic';
    }
    
    // Very simple files don't need logging
    return 'none';
  }

  /**
   * Check if logging meets requirements
   */
  meetsLoggingRequirements(logging: LoggingCheck, requiredLevel: string, metrics: ComplexityMetrics): boolean {
    switch (requiredLevel) {
      case 'comprehensive':
        return logging.hasDebugLogger && 
               logging.hasLogStatements >= 3 && 
               logging.hasErrorLogging && 
               (metrics.databaseQueries > 0 ? logging.hasPerformanceLogging : true);
      
      case 'detailed':
        return logging.hasDebugLogger && 
               logging.hasLogStatements >= 2 && 
               logging.hasErrorLogging;
      
      case 'basic':
        return logging.hasLogStatements >= 1 || logging.hasErrorLogging;
      
      case 'none':
      default:
        return true; // No requirements for simple files
    }
  }
}

/**
 * Get all TypeScript files to analyze
 */
function getAllTypeScriptFiles(): string[] {
  const files: string[] = [];
  
  // Server files (more critical, need better logging)
  const serverDirs = ['server/api', 'server/auth', 'server/services', 'server/middleware'];
  
  // Client files (less critical, but complex ones still need logging)
  const clientDirs = ['client/src/pages', 'client/src/components'];
  
  [...serverDirs, ...clientDirs].forEach(dir => {
    if (fs.existsSync(dir)) {
      const dirFiles = fs.readdirSync(dir, { recursive: true }) as string[];
      dirFiles
        .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))
        .forEach(file => {
          files.push(path.join(dir, file));
        });
    }
  });
  
  return files;
}

describe('Debug Logging Standards', () => {
  const analyzer = new CodeComplexityAnalyzer();
  
  test('should ensure all complex components have appropriate debug logging', () => {
    const files = getAllTypeScriptFiles();
    const violations: Array<{file: string, issue: string, metrics: ComplexityMetrics, required: string}> = [];
    
    files.forEach(filePath => {
      if (!fs.existsSync(filePath)) return;
      
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Skip test files and type definition files
      if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.endsWith('.d.ts')) {
        return;
      }
      
      // Skip very small files (less than 100 lines)
      if (content.split('\n').length < 100) {
        return;
      }
      
      const metrics = analyzer.analyzeComplexity(content, filePath);
      const logging = analyzer.checkLogging(content, filePath);
      const requiredLevel = analyzer.getRequiredLogLevel(metrics, filePath);
      
      logging.requiredLogLevel = requiredLevel;
      
      // Check if logging meets requirements
      if (!analyzer.meetsLoggingRequirements(logging, requiredLevel, metrics)) {
        let issue = `Insufficient logging for complexity level "${requiredLevel}".`;
        
        if (requiredLevel === 'comprehensive' && !logging.hasDebugLogger) {
          issue += ' Missing debug logger import.';
        }
        if (requiredLevel !== 'none' && !logging.hasErrorLogging) {
          issue += ' Missing error logging.';
        }
        if (metrics.databaseQueries > 0 && !logging.hasPerformanceLogging) {
          issue += ' Database operations should include performance logging.';
        }
        
        violations.push({
          file: filePath,
          issue,
          metrics,
          required: requiredLevel
        });
      }
    });
    
    // Report violations
    if (violations.length > 0) {
      const violationReport = violations.map(v => 
        `\n❌ ${v.file}:\n   ${v.issue}\n   Complexity: ${v.metrics.complexityScore} (${v.metrics.functions} functions, ${v.metrics.databaseQueries} DB ops)\n   Required level: ${v.required}`
      ).join('\n');
      
      throw new Error(`${violations.length} files have insufficient debug logging:\n${violationReport}\n\nTo fix these issues:\n1. Import debug logger: import { debugLogger, logInfo, logError } from '@/utils/debug-logger'\n2. Add appropriate logging based on complexity\n3. Include error handling with logging\n4. Add performance logging for database operations`);
    }
  });

  test('should validate debug logger utility exists and works correctly', () => {
    const debugLoggerPath = 'server/utils/debug-logger.ts';
    expect(fs.existsSync(debugLoggerPath)).toBe(true);
    
    const content = fs.readFileSync(debugLoggerPath, 'utf-8');
    
    // Check essential exports exist
    expect(content).toMatch(/export.*debugLogger/);
    expect(content).toMatch(/export.*logDebug/);
    expect(content).toMatch(/export.*logInfo/);
    expect(content).toMatch(/export.*logError/);
    expect(content).toMatch(/export.*startTiming/);
    expect(content).toMatch(/export.*logSecurityEvent/);
    
    // Check environment-based logging
    expect(content).toMatch(/isDevelopment/);
    expect(content).toMatch(/DATABASE_URL_KOVEO/);
  });

  test('should ensure security-critical files have security logging', () => {
    const securityCriticalPatterns = [
      'server/auth',
      'server/middleware/security',
      'server/api/auth',
    ];
    
    const violations: string[] = [];
    
    securityCriticalPatterns.forEach(pattern => {
      if (!fs.existsSync(pattern)) return;
      
      const files = fs.readdirSync(pattern, { recursive: true }) as string[];
      files
        .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))
        .forEach(file => {
          const filePath = path.join(pattern, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          
          const hasSecurityLogging = /logSecurityEvent|SECURITY|AUDIT/.test(content);
          
          if (!hasSecurityLogging && content.length > 500) { // Skip small utility files
            violations.push(filePath);
          }
        });
    });
    
    if (violations.length > 0) {
      throw new Error(`Security-critical files missing security logging:\n${violations.map(f => `❌ ${f}`).join('\n')}\n\nAdd security logging with: logSecurityEvent('EVENT_NAME', { details })`);
    }
  });

  test('should ensure API routes have request logging', () => {
    const apiDirs = ['server/api'];
    const violations: string[] = [];
    
    apiDirs.forEach(dir => {
      if (!fs.existsSync(dir)) return;
      
      const files = fs.readdirSync(dir, { recursive: true }) as string[];
      files
        .filter(file => file.endsWith('.ts'))
        .forEach(file => {
          const filePath = path.join(dir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Check if it's an API route file
          const hasRouteHandlers = /\.(get|post|put|patch|delete)\s*\(/i.test(content);
          
          if (hasRouteHandlers) {
            const hasRequestLogging = /logApiRequest|req\.|request/.test(content);
            
            if (!hasRequestLogging) {
              violations.push(filePath);
            }
          }
        });
    });
    
    if (violations.length > 0) {
      throw new Error(`API route files missing request logging:\n${violations.map(f => `❌ ${f}`).join('\n')}\n\nAdd request logging with: logApiRequest(req, 'operationId')`);
    }
  });
});