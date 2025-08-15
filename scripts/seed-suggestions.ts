import { DatabaseStorage } from '../server/db-storage';

/**
 *
 */
async function seedSuggestions() {
  const storage = new DatabaseStorage();
  
  // Clear existing suggestions
  await storage.clearNewSuggestions();
  
  // Create sample suggestions
  const suggestions = [
    {
      title: 'High Average Code Complexity',
      description: 'Average cyclomatic complexity (12.5) exceeds threshold (10). Consider refactoring complex functions in dashboard.tsx and sidebar.tsx to improve maintainability.',
      category: 'Code Quality' as const,
      priority: 'High' as const,
      status: 'New' as const,
      filePath: 'client/src/pages/dashboard.tsx',
    },
    {
      title: 'Insufficient Test Coverage',
      description: 'Test coverage (45%) is below the minimum threshold (90%). Add more unit tests especially for the authentication and storage modules.',
      category: 'Testing' as const,
      priority: 'Critical' as const,
      status: 'New' as const,
      filePath: null,
    },
    {
      title: 'Missing JSDoc Documentation',
      description: '87 functions/classes lack proper JSDoc documentation. Document public APIs in server/routes.ts and server/storage.ts for better maintainability.',
      category: 'Documentation' as const,
      priority: 'Medium' as const,
      status: 'New' as const,
      filePath: 'server/routes.ts',
    },
    {
      title: 'Security: Outdated Dependencies',
      description: '3 moderate severity vulnerabilities found in dependencies. Run npm audit fix to update vulnerable packages.',
      category: 'Security' as const,
      priority: 'High' as const,
      status: 'New' as const,
      filePath: 'package.json',
    },
    {
      title: 'Slow Build Performance',
      description: 'Build time (35.2s) is excessive. Consider optimizing bundle size by implementing code splitting and lazy loading for large components.',
      category: 'Performance' as const,
      priority: 'Low' as const,
      status: 'New' as const,
      filePath: 'vite.config.ts',
    },
  ];
  
  console.log('Creating improvement suggestions...');
  for (const suggestion of suggestions) {
    await storage.createImprovementSuggestion(suggestion);
    console.log(`  ✓ ${suggestion.title}`);
  }
  
  console.log('\nSuccessfully seeded 5 improvement suggestions!');
  process.exit(0);
}

seedSuggestions().catch(console.error);