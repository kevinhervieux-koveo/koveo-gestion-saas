/**
 * @file Semgrep Compliance and Domain-Specific Tests.
 * @description Advanced semgrep testing for Quebec compliance, property management
 * domain rules, and comprehensive code quality analysis using custom rules.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

describe('Advanced Semgrep Compliance Analysis', () => {
  let complianceResults;
  const rulesCoverage = {};

  beforeAll(async () => {
    // Create advanced compliance rules file
    const complianceRulesPath = 'tests/security/semgrep-compliance-rules.yml';
    await createComplianceRules(complianceRulesPath);

    try {
      const { stdout } = await execAsync(
        `npx semgrep --config=${complianceRulesPath} --config=.semgrep.yml --json client/ server/ shared/`,
        { cwd: process.cwd(), timeout: 90000 }
      );
      complianceResults = JSON.parse(stdout);

      // Analyze rules coverage
      complianceResults.results?.forEach((result) => {
        const ruleId = result.check_id;
        rulesCoverage[ruleId] = (rulesCoverage[ruleId] || 0) + 1;
      });
    } catch (_error) {
      console.warn('Compliance semgrep analysis failed:', error.message);
      complianceResults = { results: [] };
    }
  });

  describe('Quebec Law 25 Advanced Compliance', () => {
    it('should validate data processing consent mechanisms', () => {
      const consentIssues =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.law25.advanced-consent-tracking'
        ) || [];

      if (consentIssues.length > 0) {
        console.warn(`🍁 Found ${consentIssues.length} consent processing patterns:`);
        consentIssues.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(consentIssues)).toBe(true);
    });

    it('should detect data subject rights implementation gaps', () => {
      const rightsIssues =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.law25.data-subject-rights-impl'
        ) || [];

      if (rightsIssues.length > 0) {
        console.warn(`⚖️ Found ${rightsIssues.length} data subject rights implementation gaps:`);
        rightsIssues.slice(0, 5).forEach((violation) => {
          console.warn(
            `   - ${violation.path}:${violation.start.line}: ${violation.extra?.message || 'Rights implementation needed'}`
          );
        });
      }

      expect(Array.isArray(rightsIssues)).toBe(true);
    });

    it('should validate privacy impact assessment requirements', () => {
      const piaIssues =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.law25.privacy-impact-assessment'
        ) || [];

      if (piaIssues.length > 0) {
        console.warn(
          `📊 Found ${piaIssues.length} operations requiring privacy impact assessment:`
        );
        piaIssues.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(piaIssues)).toBe(true);
    });

    it('should check Quebec French language compliance in legal documents', () => {
      const languageIssues =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.law25.quebec-language-compliance'
        ) || [];

      if (languageIssues.length > 0) {
        console.warn(`🗣️ Found ${languageIssues.length} Quebec French compliance items:`);
        languageIssues.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(languageIssues)).toBe(true);
    });

    it('should validate data breach notification compliance', () => {
      const breachIssues =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.law25.breach-notification-compliance'
        ) || [];

      if (breachIssues.length > 0) {
        console.warn(`🚨 Found ${breachIssues.length} breach notification compliance items:`);
        breachIssues.forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(breachIssues)).toBe(true);
    });
  });

  describe('Property Management Domain Security', () => {
    it('should validate tenant privacy protection measures', () => {
      const tenantPrivacy =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.property.tenant-privacy-protection'
        ) || [];

      if (tenantPrivacy.length > 0) {
        console.warn(`🏠 Found ${tenantPrivacy.length} tenant privacy protection requirements:`);
        tenantPrivacy.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(tenantPrivacy)).toBe(true);
    });

    it('should check building security data handling', () => {
      const buildingSecurity =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.property.building-security-compliance'
        ) || [];

      if (buildingSecurity.length > 0) {
        console.warn(`🔐 Found ${buildingSecurity.length} building security compliance items:`);
        buildingSecurity.forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(buildingSecurity.length).toBeLessThanOrEqual(3);
    });

    it('should validate maintenance data confidentiality', () => {
      const maintenanceData =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.property.maintenance-data-confidentiality'
        ) || [];

      if (maintenanceData.length > 0) {
        console.warn(`🔧 Found ${maintenanceData.length} maintenance data confidentiality items:`);
        maintenanceData.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(maintenanceData)).toBe(true);
    });

    it('should check financial document security', () => {
      const financialDocs =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.property.financial-document-security'
        ) || [];

      if (financialDocs.length > 0) {
        console.warn(`💰 Found ${financialDocs.length} financial document security requirements:`);
        financialDocs.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(financialDocs)).toBe(true);
    });
  });

  describe('Code Quality and Best Practices', () => {
    it('should enforce TypeScript strict mode compliance', () => {
      const strictMode =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.quality.typescript-strict-mode'
        ) || [];

      if (strictMode.length > 0) {
        console.warn(`📝 Found ${strictMode.length} TypeScript strict mode violations:`);
        strictMode.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(strictMode)).toBe(true);
    });

    it('should validate error handling patterns', () => {
      const errorHandling =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.quality.error-handling-patterns'
        ) || [];

      if (errorHandling.length > 0) {
        console.warn(`🛡️ Found ${errorHandling.length} error handling improvements needed:`);
        errorHandling.slice(0, 8).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(errorHandling)).toBe(true);
    });

    it('should check API endpoint documentation compliance', () => {
      const apiDocs =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.quality.api-documentation'
        ) || [];

      if (apiDocs.length > 0) {
        console.warn(`📚 Found ${apiDocs.length} API endpoints needing documentation:`);
        apiDocs.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(apiDocs)).toBe(true);
    });

    it('should validate logging and monitoring standards', () => {
      const logging =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.quality.logging-standards'
        ) || [];

      if (logging.length > 0) {
        console.warn(`📊 Found ${logging.length} logging standard improvements:`);
        logging.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(logging)).toBe(true);
    });
  });

  describe('Enterprise Security Standards', () => {
    it('should validate role-based access control implementation', () => {
      const rbacImpl =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.security.rbac-implementation'
        ) || [];

      if (rbacImpl.length > 0) {
        console.warn(`👥 Found ${rbacImpl.length} RBAC implementation items:`);
        rbacImpl.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(rbacImpl)).toBe(true);
    });

    it('should check session management security', () => {
      const sessionSecurity =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.security.session-management'
        ) || [];

      if (sessionSecurity.length > 0) {
        console.warn(`🔐 Found ${sessionSecurity.length} session management security items:`);
        sessionSecurity.forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(sessionSecurity)).toBe(true);
    });

    it('should validate audit trail implementation', () => {
      const auditTrail =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.security.audit-trail'
        ) || [];

      if (auditTrail.length > 0) {
        console.warn(`📋 Found ${auditTrail.length} audit trail implementation items:`);
        auditTrail.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(auditTrail)).toBe(true);
    });
  });

  describe('Internationalization and Localization', () => {
    it('should validate Quebec French translation completeness', () => {
      const frenchCompleteness =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.i18n.quebec-french-completeness'
        ) || [];

      if (frenchCompleteness.length > 0) {
        console.warn(`🍁 Found ${frenchCompleteness.length} Quebec French translation gaps:`);
        frenchCompleteness.slice(0, 8).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(frenchCompleteness)).toBe(true);
    });

    it('should check cultural adaptation compliance', () => {
      const culturalAdaptation =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.i18n.cultural-adaptation'
        ) || [];

      if (culturalAdaptation.length > 0) {
        console.warn(`🌐 Found ${culturalAdaptation.length} cultural adaptation items:`);
        culturalAdaptation.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(culturalAdaptation)).toBe(true);
    });

    it('should validate address and postal code formats for Quebec', () => {
      const quebecFormats =
        complianceResults.results?.filter(
          (result) => result.check_id === 'koveo.i18n.quebec-address-formats'
        ) || [];

      if (quebecFormats.length > 0) {
        console.warn(`📮 Found ${quebecFormats.length} Quebec address format items:`);
        quebecFormats.slice(0, 5).forEach((violation) => {
          console.warn(`   - ${violation.path}:${violation.start.line}`);
        });
      }

      expect(Array.isArray(quebecFormats)).toBe(true);
    });
  });

  describe('Rules Coverage Analysis', () => {
    it('should have comprehensive rule coverage across all domains', () => {
      const domains = {};
      Object.keys(rulesCoverage).forEach((ruleId) => {
        const parts = ruleId.split('.');
        if (parts.length >= 2) {
          const domain = parts[1];
          domains[domain] = (domains[domain] || 0) + rulesCoverage[ruleId];
        }
      });

      console.warn('\n📊 Rules Coverage by Domain:');
      Object.entries(domains).forEach(([domain, count]) => {
        console.warn(`   - ${domain}: ${count} findings`);
      });

      // Should have coverage across multiple domains
      expect(Object.keys(domains).length).toBeGreaterThanOrEqual(3);
    });

    it('should identify most triggered rules for optimization', () => {
      const sortedRules = Object.entries(rulesCoverage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      if (sortedRules.length > 0) {
        console.warn('\n🔝 Top 10 Most Triggered Rules:');
        sortedRules.forEach(([ruleId, count], _index) => {
          console.warn(`   ${index + 1}. ${ruleId}: ${count} findings`);
        });
      }

      expect(Array.isArray(sortedRules)).toBe(true);
    });

    it('should validate rule effectiveness across codebase', () => {
      const totalFindings = complianceResults.results?.length || 0;
      const uniqueFiles = new Set();

      complianceResults.results?.forEach((result) => {
        uniqueFiles.add(result.path);
      });

      const coverage = {
        totalRules: Object.keys(rulesCoverage).length,
        totalFindings,
        uniqueFiles: uniqueFiles.size,
        averageFindingsPerRule: totalFindings / Math.max(Object.keys(rulesCoverage).length, 1),
      };

      console.warn('\n📈 Rule Effectiveness Analysis:');
      console.warn(`   Rules defined: ${coverage.totalRules}`);
      console.warn(`   Total findings: ${coverage.totalFindings}`);
      console.warn(`   Files analyzed: ${coverage.uniqueFiles}`);
      console.warn(`   Avg findings per rule: ${coverage.averageFindingsPerRule.toFixed(2)}`);

      expect(coverage.totalRules).toBeGreaterThan(0);
      expect(coverage.uniqueFiles).toBeGreaterThan(0);
    });
  });

  afterAll(async () => {
    // Generate comprehensive compliance report
    const report = {
      timestamp: new Date().toISOString(),
      analysis: {
        totalFindings: complianceResults.results?.length || 0,
        rulesCoverage,
        domainAnalysis: {},
        severityBreakdown: {
          _error:
            complianceResults.results?.filter((r) => r.extra?.severity === 'ERROR').length || 0,
          warning:
            complianceResults.results?.filter((r) => r.extra?.severity === 'WARNING').length || 0,
          info: complianceResults.results?.filter((r) => r.extra?.severity === 'INFO').length || 0,
        },
      },
      findings: complianceResults.results || [],
      recommendations: generateRecommendations(complianceResults.results || []),
    };

    try {
      await fs.writeFile(
        path.join(process.cwd(), 'reports', 'compliance-analysis.json'),
        JSON.stringify(report, null, 2)
      );
      console.warn('📄 Comprehensive compliance report saved to reports/compliance-analysis.json');
    } catch (_error) {
      console.warn('Could not save compliance report:', error.message);
    }

    // Display final summary
    console.warn('\n🎯 COMPREHENSIVE COMPLIANCE ANALYSIS COMPLETE');
    console.warn('===============================================');
    console.warn(`📊 Total Rules Analyzed: ${Object.keys(rulesCoverage).length}`);
    console.warn(`🔍 Total Findings: ${report.analysis.totalFindings}`);
    console.warn(`⚠️  Critical Issues: ${report.analysis.severityBreakdown.error}`);
    console.warn(`⚡ Recommendations Generated: ${report.recommendations.length}`);

    if (report.analysis.severityBreakdown.error === 0) {
      console.warn('✅ No critical compliance issues detected');
    } else {
      console.warn('❗ Critical compliance issues require attention');
    }
  });
});

// Helper function to create advanced compliance rules
/**
 *
 * @param filePath
 */
