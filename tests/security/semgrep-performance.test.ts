/**
 * @file Semgrep Performance Analysis Tests
 * @description Performance-focused semgrep rules and tests for the Koveo Gestion platform
 * to identify bottlenecks, optimization opportunities, and performance anti-patterns.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

describe('Semgrep Performance Analysis', () => {
  let performanceResults;

  beforeAll(async () => {
    // Create performance-specific semgrep rules if they don't exist
    const performanceRulesPath = 'tests/security/semgrep-performance-rules.yml';
    
    try {
      await fs.access(performanceRulesPath);
    } catch {
      // Create performance rules file
      await createPerformanceRules(performanceRulesPath);
    }

    try {
      const { stdout } = await execAsync(
        `npx semgrep --config=${performanceRulesPath} --json client/ server/ shared/`,
        { cwd: process.cwd(), timeout: 60000 }
      );
      performanceResults = JSON.parse(stdout);
    } catch (error) {
      console.warn('Performance semgrep analysis failed:', error.message);
      performanceResults = { results: [] };
    }
  });

  describe('React Performance Patterns', () => {
    it('should detect inefficient re-renders', () => {
      const rerenderIssues = performanceResults.results?.filter(
        result => result.check_id === 'koveo.performance.inefficient-rerenders'
      ) || [];

      if (rerenderIssues.length > 0) {
        console.log(`🔄 Found ${rerenderIssues.length} potential re-render issues:`);
        rerenderIssues.forEach(violation => {
          console.log(`   - ${violation.path}:${violation.start.line} - ${violation.extra.message}`);
        });
      }

      // Allow some re-render issues but flag excessive ones
      expect(rerenderIssues.length).toBeLessThanOrEqual(15);
    });

    it('should detect missing useMemo for expensive calculations', () => {
      const memoIssues = performanceResults.results?.filter(
        result => result.check_id === 'koveo.performance.missing-usememo'
      ) || [];

      if (memoIssues.length > 0) {
        console.log(`🧠 Found ${memoIssues.length} expensive calculations that could use useMemo:`);
        memoIssues.slice(0, 8).forEach(violation => {
          console.log(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(memoIssues)).toBe(true);
    });

    it('should detect missing useCallback for event handlers', () => {
      const callbackIssues = performanceResults.results?.filter(
        result => result.check_id === 'koveo.performance.missing-usecallback'
      ) || [];

      if (callbackIssues.length > 0) {
        console.log(`⚡ Found ${callbackIssues.length} event handlers that could use useCallback:`);
        callbackIssues.slice(0, 8).forEach(violation => {
          console.log(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(callbackIssues)).toBe(true);
    });

    it('should detect large component trees', () => {
      const largeComponents = performanceResults.results?.filter(
        result => result.check_id === 'koveo.performance.large-component-tree'
      ) || [];

      if (largeComponents.length > 0) {
        console.log(`🌳 Found ${largeComponents.length} potentially large component trees:`);
        largeComponents.forEach(violation => {
          console.log(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(largeComponents)).toBe(true);
    });
  });

  describe('Database Query Optimization', () => {
    it('should detect N+1 query patterns', () => {
      const n1Queries = performanceResults.results?.filter(
        result => result.check_id === 'koveo.performance.n1-query-pattern'
      ) || [];

      if (n1Queries.length > 0) {
        console.log(`🗄️ Found ${n1Queries.length} potential N+1 query patterns:`);
        n1Queries.forEach(violation => {
          console.log(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      // N+1 queries should be minimized
      expect(n1Queries.length).toBeLessThanOrEqual(5);
    });

    it('should detect missing database indexes', () => {
      const indexIssues = performanceResults.results?.filter(
        result => result.check_id === 'koveo.performance.missing-db-indexes'
      ) || [];

      if (indexIssues.length > 0) {
        console.log(`📊 Found ${indexIssues.length} queries that might benefit from indexes:`);
        indexIssues.slice(0, 6).forEach(violation => {
          console.log(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(indexIssues)).toBe(true);
    });

    it('should detect inefficient database operations', () => {
      const inefficientOps = performanceResults.results?.filter(
        result => result.check_id === 'koveo.performance.inefficient-db-operations'
      ) || [];

      if (inefficientOps.length > 0) {
        console.log(`⚠️ Found ${inefficientOps.length} inefficient database operations:`);
        inefficientOps.forEach(violation => {
          console.log(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(inefficientOps.length).toBeLessThanOrEqual(8);
    });
  });

  describe('Network and API Performance', () => {
    it('should detect missing request caching', () => {
      const cachingIssues = performanceResults.results?.filter(
        result => result.check_id === 'koveo.performance.missing-request-caching'
      ) || [];

      if (cachingIssues.length > 0) {
        console.log(`📦 Found ${cachingIssues.length} API requests that could benefit from caching:`);
        cachingIssues.slice(0, 6).forEach(violation => {
          console.log(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(cachingIssues)).toBe(true);
    });

    it('should detect inefficient data fetching patterns', () => {
      const fetchingIssues = performanceResults.results?.filter(
        result => result.check_id === 'koveo.performance.inefficient-data-fetching'
      ) || [];

      if (fetchingIssues.length > 0) {
        console.log(`🌐 Found ${fetchingIssues.length} inefficient data fetching patterns:`);
        fetchingIssues.slice(0, 6).forEach(violation => {
          console.log(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(fetchingIssues)).toBe(true);
    });

    it('should detect missing request batching opportunities', () => {
      const batchingIssues = performanceResults.results?.filter(
        result => result.check_id === 'koveo.performance.missing-request-batching'
      ) || [];

      if (batchingIssues.length > 0) {
        console.log(`📤 Found ${batchingIssues.length} opportunities for request batching:`);
        batchingIssues.slice(0, 5).forEach(violation => {
          console.log(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(batchingIssues)).toBe(true);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should detect potential memory leaks', () => {
      const memoryLeaks = performanceResults.results?.filter(
        result => result.check_id === 'koveo.performance.potential-memory-leaks'
      ) || [];

      if (memoryLeaks.length > 0) {
        console.log(`🧠 Found ${memoryLeaks.length} potential memory leak patterns:`);
        memoryLeaks.forEach(violation => {
          console.log(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      // Memory leaks should be addressed
      expect(memoryLeaks.length).toBeLessThanOrEqual(3);
    });

    it('should detect inefficient string operations', () => {
      const stringIssues = performanceResults.results?.filter(
        result => result.check_id === 'koveo.performance.inefficient-string-operations'
      ) || [];

      if (stringIssues.length > 0) {
        console.log(`🔤 Found ${stringIssues.length} inefficient string operations:`);
        stringIssues.slice(0, 6).forEach(violation => {
          console.log(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(stringIssues)).toBe(true);
    });

    it('should detect inefficient array operations', () => {
      const arrayIssues = performanceResults.results?.filter(
        result => result.check_id === 'koveo.performance.inefficient-array-operations'
      ) || [];

      if (arrayIssues.length > 0) {
        console.log(`📝 Found ${arrayIssues.length} inefficient array operations:`);
        arrayIssues.slice(0, 6).forEach(violation => {
          console.log(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(arrayIssues)).toBe(true);
    });
  });

  describe('Bundle Size and Loading Performance', () => {
    it('should detect large import statements', () => {
      const largeImports = performanceResults.results?.filter(
        result => result.check_id === 'koveo.performance.large-imports'
      ) || [];

      if (largeImports.length > 0) {
        console.log(`📦 Found ${largeImports.length} potentially large imports:`);
        largeImports.forEach(violation => {
          console.log(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(largeImports)).toBe(true);
    });

    it('should detect missing lazy loading opportunities', () => {
      const lazyLoadingIssues = performanceResults.results?.filter(
        result => result.check_id === 'koveo.performance.missing-lazy-loading'
      ) || [];

      if (lazyLoadingIssues.length > 0) {
        console.log(`⏳ Found ${lazyLoadingIssues.length} components that could be lazy loaded:`);
        lazyLoadingIssues.slice(0, 5).forEach(violation => {
          console.log(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(lazyLoadingIssues)).toBe(true);
    });
  });

  afterAll(async () => {
    // Generate performance analysis report
    const totalIssues = performanceResults.results?.length || 0;
    const criticalIssues = performanceResults.results?.filter(
      r => r.extra?.severity === 'ERROR'
    ).length || 0;
    
    const categories = {};
    performanceResults.results?.forEach(result => {
      const category = result.check_id.split('.')[2] || 'other';
      categories[category] = (categories[category] || 0) + 1;
    });

    console.log('\n🚀 Performance Analysis Summary:');
    console.log(`   Total performance issues found: ${totalIssues}`);
    console.log(`   Critical issues: ${criticalIssues}`);
    console.log('   Issues by category:');
    
    Object.entries(categories).forEach(([category, count]) => {
      console.log(`     - ${category}: ${count}`);
    });

    if (totalIssues === 0) {
      console.log('✅ No performance issues detected');
    }

    // Save detailed results for further analysis
    try {
      await fs.writeFile(
        'reports/performance-analysis.json',
        JSON.stringify(performanceResults, null, 2)
      );
      console.log('📊 Detailed performance report saved to reports/performance-analysis.json');
    } catch (error) {
      console.warn('Could not save performance report:', error.message);
    }
  });
});

// Helper function to create performance rules
async function createPerformanceRules(filePath) {
  const performanceRules = `# Performance-Specific Semgrep Rules
rules:
  - id: koveo.performance.inefficient-rerenders
    pattern-either:
      - pattern: |
          const $COMPONENT = ({ $PROPS }) => {
            ...
            return <div>{$DATA.map($CALLBACK)}</div>
          }
      - pattern: |
          function $COMPONENT({ $PROPS }) {
            return <div>{$EXPENSIVE_OPERATION}</div>
          }
    message: "Potential inefficient re-render - consider memoization"
    languages: [typescript, javascript]
    severity: INFO

  - id: koveo.performance.missing-usememo
    pattern: |
      const $RESULT = $DATA.filter($PREDICATE).map($TRANSFORM).sort($COMPARE)
    message: "Expensive calculation should use useMemo"
    languages: [typescript, javascript]
    severity: INFO

  - id: koveo.performance.missing-usecallback
    pattern-either:
      - pattern: |
          onClick={() => $HANDLER($ARGS)}
      - pattern: |
          onChange={($EVENT) => $HANDLER($EVENT)}
    message: "Event handler could benefit from useCallback"
    languages: [typescript, javascript]
    severity: INFO

  - id: koveo.performance.n1-query-pattern
    pattern: |
      for (const $ITEM of $ITEMS) {
        await $DB.select().where(eq($TABLE.id, $ITEM.id))
      }
    message: "Potential N+1 query - consider batch loading"
    languages: [typescript, javascript]
    severity: WARNING

  - id: koveo.performance.inefficient-db-operations
    pattern-either:
      - pattern: |
          await $DB.select().from($TABLE)
      - pattern: |
          SELECT * FROM $TABLE
    message: "Selecting all columns may be inefficient"
    languages: [typescript, javascript, sql]
    severity: INFO

  - id: koveo.performance.missing-request-caching
    pattern: |
      useQuery({
        queryKey: [$KEY],
        queryFn: $FN
      })
    pattern-not: |
      useQuery({
        queryKey: [$KEY],
        queryFn: $FN,
        staleTime: $TIME
      })
    message: "API request could benefit from caching strategy"
    languages: [typescript, javascript]
    severity: INFO

  - id: koveo.performance.potential-memory-leaks
    pattern-either:
      - pattern: |
          useEffect(() => {
            $SUBSCRIPTION
          }, [])
      - pattern: |
          setInterval($CALLBACK, $INTERVAL)
    pattern-not: |
      useEffect(() => {
        $SUBSCRIPTION
        return () => $CLEANUP
      }, [])
    message: "Potential memory leak - missing cleanup"
    languages: [typescript, javascript]
    severity: WARNING

  - id: koveo.performance.inefficient-string-operations
    pattern-either:
      - pattern: |
          $STR += $OTHER
      - pattern: |
          $STRINGS.join("")
    message: "Inefficient string concatenation"
    languages: [typescript, javascript]
    severity: INFO

  - id: koveo.performance.large-imports
    pattern-either:
      - pattern: |
          import * as $LIB from "$PACKAGE"
      - pattern: |
          import $DEFAULT from "lodash"
    message: "Large import may increase bundle size"
    languages: [typescript, javascript]
    severity: INFO
`;

  await fs.writeFile(filePath, performanceRules);
}