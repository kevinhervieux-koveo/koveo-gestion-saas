#!/usr/bin/env tsx

/**
 * Quebec Law 25 Security Compliance Check.
 * 
 * This script validates Quebec Law 25 privacy and security requirements
 * for the Koveo Gestion property management platform.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, lstatSync } from 'fs';
import { join } from 'path';

/**
 *
 */
interface ComplianceResult {
  category: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: string[];
}

/**
 *
 */
class QuebecSecurityChecker {
  private results: ComplianceResult[] = [];
  private criticalIssues = 0;
  private warnings = 0;

  /**
   * Main entry point for Quebec Law 25 compliance checking.
   */
  async runCompliance(): Promise<void> {
    console.log('🇨🇦 Quebec Law 25 Security Compliance Check');
    console.log('============================================\n');

    // Run all compliance checks
    await this.checkPersonalDataProtection();
    await this.checkDataEncryption();
    await this.checkAccessControls();
    await this.checkDataStorageCompliance();
    await this.checkPrivacyByDesign();
    await this.checkSecurityIncidentPrevention();
    await this.checkConsentManagement();
    await this.checkDataRetention();

    // Generate report
    this.generateReport();
    
    // Exit with appropriate code
    if (this.criticalIssues > 0) {
      console.log(`\n❌ COMPLIANCE FAILURE: ${this.criticalIssues} critical issues found`);
      process.exit(1);
    }
    
    if (this.warnings > 0) {
      console.log(`\n⚠️  COMPLIANCE WARNING: ${this.warnings} warnings found`);
    } else {
      console.log('\n✅ ALL QUEBEC LAW 25 COMPLIANCE CHECKS PASSED');
    }
  }

  /**
   * Check personal data protection mechanisms.
   */
  private async checkPersonalDataProtection(): Promise<void> {
    console.log('🔐 Checking Personal Data Protection...');
    
    // Check for proper data classification
    const sensitiveDataFiles = this.findFiles(['server', 'shared'], /\.(ts|js)$/);
    const dataClassificationIssues: string[] = [];
    
    for (const file of sensitiveDataFiles) {
      const content = readFileSync(file, 'utf-8');
      
      // Look for hardcoded sensitive data patterns
      const sensitivePatterns = [
        /sin[\s_-]*number/i,
        /social[\s_-]*insurance/i,
        /numero[\s_-]*assurance[\s_-]*sociale/i,
        /credit[\s_-]*card/i,
        /carte[\s_-]*credit/i,
        /password[\s_-]*=[\s_-]*["'][^"']+["']/i,
      ];
      
      for (const pattern of sensitivePatterns) {
        if (pattern.test(content)) {
          dataClassificationIssues.push(`${file}: Contains potential sensitive data pattern`);
        }
      }
    }
    
    if (dataClassificationIssues.length > 0) {
      this.addResult('Personal Data Protection', 'FAIL', 
        'Potential sensitive data exposure found', dataClassificationIssues);
      this.criticalIssues++;
    } else {
      this.addResult('Personal Data Protection', 'PASS', 
        'No hardcoded sensitive data patterns found');
    }
  }

  /**
   * Check data encryption compliance.
   */
  private async checkDataEncryption(): Promise<void> {
    console.log('🔒 Checking Data Encryption Compliance...');
    
    const encryptionIssues: string[] = [];
    
    // Check for encryption libraries
    const packageJsonPath = join(process.cwd(), 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      const encryptionLibs = ['bcrypt', 'crypto', 'node-forge', 'helmet'];
      const missingLibs = encryptionLibs.filter(lib => !deps[lib] && !Object.keys(deps).some(dep => dep.includes(lib)));
      
      if (missingLibs.length > 0) {
        encryptionIssues.push(`Missing encryption libraries: ${missingLibs.join(', ')}`);
      }
    }
    
    // Check for secure session configuration
    const serverFiles = this.findFiles(['server'], /\.(ts|js)$/);
    let sessionSecurityFound = false;
    
    for (const file of serverFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('express-session') && content.includes('secure: true') && content.includes('httpOnly: true')) {
        sessionSecurityFound = true;
        break;
      }
    }
    
    if (!sessionSecurityFound) {
      encryptionIssues.push('Secure session configuration not found');
    }
    
