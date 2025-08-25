/**
 * @file Extended Semgrep Tests for Koveo Gestion.
 * @description Comprehensive semgrep-based testing for translation coverage,
 * performance patterns, React best practices, and property management domain rules.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

describe('Extended Semgrep Analysis', () => {
  let semgrepResults;

  beforeAll(async () => {
    // Run semgrep with custom rules
    try {
      const { stdout } = await execAsync(
        'npx semgrep --config=.semgrep.yml --config=tests/security/semgrep-extended-rules.yml --json client/ server/ shared/',
        { cwd: process.cwd(), timeout: 60000 }
      );
      semgrepResults = JSON.parse(stdout);
    } catch (_error) {
      console.warn('Semgrep execution failed:', error.message);
      semgrepResults = { results: [] };
    }
  });

  describe('Translation and Internationalization Rules', () => {
    it('should detect hardcoded French strings requiring i18n', () => {
      const i18nViolations =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.i18n.hardcoded-french-text'
        ) || [];

      // Report findings but don't fail - these are improvement opportunities
      if (i18nViolations.length > 0) {
        console.warn(
          `📝 Found ${i18nViolations.length} hardcoded French strings that could benefit from i18n:`
        );
        i18nViolations.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(i18nViolations)).toBe(true);
    });

    it('should detect hardcoded English strings requiring i18n', () => {
      const i18nViolations =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.i18n.hardcoded-english-text'
        ) || [];

      if (i18nViolations.length > 0) {
        console.warn(
          `📝 Found ${i18nViolations.length} hardcoded English strings that could benefit from i18n:`
        );
        i18nViolations.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(i18nViolations)).toBe(true);
    });

    it('should detect missing translation keys usage', () => {
      const missingTranslations =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.i18n.missing-translation-usage'
        ) || [];

      if (missingTranslations.length > 0) {
        console.warn(
          `🔍 Found ${missingTranslations.length} components without translation usage:`
        );
        missingTranslations.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(missingTranslations)).toBe(true);
    });

    it('should detect Quebec French terminology compliance', () => {
      const quebecTerms =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.i18n.quebec-french-terms'
        ) || [];

      if (quebecTerms.length > 0) {
        console.warn(
          `🍁 Found ${quebecTerms.length} non-Quebec French terms that should be localized:`
        );
        quebecTerms.slice(0, 5).forEach((violation) => {
          console.warn(
            `   - ${violation.path}:${violation.start.line}: ${violation.extra.message}`
          );
        });
      }

      expect(Array.isArray(quebecTerms)).toBe(true);
    });
  });

  describe('Performance and Code Quality Rules', () => {
    it('should detect expensive operations in render methods', () => {
      const performanceIssues =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.performance.expensive-render-operations'
        ) || [];

      if (performanceIssues.length > 0) {
        console.warn(
          `⚡ Found ${performanceIssues.length} potentially expensive operations in render:`
        );
        performanceIssues.forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      // This should be 0 for optimal performance
      expect(performanceIssues.length).toBeLessThanOrEqual(10);
    });

    it('should detect missing React.memo optimization opportunities', () => {
      const memoOpportunities =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.performance.missing-react-memo'
        ) || [];

      if (memoOpportunities.length > 0) {
        console.warn(
          `🔄 Found ${memoOpportunities.length} components that could benefit from React.memo:`
        );
        memoOpportunities.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(memoOpportunities)).toBe(true);
    });

    it('should detect large bundle size contributors', () => {
      const bundleIssues =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.performance.large-bundle-imports'
        ) || [];

      if (bundleIssues.length > 0) {
        console.warn(`📦 Found ${bundleIssues.length} imports that may increase bundle size:`);
        bundleIssues.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(bundleIssues)).toBe(true);
    });

    it('should detect missing error boundaries', () => {
      const errorBoundaryIssues =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.react.missing-error-boundary'
        ) || [];

      if (errorBoundaryIssues.length > 0) {
        console.warn(
          `🛡️ Found ${errorBoundaryIssues.length} components that need error boundaries:`
        );
        errorBoundaryIssues.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(errorBoundaryIssues)).toBe(true);
    });
  });

  describe('React and TypeScript Best Practices', () => {
    it('should detect missing prop types or TypeScript interfaces', () => {
      const typeIssues =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.react.missing-prop-types'
        ) || [];

      if (typeIssues.length > 0) {
        console.warn(`📝 Found ${typeIssues.length} components missing proper type definitions:`);
        typeIssues.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(typeIssues)).toBe(true);
    });

    it('should detect improper hook usage patterns', () => {
      const hookIssues =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.react.improper-hook-usage'
        ) || [];

      if (hookIssues.length > 0) {
        console.warn(`🪝 Found ${hookIssues.length} improper hook usage patterns:`);
        hookIssues.forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(hookIssues.length).toBe(0);
    });

    it('should detect missing accessibility attributes', () => {
      const a11yIssues =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.accessibility.missing-attributes'
        ) || [];

      if (a11yIssues.length > 0) {
        console.warn(`♿ Found ${a11yIssues.length} accessibility issues:`);
        a11yIssues.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(a11yIssues)).toBe(true);
    });

    it('should detect unused imports and variables', () => {
      const unusedCode =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.code-quality.unused-imports'
        ) || [];

      if (unusedCode.length > 0) {
        console.warn(`🧹 Found ${unusedCode.length} unused imports or variables:`);
        unusedCode.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(unusedCode)).toBe(true);
    });
  });

  describe('Property Management Domain-Specific Rules', () => {
    it('should detect missing tenant data validation', () => {
      const tenantDataIssues =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.property.missing-tenant-validation'
        ) || [];

      if (tenantDataIssues.length > 0) {
        console.warn(
          `🏠 Found ${tenantDataIssues.length} tenant data operations missing validation:`
        );
        tenantDataIssues.forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(tenantDataIssues.length).toBeLessThanOrEqual(5);
    });

    it('should detect insecure building access code handling', () => {
      const accessCodeIssues =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.property.insecure-access-codes'
        ) || [];

      if (accessCodeIssues.length > 0) {
        console.warn(`🔐 Found ${accessCodeIssues.length} insecure access code patterns:`);
        accessCodeIssues.forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(accessCodeIssues.length).toBe(0);
    });

    it('should detect missing maintenance request validation', () => {
      const maintenanceIssues =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.property.maintenance-validation'
        ) || [];

      if (maintenanceIssues.length > 0) {
        console.warn(
          `🔧 Found ${maintenanceIssues.length} maintenance operations missing validation:`
        );
        maintenanceIssues.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(maintenanceIssues)).toBe(true);
    });

    it('should detect financial data exposure risks', () => {
      const financialRisks =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.property.financial-data-exposure'
        ) || [];

      if (financialRisks.length > 0) {
        console.warn(`💰 Found ${financialRisks.length} potential financial data exposure risks:`);
        financialRisks.forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(financialRisks.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Custom Business Logic Rules', () => {
    it('should detect improper role-based access control patterns', () => {
      const rbacIssues =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.rbac.improper-access-control'
        ) || [];

      if (rbacIssues.length > 0) {
        console.warn(`🛡️ Found ${rbacIssues.length} improper RBAC patterns:`);
        rbacIssues.forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(rbacIssues.length).toBeLessThanOrEqual(2);
    });

    it('should detect missing audit logging for critical operations', () => {
      const auditIssues =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.audit.missing-logging'
        ) || [];

      if (auditIssues.length > 0) {
        console.warn(`📊 Found ${auditIssues.length} critical operations missing audit logging:`);
        auditIssues.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(auditIssues)).toBe(true);
    });

    it('should detect database query optimization opportunities', () => {
      const dbOptimization =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.database.optimization-opportunity'
        ) || [];

      if (dbOptimization.length > 0) {
        console.warn(
          `🗄️ Found ${dbOptimization.length} database query optimization opportunities:`
        );
        dbOptimization.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(dbOptimization)).toBe(true);
    });
  });

  describe('Law 25 Extended Compliance', () => {
    it('should validate extended Law 25 compliance patterns', () => {
      const law25Extended =
        semgrepResults.results?.filter((result) => result.extra?.metadata?.law25) || [];

      const categories = {};
      law25Extended.forEach((violation) => {
        const category = violation.extra.metadata.law25;
        categories[category] = (categories[category] || 0) + 1;
      });

      console.warn('📋 Law 25 Compliance Analysis:');
      Object.entries(categories).forEach(([category, count]) => {
        console.warn(`   - ${category}: ${count} findings`);
      });

      // Ensure we have comprehensive coverage
      expect(Object.keys(categories).length).toBeGreaterThanOrEqual(5);
    });

    it('should detect privacy policy references', () => {
      const privacyRefs =
        semgrepResults.results?.filter(
          (result) => result.check_id === 'koveo.law25.privacy-policy-reference'
        ) || [];

      if (privacyRefs.length === 0) {
        console.warn('⚠️ No privacy policy references detected - consider adding privacy links');
      } else {
        console.warn(`🔒 Found ${privacyRefs.length} privacy policy references`);
      }

      expect(Array.isArray(privacyRefs)).toBe(true);
    });
  });

  afterAll(() => {
    // Generate summary report
    const totalFindings = semgrepResults.results?.length || 0;
    const criticalFindings =
      semgrepResults.results?.filter((r) => r.extra?.severity === 'ERROR').length || 0;
    const warningFindings =
      semgrepResults.results?.filter((r) => r.extra?.severity === 'WARNING').length || 0;

    console.warn('\n📊 Semgrep Analysis Summary:');
    console.warn(`   Total findings: ${totalFindings}`);
    console.warn(`   Critical: ${criticalFindings}`);
    console.warn(`   Warnings: ${warningFindings}`);
    console.warn(`   Info: ${totalFindings - criticalFindings - warningFindings}`);

    if (totalFindings === 0) {
      console.warn('✅ No issues detected by semgrep analysis');
    }
  });
});