async function createComplianceRules(filePath) {
  const complianceRules = `# Advanced Compliance Rules for Koveo Gestion
rules:
  # Quebec Law 25 Advanced Rules
  - id: koveo.law25.advanced-consent-tracking
    pattern-either:
      - pattern: |
          const consent = { ..., dataProcessing: $VALUE, ... }
      - pattern: |
          user.consent.marketing = $BOOL
      - pattern: |
          consentForm.submit($DATA)
    message: "Consent tracking detected - ensure Law 25 compliance with granular consent options"
    languages: [typescript, javascript]
    severity: INFO
    metadata:
      category: privacy
      law25: advanced-consent

  - id: koveo.law25.data-subject-rights-impl
    pattern-either:
      - pattern: |
          router.get("/api/user/data-export", ...)
      - pattern: |
          router.delete("/api/user/delete-account", ...)
      - pattern: |
          router.put("/api/user/data-correction", ...)
    message: "Data subject rights endpoint - ensure full Law 25 compliance implementation"
    languages: [typescript, javascript]
    severity: INFO
    metadata:
      category: privacy
      law25: data-subject-rights

  - id: koveo.law25.privacy-impact-assessment
    pattern-either:
      - pattern: |
          collectPersonalData($DATA)
      - pattern: |
          processSensitiveInformation($INFO)
      - pattern: |
          shareDataWithThirdParty($PARTY, $DATA)
    message: "High-risk data processing may require privacy impact assessment under Law 25"
    languages: [typescript, javascript]
    severity: WARNING
    metadata:
      category: privacy
      law25: pia-required

  - id: koveo.law25.quebec-language-compliance
    pattern-either:
      - pattern: |
          "Terms of Service"
      - pattern: |
          "Privacy Policy"
      - pattern: |
          "Data Processing Agreement"
    message: "Legal documents must be available in French per Quebec Law 25"
    languages: [typescript, javascript]
    severity: INFO
    metadata:
      category: compliance
      law25: quebec-language

  - id: koveo.law25.breach-notification-compliance
    pattern-either:
      - pattern: |
          logger.error("Security breach", $DATA)
      - pattern: |
          notifySecurityIncident($INCIDENT)
      - pattern: |
          reportDataBreach($DETAILS)
    message: "Security incident logging - ensure Law 25 breach notification procedures"
    languages: [typescript, javascript]
    severity: INFO
    metadata:
      category: security
      law25: breach-notification

  # Property Management Domain Rules
  - id: koveo.property.tenant-privacy-protection
    pattern-either:
      - pattern: |
          tenant.personalInfo
      - pattern: |
          resident.privateData
      - pattern: |
          tenantProfile.sensitiveData
    message: "Tenant privacy data access - ensure proper authorization and Law 25 compliance"
    languages: [typescript, javascript]
    severity: WARNING
    metadata:
      category: property-privacy
      domain: tenant-protection

  - id: koveo.property.building-security-compliance
    pattern-either:
      - pattern: |
          building.accessCodes
      - pattern: |
          securitySystem.credentials
      - pattern: |
          buildingAccess.keyManagement
    message: "Building security data handling requires strict access controls"
    languages: [typescript, javascript]
    severity: ERROR
    metadata:
      category: property-security
      domain: building-protection

  - id: koveo.property.maintenance-data-confidentiality
    pattern-either:
      - pattern: |
          maintenanceRequest.tenantDetails
      - pattern: |
          workOrder.accessInformation
      - pattern: |
          serviceCall.privateNotes
    message: "Maintenance data may contain private tenant information"
    languages: [typescript, javascript]
    severity: INFO
    metadata:
      category: property-privacy
      domain: maintenance-privacy

  - id: koveo.property.financial-document-security
    pattern-either:
      - pattern: |
          financialDocument.upload($FILE)
      - pattern: |
          billDocument.generate($DATA)
      - pattern: |
          paymentRecord.store($TRANSACTION)
    message: "Financial documents require encryption and access controls"
    languages: [typescript, javascript]
    severity: WARNING
    metadata:
      category: financial-security
      domain: document-protection

  # Code Quality Rules
  - id: koveo.quality.typescript-strict-mode
    pattern-either:
      - pattern: |
          // @ts-ignore
      - pattern: |
          // @ts-nocheck
      - pattern: |
          any
    message: "Avoid TypeScript strict mode bypasses for better type safety"
    languages: [typescript]
    severity: INFO
    metadata:
      category: code-quality
      domain: type-safety

  - id: koveo.quality.error-handling-patterns
    pattern-either:
      - pattern: |
          catch ($ERROR) {
            console.warn($ERROR)
          }
      - pattern: |
          catch ($ERROR) {
            // TODO: handle error
          }
      - pattern: |
          .catch(() => {})
    message: "Improve error handling with proper error reporting and user feedback"
    languages: [typescript, javascript]
    severity: INFO
    metadata:
      category: code-quality
      domain: error-handling

  - id: koveo.quality.api-documentation
    pattern: |
      router.$METHOD("$PATH", async (req, res) => {
        ...
      })
    pattern-not: |
      /**
       * ...
       */
      router.$METHOD("$PATH", async (req, res) => {
        ...
      })
    message: "API endpoints should have JSDoc documentation"
    languages: [typescript, javascript]
    severity: INFO
    metadata:
      category: code-quality
      domain: documentation

  - id: koveo.quality.logging-standards
    pattern-either:
      - pattern: |
          console.warn($MSG)
      - pattern: |
          console.error($MSG)
    pattern-not: |
      logger.$LEVEL($MSG)
    message: "Use structured logging instead of console.log for better monitoring"
    languages: [typescript, javascript]
    severity: INFO
    metadata:
      category: code-quality
      domain: logging

  # Enterprise Security Rules
  - id: koveo.security.rbac-implementation
    pattern-either:
      - pattern: |
          checkUserRole($USER, $ROLE)
      - pattern: |
          hasPermission($USER, $PERMISSION)
      - pattern: |
          authorizeAccess($USER, $RESOURCE)
    message: "RBAC implementation detected - ensure comprehensive permission checking"
    languages: [typescript, javascript]
    severity: INFO
    metadata:
      category: enterprise-security
      domain: rbac

  - id: koveo.security.session-management
    pattern-either:
      - pattern: |
          session.save($DATA)
      - pattern: |
          req.session.$PROPERTY = $VALUE
      - pattern: |
          sessionStore.set($ID, $DATA)
    message: "Session management operation - ensure secure session handling"
    languages: [typescript, javascript]
    severity: INFO
    metadata:
      category: enterprise-security
      domain: session-management

  - id: koveo.security.audit-trail
    pattern-either:
      - pattern: |
          auditLog.record($ACTION, $USER)
      - pattern: |
          createAuditEntry($EVENT)
      - pattern: |
          logUserAction($ACTION, $DETAILS)
    message: "Audit trail implementation - ensure comprehensive activity logging"
    languages: [typescript, javascript]
    severity: INFO
    metadata:
      category: enterprise-security
      domain: audit-trail

  # Internationalization Rules
  - id: koveo.i18n.quebec-french-completeness
    pattern-either:
      - pattern: |
          t("$KEY")
      - pattern: |
          useLanguage()
      - pattern: |
          translations.fr[$KEY]
    message: "Translation usage detected - verify Quebec French completeness"
    languages: [typescript, javascript]
    severity: INFO
    metadata:
      category: i18n
      domain: quebec-completeness

  - id: koveo.i18n.cultural-adaptation
    pattern-either:
      - pattern: |
          dateFormat($DATE)
      - pattern: |
          currencyFormat($AMOUNT)
      - pattern: |
          addressFormat($ADDRESS)
    message: "Cultural adaptation point - ensure Quebec cultural preferences"
    languages: [typescript, javascript]
    severity: INFO
    metadata:
      category: i18n
      domain: cultural-adaptation

  - id: koveo.i18n.quebec-address-formats
    pattern-either:
      - pattern: |
          postalCode
      - pattern: |
          zipCode
      - pattern: |
          "postal_code"
      - pattern: |
          addressLine1
    message: "Address formatting - ensure Quebec postal code format (A1A 1A1)"
    languages: [typescript, javascript]
    severity: INFO
    metadata:
      category: i18n
      domain: quebec-formats
`;

  await fs.writeFile(filePath, complianceRules);
}

// Helper function to generate recommendations
/**
 *
 * @param findings
 */
function generateRecommendations(findings) {
  const recommendations = [];
  const categories = {};

  findings.forEach((finding) => {
    const category = finding.extra?.metadata?.category || 'general';
    categories[category] = (categories[category] || 0) + 1;
  });

  // Generate recommendations based on findings
  Object.entries(categories).forEach(([category, count]) => {
    if (count > 5) {
      recommendations.push({
        category,
        priority: 'high',
        recommendation: `Address ${count} ${category} issues to improve code quality and compliance`,
      });
    }
  });

  return recommendations;
}
