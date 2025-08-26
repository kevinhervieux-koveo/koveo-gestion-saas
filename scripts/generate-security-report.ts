#!/usr/bin/env tsx

/**
 * Security Report Generator.
 *
 * Generates comprehensive security reports for Koveo Gestion
 * including Quebec Law 25 compliance status.
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Interface for security metrics data.
 */
interface SecurityMetrics {
  vulnerabilities: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
    info: number;
  };
  compliance: {
    quebec_law25: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
    authentication: 'SECURE' | 'INSECURE' | 'NEEDS_REVIEW';
    data_protection: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
  };
  recommendations: string[];
}

/**
 *
 */
class SecurityReportGenerator {
  private metrics: SecurityMetrics = {
    vulnerabilities: {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      info: 0,
    },
    compliance: {
      quebec_law25: 'NEEDS_REVIEW',
      authentication: 'NEEDS_REVIEW',
      data_protection: 'NEEDS_REVIEW',
    },
    recommendations: [],
  };

  /**
   *
   */
  async generateReport(): Promise<void> {
    console.warn('📋 Generating Comprehensive Security Report');
    console.warn('===========================================\n');

    // Collect security data
    await this.collectVulnerabilityData();
    await this.assessQuebecCompliance();
    await this.assessAuthenticationSecurity();
    await this.assessDataProtection();

    // Generate recommendations
    this.generateRecommendations();

    // Create reports
    this.createTextReport();
    this.createJsonReport();

    console.warn('✅ Security report generated successfully');
    console.warn('📁 Reports saved: security-report.md, security-report.json');
  }

  /**
   *
   */
  private async collectVulnerabilityData(): Promise<void> {
    console.warn('🔍 Collecting vulnerability data...');

    try {
      // Run npm audit and parse results
      const auditOutput = execSync('npm audit --json 2>/dev/null || echo "{}"', {
        encoding: 'utf-8',
      });

      const auditData = JSON.parse(auditOutput);

      if (auditData.metadata && auditData.metadata.vulnerabilities) {
        this.metrics.vulnerabilities = {
          critical: auditData.metadata.vulnerabilities.critical || 0,
          high: auditData.metadata.vulnerabilities.high || 0,
          moderate: auditData.metadata.vulnerabilities.moderate || 0,
          low: auditData.metadata.vulnerabilities.low || 0,
          info: auditData.metadata.vulnerabilities.info || 0,
        };
      }

      console.warn(
        `   Found ${this.metrics.vulnerabilities.critical + this.metrics.vulnerabilities.high} critical/high vulnerabilities`
      );
    } catch (_error) {
      console.warn('   Warning: Could not collect vulnerability data');
    }
  }

  /**
   *
   */
  private async assessQuebecCompliance(): Promise<void> {
    console.warn('🇨🇦 Assessing Quebec Law 25 compliance...');

    try {
      // Try to run Quebec compliance check
      execSync('tsx scripts/quebec-security-check.ts', {
        stdio: 'pipe',
        timeout: 30000,
      });

      this.metrics.compliance.quebec_law25 = 'COMPLIANT';
      console.warn('   ✅ Quebec Law 25: COMPLIANT');
    } catch (_error) {
      this.metrics.compliance.quebec_law25 = 'NON_COMPLIANT';
      console.warn('   ❌ Quebec Law 25: NON_COMPLIANT');
      this.metrics.recommendations.push(
        'Address Quebec Law 25 compliance issues identified in security check'
      );
    }
  }

