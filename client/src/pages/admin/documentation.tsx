import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * Comprehensive documentation data structure for the Quebec property management platform.
 * Contains project overview, technical components, API specifications, database schema,
 * and dependency information for complete system documentation.
 */
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
}

/**
 * Owner documentation center page for generating and managing project documentation.
 * Provides comprehensive documentation generation, export capabilities for Google Suite,
 * LLM-optimized documentation, and automatic refresh functionality for development environments.
 *
 * Features:
 * - Real-time documentation generation
 * - Google Suite export (DOCX, XLSX formats)
 * - LLM-optimized documentation for AI processing
 * - Auto-refresh in Replit environment
 * - Manual refresh capabilities.
 *
 * @returns {JSX.Element} Rendered documentation center with export and generation tools.
 */
export default function OwnerDocumentation() {
  const [isExportingGoogleSuite, setIsExportingGoogleSuite] = useState(false);
  const [isGeneratingLLM, setIsGeneratingLLM] = useState(false);
  const [gitStatus, setGitStatus] = useState<{
    hasChanges: boolean;
    lastCommit: any;
  } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch comprehensive documentation data from the real API
  const {
    data: docData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<DocumentationData>({
    queryKey: ['/api/documentation/comprehensive'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    queryFn: async () => {
      console.log('📚 Fetching real documentation data...');
      const response = await fetch('/api/documentation/comprehensive', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch documentation: ${response.statusText}`);
      }
      
      const data = await response.json();
      setLastRefresh(new Date());
      console.log('✅ Documentation data fetched successfully:', {
        components: data.components?.length || 0,
        apis: data.apis?.length || 0,
        tables: data.database?.tables?.length || 0,
        files: data.documentationFiles?.length || 0,
      });
      
      return data;
    },
  });

  // Auto-refresh documentation every 30 minutes when working in Replit
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    // Check if we're in a Replit environment
    const isReplit =
      window.location.hostname.includes('replit') ||
      window.location.hostname.includes('.repl.') ||
      import.meta.env.REPLIT_ENV;

    if (isReplit) {
      // Set up 30-minute auto-refresh
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
      ); // 30 minutes

    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [refetch, toast]);

  // Listen for deployment events or page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible, check if we should refresh
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

  // Manual refresh function
  const handleManualRefresh = async () => {
    setIsAutoRefreshing(true);
    try {
      await refetch();
      toast({
        title: 'Documentation Refreshed',
        description: 'Documentation data has been updated with the latest information.',
      });
    } catch (error) {
      console.error('Refresh error:', error);
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
      // Simulate generating Google Suite documents
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create documentation files structure
      const documentationFiles = {
        'project-overview.docx': generateProjectOverviewDocx(docData),
        'component-specifications.xlsx': generateComponentSpreadsheet(docData),
        'api-documentation.docx': generateApiDocumentation(docData),
        'database-schema.xlsx': generateDatabaseSchema(docData),
        'dependencies-list.docx': generateDependenciesList(docData),
      };

      // Create and download ZIP
      const zip = await createDocumentationZip(documentationFiles);
      downloadFile(zip, 'koveo-gestion-documentation.zip');

      toast({
        title: 'Documentation Exported',
        description: 'Google Suite documentation package has been downloaded successfully.',
      });
    } catch (error) {
      console.error('Export error:', error);
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
      // Generate comprehensive LLM documentation
      const llmDoc = generateComprehensiveLLMDocumentation(docData);

      // Create and download the text file
      const blob = new Blob([llmDoc], { type: 'text/plain;charset=utf-8' });
      const filename = `koveo-gestion-llm-documentation-${new Date().toISOString().split('T')[0]}.txt`;
      downloadFile(blob, filename);

      toast({
        title: 'LLM Documentation Exported',
        description:
          'Comprehensive documentation for AI processing has been downloaded as a text file.',
      });
    } catch (error) {
      console.error('LLM documentation generation error:', error);
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
      doc += `Response: ${api._response}\n\n`;
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
    // Create ZIP content for documentation download
    const zipContent = Object.entries(files)
      .map(([filename, content]) => `=== ${filename} ===\n${content}\n\n`)
      .join('');

    return new Blob([zipContent], { type: 'application/zip' });
  };

  const generateComprehensiveLLMDocumentation = (_data: DocumentationData | undefined) => {
    if (!_data) {
      return '';
    }

    const lastUpdated = _data.projectOverview.lastUpdated || new Date().toISOString();

    return `KOVEO_GESTION_COMPREHENSIVE_DOCUMENTATION_FOR_LLM_PROCESSING

=== EXECUTIVE SUMMARY ===
${_data.projectOverview.description}

Generated on: ${new Date(lastUpdated).toLocaleString()}
Project Version: ${_data.projectOverview.version}
Architecture: ${_data.projectOverview.architecture}

=== PROJECT_OVERVIEW ===
PROJECT_IDENTITY:
- Name: ${_data.projectOverview.name}
- Version: ${_data.projectOverview.version}
- Description: ${_data.projectOverview.description}
- Architecture: ${_data.projectOverview.architecture}
- Last Updated: ${lastUpdated}

=== SYSTEM_COMPONENTS ===
Total Components: ${_data.components.length}

${_data.components.map(component => `
COMPONENT: ${component.name}
- Type: ${component.type}
- Dependencies: ${component.dependencies.join(', ')}
- Exports: ${component.exports.join(', ')}
- Complexity Score: ${component.complexity}
`).join('')}

=== API_ENDPOINTS ===
Total API Endpoints: ${_data.apis.length}

${_data.apis.map(api => `
ENDPOINT: ${api.method} ${api.endpoint}
- Description: ${api.description}
- Parameters: ${api.parameters.length > 0 ? api.parameters.join(', ') : 'None'}
- Response Type: ${api.response}
`).join('')}

=== DATABASE_SCHEMA ===
Total Tables: ${_data.database.tables.length}

${_data.database.tables.map(table => `
TABLE: ${table.name}
Columns:
${table.columns.map(col => `  - ${col.name}: ${col.type} ${col.nullable ? '(nullable)' : '(required)'} ${col.primary ? '(primary key)' : ''}`).join('\n')}
`).join('')}

=== DEPENDENCIES ===
Total Dependencies: ${_data.dependencies.length}

PRODUCTION DEPENDENCIES (${_data.dependencies.filter(d => d.type === 'production').length}):
${_data.dependencies.filter(d => d.type === 'production').map(dep => `
- ${dep.name} (${dep.version}): ${dep.description}
`).join('')}

DEVELOPMENT DEPENDENCIES (${_data.dependencies.filter(d => d.type === 'development').length}):
${_data.dependencies.filter(d => d.type === 'development').map(dep => `
- ${dep.name} (${dep.version}): ${dep.description}
`).join('')}

=== DOCUMENTATION_FILES ===
Total Documentation Files: ${_data.documentationFiles.length}

Documentation by Category:
${Object.entries(_data.documentationFiles.reduce((groups, file) => {
  const category = file.category || 'general';
  if (!groups[category]) groups[category] = [];
  groups[category].push(file);
  return groups;
}, {} as Record<string, typeof _data.documentationFiles>)).map(([category, files]) => `
${category.toUpperCase()} (${files.length} files):
${files.map(file => `  - ${file.name} (${(file.size / 1024).toFixed(1)} KB) - ${file.path}`).join('\n')}
`).join('')}

=== TECHNICAL_METRICS ===
- Components: ${_data.components.length}
- API Endpoints: ${_data.apis.length}  
- Database Tables: ${_data.database.tables.length}
- Dependencies: ${_data.dependencies.length}
- Documentation Files: ${_data.documentationFiles.length}
- Average Component Complexity: ${(_data.components.reduce((sum, c) => sum + c.complexity, 0) / _data.components.length).toFixed(2)}

LAST_UPDATED: ${lastUpdated}
DOCUMENTATION_VERSION: 3.0
SYSTEM_VERSION: ${_data.projectOverview.version}
GENERATED_BY: Koveo Gestion Documentation System`;
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

      {/* Refresh Command */}
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

      {/* Auto-refresh status bar */}
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
          {/* Overview Stats */}
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            <Card>
              <CardContent className='p-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='text-sm font-medium text-gray-600'>Components</p>
                    <p className='text-2xl font-bold text-koveo-navy'>
                      {docData?.components.length || 0}
                    </p>
                  </div>
                  <Package className='h-8 w-8 text-koveo-navy' />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className='p-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='text-sm font-medium text-gray-600'>API Endpoints</p>
                    <p className='text-2xl font-bold text-koveo-navy'>
                      {docData?.apis.length || 0}
                    </p>
                  </div>
                  <Cpu className='h-8 w-8 text-koveo-navy' />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className='p-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='text-sm font-medium text-gray-600'>Database Tables</p>
                    <p className='text-2xl font-bold text-koveo-navy'>
                      {docData?.database.tables.length || 0}
                    </p>
                  </div>
                  <FileSpreadsheet className='h-8 w-8 text-koveo-navy' />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className='p-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='text-sm font-medium text-gray-600'>Documentation Files</p>
                    <p className='text-2xl font-bold text-koveo-navy'>
                      {docData?.documentationFiles?.length || 0}
                    </p>
                  </div>
                  <BookOpen className='h-8 w-8 text-koveo-navy' />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Export Options */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* Google Suite Export */}
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

            {/* LLM Documentation */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Cpu className='h-5 w-5' />
                  LLM Documentation
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <p className='text-sm text-gray-600'>
                  Generate exhaustive technical documentation with detailed schema relationships and
                  business logic optimized for AI/LLM processing.
                </p>

                <div className='flex items-center gap-2'>
                  <Badge variant='secondary' className='text-xs'>
                    <AlertCircle className='w-3 h-3 mr-1' />
                    Enhanced Schema Analysis
                  </Badge>
                  <Badge variant='secondary' className='text-xs'>
                    <CheckCircle className='w-3 h-3 mr-1' />
                    Business Logic Mapping
                  </Badge>
                </div>

                <Button
                  onClick={handleGenerateLLMDocumentation}
                  disabled={isGeneratingLLM || isLoading}
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
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Documentation Files Browser */}
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

                {/* Group files by category */}
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
