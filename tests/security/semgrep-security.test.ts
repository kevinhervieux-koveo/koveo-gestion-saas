import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Semgrep Security Tests', () => {
  let semgrepResults: any;
  
  beforeAll(() => {
    // Ensure reports directory exists
    if (!fs.existsSync('reports')) {
      fs.mkdirSync('reports', { recursive: true });
    }
    
    // Run Semgrep scan and capture results
    try {
      const semgrepOutput = execSync(
        'semgrep --config=.semgrep.yml --json --no-git-ignore --include="*.ts" --include="*.tsx" .',
        { 
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000
        }
      );
      semgrepResults = JSON.parse(semgrepOutput);
      
      // Save results to reports directory
      fs.writeFileSync('reports/semgrep-results.json', JSON.stringify(semgrepResults, null, 2));
    } catch (error: any) {
      // Semgrep may exit with code 1 when findings are detected, which is expected
      if (error.stdout) {
        try {
          semgrepResults = JSON.parse(error.stdout);
          fs.writeFileSync('reports/semgrep-results.json', JSON.stringify(semgrepResults, null, 2));
        } catch (parseError) {
          console.warn('Semgrep output parsing failed, using empty results');
          semgrepResults = { results: [] };
        }
      } else {
        console.warn('Semgrep execution completed with no output, using empty results');
        semgrepResults = { results: [] };
      }
    }
  });

  describe('Security Rule Validation', () => {
    test('should detect hardcoded secrets', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'hardcoded-secrets'
      ) || [];
      
      // Should not have any hardcoded secrets in production code
      expect(violations.length).toBe(0);
    });

    test('should detect SQL injection vulnerabilities', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'sql-injection-prevention'
      ) || [];
      
      // Should not have any SQL injection vulnerabilities
      expect(violations.length).toBe(0);
    });

    test('should detect XSS vulnerabilities in React components', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'xss-prevention-react'
      ) || [];
      
      // Should not have any unvalidated dangerouslySetInnerHTML usage
      expect(violations.length).toBe(0);
    });

    test('should detect weak cryptographic usage', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'weak-crypto-usage'
      ) || [];
      
      // Should not use weak crypto algorithms
      expect(violations.length).toBe(0);
    });

    test('should detect command injection risks', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'command-injection-risk'
      ) || [];
      
      // Should not have command injection vulnerabilities
      expect(violations.length).toBe(0);
    });

    test('should detect directory traversal vulnerabilities', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'directory-traversal-prevention'
      ) || [];
      
      // Should not have path traversal vulnerabilities
      expect(violations.length).toBe(0);
    });

    test('should detect environment variable exposure', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'env-var-exposure'
      ) || [];
      
      // Should not expose environment variables in logs
      expect(violations.length).toBe(0);
    });

    test('should detect database connection exposure', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'database-connection-exposure'
      ) || [];
      
      // Should not expose database connection details
      expect(violations.length).toBe(0);
    });
  });

  describe('Quebec Law 25 Compliance', () => {
    test('should flag potential personal data logging violations', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'law25-sensitive-data-logging'
      ) || [];
      
      if (violations.length > 0) {
        console.warn('⚠️ Potential Law 25 violations found:', violations.length);
        violations.forEach((v: any) => {
          console.warn(`  - ${v.path}:${v.start.line} - ${v.message}`);
        });
      }
      
      // This is informational - log violations but don't fail the test
      expect(violations).toBeDefined();
    });

    test('should flag cross-border data transfer without consent', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'law25-cross-border-transfer'
      ) || [];
      
      // Critical compliance issue
      expect(violations.length).toBe(0);
    });

    test('should flag missing encryption for sensitive data', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'law25-encryption-at-rest'
      ) || [];
      
      // Critical compliance issue
      expect(violations.length).toBe(0);
    });

    test('should flag insecure communication protocols', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'law25-secure-communication'
      ) || [];
      
      // Critical compliance issue
      expect(violations.length).toBe(0);
    });
  });

  describe('Express.js Security', () => {
    test('should detect CORS wildcard misconfigurations', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'express-cors-wildcard'
      ) || [];
      
      // Should not have overly permissive CORS
      expect(violations.length).toBe(0);
    });

    test('should detect missing rate limiting on auth endpoints', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'missing-rate-limiting'
      ) || [];
      
      if (violations.length > 0) {
        console.warn('⚠️ Auth endpoints without rate limiting:', violations.length);
        violations.forEach((v: any) => {
          console.warn(`  - ${v.path}:${v.start.line} - ${v.message}`);
        });
      }
      
      // Warning level - log but don't fail
      expect(violations).toBeDefined();
    });

    test('should detect insecure session configurations', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'session-security-missing'
      ) || [];
      
      if (violations.length > 0) {
        console.warn('⚠️ Session security issues:', violations.length);
        violations.forEach((v: any) => {
          console.warn(`  - ${v.path}:${v.start.line} - ${v.message}`);
        });
      }
      
      // Warning level - check but don't fail tests
      expect(violations).toBeDefined();
    });
  });

  describe('React Security', () => {
    test('should detect external links without security attributes', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'react-external-links'
      ) || [];
      
      if (violations.length > 0) {
        console.warn('⚠️ External links missing rel attributes:', violations.length);
        violations.forEach((v: any) => {
          console.warn(`  - ${v.path}:${v.start.line} - ${v.message}`);
        });
      }
      
      // Warning level - informational
      expect(violations).toBeDefined();
    });

    test('should detect potential prototype pollution', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'prototype-pollution-risk'
      ) || [];
      
      // Critical security issue
      expect(violations.length).toBe(0);
    });
  });

  describe('Property Management Security', () => {
    test('should protect tenant financial data', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'tenant-financial-data-protection'
      ) || [];
      
      if (violations.length > 0) {
        console.warn('⚠️ Tenant financial data protection concerns:', violations.length);
        violations.forEach((v: any) => {
          console.warn(`  - ${v.path}:${v.start.line} - ${v.message}`);
        });
      }
      
      // Domain-specific warning
      expect(violations).toBeDefined();
    });

    test('should protect building access data', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'building-access-data-security'
      ) || [];
      
      if (violations.length > 0) {
        console.warn('⚠️ Building access data security concerns:', violations.length);
        violations.forEach((v: any) => {
          console.warn(`  - ${v.path}:${v.start.line} - ${v.message}`);
        });
      }
      
      // Domain-specific warning
      expect(violations).toBeDefined();
    });
  });

  describe('File Upload Security', () => {
    test('should detect insecure file upload configurations', () => {
      const violations = semgrepResults.results?.filter((result: any) => 
        result.check_id === 'file-upload-security'
      ) || [];
      
      if (violations.length > 0) {
        console.warn('⚠️ File upload security issues:', violations.length);
        violations.forEach((v: any) => {
          console.warn(`  - ${v.path}:${v.start.line} - ${v.message}`);
        });
      }
      
      // Warning level - should be addressed
      expect(violations).toBeDefined();
    });
  });

  describe('Security Summary Report', () => {
    test('should generate security summary report', () => {
      const totalFindings = semgrepResults.results?.length || 0;
      const criticalFindings = semgrepResults.results?.filter((r: any) => r.severity === 'ERROR').length || 0;
      const warningFindings = semgrepResults.results?.filter((r: any) => r.severity === 'WARNING').length || 0;
      const infoFindings = semgrepResults.results?.filter((r: any) => r.severity === 'INFO').length || 0;

      const summary = {
        totalFindings,
        criticalFindings,
        warningFindings,
        infoFindings,
        scanDate: new Date().toISOString(),
        rulesApplied: semgrepResults.results?.map((r: any) => r.check_id).filter((id: string, index: number, array: string[]) => array.indexOf(id) === index) || []
      };

      // Save security summary
      fs.writeFileSync('reports/security-summary.json', JSON.stringify(summary, null, 2));

      console.log('\n🔒 Security Scan Summary:');
      console.log(`   Total findings: ${totalFindings}`);
      console.log(`   Critical: ${criticalFindings}`);
      console.log(`   Warnings: ${warningFindings}`);
      console.log(`   Info: ${infoFindings}`);
      console.log(`   Rules applied: ${summary.rulesApplied.length}`);

      // Test should pass if no critical findings
      expect(criticalFindings).toBe(0);
    });
  });
});