  /**
   *
   */
  private async assessAuthenticationSecurity(): Promise<void> {
    console.warn('🔑 Assessing authentication security...');

    try {
      // Check if authentication files exist
      const authFiles = ['server/auth.ts', 'server/middleware/auth.ts', 'server/routes/auth.ts'];

      const hasAuthSystem = authFiles.some((file) => existsSync(join(process.cwd(), file)));

      if (hasAuthSystem) {
        // Check for secure patterns
        let securePatterns = 0;

        for (const file of authFiles) {
          const filePath = join(process.cwd(), file);
          if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf-8');

            if (content.includes('bcrypt') || content.includes('hash')) {
              securePatterns++;
            }
            if (content.includes('session') && content.includes('secure')) {
              securePatterns++;
            }
            if (content.includes('jwt') && content.includes('secret')) {
              securePatterns++;
            }
          }
        }

        if (securePatterns >= 2) {
          this.metrics.compliance.authentication = 'SECURE';
          console.warn('   ✅ Authentication: SECURE');
        } else {
          this.metrics.compliance.authentication = 'NEEDS_REVIEW';
          console.warn('   ⚠️  Authentication: NEEDS_REVIEW');
          this.metrics.recommendations.push(
            'Review authentication implementation for security best practices'
          );
        }
      } else {
        this.metrics.compliance.authentication = 'INSECURE';
        console.warn('   ❌ Authentication: NOT_FOUND');
        this.metrics.recommendations.push('Implement proper authentication system');
      }
    } catch (_error) {
      this.metrics.compliance.authentication = 'NEEDS_REVIEW';
      console.warn('   ⚠️  Authentication: ASSESSMENT_FAILED');
    }
  }

  /**
   *
   */
  private async assessDataProtection(): Promise<void> {
    console.warn('🛡️ Assessing data protection...');

    try {
      let protectionScore = 0;

      // Check for encryption libraries
      const packageJsonPath = join(process.cwd(), 'package.json');
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        if (deps.bcrypt || deps.crypto) {
          protectionScore++;
        }
        if (deps.helmet) {
          protectionScore++;
        }
        if (deps['express-session']) {
          protectionScore++;
        }
      }

      // Check for secure database connection
      if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('ssl')) {
        protectionScore++;
      }

      if (protectionScore >= 3) {
        this.metrics.compliance.data_protection = 'COMPLIANT';
        console.warn('   ✅ Data Protection: COMPLIANT');
      } else if (protectionScore >= 2) {
        this.metrics.compliance.data_protection = 'NEEDS_REVIEW';
        console.warn('   ⚠️  Data Protection: NEEDS_REVIEW');
        this.metrics.recommendations.push('Enhance data protection mechanisms');
      } else {
        this.metrics.compliance.data_protection = 'NON_COMPLIANT';
        console.warn('   ❌ Data Protection: NON_COMPLIANT');
        this.metrics.recommendations.push('Implement comprehensive data protection measures');
      }
    } catch (_error) {
      this.metrics.compliance.data_protection = 'NEEDS_REVIEW';
      console.warn('   ⚠️  Data Protection: ASSESSMENT_FAILED');
    }
  }

  /**
   *
   */
  private generateRecommendations(): void {
    // Add vulnerability-based recommendations
    if (this.metrics.vulnerabilities.critical > 0) {
      this.metrics.recommendations.unshift('URGENT: Address critical vulnerabilities immediately');
    }

    if (this.metrics.vulnerabilities.high > 3) {
      this.metrics.recommendations.push('Address high-severity vulnerabilities');
    }

    // Add general recommendations
    this.metrics.recommendations.push('Run security audits regularly (weekly minimum)');
    this.metrics.recommendations.push('Keep dependencies up to date');
    this.metrics.recommendations.push('Review and test authentication systems monthly');
    this.metrics.recommendations.push('Ensure Quebec Law 25 compliance documentation is current');
  }

  /**
   *
   */
  private createTextReport(): void {
    const timestamp = new Date().toISOString();

    const report = `# 🔒 Koveo Gestion Security Report

**Generated:** ${timestamp}
**Repository:** Koveo Gestion Property Management Platform
**Compliance Framework:** Quebec Law 25

## 📊 Executive Summary

| Metric | Status |
|--------|---------|
| Critical Vulnerabilities | ${this.metrics.vulnerabilities.critical} |
| High Vulnerabilities | ${this.metrics.vulnerabilities.high} |
| Quebec Law 25 | ${this.metrics.compliance.quebec_law25} |
| Authentication Security | ${this.metrics.compliance.authentication} |
| Data Protection | ${this.metrics.compliance.data_protection} |

## 🚨 Vulnerability Summary

- **Critical:** ${this.metrics.vulnerabilities.critical}
- **High:** ${this.metrics.vulnerabilities.high}
- **Moderate:** ${this.metrics.vulnerabilities.moderate}
- **Low:** ${this.metrics.vulnerabilities.low}
- **Info:** ${this.metrics.vulnerabilities.info}

## 🇨🇦 Quebec Law 25 Compliance

**Status:** ${this.metrics.compliance.quebec_law25}

Quebec Law 25 requires organizations to:
- ✅ Protect personal information with appropriate security measures
- ✅ Implement privacy by design principles
- ✅ Ensure data breach prevention and response capabilities
- ✅ Maintain consent management systems
- ✅ Provide data portability and deletion rights

## 🔐 Security Assessment

### Authentication & Authorization
**Status:** ${this.metrics.compliance.authentication}

### Data Protection
**Status:** ${this.metrics.compliance.data_protection}

## 📋 Recommendations

${this.metrics.recommendations.map((rec, _index) => `${index + 1}. ${rec}`).join('\n')}

## 🎯 Action Items

${
  this.metrics.vulnerabilities.critical > 0
    ? '🚨 **IMMEDIATE ACTION REQUIRED:** Critical vulnerabilities detected\n'
    : '✅ No critical vulnerabilities detected\n'
}

### Next Steps
1. Review and address all recommendations above
2. Schedule weekly security audits
3. Update security documentation
4. Train development team on Quebec Law 25 requirements
5. Implement automated security monitoring

---

*This report was generated automatically. For questions about Quebec Law 25 compliance, contact your legal compliance team.*`;

    writeFileSync('security-report.md', report);
  }

  /**
   *
   */
  private createJsonReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      repository: 'koveo-gestion',
      compliance_framework: 'Quebec Law 25',
      metrics: this.metrics,
      summary: {
        overall_status: this.getOverallStatus(),
        critical_issues: this.metrics.vulnerabilities.critical + this.metrics.vulnerabilities.high,
        compliance_level: this.getComplianceLevel(),
        recommendations_count: this.metrics.recommendations.length,
      },
    };

    writeFileSync('security-report.json', JSON.stringify(report, null, 2));
  }

  /**
   *
   */
  private getOverallStatus(): 'SECURE' | 'NEEDS_ATTENTION' | 'CRITICAL' {
    if (this.metrics.vulnerabilities.critical > 0) {
      return 'CRITICAL';
    }

    if (
      this.metrics.vulnerabilities.high > 3 ||
      this.metrics.compliance.quebec_law25 === 'NON_COMPLIANT'
    ) {
      return 'NEEDS_ATTENTION';
    }

    return 'SECURE';
  }

  /**
   *
   */
  private getComplianceLevel(): number {
    let score = 0;
    let total = 0;

    // Vulnerability score (40% weight)
    if (this.metrics.vulnerabilities.critical === 0) {
      score += 15;
    }
    if (this.metrics.vulnerabilities.high <= 3) {
      score += 25;
    }
    total += 40;

    // Compliance score (60% weight)
    if (this.metrics.compliance.quebec_law25 === 'COMPLIANT') {
      score += 20;
    } else if (this.metrics.compliance.quebec_law25 === 'NEEDS_REVIEW') {
      score += 10;
    }

    if (this.metrics.compliance.authentication === 'SECURE') {
      score += 20;
    } else if (this.metrics.compliance.authentication === 'NEEDS_REVIEW') {
      score += 10;
    }

    if (this.metrics.compliance.data_protection === 'COMPLIANT') {
      score += 20;
    } else if (this.metrics.compliance.data_protection === 'NEEDS_REVIEW') {
      score += 10;
    }

    total += 60;

    return Math.round((score / total) * 100);
  }
}

// Run the report generator
if (require.main === module) {
  const generator = new SecurityReportGenerator();
  generator.generateReport().catch((error) => {
    console.error('❌ Security report generation failed:', _error);
    process.exit(1);
  });
}

export default SecurityReportGenerator;
