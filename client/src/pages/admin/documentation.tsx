import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Package,
  BookOpen,
  Cpu,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Terminal,
  Eye,
  ExternalLink,
  Folder,
  Code,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentationData {
  projectOverview: {
    name: string;
    description: string;
    version: string;
    architecture: string;
    lastUpdated: string;
  };
  components: Array<{
    name: string;
    type: string;
    dependencies: string[];
    exports: string[];
    complexity: number;
  }>;
  apis: Array<{
    endpoint: string;
    method: string;
    description: string;
    parameters: string[];
    response: string;
  }>;
  database: {
    tables: Array<{
      name: string;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        primary: boolean;
      }>;
    }>;
  };
  dependencies: Array<{
    name: string;
    version: string;
    type: 'production' | 'development';
    description: string;
  }>;
  documentationFiles: Array<{
    name: string;
    path: string;
    size: number;
    lastModified: string;
    category: string;
  }>;
  enhancedSchema?: {
    entityRelationshipDiagram: string;
    entityDescriptions: Array<{
      tableName: string;
      businessDescription: string;
      domain: string;
      keyPurpose: string;
    }>;
    foreignKeyChains: Array<{
      from: string;
      chain: string[];
      description: string;
    }>;
    cascadeDeleteBehaviors: Array<{
      table: string;
      column: string;
      referencedTable: string;
      onDelete: string;
      businessImplication: string;
    }>;
  };
  hooksAndUtilities?: {
    hooks: Array<{
      name: string;
      description: string;
      parameters: string[];
      dependencies: string[];
      usagePatterns: string[];
    }>;
    utilities: Array<{
      name: string;
      description: string;
      functions: Array<{
        name: string;
        description: string;
        parameters: string[];
      }>;
    }>;
  };
  testing?: {
    structure: {
      unit: Array<{ name: string; description: string; file: string; testCount: number }>;
      integration: Array<{ name: string; description: string; file: string; testCount: number }>;
      e2e: Array<{ name: string; description: string; file: string; testCount: number }>;
      security: Array<{ name: string; description: string; file: string; testCount: number }>;
      critical: Array<{ name: string; description: string; file: string; testCount: number }>;
    };
    totalTests: number;
    coverage: {
      unit: number;
      integration: number;
      e2e: number;
      security: number;
      critical: number;
    };
  };
  codePatterns?: {
    apiPatterns: Array<{
      name: string;
      category: string;
      description: string;
      example: string;
      usage: string[];
    }>;
    reactPatterns: Array<{
      name: string;
      category: string;
      description: string;
      example: string;
      usage: string[];
    }>;
    databasePatterns: Array<{
      name: string;
      category: string;
      description: string;
      example: string;
      usage: string[];
    }>;
  };
  businessFlows?: Array<{
    name: string;
    description: string;
    tables: string[];
    steps: Array<{
      stepNumber: number;
      action: string;
      role: string;
      dataTransformation: string;
    }>;
    errorHandling: Array<{
      scenario: string;
      handling: string;
    }>;
    flow: string;
  }>;
}

