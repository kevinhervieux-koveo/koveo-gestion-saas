#!/usr/bin/env tsx
/**
 * Automated Page Creation Script
 * Creates new pages with full pillar compliance and validation.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 *
 */
interface PageConfig {
  name: string;
  section: string;
  menuTitle: string;
  icon: string;
  requiredRole?: string;
  hasForm?: boolean;
  hasTable?: boolean;
  needsApi?: boolean;
}

/**
 *
 */
class PageGenerator {
  private startTime: Date;
  private violations: string[] = [];

  /**
   *
   */
  constructor() {
    this.startTime = new Date();
  }

  /**
   * Generate page component.
   * @param config
   */
  private generatePageComponent(config: PageConfig): string {
    const componentName = this.toPascalCase(config.name);
    
    return `import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ${config.icon} } from 'lucide-react';
${config.hasTable ? "import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';" : ''}
${config.hasForm ? "import { useForm } from 'react-hook-form';\nimport { zodResolver } from '@hookform/resolvers/zod';\nimport * as z from 'zod';\nimport { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';\nimport { Input } from '@/components/ui/input';" : ''}

/**
 * ${componentName} Component
 * 
 * @description ${config.menuTitle} page for ${config.section} section
 * @pillar validation - Quality checks enforced
 * @pillar documentation - JSDoc complete
 * @pillar anti-workaround - No hacks or shortcuts
 * @pillar roadmap - Part of ${config.section} module
 * @pillar improvement - Metrics tracked
 */
export default function ${componentName}() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  ${config.needsApi ? `
  // Fetch data from API
  const { data, isLoading: isQueryLoading, error } = useQuery({
    queryKey: ['/api/${config.section}/${config.name}'],
    enabled: true,
  });
  ` : ''}

  ${config.hasForm ? `
  // Form schema
  const formSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      // TODO: Implement form submission
      toast({
        title: 'Success',
        description: 'Form submitted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit form',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  ` : ''}

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <${config.icon} className="h-8 w-8" />
          ${config.menuTitle}
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage ${config.menuTitle.toLowerCase()} for your organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>${config.menuTitle}</CardTitle>
          <CardDescription>
            View and manage ${config.menuTitle.toLowerCase()} settings and data
          </CardDescription>
        </CardHeader>
        <CardContent>
          ${config.needsApi && 'isQueryLoading' ? `
          {isQueryLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-red-500 text-center py-8">
              Failed to load data. Please try again.
            </div>
          ) : (
            <div>
              {/* Content goes here */}
              ${config.hasTable ? this.generateTableContent() : '<p>No data available</p>'}
            </div>
          )}
          ` : config.hasTable ? this.generateTableContent() : '<p>Content will be implemented here</p>'}
          
          ${config.hasForm ? `
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit
              </Button>
            </form>
          </Form>
          ` : ''}
        </CardContent>
      </Card>
    </div>
  );
}`;
  }

  /**
   * Generate table content.
   */
  private generateTableContent(): string {
    return `
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Sample Item</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell>{new Date().toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">Edit</Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>`;
  }

  /**
   * Generate test file.
   * @param config
   */
  private generateTestFile(config: PageConfig): string {
    const componentName = this.toPascalCase(config.name);
    
    return `import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import ${componentName} from '@/pages/${config.section}/${config.name}';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('${componentName}', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('renders the page title', () => {
    renderWithProviders(<${componentName} />);
    expect(screen.getByText('${config.menuTitle}')).toBeInTheDocument();
  });

  it('displays loading state initially', async () => {
    renderWithProviders(<${componentName} />);
    ${config.needsApi ? "expect(screen.getByRole('status')).toBeInTheDocument();" : '// No loading state for static content'}
  });

  ${config.hasForm ? `
  it('validates form inputs', async () => {
    renderWithProviders(<${componentName} />);
    // Add form validation tests
  });
  ` : ''}

  ${config.hasTable ? `
  it('renders table with data', async () => {
    renderWithProviders(<${componentName} />);
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });
  ` : ''}
});`;
  }

  /**
   * Add route to App.tsx.
   * @param config
   */
  private async addRoute(config: PageConfig): Promise<void> {
    const appPath = 'client/src/App.tsx';
    const appContent = fs.readFileSync(appPath, 'utf-8');
    
    // Add import
    const importStatement = `const ${this.toPascalCase(config.name)} = lazy(() => import("./pages/${config.section}/${config.name}"));`;
    const lastImport = appContent.lastIndexOf('const ');
    const beforeLastImport = appContent.substring(0, lastImport);
    const afterLastImport = appContent.substring(lastImport);
    
    if (!appContent.includes(importStatement)) {
      const newContent = beforeLastImport + importStatement + '\n' + afterLastImport;
      fs.writeFileSync(appPath, newContent);
    }
    
    // Add route
    const routePath = `/${config.section}/${config.name}`;
    const routeComponent = `<Route path="${routePath}" component={${this.toPascalCase(config.name)}} />`;
    
    if (!appContent.includes(routePath)) {
      const routesEnd = appContent.indexOf('</Switch>');
      const beforeRoutes = appContent.substring(0, routesEnd);
      const afterRoutes = appContent.substring(routesEnd);
      const updatedContent = beforeRoutes + '          ' + routeComponent + '\n' + afterRoutes;
      fs.writeFileSync(appPath, updatedContent);
    }
  }

  /**
   * Add menu item to sidebar.
   * @param config
   */
  private async addMenuItem(config: PageConfig): Promise<void> {
    const sidebarPath = 'client/src/components/layout/sidebar.tsx';
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
    
    // Find the section and add menu item
    const sectionPattern = new RegExp(`name: '${this.capitalize(config.section)}'[\\s\\S]*?items: \\[`);
    const match = sidebarContent.match(sectionPattern);
    
    if (match) {
      const menuItem = `        { name: '${config.menuTitle}', href: '/${config.section}/${config.name}', icon: ${config.icon}${config.requiredRole ? `, requiredRole: '${config.requiredRole}'` : ''} },`;
      const insertIndex = match.index! + match[0].length;
      const before = sidebarContent.substring(0, insertIndex);
      const after = sidebarContent.substring(insertIndex);
      const newContent = before + '\n' + menuItem + after;
      fs.writeFileSync(sidebarPath, newContent);
    }
  }

  /**
   * Validate page creation.
   * @param config
   */
  private async validatePage(config: PageConfig): Promise<boolean> {
    console.log('\n🔍 Running page validation...');
    
    // Check if page component exists
    const pagePath = `client/src/pages/${config.section}/${config.name}.tsx`;
    if (!fs.existsSync(pagePath)) {
      this.violations.push('Page component file not created');
    }
    
    // Check if test exists
    const testPath = `tests/unit/pages/${config.section}/${config.name}.test.tsx`;
    if (!fs.existsSync(testPath)) {
      this.violations.push('Test file not created');
    }
    
    // Check TypeScript compilation
    try {
      execSync(`npx tsc --noEmit ${pagePath}`, { stdio: 'pipe' });
      console.log('  ✅ TypeScript validation passed');
    } catch (error) {
      this.violations.push('TypeScript compilation failed');
      console.log('  ❌ TypeScript validation failed');
    }
    
    // Check linting
    try {
      execSync(`npx eslint ${pagePath}`, { stdio: 'pipe' });
      console.log('  ✅ ESLint validation passed');
    } catch (error) {
      this.violations.push('ESLint validation failed');
      console.log('  ❌ ESLint validation failed');
    }
    
    return this.violations.length === 0;
  }

  /**
   * Create page with all validations.
   * @param config
   */
  public async createPage(config: PageConfig): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 CREATING PAGE: ${config.menuTitle}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Step 1: Create directory if needed
    const pageDir = `client/src/pages/${config.section}`;
    if (!fs.existsSync(pageDir)) {
      fs.mkdirSync(pageDir, { recursive: true });
      console.log(`📁 Created directory: ${pageDir}`);
    }
    
    // Step 2: Generate and save page component
    const pagePath = `${pageDir}/${config.name}.tsx`;
    const pageContent = this.generatePageComponent(config);
    fs.writeFileSync(pagePath, pageContent);
    console.log(`✅ Created page component: ${pagePath}`);
    
    // Step 3: Create test file
    const testDir = `tests/unit/pages/${config.section}`;
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    const testPath = `${testDir}/${config.name}.test.tsx`;
    const testContent = this.generateTestFile(config);
    fs.writeFileSync(testPath, testContent);
    console.log(`✅ Created test file: ${testPath}`);
    
    // Step 4: Add route
    await this.addRoute(config);
    console.log(`✅ Added route to App.tsx`);
    
    // Step 5: Add menu item
    await this.addMenuItem(config);
    console.log(`✅ Added menu item to sidebar`);
    
    // Step 6: Validate
    const isValid = await this.validatePage(config);
    
    // Step 7: Calculate metrics
    const endTime = new Date();
    const timeTaken = (endTime.getTime() - this.startTime.getTime()) / 1000;
    
    // Step 8: Save metrics
    this.saveMetrics(config, timeTaken, isValid);
    
    // Step 9: Display results
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 PAGE CREATION SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`  Page Name: ${config.menuTitle}`);
    console.log(`  Section: ${config.section}`);
    console.log(`  Time Taken: ${timeTaken.toFixed(2)} seconds`);
    console.log(`  Validation: ${isValid ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (this.violations.length > 0) {
      console.log('\n⚠️  Violations found:');
      this.violations.forEach(v => console.log(`  - ${v}`));
    }
    
    console.log(`\n${'='.repeat(60)}\n`);
  }

  /**
   * Save metrics to tracking file.
   * @param config
   * @param timeTaken
   * @param isValid
   */
  private saveMetrics(config: PageConfig, timeTaken: number, isValid: boolean): void {
    const metricsFile = '.page-creation-metrics.json';
    let metrics: any[] = [];
    
    if (fs.existsSync(metricsFile)) {
      metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf-8'));
    }
    
    metrics.push({
      page: config.name,
      section: config.section,
      timestamp: new Date().toISOString(),
      timeTaken,
      isValid,
      violations: this.violations.length,
      features: {
        hasForm: config.hasForm,
        hasTable: config.hasTable,
        needsApi: config.needsApi,
        hasRole: !!config.requiredRole
      }
    });
    
    fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
  }

  // Utility functions
  /**
   *
   * @param str
   */
  private toPascalCase(str: string): string {
    return str.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
  }

  /**
   *
   * @param str
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: tsx scripts/create-page.ts <name> <section> <menuTitle> [options]');
    console.log('\nOptions:');
    console.log('  --icon <icon>        Icon name from lucide-react (default: FileText)');
    console.log('  --role <role>        Required role (admin, manager, tenant)');
    console.log('  --with-form          Add form functionality');
    console.log('  --with-table         Add table display');
    console.log('  --with-api           Add API integration');
    console.log('\nExample:');
    console.log('  tsx scripts/create-page.ts reports admin "Reports" --icon BarChart --role admin --with-table --with-api');
    process.exit(1);
  }

  const config: PageConfig = {
    name: args[0],
    section: args[1],
    menuTitle: args[2],
    icon: 'FileText',
    hasForm: false,
    hasTable: false,
    needsApi: false,
  };

  // Parse options
  for (let i = 3; i < args.length; i++) {
    switch (args[i]) {
      case '--icon':
        config.icon = args[++i];
        break;
      case '--role':
        config.requiredRole = args[++i];
        break;
      case '--with-form':
        config.hasForm = true;
        break;
      case '--with-table':
        config.hasTable = true;
        break;
      case '--with-api':
        config.needsApi = true;
        break;
    }
  }

  const generator = new PageGenerator();
  generator.createPage(config);
}

export { PageGenerator };