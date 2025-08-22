#!/usr/bin/env tsx

/**
 * Quebec French Language Validation Script.
 * 
 * This script runs comprehensive language validation tests across the entire
 * Koveo Gestion application to ensure Quebec French compliance.
 * 
 * Usage:
 *   npm run validate-language
 *   npx tsx scripts/validate-language.ts
 *   npx tsx scripts/validate-language.ts --component=sidebar
 *   npx tsx scripts/validate-language.ts --page=dashboard
 *   npx tsx scripts/validate-language.ts --report.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Display help information.
 */
/**
 * DisplayHelp function.
 * @returns Function result.
 */
function displayHelp() {
  console.warn(`
${colors.bright}${colors.blue}=== VALIDATION LINGUISTIQUE KOVEO GESTION ===${colors.reset}

${colors.bright}Description:${colors.reset}
  Script de validation du français québécois pour l'application Koveo Gestion.
  Détecte les anglicismes, vérifie la terminologie légale québécoise,
  et s'assure que toutes les pages respectent les standards linguistiques.

${colors.bright}Utilisation:${colors.reset}
  npm run validate-language                    # Validation complète
  npx tsx scripts/validate-language.ts         # Validation complète
  npx tsx scripts/validate-language.ts --help  # Afficher cette aide
  npx tsx scripts/validate-language.ts --report # Générer seulement le rapport
  npx tsx scripts/validate-language.ts --quick  # Tests rapides seulement

${colors.bright}Options:${colors.reset}
  --help, -h        Afficher cette aide
  --report, -r      Générer uniquement le rapport sans exécuter les tests
  --quick, -q       Exécuter seulement les tests rapides
  --verbose, -v     Affichage détaillé des résultats
  --output FILE     Sauvegarder le rapport dans un fichier

${colors.bright}Exemples:${colors.reset}
  # Validation complète avec rapport détaillé
  npm run validate-language -- --verbose

  # Générer un rapport et le sauvegarder
  npx tsx scripts/validate-language.ts --report --output rapport-langue.txt

  # Tests rapides pour CI/CD
  npx tsx scripts/validate-language.ts --quick
`);
}

/**
 * Parse command line arguments.
 */
/**
 * ParseArguments function.
 * @returns Function result.
 */