interface LLMSectionConfig {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

const DEFAULT_SECTIONS: LLMSectionConfig[] = [
  { id: 'schemaAnalysis', label: 'Enhanced Schema Analysis', description: 'Database schema with entity descriptions', enabled: true },
  { id: 'hooksUtilities', label: 'Hooks & Utilities', description: 'Custom hooks and utility functions', enabled: true },
  { id: 'codePatterns', label: 'Code Patterns', description: 'Common implementation patterns', enabled: true },
  { id: 'testing', label: 'Testing Documentation', description: 'Test coverage and testing patterns', enabled: true },
  { id: 'businessWorkflows', label: 'Business Workflows', description: 'User flows and business logic', enabled: true },
  { id: 'apiEndpoints', label: 'API Endpoints', description: 'All API routes and specifications', enabled: true },
  { id: 'dependencies', label: 'Dependencies', description: 'Production and dev dependencies', enabled: true },
];

export default function OwnerDocumentation() {
  const [isExportingGoogleSuite, setIsExportingGoogleSuite] = useState(false);
  const [isGeneratingLLM, setIsGeneratingLLM] = useState(false);
  const [gitStatus, setGitStatus] = useState<{
    hasChanges: boolean;
    lastCommit: any;
  } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [llmSections, setLlmSections] = useState<LLMSectionConfig[]>(DEFAULT_SECTIONS);
  const [outputFormat, setOutputFormat] = useState<'txt' | 'md'>('txt');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const selectedSectionCount = llmSections.filter(s => s.enabled).length;

  const toggleSection = (sectionId: string) => {
    setLlmSections(prev => 
      prev.map(section => 
        section.id === sectionId 
          ? { ...section, enabled: !section.enabled }
          : section
      )
    );
  };

  const {
    data: docData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<DocumentationData>({
    queryKey: ['/api/documentation/comprehensive'],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const response = await fetch('/api/documentation/comprehensive', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch documentation: ${response.statusText}`);
      }
      
      const data = await response.json();
      setLastRefresh(new Date());
      
      return data;
    },
  });

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const isReplit =
      window.location.hostname.includes('replit') ||
      window.location.hostname.includes('.repl.') ||
      import.meta.env.REPLIT_ENV;

    if (isReplit) {
      intervalId = setInterval(
        () => {
          setIsAutoRefreshing(true);
          refetch().finally(() => {
            setIsAutoRefreshing(false);
            toast({
              title: 'Documentation Updated',
              description: 'Documentation has been automatically refreshed.',
            });
          });
        },
        30 * 60 * 1000
      );
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [refetch, toast]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const timeSinceLastRefresh = Date.now() - lastRefresh.getTime();
        const fiveMinutes = 5 * 60 * 1000;

        if (timeSinceLastRefresh > fiveMinutes) {
          setIsAutoRefreshing(true);
          refetch().finally(() => setIsAutoRefreshing(false));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [lastRefresh, refetch]);

  const handleManualRefresh = async () => {
    setIsAutoRefreshing(true);
    try {
      await refetch();
      toast({
        title: 'Documentation Refreshed',
        description: 'Documentation data has been updated with the latest information.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Refresh Failed',
        description: 'Failed to refresh documentation. Please try again.',
      });
    } finally {
      setIsAutoRefreshing(false);
    }
  };

  const handleExportGoogleSuite = async () => {
    setIsExportingGoogleSuite(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const documentationFiles = {
        'project-overview.docx': generateProjectOverviewDocx(docData),
        'component-specifications.xlsx': generateComponentSpreadsheet(docData),
        'api-documentation.docx': generateApiDocumentation(docData),
        'database-schema.xlsx': generateDatabaseSchema(docData),
        'dependencies-list.docx': generateDependenciesList(docData),
      };

      const zip = await createDocumentationZip(documentationFiles);
      downloadFile(zip, 'koveo-gestion-documentation.zip');

      toast({
        title: 'Documentation Exported',
        description: 'Google Suite documentation package has been downloaded successfully.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'Failed to export Google Suite documentation. Please try again.',
      });
    } finally {
      setIsExportingGoogleSuite(false);
    }
  };

  const handleGenerateLLMDocumentation = async () => {
    setIsGeneratingLLM(true);
    try {
      const enabledSections = llmSections.filter(s => s.enabled).map(s => s.id);
      const llmDoc = generateComprehensiveLLMDocumentation(docData, enabledSections, outputFormat);

      const mimeType = outputFormat === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
      const blob = new Blob([llmDoc], { type: mimeType });
      const extension = outputFormat === 'md' ? 'md' : 'txt';
      const filename = `koveo-gestion-llm-documentation-${new Date().toISOString().split('T')[0]}.${extension}`;
      downloadFile(blob, filename);

      toast({
        title: 'LLM Documentation Exported',
        description: `Documentation with ${selectedSectionCount} sections exported as ${extension.toUpperCase()} file.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'Failed to export LLM documentation. Please try again.',
      });
    } finally {
      setIsGeneratingLLM(false);
    }
  };

  const generateProjectOverviewDocx = (_data: DocumentationData | undefined) => {
    if (!_data) {
      return '';
    }
    return `PROJECT OVERVIEW
    
Name: ${_data.projectOverview.name}
Description: ${_data.projectOverview.description}
Version: ${_data.projectOverview.version}
Architecture: ${_data.projectOverview.architecture}

FEATURES:
- Property management for Quebec residential communities
- Multi-tenant architecture supporting owners, managers, and residents
- AI-powered improvement suggestions
- Real-time quality assurance monitoring
- Comprehensive filter and sort capabilities
- Multi-language support (French/English)

COMPLIANCE:
- Quebec Law 25 privacy regulations
- Responsive design for all devices
- Accessibility standards (WCAG)
`;
  };

  const generateComponentSpreadsheet = (_data: DocumentationData | undefined) => {
    if (!_data) {
      return '';
    }
    let csv = 'Component Name,Type,Dependencies,Exports,Complexity\n';
    _data.components.forEach((comp) => {
      csv += `"${comp.name}","${comp.type}","${comp.dependencies.join(', ')}","${comp.exports.join(', ')}",${comp.complexity}\n`;
    });
    return csv;
  };

  const generateApiDocumentation = (_data: DocumentationData | undefined) => {
    if (!_data) {
      return '';
    }
    let doc = 'API DOCUMENTATION\n\n';
    _data.apis.forEach((api) => {
      doc += `Endpoint: ${api.endpoint}\n`;
      doc += `Method: ${api.method}\n`;
      doc += `Description: ${api.description}\n`;
      doc += `Parameters: ${api.parameters.join(', ')}\n`;
      doc += `Response: ${api.response}\n\n`;
    });
    return doc;
  };

  const generateDatabaseSchema = (_data: DocumentationData | undefined) => {
    if (!_data) {
      return '';
    }
    let csv = 'Table,Column,Type,Nullable,Primary Key\n';
    _data.database.tables.forEach((table) => {
      table.columns.forEach((col) => {
        csv += `"${table.name}","${col.name}","${col.type}",${col.nullable},${col.primary}\n`;
      });
    });
    return csv;
  };

  const generateDependenciesList = (_data: DocumentationData | undefined) => {
    if (!_data) {
      return '';
    }
    let doc = 'DEPENDENCIES LIST\n\n';
    doc += 'PRODUCTION DEPENDENCIES:\n';
    _data.dependencies
      .filter((d) => d.type === 'production')
      .forEach((dep) => {
        doc += `- ${dep.name} (${dep.version}): ${dep.description}\n`;
      });
    doc += '\nDEVELOPMENT DEPENDENCIES:\n';
    _data.dependencies
      .filter((d) => d.type === 'development')
      .forEach((dep) => {
        doc += `- ${dep.name} (${dep.version}): ${dep.description}\n`;
      });
    return doc;
  };

  const createDocumentationZip = async (files: Record<string, string>) => {
    const zipContent = Object.entries(files)
      .map(([filename, content]) => `=== ${filename} ===\n${content}\n\n`)
      .join('');

    return new Blob([zipContent], { type: 'application/zip' });
  };

  const generateComprehensiveLLMDocumentation = (
    _data: DocumentationData | undefined, 
    enabledSections: string[],
    format: 'txt' | 'md'
  ): string => {
    if (!_data) {
      return '';
    }

    const lastUpdated = _data.projectOverview.lastUpdated || new Date().toISOString();
    const timestamp = new Date().toISOString();
    const isMarkdown = format === 'md';

    const h1 = (text: string) => isMarkdown ? `# ${text}\n\n` : `${text}\n${'='.repeat(text.length)}\n\n`;
    const h2 = (text: string) => isMarkdown ? `## ${text}\n\n` : `=== ${text} ===\n\n`;
    const h3 = (text: string) => isMarkdown ? `### ${text}\n\n` : `--- ${text} ---\n\n`;
    const bullet = (text: string) => isMarkdown ? `- ${text}\n` : `• ${text}\n`;
    const code = (text: string) => isMarkdown ? `\`${text}\`` : text;
    const codeBlock = (content: string, lang: string = '') => isMarkdown 
      ? `\`\`\`${lang}\n${content}\n\`\`\`\n\n` 
      : `${content}\n\n`;

    let doc = '';

    doc += `<DOCUMENT_METADATA>
Generated: ${timestamp}
Documentation Version: 4.0
Format: ${isMarkdown ? 'Markdown' : 'Plain Text'}
LLM Optimized: Claude/ChatGPT Compatible
Project: ${_data.projectOverview.name}
Version: ${_data.projectOverview.version}
Sections Included: ${enabledSections.length}
</DOCUMENT_METADATA>\n\n`;

    doc += h1('KOVEO GESTION - COMPREHENSIVE LLM DOCUMENTATION');

    doc += h2('TABLE OF CONTENTS');
    doc += `<TABLE_OF_CONTENTS>\n`;
    if (enabledSections.includes('schemaAnalysis')) doc += bullet('SCHEMA_ANALYSIS - Database Schema and Entity Relationships');
    if (enabledSections.includes('apiEndpoints')) doc += bullet('API_ENDPOINTS - REST API Specifications');
    if (enabledSections.includes('hooksUtilities')) doc += bullet('HOOKS_AND_UTILITIES - Custom React Hooks');
    if (enabledSections.includes('codePatterns')) doc += bullet('CODE_PATTERNS - Implementation Patterns');
    if (enabledSections.includes('testing')) doc += bullet('TESTING - Test Coverage and Strategies');
    if (enabledSections.includes('businessWorkflows')) doc += bullet('BUSINESS_WORKFLOWS - User Flows and Processes');
    if (enabledSections.includes('dependencies')) doc += bullet('DEPENDENCIES - Package Dependencies');
    doc += bullet('COMPLIANCE - Quebec Law 25 and Civil Code');
    doc += `</TABLE_OF_CONTENTS>\n\n`;

    doc += `<OVERVIEW>
${h2('Executive Summary')}
${_data.projectOverview.description}

${h3('Project Identity')}
${bullet(`Name: ${_data.projectOverview.name}`)}
${bullet(`Version: ${_data.projectOverview.version}`)}
${bullet(`Architecture: ${_data.projectOverview.architecture}`)}
${bullet(`Last Updated: ${lastUpdated}`)}

${h3('Key Capabilities')}
${bullet('Multi-tenant property management for Quebec condominiums')}
${bullet('Role-based access control (Admin, Manager, Resident)')}
${bullet('AI-powered improvement suggestions and analytics')}
${bullet('Bilingual support (French/English)')}
${bullet('Quebec Law 25 privacy compliance')}
</OVERVIEW>\n\n`;

    if (enabledSections.includes('schemaAnalysis') && _data.database?.tables?.length > 0) {
      doc += `<SCHEMA_ANALYSIS>
${h2('Database Schema Analysis')}
Total Tables: ${_data.database.tables.length}

${_data.enhancedSchema?.entityRelationshipDiagram ? `<ENTITY_RELATIONSHIP_DIAGRAM>
${_data.enhancedSchema.entityRelationshipDiagram}
</ENTITY_RELATIONSHIP_DIAGRAM>

` : ''}${h3('Entity Descriptions')}
${_data.enhancedSchema?.entityDescriptions?.length ? _data.enhancedSchema.entityDescriptions.map(entity => `
<ENTITY name="${entity.tableName}" domain="${entity.domain}">
Business Description: ${entity.businessDescription}
Key Purpose: ${entity.keyPurpose}
</ENTITY>`).join('\n') : _data.database.tables.map(table => {
  const pkColumns = table.columns.filter(c => c.primary);
  const fkColumns = table.columns.filter(c => c.name.endsWith('_id') || c.name.endsWith('Id'));
  return `
<ENTITY name="${table.name}">
Primary Keys: ${pkColumns.map(c => c.name).join(', ') || 'None'}
Foreign Keys: ${fkColumns.map(c => c.name).join(', ') || 'None'}
Column Count: ${table.columns.length}

Columns:
${table.columns.map(col => `  ${col.name}: ${col.type} ${col.nullable ? '(nullable)' : '(required)'} ${col.primary ? '[PK]' : ''}`).join('\n')}
</ENTITY>`;
}).join('\n')}

${_data.enhancedSchema?.foreignKeyChains?.length ? `${h3('Foreign Key Chains')}
${_data.enhancedSchema.foreignKeyChains.map(chain => `<FK_CHAIN from="${chain.from}">
  Path: ${chain.chain.join(' → ')}
  Description: ${chain.description}
</FK_CHAIN>`).join('\n')}

` : ''}${_data.enhancedSchema?.cascadeDeleteBehaviors?.length ? `${h3('Cascade Delete Behaviors')}
${_data.enhancedSchema.cascadeDeleteBehaviors.map(cascade => `<CASCADE table="${cascade.table}" column="${cascade.column}">
  References: ${cascade.referencedTable}
  On Delete: ${cascade.onDelete}
  Business Implication: ${cascade.businessImplication}
</CASCADE>`).join('\n')}

` : ''}${h3('Entity Relationships')}
<ENTITY_RELATIONSHIPS>
Relationship patterns detected:
${_data.database.tables.map(table => {
  const fkColumns = table.columns.filter(c => c.name.endsWith('_id') || c.name.endsWith('Id'));
  if (fkColumns.length === 0) return '';
  return fkColumns.map(fk => {
    const referencedTable = fk.name.replace(/_id$/i, '').replace(/Id$/, '');
    return `${table.name} --> ${referencedTable} (via ${fk.name})`;
  }).join('\n');
}).filter(Boolean).join('\n')}
</ENTITY_RELATIONSHIPS>
</SCHEMA_ANALYSIS>\n\n`;
    }

    if (enabledSections.includes('apiEndpoints') && _data.apis?.length > 0) {
      doc += `<API_ENDPOINTS>
${h2('API Endpoint Specifications')}
Total Endpoints: ${_data.apis.length}

${_data.apis.map(api => `
<ENDPOINT>
Route: ${api.method} ${api.endpoint}
Description: ${api.description}
Parameters: ${api.parameters.length > 0 ? api.parameters.join(', ') : 'None'}
Response Type: ${api.response}
</ENDPOINT>`).join('\n')}
</API_ENDPOINTS>\n\n`;
    }

    if (enabledSections.includes('hooksUtilities')) {
      const hooks = _data.hooksAndUtilities?.hooks || [];
      const utilities = _data.hooksAndUtilities?.utilities || [];
      
      doc += `<HOOKS_AND_UTILITIES>
${h2('Custom Hooks and Utilities')}
Total Hooks: ${hooks.length}
Total Utilities: ${utilities.length}

${h3('Hooks')}
${hooks.length > 0 ? hooks.map(hook => `<HOOK name="${hook.name}">
Description: ${hook.description}
Dependencies: ${hook.dependencies?.join(', ') || 'None'}
Usage Patterns:
${hook.usagePatterns?.map(p => `  - ${p}`).join('\n') || '  - Standard usage'}
</HOOK>`).join('\n\n') : `<HOOK name="useToast">
Description: Toast notification management hook
Usage: const { toast } = useToast()
Pattern: Imperative notifications with auto-dismiss
</HOOK>

<HOOK name="useQuery">
Description: TanStack Query data fetching hook
Usage: const { data, isLoading } = useQuery({ queryKey: [...] })
Pattern: Declarative data fetching with caching
</HOOK>

<HOOK name="useAuth">
Description: Authentication state management
Usage: const { user, isAuthenticated, login, logout } = useAuth()
Pattern: Context-based auth state
</HOOK>`}

${h3('Utility Functions')}
${utilities.length > 0 ? utilities.map(util => `<UTILITY name="${util.name}">
Description: ${util.description}
Functions:
${util.functions?.map(f => `  - ${f.name}: ${f.description}`).join('\n') || '  - Various utility functions'}
</UTILITY>`).join('\n\n') : `<UTILITY name="apiRequest">
Location: @lib/queryClient
Description: Typed API request wrapper with error handling
Usage: apiRequest('POST', '/api/endpoint', data)
</UTILITY>

<UTILITY name="cn">
Location: @lib/utils
Description: Tailwind class name merger using clsx and tailwind-merge
Usage: cn('base-class', conditional && 'conditional-class')
</UTILITY>`}
</HOOKS_AND_UTILITIES>\n\n`;
    }

    if (enabledSections.includes('codePatterns')) {
      const apiPatterns = _data.codePatterns?.apiPatterns || [];
      const reactPatterns = _data.codePatterns?.reactPatterns || [];
      const databasePatterns = _data.codePatterns?.databasePatterns || [];
      
      doc += `<CODE_PATTERNS>
${h2('Common Implementation Patterns')}

${apiPatterns.length > 0 ? `${h3('API Patterns')}
${apiPatterns.map(pattern => `<PATTERN name="${pattern.name}">
Description: ${pattern.description}
${codeBlock(pattern.example, 'typescript')}
Usage:
${pattern.usage?.map(u => `  - ${u}`).join('\n') || '  - Standard API usage'}
</PATTERN>`).join('\n')}

` : ''}${reactPatterns.length > 0 ? `${h3('React Patterns')}
${reactPatterns.map(pattern => `<PATTERN name="${pattern.name}">
Description: ${pattern.description}
${codeBlock(pattern.example, 'typescript')}
Usage:
${pattern.usage?.map(u => `  - ${u}`).join('\n') || '  - Standard React usage'}
</PATTERN>`).join('\n')}

` : `${h3('Data Fetching Pattern')}
<PATTERN name="Query with Loading State">
${codeBlock(`const { data, isLoading, error } = useQuery({
  queryKey: ['/api/resource'],
  staleTime: 5 * 60 * 1000,
});

if (isLoading) return <Loader2 className="animate-spin" />;
if (error) return <ErrorDisplay error={error} />;
return <DataDisplay data={data} />;`, 'typescript')}
</PATTERN>

${h3('Form Handling Pattern')}
<PATTERN name="React Hook Form with Zod">
${codeBlock(`const form = useForm<FormData>({
  resolver: zodResolver(formSchema),
  defaultValues: { ... },
});

const onSubmit = async (data: FormData) => {
  await apiRequest('POST', '/api/endpoint', data);
  queryClient.invalidateQueries({ queryKey: ['/api/resource'] });
};`, 'typescript')}
</PATTERN>

`}${databasePatterns.length > 0 ? `${h3('Database Patterns')}
${databasePatterns.map(pattern => `<PATTERN name="${pattern.name}">
Description: ${pattern.description}
${codeBlock(pattern.example, 'typescript')}
Usage:
${pattern.usage?.map(u => `  - ${u}`).join('\n') || '  - Standard database usage'}
</PATTERN>`).join('\n')}
` : ''}
</CODE_PATTERNS>\n\n`;
    }

    if (enabledSections.includes('testing')) {
      const testing = _data.testing;
      
      doc += `<TESTING>
${h2('Testing Documentation')}
${testing ? `Total Test Cases: ~${testing.totalTests}` : ''}

${h3('Test Coverage Overview')}
<TEST_TYPES>
${bullet(`Unit Tests: ${testing?.coverage?.unit || 0} suites - Component and function isolation testing`)}
${bullet(`Integration Tests: ${testing?.coverage?.integration || 0} suites - API and database interaction testing`)}
${bullet(`E2E Tests: ${testing?.coverage?.e2e || 0} suites - Full user flow testing with Puppeteer`)}
${bullet(`Security Tests: ${testing?.coverage?.security || 0} suites - Authentication and authorization testing`)}
${bullet(`Critical Tests: ${testing?.coverage?.critical || 0} suites - Critical path testing`)}
</TEST_TYPES>

${testing?.structure ? Object.entries(testing.structure).map(([category, suites]) => {
  if (!suites || suites.length === 0) return '';
  return `${h3(`${category.charAt(0).toUpperCase() + category.slice(1)} Tests`)}
${suites.map(suite => `<TEST_SUITE name="${suite.name}" file="${suite.file}" tests="${suite.testCount}">
${suite.description}
</TEST_SUITE>`).join('\n')}
`;
}).filter(Boolean).join('\n') : `${h3('Testing Patterns')}
<TEST_PATTERN name="Component Testing">
${codeBlock(`describe('ComponentName', () => {
  it('renders correctly', () => {
    render(<ComponentName />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
  
  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<ComponentName onAction={mockFn} />);
    await user.click(screen.getByRole('button'));
    expect(mockFn).toHaveBeenCalled();
  });
});`, 'typescript')}
</TEST_PATTERN>`}

${h3('Test Directories')}
${bullet('tests/unit/ - Unit tests for components and utilities')}
${bullet('tests/integration/ - API integration tests')}
${bullet('tests/e2e/ - End-to-end browser tests')}
${bullet('tests/security/ - Security and auth tests')}
${bullet('tests/critical/ - Critical path tests')}
</TESTING>\n\n`;
    }

    if (enabledSections.includes('businessWorkflows')) {
      const businessFlows = _data.businessFlows || [];
      
      if (businessFlows.length > 0) {
        doc += `<BUSINESS_WORKFLOWS>
${h2('Business Workflows')}
Total Workflows: ${businessFlows.length}

${businessFlows.map(flow => `${h3(flow.name)}
<WORKFLOW name="${flow.name}">
Description: ${flow.description}
Tables Involved: ${flow.tables?.join(', ') || 'N/A'}
Flow: ${flow.flow}

Steps:
${flow.steps?.map(step => `${step.stepNumber}. ${step.action}
   Role: ${step.role}
   Data Transformation: ${step.dataTransformation}`).join('\n') || 'N/A'}

Error Handling:
${flow.errorHandling?.map(err => `- ${err.scenario}: ${err.handling}`).join('\n') || 'Standard error handling'}
</WORKFLOW>`).join('\n\n')}
</BUSINESS_WORKFLOWS>\n\n`;
      } else {
        doc += `<BUSINESS_WORKFLOWS>
${h2('Business Workflows')}

${h3('User Authentication Flow')}
<WORKFLOW name="Login">
Actors: All users (Admin, Manager, Resident)
Steps:
1. User navigates to /login
2. User enters credentials (email/password)
3. System validates credentials against database
4. On success: Create session, redirect to dashboard
5. On failure: Display error, allow retry
Error Handling: Rate limiting, account lockout after 5 failed attempts
</WORKFLOW>

${h3('Property Management Flow')}
<WORKFLOW name="Add Building">
Actors: Admin, Manager
Steps:
1. Navigate to Buildings section
2. Click "Add Building" button
3. Fill building details form (address, units, amenities)
4. Upload building documents (optional)
5. Submit form
6. System creates building and associated records
Permissions: Requires 'building:create' permission
</WORKFLOW>

${h3('Maintenance Request Flow')}
<WORKFLOW name="Submit Maintenance Request">
Actors: Resident, Manager
Steps:
1. Resident submits request via form
2. System creates ticket, notifies manager
3. Manager assigns to vendor or staff
4. Work is performed
5. Manager marks as complete
6. Resident confirms resolution
Status States: pending -> assigned -> in_progress -> completed -> closed
</WORKFLOW>

${h3('Document Management Flow')}
<WORKFLOW name="Upload Document">
Actors: Manager, Admin
Steps:
1. Select document type and category
2. Upload file (validated for type/size)
3. System scans for viruses (quarantine if needed)
4. Document stored in organized folder structure
5. Metadata indexed for search
Access Control: Role-based visibility per document type
</WORKFLOW>
</BUSINESS_WORKFLOWS>\n\n`;
      }
    }

    if (enabledSections.includes('dependencies') && _data.dependencies?.length > 0) {
      const prodDeps = _data.dependencies.filter(d => d.type === 'production');
      const devDeps = _data.dependencies.filter(d => d.type === 'development');
      
      doc += `<DEPENDENCIES>
${h2('Package Dependencies')}
Total: ${_data.dependencies.length} (${prodDeps.length} production, ${devDeps.length} development)

${h3('Production Dependencies')}
${prodDeps.map(dep => `<DEP name="${dep.name}" version="${dep.version}">${dep.description}</DEP>`).join('\n')}

${h3('Development Dependencies')}
${devDeps.map(dep => `<DEP name="${dep.name}" version="${dep.version}">${dep.description}</DEP>`).join('\n')}

${h3('Key Framework Dependencies')}
${bullet('React 18+ - UI framework')}
${bullet('TanStack Query - Data fetching and caching')}
${bullet('Drizzle ORM - Database operations')}
${bullet('Express - Backend server')}
${bullet('Tailwind CSS - Styling')}
${bullet('shadcn/ui - Component library')}
</DEPENDENCIES>\n\n`;
    }

    doc += `<COMPLIANCE>
${h2('Regulatory Compliance')}

${h3('Quebec Law 25 (Privacy)')}
<LAW_25_COMPLIANCE>
${bullet('Personal information inventory maintained')}
${bullet('Privacy policy published and accessible')}
${bullet('Consent mechanisms for data collection')}
${bullet('Data retention policies implemented')}
${bullet('Incident response procedures documented')}
${bullet('Privacy officer designated')}
${bullet('Data subject access request handling')}
</LAW_25_COMPLIANCE>

${h3('Quebec Civil Code (Condominiums)')}
<CIVIL_CODE_COMPLIANCE>
${bullet('Co-ownership declaration management')}
${bullet('Common expense calculations per declaration')}
${bullet('Meeting minute documentation')}
${bullet('Financial statement generation')}
${bullet('Reserve fund tracking')}
${bullet('Unit owner registry maintenance')}
</CIVIL_CODE_COMPLIANCE>

${h3('Accessibility Standards')}
<ACCESSIBILITY>
${bullet('WCAG 2.1 Level AA compliance target')}
${bullet('Keyboard navigation support')}
${bullet('Screen reader compatibility')}
${bullet('Color contrast requirements met')}
${bullet('Alt text for images')}
</ACCESSIBILITY>
</COMPLIANCE>\n\n`;

    if (_data.components?.length > 0) {
      doc += `<COMPONENTS>
${h2('Component Architecture')}
Total Components: ${_data.components.length}
Average Complexity: ${(_data.components.reduce((sum, c) => sum + c.complexity, 0) / _data.components.length).toFixed(2)}

${_data.components.map(comp => `
<COMPONENT name="${comp.name}">
Type: ${comp.type}
Complexity Score: ${comp.complexity}
Dependencies: ${comp.dependencies.join(', ') || 'None'}
Exports: ${comp.exports.join(', ') || 'Default export'}
</COMPONENT>`).join('\n')}
</COMPONENTS>\n\n`;
    }

    doc += `<DOCUMENT_FOOTER>
${h2('Technical Metrics Summary')}
${bullet(`Components: ${_data.components?.length || 0}`)}
${bullet(`API Endpoints: ${_data.apis?.length || 0}`)}
${bullet(`Database Tables: ${_data.database?.tables?.length || 0}`)}
${bullet(`Dependencies: ${_data.dependencies?.length || 0}`)}
${bullet(`Documentation Files: ${_data.documentationFiles?.length || 0}`)}

Generated: ${timestamp}
Documentation Version: 4.0
System Version: ${_data.projectOverview.version}
Generator: Koveo Gestion LLM Documentation System
Optimized For: Claude, ChatGPT, and other LLMs
</DOCUMENT_FOOTER>`;

    return doc;
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header
        title='Documentation Center'
        subtitle='Generate and export comprehensive project documentation'
      />

      <div className='border-b bg-gray-50 px-6 py-3'>
        <div className='max-w-7xl mx-auto'>
          <div className='flex items-center gap-2 text-sm text-gray-600'>
            <Terminal className='h-4 w-4' />
            <span className='font-medium'>Refresh Command:</span>
            <code className='bg-gray-100 px-2 py-1 rounded text-xs font-mono'>
              npm run docs:generate
            </code>
          </div>
        </div>
      </div>

      <div className='px-6 py-2 bg-gray-50 border-b'>
        <div className='max-w-7xl mx-auto flex items-center justify-between text-sm'>
          <div className='flex items-center gap-4 text-gray-600'>
            <div className='flex items-center gap-2'>
              <Clock className='h-4 w-4' />
              <span>
                Last updated: {lastRefresh.toLocaleDateString()} at{' '}
                {lastRefresh.toLocaleTimeString()}
              </span>
            </div>
            {isAutoRefreshing && (
              <div className='flex items-center gap-2 text-blue-600'>
                <RefreshCw className='h-4 w-4 animate-spin' />
                <span>Auto-refreshing...</span>
              </div>
            )}
          </div>
          <Button
            variant='ghost'
            size='sm'
            onClick={handleManualRefresh}
            disabled={isFetching || isAutoRefreshing}
            className='h-8'
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${isFetching || isAutoRefreshing ? 'animate-spin' : ''}`}
            />
            Refresh Now
          </Button>
        </div>
      </div>

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Download className='h-5 w-5' />
                  Human Documentation (Google Suite)
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <p className='text-sm text-gray-600'>
                  Export comprehensive documentation in human-readable formats including Word
                  documents, Excel spreadsheets, and other Google Suite compatible files.
                </p>

                <div className='space-y-2'>
                  <div className='flex items-center gap-2 text-sm'>
                    <FileText className='h-4 w-4 text-blue-600' />
                    <span>Project Overview (.docx)</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <FileSpreadsheet className='h-4 w-4 text-green-600' />
                    <span>Component Specifications (.xlsx)</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <FileText className='h-4 w-4 text-blue-600' />
                    <span>API Documentation (.docx)</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <FileSpreadsheet className='h-4 w-4 text-green-600' />
                    <span>Database Schema (.xlsx)</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <FileText className='h-4 w-4 text-blue-600' />
                    <span>Dependencies List (.docx)</span>
                  </div>
                </div>

                <Button
                  onClick={handleExportGoogleSuite}
                  disabled={isExportingGoogleSuite || isLoading}
                  className='w-full'
                >
                  {isExportingGoogleSuite ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Exporting Documentation...
                    </>
                  ) : (
                    <>
                      <Package className='mr-2 h-4 w-4' />
                      Export Google Suite Package
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Cpu className='h-5 w-5' />
                  LLM Documentation
                  <Badge variant='outline' className='ml-2'>v4.0</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <p className='text-sm text-gray-600'>
                  Generate comprehensive, LLM-optimized documentation with XML-structured sections,
                  enhanced schema analysis, business workflows, and code patterns for Claude and ChatGPT.
                </p>

                <div className='flex flex-wrap items-center gap-2'>
                  <Badge variant='secondary' className='text-xs'>
                    <AlertCircle className='w-3 h-3 mr-1' />
                    Enhanced Schema Analysis
                  </Badge>
                  <Badge variant='secondary' className='text-xs'>
                    <CheckCircle className='w-3 h-3 mr-1' />
                    Business Logic Mapping
                  </Badge>
                  <Badge variant='secondary' className='text-xs'>
                    <Code className='w-3 h-3 mr-1' />
                    Code Patterns
                  </Badge>
                  <Badge variant='secondary' className='text-xs'>
                    <Sparkles className='w-3 h-3 mr-1' />
                    Claude/ChatGPT Optimized
                  </Badge>
                </div>

                <div className='space-y-3 pt-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-medium text-gray-700'>Select sections</span>
                    <Badge variant='outline' className='text-xs'>
                      {selectedSectionCount} selected
                    </Badge>
                  </div>
                  
                  <div className='grid grid-cols-1 gap-2 p-3 bg-gray-50 rounded-lg'>
                    {llmSections.map((section) => (
                      <div key={section.id} className='flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          <Switch
                            id={section.id}
                            checked={section.enabled}
                            onCheckedChange={() => toggleSection(section.id)}
                          />
                          <Label htmlFor={section.id} className='text-sm cursor-pointer'>
                            {section.label}
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label className='text-sm font-medium text-gray-700'>Output Format</Label>
                  <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as 'txt' | 'md')}>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Select format' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='txt'>Standard Text (.txt)</SelectItem>
                      <SelectItem value='md'>Markdown (.md)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerateLLMDocumentation}
                  disabled={isGeneratingLLM || isLoading || selectedSectionCount === 0}
                  className='w-full'
                  variant='outline'
                >
                  {isGeneratingLLM ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Generating Documentation...
                    </>
                  ) : (
                    <>
                      <Cpu className='mr-2 h-4 w-4' />
                      Generate LLM Documentation
                      {selectedSectionCount > 0 && (
                        <Badge variant='secondary' className='ml-2 text-xs'>
                          {selectedSectionCount} sections
                        </Badge>
                      )}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {docData?.documentationFiles && (
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Folder className='h-5 w-5' />
                  Documentation Files ({docData.documentationFiles.length})
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <p className='text-sm text-gray-600'>
                  Browse existing documentation files in the project. Updates only occur during git pushes and deployments.
                </p>

                {Object.entries(
                  docData.documentationFiles.reduce((groups, file) => {
                    const category = file.category || 'general';
                    if (!groups[category]) groups[category] = [];
                    groups[category].push(file);
                    return groups;
                  }, {} as Record<string, typeof docData.documentationFiles>)
                ).map(([category, files]) => (
                  <div key={category} className='space-y-2'>
                    <h4 className='font-medium text-sm text-gray-700 capitalize flex items-center gap-1'>
                      <BookOpen className='h-4 w-4' />
                      {category} ({files.length})
                    </h4>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2'>
                      {files.map((file) => (
                        <div
                          key={file.path}
                          className='flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors'
                        >
                          <div className='flex items-center gap-2 min-w-0 flex-1'>
                            <FileText className='h-4 w-4 text-blue-600 flex-shrink-0' />
                            <div className='min-w-0 flex-1'>
                              <p className='text-sm font-medium text-gray-900 truncate'>
                                {file.name}
                              </p>
                              <p className='text-xs text-gray-500'>
                                {(file.size / 1024).toFixed(1)} KB • {' '}
                                {new Date(file.lastModified).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-8 w-8 p-0 flex-shrink-0'
                            onClick={() => {
                              window.open(`/api/documentation/file/${file.path}`, '_blank');
                            }}
                          >
                            <ExternalLink className='h-4 w-4' />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {docData.documentationFiles.length === 0 && (
                  <div className='text-center py-8 text-gray-500'>
                    <BookOpen className='h-8 w-8 mx-auto mb-2 text-gray-400' />
                    <p>No documentation files found in the docs directory.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isLoading && (
            <Card>
              <CardContent className='flex items-center justify-center py-16'>
                <Loader2 className='h-8 w-8 animate-spin text-koveo-navy mr-3' />
                <span>Loading documentation data...</span>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