    // Check for HTTPS enforcement
    let httpsEnforcement = false;
    for (const file of serverFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('helmet') || content.includes('hsts') || content.includes('forceSSL')) {
        httpsEnforcement = true;
        break;
      }
    }
    
    if (!httpsEnforcement) {
      encryptionIssues.push('HTTPS enforcement not properly configured');
    }
    
    if (encryptionIssues.length > 0) {
      this.addResult('Data Encryption', 'FAIL', 
        'Encryption compliance issues found', encryptionIssues);
      this.criticalIssues++;
    } else {
      this.addResult('Data Encryption', 'PASS', 
        'Data encryption properly implemented');
    }
  }

  /**
   * Check access control mechanisms.
   */
  private async checkAccessControls(): Promise<void> {
    console.log('🔑 Checking Access Controls...');
    
    const accessControlIssues: string[] = [];
    const serverFiles = this.findFiles(['server'], /\.(ts|js)$/);
    
    // Check for authentication middleware
    let authMiddlewareFound = false;
    let authorizationFound = false;
    
    for (const file of serverFiles) {
      const content = readFileSync(file, 'utf-8');
      
      if (content.includes('requireAuth') || content.includes('authenticate')) {
        authMiddlewareFound = true;
      }
      
      if (content.includes('authorize') || content.includes('permissions') || content.includes('role')) {
        authorizationFound = true;
      }
    }
    
    if (!authMiddlewareFound) {
      accessControlIssues.push('Authentication middleware not found');
    }
    
    if (!authorizationFound) {
      accessControlIssues.push('Authorization system not properly implemented');
    }
    
    // Check for protected routes
    let protectedRoutesFound = false;
    for (const file of serverFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('requireAuth') && (content.includes('app.get') || content.includes('app.post'))) {
        protectedRoutesFound = true;
        break;
      }
    }
    
    if (!protectedRoutesFound) {
      accessControlIssues.push('Protected routes not properly configured');
    }
    
    if (accessControlIssues.length > 0) {
      this.addResult('Access Controls', 'FAIL', 
        'Access control issues found', accessControlIssues);
      this.criticalIssues++;
    } else {
      this.addResult('Access Controls', 'PASS', 
        'Access controls properly implemented');
    }
  }

  /**
   * Check data storage compliance for Quebec Law 25.
   */
  private async checkDataStorageCompliance(): Promise<void> {
    console.log('💾 Checking Data Storage Compliance...');
    
    const storageIssues: string[] = [];
    const clientFiles = this.findFiles(['client/src'], /\.(ts|tsx)$/);
    
    // Check for inappropriate client-side storage
    for (const file of clientFiles) {
      const content = readFileSync(file, 'utf-8');
      
      // Look for localStorage/sessionStorage with sensitive data
      const sensitiveStoragePattern = /(localStorage|sessionStorage).*\.(set|getItem).*?(personal|private|sensitive|password|token|user)/i;
      if (sensitiveStoragePattern.test(content)) {
        storageIssues.push(`${file}: Potential sensitive data in browser storage`);
      }
      
      // Check for unencrypted data transmission
      if (content.includes('http://') && !content.includes('localhost')) {
        storageIssues.push(`${file}: Insecure HTTP connection found`);
      }
    }
    
    // Check database configuration
    const serverFiles = this.findFiles(['server'], /\.(ts|js)$/);
    let databaseSecurityFound = false;
    
    for (const file of serverFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('sslmode') || content.includes('ssl: true') || content.includes('DATABASE_URL')) {
        databaseSecurityFound = true;
        break;
      }
    }
    
    if (!databaseSecurityFound) {
      storageIssues.push('Database SSL/security configuration not found');
    }
    
    if (storageIssues.length > 0) {
      this.addResult('Data Storage Compliance', 'FAIL', 
        'Data storage compliance issues found', storageIssues);
      this.criticalIssues++;
    } else {
      this.addResult('Data Storage Compliance', 'PASS', 
        'Data storage properly secured for Quebec Law 25');
    }
  }

  /**
   * Check privacy by design implementation.
   */
  private async checkPrivacyByDesign(): Promise<void> {
    console.log('🛡️ Checking Privacy by Design...');
    
    const privacyIssues: string[] = [];
    
    // Check for data minimization
    const schemaFile = join(process.cwd(), 'shared', 'schema.ts');
    if (existsSync(schemaFile)) {
      const content = readFileSync(schemaFile, 'utf-8');
      
      // Look for optional/nullable fields indicating data minimization
      if (!content.includes('optional()') && !content.includes('nullable()')) {
        privacyIssues.push('Data minimization not evident in schema design');
      }
    }
    
    // Check for consent management
    const clientFiles = this.findFiles(['client/src'], /\.(ts|tsx)$/);
    let consentMechanismFound = false;
    
    for (const file of clientFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('consent') || content.includes('agree') || content.includes('privacy')) {
        consentMechanismFound = true;
        break;
      }
    }
    
    if (!consentMechanismFound) {
      privacyIssues.push('Consent management mechanism not found');
    }
    
    // Check for data retention policies
    let dataRetentionFound = false;
    const serverFiles = this.findFiles(['server'], /\.(ts|js)$/);
    
    for (const file of serverFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('delete') || content.includes('expire') || content.includes('retention')) {
        dataRetentionFound = true;
        break;
      }
    }
    
    if (!dataRetentionFound) {
      this.warnings++;
      this.addResult('Privacy by Design', 'WARNING', 
        'Data retention mechanisms should be more evident');
    }
    
    if (privacyIssues.length > 0) {
      this.addResult('Privacy by Design', 'FAIL', 
        'Privacy by design issues found', privacyIssues);
      this.criticalIssues++;
    } else if (this.results[this.results.length - 1]?.status !== 'WARNING') {
      this.addResult('Privacy by Design', 'PASS', 
        'Privacy by design principles implemented');
    }
  }

  /**
   * Check security incident prevention.
   */
  private async checkSecurityIncidentPrevention(): Promise<void> {
    console.log('🚨 Checking Security Incident Prevention...');
    
    const securityIssues: string[] = [];
    
    // Check for input validation
    const serverFiles = this.findFiles(['server'], /\.(ts|js)$/);
    let inputValidationFound = false;
    
    for (const file of serverFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('validate') || content.includes('sanitize') || content.includes('zod')) {
        inputValidationFound = true;
        break;
      }
    }
    
    if (!inputValidationFound) {
      securityIssues.push('Input validation not properly implemented');
    }
    
    // Check for SQL injection protection
    let sqlInjectionProtection = true;
    for (const file of serverFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.match(/SELECT.*\+|INSERT.*\+|UPDATE.*\+|DELETE.*\+/)) {
        securityIssues.push(`${file}: Potential SQL injection vulnerability`);
        sqlInjectionProtection = false;
      }
    }
    
    // Check for logging security
    let secureLoggingFound = true;
    for (const file of serverFiles) {
      const content = readFileSync(file, 'utf-8');
      if (content.match(/console\.log.*password|console\.log.*token|console\.log.*secret/i)) {
        securityIssues.push(`${file}: Sensitive data in logs`);
        secureLoggingFound = false;
      }
    }
    
    if (securityIssues.length > 0) {
      this.addResult('Security Incident Prevention', 'FAIL', 
        'Security vulnerabilities found', securityIssues);
      this.criticalIssues++;
    } else {
      this.addResult('Security Incident Prevention', 'PASS', 
        'Security incident prevention measures in place');
    }
  }

  /**
   * Check consent management compliance.
   */
  private async checkConsentManagement(): Promise<void> {
    console.log('✋ Checking Consent Management...');
    
    // This is a placeholder for consent management checks
    // In a real implementation, you would check for:
    // - Consent capture mechanisms
    // - Consent withdrawal options
    // - Consent audit trails
    // - Age verification for minors
    
    this.addResult('Consent Management', 'WARNING', 
      'Consent management implementation should be reviewed manually');
    this.warnings++;
  }

  /**
   * Check data retention policies.
   */
  private async checkDataRetention(): Promise<void> {
    console.log('📅 Checking Data Retention Policies...');
    
    // This is a placeholder for data retention checks
    // In a real implementation, you would check for:
    // - Automated data deletion
    // - Retention period enforcement
    // - Data archival processes
    
    this.addResult('Data Retention', 'WARNING', 
      'Data retention policies should be reviewed and implemented');
    this.warnings++;
  }

  /**
   * Helper method to find files matching a pattern.
   * @param directories
   * @param pattern
   */
  private findFiles(directories: string[], pattern: RegExp): string[] {
    const files: string[] = [];
    
    const scanDirectory = (dir: string) => {
      const fullPath = join(process.cwd(), dir);
      if (!existsSync(fullPath)) {return;}
      
      const items = readdirSync(fullPath);
      for (const item of items) {
        const itemPath = join(fullPath, item);
        const stat = lstatSync(itemPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scanDirectory(join(dir, item));
        } else if (stat.isFile() && pattern.test(item)) {
          files.push(itemPath);
        }
      }
    };
    
    for (const directory of directories) {
      scanDirectory(directory);
    }
    
    return files;
  }

  /**
   * Add a compliance result.
   * @param category
   * @param status
   * @param message
   * @param details
   */
  private addResult(category: string, status: 'PASS' | 'FAIL' | 'WARNING', message: string, details?: string[]): void {
    this.results.push({ category, status, message, details });
  }

  /**
   * Generate compliance report.
   */
  private generateReport(): void {
    console.log('\n📋 Quebec Law 25 Compliance Report');
    console.log('=====================================\n');
    
    for (const result of this.results) {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
      console.log(`${icon} ${result.category}: ${result.message}`);
      
      if (result.details && result.details.length > 0) {
        result.details.forEach(detail => {
          console.log(`   - ${detail}`);
        });
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Passed: ${this.results.filter(r => r.status === 'PASS').length}`);
    console.log(`   Failed: ${this.results.filter(r => r.status === 'FAIL').length}`);
    console.log(`   Warnings: ${this.results.filter(r => r.status === 'WARNING').length}`);
  }
}

// Run the compliance check
if (require.main === module) {
  const checker = new QuebecSecurityChecker();
  checker.runCompliance().catch(error => {
    console.error('❌ Quebec compliance check failed:', error);
    process.exit(1);
  });
}

export default QuebecSecurityChecker;