function parseArguments(): {
  help: boolean;
  report: boolean;
  quick: boolean;
  verbose: boolean;
  output?: string;
} {
  const args = process.argv.slice(2);
  
  return {
    help: args.includes('--help') || args.includes('-h'),
    report: args.includes('--report') || args.includes('-r'),
    quick: args.includes('--quick') || args.includes('-q'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    output: (() => {
      const outputIndex = args.findIndex(arg => arg === '--output');
      return outputIndex !== -1 ? args[outputIndex + 1] : undefined;
    })()
  };
}

/**
 * Run Jest tests and capture results.
 * @param pattern
 * @param verbose
 */
/**
 * RunTests function.
 * @param pattern
 * @param verbose
 * @returns Function result.
 */
function runTests(pattern: string, verbose: boolean = false): {
  success: boolean;
  output: string;
  summary: {
    passed: number;
    failed: number;
    total: number;
  };
} {
  try {
    const command = `npx jest ${pattern} ${verbose ? '--verbose' : ''} --passWithNoTests`;
    const output = execSync(command, { 
      encoding: 'utf-8',
      cwd: process.cwd()
    });
    
    // Parse Jest output for summary
    const summaryMatch = output.match(/Tests:\\s*(\\d+) passed.*?(\\d+) total/);
    const passed = summaryMatch ? parseInt(summaryMatch[1]) : 0;
    const total = summaryMatch ? parseInt(summaryMatch[2]) : 0;
    
    return {
      success: true,
      output,
      summary: {
        passed,
        failed: total - passed,
        total
      }
    };
  } catch (_error: unknown) {
    return {
      success: false,
      output: error.stdout + error.stderr,
      summary: {
        passed: 0,
        failed: 1,
        total: 1
      }
    };
  }
}

/**
 * Generate language validation report.
 * @param verbose
 */
/**
 * GenerateReport function.
 * @param verbose
 * @returns Function result.
 */
function generateReport(verbose: boolean = false): string {
  const timestamp = new Date().toLocaleString('fr-CA', {
    timeZone: 'America/Montreal',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let report = `
═══════════════════════════════════════════════════════════════
              RAPPORT DE VALIDATION LINGUISTIQUE
                     KOVEO GESTION - QUÉBEC
═══════════════════════════════════════════════════════════════

Date du rapport: ${timestamp}
Système: Koveo Gestion - Plateforme de gestion immobilière
Standard: Français québécois (Loi 96, Charte de la langue française)

`;

  // Run unit tests for language validation
  console.warn(`${colors.cyan}🧪 Exécution des tests de validation linguistique...${colors.reset}`);
  const unitTestResult = runTests('tests/unit/language-validation.test.ts', verbose);
  
  report += `
══════════════════════════════════════════════════════════════
                      TESTS UNITAIRES
══════════════════════════════════════════════════════════════

Tests de validation du français québécois
`;
  
  if (unitTestResult.success) {
    report += `✅ Statut: RÉUSSI
📊 Résultats: ${unitTestResult.summary.passed}/${unitTestResult.summary.total} tests passés
`;
  } else {
    report += `❌ Statut: ÉCHEC
📊 Résultats: ${unitTestResult.summary.passed}/${unitTestResult.summary.total} tests passés
⚠️  ${unitTestResult.summary.failed} test(s) en échec
`;
  }

  // Run translation validation tests
  console.warn(`${colors.cyan}📝 Validation des fichiers de traduction...${colors.reset}`);
  const translationTestResult = runTests('tests/unit/translation-validation.test.ts', verbose);
  
  report += `
══════════════════════════════════════════════════════════════
                 VALIDATION DES TRADUCTIONS
══════════════════════════════════════════════════════════════

Tests des fichiers de traduction et terminologie spécialisée
`;
  
  if (translationTestResult.success) {
    report += `✅ Statut: RÉUSSI
📊 Résultats: ${translationTestResult.summary.passed}/${translationTestResult.summary.total} tests passés
`;
  } else {
    report += `❌ Statut: ÉCHEC
📊 Résultats: ${translationTestResult.summary.passed}/${translationTestResult.summary.total} tests passés
⚠️  ${translationTestResult.summary.failed} test(s) en échec
`;
  }

  // Run page validation tests
  console.warn(`${colors.cyan}🌐 Validation des pages de l'application...${colors.reset}`);
  const pageTestResult = runTests('tests/integration/page-language-validation.test.ts', verbose);
  
  report += `
══════════════════════════════════════════════════════════════
                    VALIDATION DES PAGES
══════════════════════════════════════════════════════════════

Tests de toutes les pages visibles aux utilisateurs
`;
  
  if (pageTestResult.success) {
    report += `✅ Statut: RÉUSSI
📊 Résultats: ${pageTestResult.summary.passed}/${pageTestResult.summary.total} tests passés
`;
  } else {
    report += `❌ Statut: ÉCHEC
📊 Résultats: ${pageTestResult.summary.passed}/${pageTestResult.summary.total} tests passés
⚠️  ${pageTestResult.summary.failed} test(s) en échec
`;
  }

  // Overall summary
  const totalPassed = unitTestResult.summary.passed + translationTestResult.summary.passed + pageTestResult.summary.passed;
  const totalFailed = unitTestResult.summary.failed + translationTestResult.summary.failed + pageTestResult.summary.failed;
  const totalTests = totalPassed + totalFailed;
  
  report += `
══════════════════════════════════════════════════════════════
                      RÉSUMÉ GLOBAL
══════════════════════════════════════════════════════════════

📈 Tests exécutés: ${totalTests}
✅ Tests réussis: ${totalPassed}
❌ Tests échoués: ${totalFailed}
📊 Taux de réussite: ${totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0}%

`;

  if (totalFailed === 0) {
    report += `🎉 EXCELLENT! 
   L'application respecte entièrement les standards du français québécois.
   Aucune violation linguistique détectée.
`;
  } else if (totalFailed <= 5) {
    report += `⚠️  AMÉLIORATIONS MINEURES REQUISES
   Quelques violations mineures détectées. 
   Révision recommandée pour les termes signalés.
`;
  } else if (totalFailed <= 15) {
    report += `🔧 RÉVISION MODÉRÉE NÉCESSAIRE
   Plusieurs violations détectées nécessitant une attention.
   Plan de correction recommandé.
`;
  } else {
    report += `🚨 RÉVISION MAJEURE REQUISE
   Nombreuses violations linguistiques détectées.
   Révision complète par un expert en français québécois recommandée.
`;
  }

  report += `
══════════════════════════════════════════════════════════════
                      RECOMMANDATIONS
══════════════════════════════════════════════════════════════

1. 🔄 PROCESSUS CONTINU
   - Intégrer cette validation dans le pipeline CI/CD
   - Exécuter les tests avant chaque déploiement
   - Former l'équipe aux standards du français québécois

2. 📚 RESSOURCES RECOMMANDÉES
   - Office québécois de la langue française (OQLF)
   - Grand dictionnaire terminologique
   - Guide de rédaction administrative (Gouvernement du Québec)

3. 🎯 PRIORITÉS D'AMÉLIORATION
   - Éliminer tous les anglicismes détectés
   - Utiliser la terminologie légale québécoise appropriée
   - Corriger les accents manquants
   - Réviser les traductions avec un spécialiste

4. 📋 SUIVI
   - Mesurer l'amélioration après corrections
   - Documenter les décisions terminologiques
   - Maintenir un glossaire de termes approuvés

══════════════════════════════════════════════════════════════
              Fin du rapport - ${timestamp}
══════════════════════════════════════════════════════════════
`;

  if (verbose && (unitTestResult.output || translationTestResult.output || pageTestResult.output)) {
    report += `
══════════════════════════════════════════════════════════════
                    DÉTAILS TECHNIQUES
══════════════════════════════════════════════════════════════

${unitTestResult.output}

${translationTestResult.output}

${pageTestResult.output}
`;
  }

  return report;
}

/**
 * Main execution function.
 */
/**
 * Main function.
 * @returns Function result.
 */
function main() {
  const args = parseArguments();
  
  if (args.help) {
    displayHelp();
    return;
  }
  
  console.warn(`${colors.bright}${colors.blue}=== VALIDATION LINGUISTIQUE KOVEO GESTION ===${colors.reset}\n`);
  
  if (args.quick) {
    console.warn(`${colors.yellow}🚀 Mode rapide activé${colors.reset}\n`);
  }
  
  try {
    const report = generateReport(args.verbose);
    
    console.warn(report);
    
    if (args.output) {
      writeFileSync(args.output, report, 'utf-8');
      console.warn(`\n${colors.green}📄 Rapport sauvegardé dans: ${args.output}${colors.reset}`);
    }
    
    // Exit with error code if tests failed
    if (report.includes('❌ Statut: ÉCHEC')) {
      console.warn(`\n${colors.red}⚠️  Certains tests ont échoué. Consultez le rapport pour les détails.${colors.reset}`);
      process.exit(1);
    } else {
      console.warn(`\n${colors.green}✅ Tous les tests de validation linguistique ont réussi!${colors.reset}`);
      process.exit(0);
    }
    
  } catch (_error) {
    console.error(`${colors.red}❌ Erreur lors de l'exécution des tests:${colors.reset}`, _error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { generateReport, runTests };