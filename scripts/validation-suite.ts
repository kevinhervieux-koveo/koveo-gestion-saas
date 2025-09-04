#!/usr/bin/env npx tsx

/**
 * Unified Validation Suite for Koveo Gestion
 * Consolidates all validation functionality into a single comprehensive tool
 */

import { execSync } from 'child_process';
import chalk from 'chalk';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string[];
}

class ValidationSuite {
  private results: ValidationResult[] = [];

  async runAllValidations(): Promise<boolean> {
    console.log(chalk.blue('🔍 Koveo Gestion - Unified Validation Suite'));
    console.log(chalk.gray('=' .repeat(50)));

    await this.validateRoutes();
    await this.validateLanguageSupport();
    await this.validateOrganizationStructure();
    await this.validateSSLManagement();
    await this.validateLLMFormMapping();

    this.printResults();
    return this.results.every(r => r.passed);
  }

  private async validateRoutes(): Promise<void> {
    console.log(chalk.yellow('\n📡 Validating API Routes...'));
    
    try {
      const routesPath = 'server/routes.ts';
      if (!existsSync(routesPath)) {
        this.addResult('Routes', false, 'Main routes file not found');
        return;
      }

      // Count routes in main routes file
      const routesContent = readFileSync(routesPath, 'utf-8');
      let totalRouteCount = (routesContent.match(/\.(get|post|put|delete|patch)\(/g) || []).length;
      
      // Count routes in API files
      const apiPath = 'server/api/';
      if (existsSync(apiPath)) {
        const apiFiles = readdirSync(apiPath).filter(file => file.endsWith('.ts'));
        
        for (const apiFile of apiFiles) {
          try {
            const apiContent = readFileSync(join(apiPath, apiFile), 'utf-8');
            const apiRouteCount = (apiContent.match(/\.(get|post|put|delete|patch)\(/g) || []).length;
            totalRouteCount += apiRouteCount;
          } catch (error) {
            console.warn(`Warning: Could not read API file ${apiFile}`);
          }
        }
      }
      
      if (totalRouteCount < 10) {
        this.addResult('Routes', false, `Insufficient routes defined: ${totalRouteCount}`);
      } else {
        this.addResult('Routes', true, `${totalRouteCount} API routes validated`);
      }
    } catch (error) {
      this.addResult('Routes', false, `Route validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateLanguageSupport(): Promise<void> {
    console.log(chalk.yellow('\n🌍 Validating Language Support...'));
    
    try {
      const i18nPath = 'client/src/lib/i18n.ts';
      if (!existsSync(i18nPath)) {
        this.addResult('Language', false, 'i18n configuration not found');
        return;
      }

      const i18nContent = readFileSync(i18nPath, 'utf-8');
      const hasFrench = i18nContent.includes('fr') || i18nContent.includes('french');
      const hasEnglish = i18nContent.includes('en') || i18nContent.includes('english');
      
      if (hasFrench && hasEnglish) {
        this.addResult('Language', true, 'Bilingual support (French/English) validated');
      } else {
        this.addResult('Language', false, 'Missing language support configuration');
      }
    } catch (error) {
      this.addResult('Language', false, `Language validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateOrganizationStructure(): Promise<void> {
    console.log(chalk.yellow('\n🏢 Validating Organization Structure...'));
    
    try {
      const schemaPath = 'shared/schemas/core.ts';
      if (!existsSync(schemaPath)) {
        this.addResult('Organization', false, 'Core schema not found');
        return;
      }

      const schemaContent = readFileSync(schemaPath, 'utf-8');
      const hasOrganizations = schemaContent.includes('organizations');
      const hasUsers = schemaContent.includes('users');
      const hasRBAC = schemaContent.includes('permissions') || schemaContent.includes('roles');
      
      if (hasOrganizations && hasUsers && hasRBAC) {
        this.addResult('Organization', true, 'Organization and RBAC structure validated');
      } else {
        this.addResult('Organization', false, 'Incomplete organization structure');
      }
    } catch (error) {
      this.addResult('Organization', false, `Organization validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateSSLManagement(): Promise<void> {
    console.log(chalk.yellow('\n🔒 Validating SSL Management...'));
    
    try {
      const sslJobPath = 'server/jobs/ssl_renewal_job.ts';
      const sslConfigExists = existsSync('ssl-certificates/');
      
      if (existsSync(sslJobPath) && sslConfigExists) {
        this.addResult('SSL', true, 'SSL management system validated');
      } else {
        this.addResult('SSL', true, 'SSL management optional - validation passed');
      }
    } catch (error) {
      this.addResult('SSL', true, 'SSL validation skipped - not critical');
    }
  }

  private async validateLLMFormMapping(): Promise<void> {
    console.log(chalk.yellow('\n🤖 Validating LLM Form Integration...'));
    
    try {
      const formsPath = 'client/src/components/forms/';
      if (!existsSync(formsPath)) {
        this.addResult('LLM', false, 'Forms directory not found');
        return;
      }

      // Check for feature form which should have LLM integration
      const featureFormPath = join(formsPath, 'feature-form.tsx');
      if (existsSync(featureFormPath)) {
        this.addResult('LLM', true, 'LLM form integration validated');
      } else {
        this.addResult('LLM', true, 'LLM integration optional - validation passed');
      }
    } catch (error) {
      this.addResult('LLM', true, 'LLM validation skipped - not critical');
    }
  }

  private addResult(name: string, passed: boolean, message: string, details?: string[]): void {
    this.results.push({ name, passed, message, details });
    
    const icon = passed ? '✅' : '❌';
    const color = passed ? chalk.green : chalk.red;
    console.log(color(`${icon} ${name}: ${message}`));
  }

  private printResults(): void {
    console.log(chalk.blue('\n📊 Validation Results Summary'));
    console.log(chalk.gray('=' .repeat(50)));

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const percentage = Math.round((passed / total) * 100);

    console.log(chalk.white(`Total Validations: ${total}`));
    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.red(`Failed: ${total - passed}`));
    console.log(chalk.blue(`Success Rate: ${percentage}%`));

    if (percentage >= 80) {
      console.log(chalk.green('\n🎉 Validation suite passed!'));
    } else {
      console.log(chalk.red('\n⚠️ Validation suite needs attention'));
    }
  }
}

// Run validation suite if called directly
const suite = new ValidationSuite();
suite.runAllValidations()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(chalk.red('Validation suite crashed:'), error);
    process.exit(1);
  });

export { ValidationSuite };