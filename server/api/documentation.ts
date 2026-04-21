import { Express } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { requireAuth } from '../auth/index';

// Interface for documentation data
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
  enhancedSchema?: EnhancedSchemaAnalysis;
  hooksAndUtilities?: HooksAndUtilities;
  testing?: TestingDocumentation;
  codePatterns?: CodePatterns;
  businessFlows?: EnhancedBusinessFlow[];
}

interface DocumentFile {
  name: string;
  content: string;
  path: string;
  category: string;
}

// Enhanced schema analysis types
interface EntityDescription {
  tableName: string;
  businessDescription: string;
  domain: string;
  keyPurpose: string;
}

interface ForeignKeyChain {
  from: string;
  chain: string[];
  description: string;
}

interface CascadeDeleteBehavior {
  table: string;
  column: string;
  referencedTable: string;
  onDelete: string;
  businessImplication: string;
}

interface EnhancedSchemaAnalysis {
  entityRelationshipDiagram: string;
  entityDescriptions: EntityDescription[];
  foreignKeyChains: ForeignKeyChain[];
  cascadeDeleteBehaviors: CascadeDeleteBehavior[];
}

// Hooks and utilities types
interface HookInfo {
  name: string;
  description: string;
  parameters: string[];
  dependencies: string[];
  usagePatterns: string[];
}

interface UtilityInfo {
  name: string;
  description: string;
  functions: Array<{
    name: string;
    description: string;
    parameters: string[];
  }>;
}

interface HooksAndUtilities {
  hooks: HookInfo[];
  utilities: UtilityInfo[];
}

// Testing documentation types
interface TestSuite {
  name: string;
  description: string;
  file: string;
  testCount: number;
}

interface TestingDocumentation {
  structure: {
    unit: TestSuite[];
    integration: TestSuite[];
    e2e: TestSuite[];
    security: TestSuite[];
    critical: TestSuite[];
  };
  totalTests: number;
  coverage: {
    unit: number;
    integration: number;
    e2e: number;
    security: number;
    critical: number;
  };
}

// Code patterns types
interface CodePattern {
  name: string;
  category: 'api' | 'react' | 'database';
  description: string;
  example: string;
  usage: string[];
}

interface CodePatterns {
  apiPatterns: CodePattern[];
  reactPatterns: CodePattern[];
  databasePatterns: CodePattern[];
}

// Enhanced business flow types
interface EnhancedBusinessFlow {
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
}

// LLM documentation metadata
interface DocumentationMetadata {
  generatedAt: string;
  version: string;
  tokenEstimate: number;
  sections: string[];
}

export function registerDocumentationRoutes(app: Express) {
  // Get comprehensive documentation data
  app.get('/api/documentation/comprehensive', requireAuth, async (req, res) => {
    try {
      // console.log('📚 Generating comprehensive documentation data...');

      // Read package.json for project info
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      // Read documentation files from docs directory
      const docsPath = path.join(process.cwd(), 'docs');
      const documentationFiles = await scanDocumentationFiles(docsPath);

      // Extract API endpoints from server directory
      const apiEndpoints = await extractApiEndpoints();

      // Extract database schema information
      const databaseSchema = await extractDatabaseSchema();

      // Extract component information
      const components = await extractComponentInfo();

      // Extract dependencies from package.json
      const dependencies = extractDependencies(packageJson);

      // Extract enhanced documentation data
      const [enhancedSchema, hooksAndUtilities, testing, codePatterns] = await Promise.all([
        extractEnhancedSchemaAnalysis(),
        extractHooksAndUtilities(),
        extractTestingDocumentation(),
        extractCodePatterns(),
      ]);
      const businessFlows = extractEnhancedBusinessFlows();

      const documentation: DocumentationData = {
        projectOverview: {
          name: packageJson.name || 'Koveo Gestion',
          description: packageJson.description || 'AI-powered property management SaaS platform',
          version: packageJson.version || '1.0.0',
          architecture: 'React/TypeScript frontend with Node.js/Express backend, PostgreSQL database',
          lastUpdated: new Date().toISOString(),
        },
        components,
        apis: apiEndpoints,
        database: databaseSchema,
        dependencies,
        documentationFiles,
        enhancedSchema,
        hooksAndUtilities,
        testing,
        codePatterns,
        businessFlows,
      };

      // console.log(`✅ Documentation generated with ${documentation.documentationFiles.length} files, ${documentation.apis.length} APIs, ${documentation.components.length} components`);
      res.json(documentation);
    } catch (error) {
      console.error('❌ Error generating documentation:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to generate documentation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get specific documentation file content
  app.get('/api/documentation/file/*', requireAuth, async (req, res) => {
    try {
      const filePath = req.params[0]; // Everything after /file/
      const fullPath = path.join(process.cwd(), 'docs', filePath);
      
      // Security check - ensure path is within docs directory
      const docsPath = path.join(process.cwd(), 'docs');
      if (!fullPath.startsWith(docsPath)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      const stats = await fs.stat(fullPath);

      res.json({
        success: true,
        file: {
          name: path.basename(fullPath),
          content,
          path: filePath,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
        }
      });
    } catch (error) {
      console.error('❌ Error reading documentation file:', error);
      res.status(404).json({ 
        success: false, 
        message: 'Documentation file not found' 
      });
    }
  });

  // List all documentation files
  app.get('/api/documentation/files', requireAuth, async (req, res) => {
    try {
      const docsPath = path.join(process.cwd(), 'docs');
      const files = await scanDocumentationFiles(docsPath);
      
      res.json({
        success: true,
        files,
        total: files.length
      });
    } catch (error) {
      console.error('❌ Error listing documentation files:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to list documentation files' 
      });
    }
  });

  // Generate comprehensive LLM documentation with detailed schema and business logic
  app.post('/api/documentation/llm-generate', requireAuth, async (req, res) => {
    try {
      // console.log('🤖 Generating comprehensive LLM documentation...');
      
      const documentationData = await generateLLMDocumentation();
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `koveo-llm-documentation-${timestamp}.md`;
      
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(documentationData);
      
      // console.log(`✅ LLM documentation generated: ${filename}`);
    } catch (error) {
      console.error('❌ Error generating LLM documentation:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to generate LLM documentation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Check git status for documentation updates
  app.get('/api/documentation/git-status', requireAuth, async (req, res) => {
    try {
      const simpleGit = (await import('simple-git')).default;
      const git = simpleGit();
      
      const status = await git.status();
      const lastCommit = await git.log({ maxCount: 1 });
      
      res.json({
        success: true,
        hasChanges: !status.isClean(),
        lastCommit: lastCommit.latest,
        files: {
          modified: status.modified,
          added: status.not_added,
          deleted: status.deleted,
        }
      });
    } catch (error) {
      console.error('❌ Error checking git status:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to check git status' 
      });
    }
  });
}

// Helper function to scan documentation files
async function scanDocumentationFiles(docsPath: string): Promise<Array<{
  name: string;
  path: string;
  size: number;
  lastModified: string;
  category: string;
}>> {
  const files: Array<{
    name: string;
    path: string;
    size: number;
    lastModified: string;
    category: string;
  }> = [];

  async function scanDirectory(dirPath: string, relativePath = '') {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativeFilePath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          await scanDirectory(fullPath, relativeFilePath);
        } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.txt'))) {
          const stats = await fs.stat(fullPath);
          
          // Determine category based on path and filename
          let category = 'general';
          if (relativeFilePath.includes('guides/')) category = 'guides';
          else if (relativeFilePath.includes('references/')) category = 'references';
          else if (entry.name.includes('API')) category = 'api';
          else if (entry.name.includes('COMPONENT')) category = 'components';
          else if (entry.name.includes('DEPLOYMENT')) category = 'deployment';
          else if (entry.name.includes('SECURITY')) category = 'security';
          else if (entry.name.includes('TESTING')) category = 'testing';
          
          files.push({
            name: entry.name,
            path: relativeFilePath,
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
            category,
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not scan directory ${dirPath}:`, error);
    }
  }

  await scanDirectory(docsPath);
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

async function extractApiEndpoints() {
  const apis: Array<{
    endpoint: string;
    method: string;
    description: string;
    parameters: string[];
    response: string;
  }> = [];

  const serverPath = path.join(process.cwd(), 'server');

  async function scanDirectory(dirPath: string) {
    try {
      await fs.access(dirPath);
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            if (content.includes('app.get(') || content.includes('app.post(') || content.includes('app.put(') || content.includes('app.delete(') || content.includes('app.patch(') || content.includes('router.get(') || content.includes('router.post(') || content.includes('router.put(') || content.includes('router.delete(') || content.includes('router.patch(')) {
              const relativeName = path.relative(serverPath, fullPath);
              const extractedApis = extractApisFromFile(content, relativeName);
              apis.push(...extractedApis);
            }
          } catch (error) {
            console.warn(`⚠️ Could not read file ${entry.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Directory not accessible ${dirPath}:`, error);
    }
  }

  try {
    await scanDirectory(path.join(serverPath, 'api'));
    const additionalFiles = ['routes.ts', 'auth.ts'];
    for (const file of additionalFiles) {
      const filePath = path.join(serverPath, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const extractedApis = extractApisFromFile(content, file);
        apis.push(...extractedApis);
      } catch {
      }
    }
    const servicesPath = path.join(serverPath, 'services');
    await scanDirectory(servicesPath);
  } catch (error) {
    console.warn('⚠️ Could not extract API endpoints:', error);
  }

  return apis;
}

// Helper function to extract APIs from file content
function extractApisFromFile(content: string, filename: string): Array<{
  endpoint: string;
  method: string;
  description: string;
  parameters: string[];
  response: string;
}> {
  const apis: Array<{
    endpoint: string;
    method: string;
    description: string;
    parameters: string[];
    response: string;
  }> = [];

  // Extract route definitions using regex patterns
  const routePatterns = [
    /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
  ];

  for (const pattern of routePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const endpoint = match[2];
      
      // Try to extract description from comments above the route
      const lines = content.substring(0, match.index).split('\n');
      let description = `${filename.replace('.ts', '')} - ${method} ${endpoint}`;
      
      // Look for comments in the last few lines before the route
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
        const line = lines[i].trim();
        if (line.startsWith('//') || line.startsWith('*')) {
          description = line.replace(/^[\/\*\s]+/, '').trim();
          break;
        }
      }

      apis.push({
        endpoint,
        method,
        description,
        parameters: extractParameters(content, match.index),
        response: 'Object', // Default response type
      });
    }
  }

  return apis;
}

// Helper function to extract parameters from route context
function extractParameters(content: string, routeIndex: number): string[] {
  const parameters: string[] = [];
  
  // Look for common parameter patterns in the route context
  const routeContext = content.substring(routeIndex, routeIndex + 500);
  
  // Extract req.query patterns
  const queryMatches = routeContext.match(/req\.query\.(\w+)/g);
  if (queryMatches) {
    queryMatches.forEach(match => {
      const param = match.replace('req.query.', '');
      if (!parameters.includes(param)) {
        parameters.push(param);
      }
    });
  }
  
  // Extract req.params patterns
  const paramMatches = routeContext.match(/req\.params\.(\w+)/g);
  if (paramMatches) {
    paramMatches.forEach(match => {
      const param = match.replace('req.params.', '');
      if (!parameters.includes(param)) {
        parameters.push(param);
      }
    });
  }
  
  // Extract URL parameters from route definition
  const urlParamMatches = routeContext.match(/:(\w+)/g);
  if (urlParamMatches) {
    urlParamMatches.forEach(match => {
      const param = match.replace(':', '');
      if (!parameters.includes(param)) {
        parameters.push(param);
      }
    });
  }

  return parameters;
}

// Helper function to extract database schema with relationships and business logic
async function extractDatabaseSchema() {
  const schema = {
    tables: [] as Array<{
      name: string;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        primary: boolean;
        foreignKey?: {
          table: string;
          column: string;
          onDelete?: string;
        };
      }>;
      relationships: {
        hasMany: string[];
        belongsTo: string[];
        manyToMany: string[];
      };
      businessLogic: string[];
      domain: string;
    }>,
    relationships: Array<{
      from: string;
      to: string;
      type: 'one-to-many' | 'many-to-one' | 'many-to-many';
      description: string;
      businessRule: string;
    }>,
    businessFlows: Array<{
      name: string;
      description: string;
      tables: string[];
      flow: string;
    }>
  };

  try {
    // Read the main schema file
    const schemaPath = path.join(process.cwd(), 'shared', 'schema.ts');
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    
    // Extract table exports from schema files
    const schemasPath = path.join(process.cwd(), 'shared', 'schemas');
    const allSchemaContent: Record<string, string> = {};
    
    try {
      const schemaFiles = await fs.readdir(schemasPath);
      
      for (const file of schemaFiles) {
        if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
          try {
            const content = await fs.readFile(path.join(schemasPath, file), 'utf-8');
            allSchemaContent[file] = content;
            const tables = extractTablesFromSchemaWithRelationships(content, file);
            schema.tables.push(...tables);
          } catch (error) {
            console.warn(`⚠️ Could not read schema file ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Schemas directory not accessible:', error);
    }

    // Extract relationships and business logic across all schema files
    schema.relationships = extractSchemaRelationships(allSchemaContent);
    schema.businessFlows = extractBusinessFlows(allSchemaContent);
    
  } catch (error) {
    console.warn('⚠️ Could not extract database schema:', error);
  }

  return schema;
}

// Helper function to extract tables from schema file content with relationships
function extractTablesFromSchemaWithRelationships(content: string, filename: string): Array<{
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    primary: boolean;
    foreignKey?: {
      table: string;
      column: string;
      onDelete?: string;
    };
  }>;
  relationships: {
    hasMany: string[];
    belongsTo: string[];
    manyToMany: string[];
  };
  businessLogic: string[];
  domain: string;
}> {
  const tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      primary: boolean;
      foreignKey?: {
        table: string;
        column: string;
        onDelete?: string;
      };
    }>;
    relationships: {
      hasMany: string[];
      belongsTo: string[];
      manyToMany: string[];
    };
    businessLogic: string[];
    domain: string;
  }> = [];

  // Determine domain from filename
  const domain = filename.replace('.ts', '');

  // Extract table definitions using regex
  const tablePattern = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{([^}]+)\}/gs;
  
  let match;
  while ((match = tablePattern.exec(content)) !== null) {
    const tableName = match[2]; // The string name, not the variable name
    const columnsContent = match[3];
    
    const columns = extractColumnsFromTableDefinitionWithForeignKeys(columnsContent);
    const relationships = extractTableRelationships(content, match[1]);
    const businessLogic = extractTableBusinessLogic(content, tableName);
    
    tables.push({
      name: tableName,
      columns,
      relationships,
      businessLogic,
      domain,
    });
  }

  return tables;
}

// Enhanced helper function to extract columns with foreign key information
function extractColumnsFromTableDefinitionWithForeignKeys(columnsContent: string): Array<{
  name: string;
  type: string;
  nullable: boolean;
  primary: boolean;
  foreignKey?: {
    table: string;
    column: string;
    onDelete?: string;
  };
}> {
  const columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    primary: boolean;
    foreignKey?: {
      table: string;
      column: string;
      onDelete?: string;
    };
  }> = [];

  // Split by lines and process each column definition
  const lines = columnsContent.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('//')) {
      const columnMatch = trimmedLine.match(/(\w+):\s*(\w+)\s*\(/);
      if (columnMatch) {
        const columnName = columnMatch[1];
        const columnType = columnMatch[2];
        
        const isNullable = !trimmedLine.includes('.notNull()');
        const isPrimary = trimmedLine.includes('.primaryKey()');
        
        // Extract foreign key relationship
        let foreignKey: { table: string; column: string; onDelete?: string } | undefined;
        const fkMatch = trimmedLine.match(/\.references\(\(\)\s*=>\s*(\w+)\.(\w+),?\s*\{[^}]*onDelete:\s*['"`](\w+)['"`]/);
        if (fkMatch) {
          foreignKey = {
            table: fkMatch[1],
            column: fkMatch[2],
            onDelete: fkMatch[3],
          };
        } else {
          const simpleFkMatch = trimmedLine.match(/\.references\(\(\)\s*=>\s*(\w+)\.(\w+)/);
          if (simpleFkMatch) {
            foreignKey = {
              table: simpleFkMatch[1],
              column: simpleFkMatch[2],
            };
          }
        }
        
        columns.push({
          name: columnName,
          type: columnType,
          nullable: isNullable,
          primary: isPrimary,
          foreignKey,
        });
      }
    }
  }

  return columns;
}

// Helper function to extract table relationships from relations definitions
function extractTableRelationships(content: string, tableName: string): {
  hasMany: string[];
  belongsTo: string[];
  manyToMany: string[];
} {
  const relationships = {
    hasMany: [] as string[],
    belongsTo: [] as string[],
    manyToMany: [] as string[],
  };

  // Find relations definition for this table
  const relationPattern = new RegExp(
    `export\\s+const\\s+${tableName}Relations\\s*=\\s*relations\\s*\\(\\s*${tableName}\\s*,\\s*\\(\\{[^}]*\\}\\)\\s*=>\\s*\\(\\{([^}]+)\\}\\)\\)`,
    'gs'
  );
  
  const relationMatch = relationPattern.exec(content);
  if (relationMatch) {
    const relationsContent = relationMatch[1];
    
    // Extract one and many relationships
    const oneMatch = relationsContent.match(/(\w+):\s*one\s*\(\s*(\w+)/g);
    if (oneMatch) {
      oneMatch.forEach(match => {
        const relationName = match.match(/(\w+):/)?.[1];
        const targetTable = match.match(/one\s*\(\s*(\w+)/)?.[1];
        if (relationName && targetTable) {
          relationships.belongsTo.push(targetTable);
        }
      });
    }
    
    const manyMatch = relationsContent.match(/(\w+):\s*many\s*\(\s*(\w+)/g);
    if (manyMatch) {
      manyMatch.forEach(match => {
        const relationName = match.match(/(\w+):/)?.[1];
        const targetTable = match.match(/many\s*\(\s*(\w+)/)?.[1];
        if (relationName && targetTable) {
          relationships.hasMany.push(targetTable);
        }
      });
    }
  }

  return relationships;
}

// Helper function to extract business logic from table comments and schema
function extractTableBusinessLogic(content: string, tableName: string): string[] {
  const businessLogic: string[] = [];
  
  // Extract table comments
  const commentPattern = new RegExp(`/\\*\\*[^*]*\\*+(?:[^/*][^*]*\\*+)*/\\s*export\\s+const\\s+\\w+\\s*=\\s*pgTable\\s*\\(\\s*['"\`]${tableName}['"\`]`, 'g');
  const commentMatch = commentPattern.exec(content);
  if (commentMatch) {
    const comment = commentMatch[0];
    const lines = comment.split('\n');
    lines.forEach(line => {
      const trimmed = line.replace(/\/\*\*|\*\/|\*|\s/g, '').trim();
      if (trimmed && !trimmed.includes('export') && !trimmed.includes('pgTable')) {
        businessLogic.push(trimmed);
      }
    });
  }
  
  // Add domain-specific business rules based on table name
  if (tableName.includes('user')) {
    businessLogic.push('Quebec Law 25 compliance for user data protection');
    businessLogic.push('Role-based access control (RBAC) with hierarchical permissions');
  }
  if (tableName.includes('building') || tableName.includes('residence')) {
    businessLogic.push('Quebec civil code compliance for co-ownership properties');
    businessLogic.push('Municipal property tax integration');
  }
  if (tableName.includes('bill') || tableName.includes('budget')) {
    businessLogic.push('CAD currency handling with tax calculations');
    businessLogic.push('Quebec taxation rules and GST/PST compliance');
  }
  if (tableName.includes('document')) {
    businessLogic.push('Document retention policies per Quebec regulations');
    businessLogic.push('Access control based on user role and residence assignment');
  }
  
  return businessLogic;
}

// Helper function to extract schema relationships across all files
function extractSchemaRelationships(allSchemaContent: Record<string, string>): Array<{
  from: string;
  to: string;
  type: 'one-to-many' | 'many-to-one' | 'many-to-many';
  description: string;
  businessRule: string;
}> {
  const relationships: Array<{
    from: string;
    to: string;
    type: 'one-to-many' | 'many-to-one' | 'many-to-many';
    description: string;
    businessRule: string;
  }> = [];

  // Define key business relationships
  const businessRelationships = [
    {
      from: 'organizations',
      to: 'buildings',
      type: 'one-to-many' as const,
      description: 'Organization manages multiple buildings',
      businessRule: 'Each organization can manage multiple properties but each building belongs to one organization',
    },
    {
      from: 'buildings',
      to: 'residences',
      type: 'one-to-many' as const,
      description: 'Building contains multiple residential units',
      businessRule: 'Maximum 300 units per building as per Quebec regulations, automatically generated',
    },
    {
      from: 'users',
      to: 'user_residences',
      type: 'one-to-many' as const,
      description: 'User can be assigned to multiple residences',
      businessRule: 'Role-based assignments: tenants rent, residents own, managers oversee',
    },
    {
      from: 'residences',
      to: 'user_residences',
      type: 'one-to-many' as const,
      description: 'Residence can have multiple users (owners, tenants)',
      businessRule: 'Primary owner plus optional co-owners and tenants',
    },
    {
      from: 'buildings',
      to: 'bills',
      type: 'one-to-many' as const,
      description: 'Building generates monthly bills for residents',
      businessRule: 'Automated bill generation based on unit specifications and shared expenses',
    },
    {
      from: 'buildings',
      to: 'maintenance_requests',
      type: 'one-to-many' as const,
      description: 'Building receives maintenance requests from residents',
      businessRule: 'Priority-based assignment with emergency protocols',
    },
    {
      from: 'buildings',
      to: 'documents',
      type: 'one-to-many' as const,
      description: 'Building has associated documents and records',
      businessRule: 'Document access based on user role and residence assignment',
    },
  ];

  relationships.push(...businessRelationships);
  
  return relationships;
}

// Task 1: Enhanced Schema Relationship Mapping
async function extractEnhancedSchemaAnalysis(): Promise<EnhancedSchemaAnalysis> {
  const entityDescriptions: EntityDescription[] = [
    {
      tableName: 'organizations',
      businessDescription: 'Property management companies or condo associations that oversee multiple buildings',
      domain: 'core',
      keyPurpose: 'Top-level entity for multi-property management with Quebec compliance requirements',
    },
    {
      tableName: 'users',
      businessDescription: 'All system users including admins, managers, owners, tenants, and occupants with Law 25 consent tracking',
      domain: 'core',
      keyPurpose: 'Central user identity with role-based access control (RBAC) and Quebec privacy compliance',
    },
    {
      tableName: 'buildings',
      businessDescription: 'Physical properties (apartments, condos, rentals) managed by organizations',
      domain: 'property',
      keyPurpose: 'Property container with financial settings, bank accounts, and Quebec civil code compliance',
    },
    {
      tableName: 'residences',
      businessDescription: 'Individual housing units within buildings that can be occupied by tenants/owners',
      domain: 'property',
      keyPurpose: 'Billing unit with ownership percentage for condo fee calculations and user assignments',
    },
    {
      tableName: 'user_residences',
      businessDescription: 'Junction table linking users to residences with relationship types and date ranges',
      domain: 'property',
      keyPurpose: 'Tracks owner/tenant/occupant relationships for access control and billing',
    },
    {
      tableName: 'bills',
      businessDescription: 'Monthly charges for residences including condo fees, utilities, and special assessments',
      domain: 'financial',
      keyPurpose: 'Financial records with GST/PST Quebec tax compliance and payment tracking',
    },
    {
      tableName: 'budgets',
      businessDescription: 'Annual or multi-year financial planning with expense categories and projections',
      domain: 'financial',
      keyPurpose: 'Forecast tool for building financial health with inflation adjustments',
    },
    {
      tableName: 'maintenance_requests',
      businessDescription: 'Work orders for building repairs and maintenance with priority levels',
      domain: 'operations',
      keyPurpose: 'Service tracking with photo documentation and vendor assignment',
    },
    {
      tableName: 'documents',
      businessDescription: 'Files and records associated with buildings or residences',
      domain: 'documents',
      keyPurpose: 'Document storage with retention policies per Quebec regulations',
    },
    {
      tableName: 'invitations',
      businessDescription: 'User onboarding invites with expiration and tracking',
      domain: 'core',
      keyPurpose: 'Secure user registration flow with audit logging for Law 25',
    },
  ];

  const foreignKeyChains: ForeignKeyChain[] = [
    {
      from: 'user',
      chain: ['user_residences', 'residences', 'buildings', 'organizations'],
      description: 'User → Residence Assignment → Unit → Building → Property Management Organization',
    },
    {
      from: 'bill',
      chain: ['residences', 'buildings', 'organizations'],
      description: 'Bill → Residence (billing target) → Building (property) → Organization',
    },
    {
      from: 'maintenance_request',
      chain: ['buildings', 'organizations'],
      description: 'Maintenance Request → Building (location) → Organization (responsible party)',
    },
    {
      from: 'document',
      chain: ['buildings', 'organizations'],
      description: 'Document → Building (associated property) → Organization',
    },
    {
      from: 'invitation',
      chain: ['invitation_audit_logs'],
      description: 'Invitation → Audit Logs (Law 25 compliance tracking)',
    },
  ];

  const cascadeDeleteBehaviors: CascadeDeleteBehavior[] = [
    {
      table: 'buildings',
      column: 'organizationId',
      referencedTable: 'organizations',
      onDelete: 'cascade',
      businessImplication: 'Deleting an organization removes all its buildings, residences, and related data - requires admin confirmation',
    },
    {
      table: 'residences',
      column: 'buildingId',
      referencedTable: 'buildings',
      onDelete: 'cascade',
      businessImplication: 'Deleting a building removes all residences and user assignments - notifies affected residents',
    },
    {
      table: 'user_residences',
      column: 'userId',
      referencedTable: 'users',
      onDelete: 'cascade',
      businessImplication: 'Deleting a user removes all residence assignments - Law 25 data purge requirement',
    },
    {
      table: 'user_residences',
      column: 'residenceId',
      referencedTable: 'residences',
      onDelete: 'cascade',
      businessImplication: 'Deleting a residence removes all user links but preserves user accounts',
    },
    {
      table: 'bills',
      column: 'residenceId',
      referencedTable: 'residences',
      onDelete: 'cascade',
      businessImplication: 'Deleting a residence archives bills for tax compliance before removal',
    },
    {
      table: 'documents',
      column: 'buildingId',
      referencedTable: 'buildings',
      onDelete: 'cascade',
      businessImplication: 'Building deletion triggers document archival per Quebec retention requirements',
    },
  ];

  const entityRelationshipDiagram = `
ENTITY-RELATIONSHIP DIAGRAM (Mermaid-style description for LLM understanding):

organizations ||--o{ buildings : "manages"
buildings ||--o{ residences : "contains"  
buildings ||--o{ documents : "has"
buildings ||--o{ maintenance_requests : "receives"
buildings ||--o{ bills : "generates"
buildings ||--o{ budgets : "plans"
residences ||--o{ user_residences : "assigned_to"
users ||--o{ user_residences : "occupies"
users ||--o{ invitations : "created_by"
invitations ||--o{ invitation_audit_logs : "tracked_in"

HIERARCHY:
1. organizations (top-level, Quebec property management companies)
   ├── buildings (properties managed)
   │   ├── residences (units within buildings)
   │   │   └── user_residences (occupancy records)
   │   ├── documents (building records)
   │   ├── maintenance_requests (work orders)
   │   ├── bills (monthly charges)
   │   └── budgets (financial planning)
   └── contacts (organization contacts)

2. users (independent, linked via user_residences)
   ├── user_residences → residences → buildings
   ├── notifications (user alerts)
   └── invitations → invitation_audit_logs (onboarding trail)
`;

  return {
    entityRelationshipDiagram,
    entityDescriptions,
    foreignKeyChains,
    cascadeDeleteBehaviors,
  };
}

// Task 2: Hooks and Utilities Extraction
async function extractHooksAndUtilities(): Promise<HooksAndUtilities> {
  const hooks: HookInfo[] = [];
  const utilities: UtilityInfo[] = [];

  try {
    const hooksPath = path.join(process.cwd(), 'client', 'src', 'hooks');
    const hooksEntries = await fs.readdir(hooksPath, { withFileTypes: true }).catch(() => []);

    for (const entry of hooksEntries) {
      if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        try {
          const content = await fs.readFile(path.join(hooksPath, entry.name), 'utf-8');
          const hookInfo = extractHookFromFile(content, entry.name);
          if (hookInfo) {
            hooks.push(hookInfo);
          }
        } catch (error) {
          console.warn(`⚠️ Could not read hook file ${entry.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not scan hooks directory:', error);
  }

  try {
    const libPath = path.join(process.cwd(), 'client', 'src', 'lib');
    const libEntries = await fs.readdir(libPath, { withFileTypes: true }).catch(() => []);

    for (const entry of libEntries) {
      if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        try {
          const content = await fs.readFile(path.join(libPath, entry.name), 'utf-8');
          const utilityInfo = extractUtilityFromFile(content, entry.name);
          if (utilityInfo) {
            utilities.push(utilityInfo);
          }
        } catch (error) {
          console.warn(`⚠️ Could not read lib file ${entry.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not scan lib directory:', error);
  }

  return { hooks, utilities };
}

function extractHookFromFile(content: string, filename: string): HookInfo | null {
  const hookName = filename.replace(/\.(tsx?|jsx?)$/, '');
  
  const docCommentMatch = content.match(/\/\*\*[\s\S]*?\*\/\s*export\s+function/);
  let description = '';
  if (docCommentMatch) {
    description = docCommentMatch[0]
      .replace(/\/\*\*|\*\/|\*/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/export\s+function.*$/, '')
      .trim();
  }

  if (!description) {
    if (hookName.includes('auth')) description = 'Authentication state management hook';
    else if (hookName.includes('building')) description = 'Building data and operations hook';
    else if (hookName.includes('toast')) description = 'Toast notification management hook';
    else if (hookName.includes('mobile')) description = 'Mobile viewport detection hook';
    else if (hookName.includes('context')) description = 'Context-based state management hook';
    else description = 'Custom React hook';
  }

  const dependencies: string[] = [];
  const importMatches = content.match(/from\s+['"`]([^'"`]+)['"`]/g);
  if (importMatches) {
    for (const match of importMatches) {
      const libMatch = match.match(/from\s+['"`]([^'"`]+)['"`]/);
      if (libMatch && !libMatch[1].startsWith('.')) {
        dependencies.push(libMatch[1]);
      }
    }
  }

  const usagePatterns: string[] = [];
  if (content.includes('useQuery')) usagePatterns.push('Server state fetching with react-query');
  if (content.includes('useMutation')) usagePatterns.push('Server state mutations with react-query');
  if (content.includes('useState')) usagePatterns.push('Local state management');
  if (content.includes('useEffect')) usagePatterns.push('Side effect handling');
  if (content.includes('useContext')) usagePatterns.push('Context consumption');
  if (content.includes('useForm')) usagePatterns.push('Form state management with react-hook-form');

  return {
    name: hookName,
    description,
    parameters: [],
    dependencies: [...new Set(dependencies)].slice(0, 5),
    usagePatterns,
  };
}

function extractUtilityFromFile(content: string, filename: string): UtilityInfo | null {
  const utilityName = filename.replace(/\.(tsx?|jsx?)$/, '');
  
  let description = '';
  if (utilityName === 'queryClient') description = 'TanStack Query client setup and API request utilities';
  else if (utilityName === 'apiHelpers') description = 'CRUD operation helpers and query key management';
  else if (utilityName === 'utils') description = 'Common utility functions including className merging';
  else description = 'Utility module';

  const functions: Array<{ name: string; description: string; parameters: string[] }> = [];

  const exportFunctionMatches = content.match(/export\s+(const|function)\s+(\w+)/g);
  if (exportFunctionMatches) {
    for (const match of exportFunctionMatches) {
      const nameMatch = match.match(/export\s+(?:const|function)\s+(\w+)/);
      if (nameMatch) {
        const funcName = nameMatch[1];
        let funcDesc = '';
        
        if (funcName.includes('request') || funcName.includes('api')) funcDesc = 'HTTP request utility';
        else if (funcName.includes('create') || funcName.includes('Create')) funcDesc = 'Factory or creation utility';
        else if (funcName.includes('fetch')) funcDesc = 'Data fetching utility';
        else if (funcName.includes('query')) funcDesc = 'Query utility';
        else if (funcName.includes('mutation')) funcDesc = 'Mutation utility';
        else funcDesc = 'Utility function';
        
        functions.push({ name: funcName, description: funcDesc, parameters: [] });
      }
    }
  }

  if (functions.length === 0) return null;

  return {
    name: utilityName,
    description,
    functions: functions.slice(0, 10),
  };
}

// Task 3: Testing Documentation Extraction
async function extractTestingDocumentation(): Promise<TestingDocumentation> {
  const structure: TestingDocumentation['structure'] = {
    unit: [],
    integration: [],
    e2e: [],
    security: [],
    critical: [],
  };

  const testCategories = ['unit', 'integration', 'e2e', 'security', 'critical'] as const;

  for (const category of testCategories) {
    try {
      const testPath = path.join(process.cwd(), 'tests', category);
      const entries = await fs.readdir(testPath, { withFileTypes: true }).catch(() => []);

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.test.ts')) {
          try {
            const content = await fs.readFile(path.join(testPath, entry.name), 'utf-8');
            const suiteInfo = extractTestSuiteInfo(content, entry.name);
            if (suiteInfo) {
              structure[category].push(suiteInfo);
            }
          } catch (error) {
            console.warn(`⚠️ Could not read test file ${entry.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not scan ${category} tests directory:`, error);
    }
  }

  const totalTests = Object.values(structure).flat().reduce((acc, suite) => acc + suite.testCount, 0);

  return {
    structure,
    totalTests,
    coverage: {
      unit: structure.unit.length,
      integration: structure.integration.length,
      e2e: structure.e2e.length,
      security: structure.security.length,
      critical: structure.critical.length,
    },
  };
}

function extractTestSuiteInfo(content: string, filename: string): TestSuite | null {
  const describeMatch = content.match(/describe\s*\(\s*['"`]([^'"`]+)['"`]/);
  const suiteName = describeMatch ? describeMatch[1] : filename.replace('.test.ts', '');

  const docCommentMatch = content.match(/\/\*\*[\s\S]*?\*\//);
  let description = '';
  if (docCommentMatch) {
    description = docCommentMatch[0]
      .replace(/\/\*\*|\*\/|\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const itMatches = content.match(/\bit\s*\(/g) || [];
  const testMatches = content.match(/\btest\s*\(/g) || [];
  const testCount = itMatches.length + testMatches.length;

  if (testCount === 0) return null;

  return {
    name: suiteName,
    description: description || `Test suite for ${suiteName}`,
    file: filename,
    testCount,
  };
}

// Task 4: Code Pattern Examples
async function extractCodePatterns(): Promise<CodePatterns> {
  const apiPatterns: CodePattern[] = [
    {
      name: 'Authenticated Route Handler',
      category: 'api',
      description: 'Standard pattern for protected API routes with session-based authentication',
      example: `app.get('/api/resource', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const data = await storage.getResource(userId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});`,
      usage: ['Protected resource access', 'User-specific data retrieval', 'Role-based operations'],
    },
    {
      name: 'Request Validation with Zod',
      category: 'api',
      description: 'Input validation pattern using Zod schemas from shared types',
      example: `const validatedData = insertBuildingSchema.parse(req.body);
await storage.createBuilding(validatedData);`,
      usage: ['Create operations', 'Update operations', 'Form submissions'],
    },
    {
      name: 'Paginated List Response',
      category: 'api',
      description: 'Standard pagination pattern for list endpoints',
      example: `const { page = 1, limit = 20 } = req.query;
const offset = (page - 1) * limit;
const { data, total } = await storage.listWithPagination(offset, limit);
res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });`,
      usage: ['List endpoints', 'Search results', 'Dashboard data'],
    },
  ];

  const reactPatterns: CodePattern[] = [
    {
      name: 'Data Fetching with React Query',
      category: 'react',
      description: 'Server state management pattern using TanStack Query',
      example: `const { data, isLoading, error } = useQuery<ResponseType>({
  queryKey: ['/api/buildings', buildingId],
  enabled: !!buildingId,
});`,
      usage: ['Page data loading', 'Dashboard widgets', 'Dynamic content'],
    },
    {
      name: 'Form with React Hook Form + Zod',
      category: 'react',
      description: 'Form handling pattern with validation',
      example: `const form = useForm<FormData>({
  resolver: zodResolver(insertSchema),
  defaultValues: { name: '', email: '' },
});

const onSubmit = async (data: FormData) => {
  await createMutation.mutateAsync(data);
};`,
      usage: ['User registration', 'Data entry forms', 'Settings pages'],
    },
    {
      name: 'Mutation with Cache Invalidation',
      category: 'react',
      description: 'Data mutation pattern with automatic cache updates',
      example: `const mutation = useMutation({
  mutationFn: async (data: CreateData) => {
    const response = await apiRequest('POST', '/api/resource', data);
    return response;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/resource'] });
    toast({ title: 'Success', description: 'Created successfully' });
  },
});`,
      usage: ['Create operations', 'Update operations', 'Delete operations'],
    },
  ];

  const databasePatterns: CodePattern[] = [
    {
      name: 'Basic Select with Drizzle',
      category: 'database',
      description: 'Simple query pattern for fetching data',
      example: `const buildings = await db
  .select()
  .from(buildingsTable)
  .where(eq(buildingsTable.organizationId, orgId))
  .orderBy(desc(buildingsTable.createdAt));`,
      usage: ['List queries', 'Single record fetch', 'Filtered results'],
    },
    {
      name: 'Join Query Pattern',
      category: 'database',
      description: 'Pattern for joining related tables',
      example: `const residencesWithBuildings = await db
  .select({
    residence: residences,
    building: buildings,
  })
  .from(residences)
  .innerJoin(buildings, eq(residences.buildingId, buildings.id))
  .where(eq(buildings.organizationId, orgId));`,
      usage: ['Related data fetching', 'Report generation', 'Dashboard aggregations'],
    },
    {
      name: 'Transaction Pattern',
      category: 'database',
      description: 'Atomic operation pattern for multiple writes',
      example: `await db.transaction(async (tx) => {
  const building = await tx.insert(buildings).values(buildingData).returning();
  await tx.insert(residences).values(
    residencesData.map(r => ({ ...r, buildingId: building[0].id }))
  );
});`,
      usage: ['Complex create operations', 'Cascade updates', 'Data migration'],
    },
  ];

  return { apiPatterns, reactPatterns, databasePatterns };
}

// Task 5: Enhanced Business Flows
function extractEnhancedBusinessFlows(): EnhancedBusinessFlow[] {
  return [
    {
      name: 'User Registration and Assignment',
      description: 'Complete user onboarding flow from invitation to residence assignment with Law 25 compliance',
      tables: ['invitations', 'invitation_audit_logs', 'users', 'user_residences', 'buildings', 'residences'],
      steps: [
        { stepNumber: 1, action: 'Admin/Manager creates invitation', role: 'admin|manager', dataTransformation: 'Generate unique token, set expiration' },
        { stepNumber: 2, action: 'System logs invitation creation', role: 'system', dataTransformation: 'Create audit log entry for Law 25' },
        { stepNumber: 3, action: 'User receives invitation email', role: 'system', dataTransformation: 'SendGrid email with registration link' },
        { stepNumber: 4, action: 'User registers with consent', role: 'user', dataTransformation: 'Hash password, store Law 25 consent timestamp' },
        { stepNumber: 5, action: 'User assigned to residence', role: 'admin|manager', dataTransformation: 'Create user_residence record with relationship type' },
        { stepNumber: 6, action: 'Access permissions calculated', role: 'system', dataTransformation: 'Derive building access from residence assignment' },
      ],
      errorHandling: [
        { scenario: 'Expired invitation token', handling: 'Display error, offer to request new invitation' },
        { scenario: 'Email already registered', handling: 'Redirect to login with message' },
        { scenario: 'Invalid residence assignment', handling: 'Validate building exists and user has permission' },
      ],
      flow: 'invitation_audit_logs → invitations → users → user_residences → residences → buildings',
    },
    {
      name: 'Property Management Lifecycle',
      description: 'End-to-end property management from setup to resident assignment with Quebec compliance',
      tables: ['organizations', 'buildings', 'residences', 'users', 'user_residences', 'contacts'],
      steps: [
        { stepNumber: 1, action: 'Organization setup', role: 'admin', dataTransformation: 'Create organization with Quebec business registration' },
        { stepNumber: 2, action: 'Building creation', role: 'admin', dataTransformation: 'Create building with address validation, max 300 units' },
        { stepNumber: 3, action: 'Residence generation', role: 'system', dataTransformation: 'Auto-generate unit numbers based on totalUnits' },
        { stepNumber: 4, action: 'Contact assignment', role: 'manager', dataTransformation: 'Link emergency/maintenance contacts to building' },
        { stepNumber: 5, action: 'Resident onboarding', role: 'manager', dataTransformation: 'Invite and assign users to residences' },
        { stepNumber: 6, action: 'Financial setup', role: 'manager', dataTransformation: 'Configure bank account, monthly fees, budgets' },
      ],
      errorHandling: [
        { scenario: 'Invalid postal code format', handling: 'Quebec postal code validation with error message' },
        { scenario: 'Duplicate building address', handling: 'Warn user, allow override with confirmation' },
        { scenario: 'Unit limit exceeded', handling: 'Block creation, display max 300 units message' },
      ],
      flow: 'organizations → buildings → residences (auto-generated) → user_residences ← users',
    },
    {
      name: 'Financial Management Flow',
      description: 'Monthly billing cycle and budget management with Quebec tax compliance',
      tables: ['buildings', 'residences', 'bills', 'budgets', 'monthly_budgets', 'bill_items'],
      steps: [
        { stepNumber: 1, action: 'Budget planning', role: 'manager', dataTransformation: 'Create annual budget with categories and projections' },
        { stepNumber: 2, action: 'Monthly budget allocation', role: 'system', dataTransformation: 'Distribute annual budget across months with inflation' },
        { stepNumber: 3, action: 'Bill generation', role: 'system', dataTransformation: 'Calculate residence charges from ownership percentage + fees' },
        { stepNumber: 4, action: 'Tax calculation', role: 'system', dataTransformation: 'Apply GST (5%) and PST (9.975%) per Quebec rules' },
        { stepNumber: 5, action: 'Bill delivery', role: 'system', dataTransformation: 'Email notification with PDF attachment' },
        { stepNumber: 6, action: 'Payment processing', role: 'resident', dataTransformation: 'Record payment, update bill status' },
      ],
      errorHandling: [
        { scenario: 'Missing ownership percentage', handling: 'Default to equal split among units' },
        { scenario: 'Payment processing failure', handling: 'Retry with notification to admin' },
        { scenario: 'Budget variance exceeded', handling: 'Alert manager with variance report' },
      ],
      flow: 'buildings → residences → bills (generated monthly) ↔ budgets ← monthly_budgets',
    },
    {
      name: 'Maintenance Request Process',
      description: 'From request submission to completion with notifications and documentation',
      tables: ['users', 'buildings', 'maintenance_requests', 'notifications', 'documents'],
      steps: [
        { stepNumber: 1, action: 'Request submission', role: 'resident', dataTransformation: 'Create request with priority, description, photos' },
        { stepNumber: 2, action: 'Manager notification', role: 'system', dataTransformation: 'Send notification to building manager' },
        { stepNumber: 3, action: 'Vendor assignment', role: 'manager', dataTransformation: 'Link to vendor, set estimated completion' },
        { stepNumber: 4, action: 'Progress tracking', role: 'vendor|manager', dataTransformation: 'Update status, add progress notes' },
        { stepNumber: 5, action: 'Completion documentation', role: 'vendor', dataTransformation: 'Upload completion photos, final notes' },
        { stepNumber: 6, action: 'Resident notification', role: 'system', dataTransformation: 'Notify resident of completion, request feedback' },
      ],
      errorHandling: [
        { scenario: 'Emergency priority request', handling: 'Immediate notification, bypass normal queue' },
        { scenario: 'Vendor unavailable', handling: 'Escalate to manager for reassignment' },
        { scenario: 'Request exceeds budget', handling: 'Require manager approval before proceeding' },
      ],
      flow: 'users → maintenance_requests → buildings (assignment) → notifications (updates)',
    },
    {
      name: 'Document Management Flow',
      description: 'Document upload, categorization, and access control with Quebec retention compliance',
      tables: ['users', 'buildings', 'residences', 'documents', 'user_residences'],
      steps: [
        { stepNumber: 1, action: 'Document upload', role: 'manager|admin', dataTransformation: 'Store file, generate metadata, virus scan' },
        { stepNumber: 2, action: 'Categorization', role: 'manager', dataTransformation: 'Assign category, tags, retention period' },
        { stepNumber: 3, action: 'Access control setup', role: 'system', dataTransformation: 'Inherit building permissions, allow overrides' },
        { stepNumber: 4, action: 'Notification', role: 'system', dataTransformation: 'Notify relevant users of new document' },
        { stepNumber: 5, action: 'Access logging', role: 'system', dataTransformation: 'Log all document access for audit trail' },
        { stepNumber: 6, action: 'Retention enforcement', role: 'system', dataTransformation: 'Archive or delete per Quebec retention rules' },
      ],
      errorHandling: [
        { scenario: 'File too large', handling: 'Display size limit, suggest compression' },
        { scenario: 'Unauthorized access attempt', handling: 'Log attempt, notify admin' },
        { scenario: 'Retention period expiring', handling: 'Notify manager, request archival decision' },
      ],
      flow: 'users → documents → buildings/residences (association) ← user_residences (access control)',
    },
  ];
}

// Legacy extractBusinessFlows for backward compatibility
function extractBusinessFlows(_allSchemaContent: Record<string, string>): Array<{
  name: string;
  description: string;
  tables: string[];
  flow: string;
}> {
  const enhancedFlows = extractEnhancedBusinessFlows();
  return enhancedFlows.map(flow => ({
    name: flow.name,
    description: flow.description,
    tables: flow.tables,
    flow: flow.flow,
  }));
}

// Task 6: Generate comprehensive LLM documentation with XML markers
async function generateLLMDocumentation(): Promise<string> {
  const data = await generateDocumentationData();
  const lastUpdated = new Date().toISOString();
  
  const [enhancedSchema, hooksAndUtils, testingDocs, codePatterns] = await Promise.all([
    extractEnhancedSchemaAnalysis(),
    extractHooksAndUtilities(),
    extractTestingDocumentation(),
    extractCodePatterns(),
  ]);
  const enhancedBusinessFlows = extractEnhancedBusinessFlows();

  const sections = [
    'METADATA', 'TABLE_OF_CONTENTS', 'PROJECT_OVERVIEW', 'ENTITY_RELATIONSHIP_DIAGRAM',
    'DATABASE_SCHEMA', 'FOREIGN_KEY_CHAINS', 'CASCADE_DELETE_BEHAVIORS',
    'HOOKS', 'UTILITIES', 'TESTING', 'CODE_PATTERNS', 'BUSINESS_WORKFLOWS',
    'API_ENDPOINTS', 'COMPONENTS', 'QUEBEC_COMPLIANCE', 'TECHNICAL_DETAILS',
  ];

  const contentLength = data.database.tables.length * 500 + data.apis.length * 100 + 
    enhancedBusinessFlows.length * 500 + codePatterns.apiPatterns.length * 300;
  const tokenEstimate = Math.round(contentLength / 4);

  const metadata: DocumentationMetadata = {
    generatedAt: lastUpdated,
    version: data.projectOverview.version,
    tokenEstimate,
    sections,
  };

  return `<LLM_DOCUMENTATION>

<METADATA>
Generated: ${metadata.generatedAt}
Version: ${metadata.version}
Estimated Tokens: ~${metadata.tokenEstimate.toLocaleString()}
Sections: ${metadata.sections.length}
Format: XML-tagged for LLM parsing (compatible with Claude and ChatGPT)
</METADATA>

<TABLE_OF_CONTENTS>
1. PROJECT_OVERVIEW - System purpose and architecture
2. ENTITY_RELATIONSHIP_DIAGRAM - Visual database relationships
3. DATABASE_SCHEMA - Table definitions with business logic
4. FOREIGN_KEY_CHAINS - Data traversal paths
5. CASCADE_DELETE_BEHAVIORS - Deletion implications
6. HOOKS - React hooks documentation
7. UTILITIES - Shared utility functions
8. TESTING - Test structure and coverage
9. CODE_PATTERNS - Common implementation patterns
10. BUSINESS_WORKFLOWS - User journey documentation
11. API_ENDPOINTS - Available endpoints
12. COMPONENTS - UI component architecture
13. QUEBEC_COMPLIANCE - Regulatory requirements
14. TECHNICAL_DETAILS - Implementation specifics
</TABLE_OF_CONTENTS>

<PROJECT_OVERVIEW>
Name: ${data.projectOverview.name}
Description: ${data.projectOverview.description}
Version: ${data.projectOverview.version}
Architecture: ${data.projectOverview.architecture}
Last Updated: ${lastUpdated}
Primary Language: TypeScript
Frontend: React 18 + TanStack Query + Tailwind CSS
Backend: Node.js + Express + Drizzle ORM
Database: PostgreSQL (Neon)
Region: Quebec, Canada (Law 25 Compliant)
</PROJECT_OVERVIEW>

<ENTITY_RELATIONSHIP_DIAGRAM>
${enhancedSchema.entityRelationshipDiagram}
</ENTITY_RELATIONSHIP_DIAGRAM>

<ENTITY_DESCRIPTIONS>
${enhancedSchema.entityDescriptions.map(e => `
<entity name="${e.tableName}" domain="${e.domain}">
  <business_description>${e.businessDescription}</business_description>
  <key_purpose>${e.keyPurpose}</key_purpose>
</entity>`).join('')}
</ENTITY_DESCRIPTIONS>

<DATABASE_SCHEMA>
Total Tables: ${data.database.tables.length}
Domain Distribution: ${JSON.stringify(data.database.tables.reduce((acc, table) => {
  acc[table.domain] = (acc[table.domain] || 0) + 1;
  return acc;
}, {} as Record<string, number>))}

${data.database.tables.map(table => `
<table name="${table.name}" domain="${table.domain}">
  <columns>
${table.columns.map(col => `    <column name="${col.name}" type="${col.type}" nullable="${col.nullable}" primary="${col.primary}"${col.foreignKey ? ` fk_table="${col.foreignKey.table}" fk_column="${col.foreignKey.column}" on_delete="${col.foreignKey.onDelete || 'no action'}"` : ''}/>`).join('\n')}
  </columns>
  <relationships>
    <has_many>${table.relationships.hasMany.join(', ') || 'none'}</has_many>
    <belongs_to>${table.relationships.belongsTo.join(', ') || 'none'}</belongs_to>
  </relationships>
  <business_logic>
${table.businessLogic.map(rule => `    - ${rule}`).join('\n')}
  </business_logic>
</table>`).join('\n')}
</DATABASE_SCHEMA>

<FOREIGN_KEY_CHAINS>
${enhancedSchema.foreignKeyChains.map(chain => `
<chain from="${chain.from}">
  <path>${chain.chain.join(' → ')}</path>
  <description>${chain.description}</description>
</chain>`).join('')}
</FOREIGN_KEY_CHAINS>

<CASCADE_DELETE_BEHAVIORS>
${enhancedSchema.cascadeDeleteBehaviors.map(cascade => `
<cascade table="${cascade.table}" column="${cascade.column}">
  <references>${cascade.referencedTable}</references>
  <on_delete>${cascade.onDelete}</on_delete>
  <business_implication>${cascade.businessImplication}</business_implication>
</cascade>`).join('')}
</CASCADE_DELETE_BEHAVIORS>

<HOOKS>
Total Hooks: ${hooksAndUtils.hooks.length}
${hooksAndUtils.hooks.map(hook => `
<hook name="${hook.name}">
  <description>${hook.description}</description>
  <dependencies>${hook.dependencies.join(', ') || 'none'}</dependencies>
  <usage_patterns>
${hook.usagePatterns.map(p => `    - ${p}`).join('\n')}
  </usage_patterns>
</hook>`).join('')}
</HOOKS>

<UTILITIES>
Total Utilities: ${hooksAndUtils.utilities.length}
${hooksAndUtils.utilities.map(util => `
<utility name="${util.name}">
  <description>${util.description}</description>
  <functions>
${util.functions.map(f => `    <function name="${f.name}">${f.description}</function>`).join('\n')}
  </functions>
</utility>`).join('')}
</UTILITIES>

<TESTING>
Total Test Suites: ${Object.values(testingDocs.structure).flat().length}
Total Test Cases: ~${testingDocs.totalTests}
Coverage by Type:
  - Unit Tests: ${testingDocs.coverage.unit} suites
  - Integration Tests: ${testingDocs.coverage.integration} suites
  - E2E Tests: ${testingDocs.coverage.e2e} suites
  - Security Tests: ${testingDocs.coverage.security} suites
  - Critical Tests: ${testingDocs.coverage.critical} suites

${Object.entries(testingDocs.structure).map(([type, suites]) => `
<test_category type="${type}">
${suites.map(suite => `  <suite name="${suite.name}" file="${suite.file}" tests="${suite.testCount}">
    ${suite.description}
  </suite>`).join('\n')}
</test_category>`).join('')}
</TESTING>

<CODE_PATTERNS>

<api_patterns>
${codePatterns.apiPatterns.map(pattern => `
<pattern name="${pattern.name}">
  <description>${pattern.description}</description>
  <example>
${pattern.example}
  </example>
  <usage>
${pattern.usage.map(u => `    - ${u}`).join('\n')}
  </usage>
</pattern>`).join('')}
</api_patterns>

<react_patterns>
${codePatterns.reactPatterns.map(pattern => `
<pattern name="${pattern.name}">
  <description>${pattern.description}</description>
  <example>
${pattern.example}
  </example>
  <usage>
${pattern.usage.map(u => `    - ${u}`).join('\n')}
  </usage>
</pattern>`).join('')}
</react_patterns>

<database_patterns>
${codePatterns.databasePatterns.map(pattern => `
<pattern name="${pattern.name}">
  <description>${pattern.description}</description>
  <example>
${pattern.example}
  </example>
  <usage>
${pattern.usage.map(u => `    - ${u}`).join('\n')}
  </usage>
</pattern>`).join('')}
</database_patterns>

</CODE_PATTERNS>

<BUSINESS_WORKFLOWS>
${enhancedBusinessFlows.map(flow => `
<workflow name="${flow.name}">
  <description>${flow.description}</description>
  <tables>${flow.tables.join(', ')}</tables>
  <steps>
${flow.steps.map(step => `    <step number="${step.stepNumber}">
      <action>${step.action}</action>
      <role>${step.role}</role>
      <data_transformation>${step.dataTransformation}</data_transformation>
    </step>`).join('\n')}
  </steps>
  <error_handling>
${flow.errorHandling.map(err => `    <error scenario="${err.scenario}">
      <handling>${err.handling}</handling>
    </error>`).join('\n')}
  </error_handling>
  <flow_diagram>${flow.flow}</flow_diagram>
</workflow>`).join('')}
</BUSINESS_WORKFLOWS>

<API_ENDPOINTS>
Total Endpoints: ${data.apis.length}
${data.apis.map(api => `
<endpoint method="${api.method}" path="${api.endpoint}">
  <description>${api.description}</description>
  <parameters>${api.parameters.length > 0 ? api.parameters.join(', ') : 'none'}</parameters>
  <response_type>${api.response}</response_type>
</endpoint>`).join('')}
</API_ENDPOINTS>

<COMPONENTS>
Total Components: ${data.components.length}
${data.components.slice(0, 30).map(comp => `
<component name="${comp.name}" type="${comp.type}">
  <dependencies>${comp.dependencies.slice(0, 3).join(', ') || 'none'}</dependencies>
  <exports>${comp.exports.join(', ')}</exports>
  <complexity>${comp.complexity}</complexity>
</component>`).join('')}
</COMPONENTS>

<QUEBEC_COMPLIANCE>
<law_25>
  <description>Quebec Law 25 (Personal Information Protection)</description>
  <implementation>
    - User consent tracking in invitation_audit_logs
    - Data retention policies per Quebec regulations
    - Access control based on user role and residence assignment
    - Right to be forgotten implementation
    - Audit trail for all data access and modifications
  </implementation>
</law_25>

<civil_code>
  <description>Quebec Civil Code for Co-ownership</description>
  <implementation>
    - Maximum 300 units per building
    - Ownership percentage tracking for condo fees
    - Role-based assignments (tenants rent, residents own, managers oversee)
    - Municipal property tax integration
  </implementation>
</civil_code>

<financial>
  <description>Quebec Financial Regulations</description>
  <implementation>
    - CAD currency with GST (5%) and PST (9.975%)
    - Automated bill generation based on unit specifications
    - Tax-compliant financial reporting
    - Bilingual support (French/English)
  </implementation>
</financial>
</QUEBEC_COMPLIANCE>

<TECHNICAL_DETAILS>
<authentication>
  - Session-based with PostgreSQL store
  - Role-Based Access Control (RBAC) with hierarchical permissions
  - Multi-step registration with privacy consent
</authentication>

<database_design>
  - UUID primary keys for security
  - Soft deletes with audit trails
  - Optimistic locking for concurrent updates
  - Cascade deletes with referential integrity
</database_design>

<api_design>
  - RESTful endpoints with consistent naming
  - Typed request/response validation with Zod
  - Error handling with structured responses
  - Rate limiting and security headers
</api_design>

<frontend>
  - React 18 with TypeScript and strict mode
  - Component composition with Radix UI primitives
  - TanStack Query for server state management
  - Form validation with React Hook Form + Zod
</frontend>
</TECHNICAL_DETAILS>

</LLM_DOCUMENTATION>

<!-- 
Documentation Version: 4.0 (Enhanced with XML markers)
Generated: ${lastUpdated}
System: Koveo Gestion - Quebec Property Management SaaS
Compliance: Law 25 Fully Compliant
Security: Enterprise-grade with RBAC
-->`;
}

// Helper function to generate documentation data
async function generateDocumentationData(): Promise<DocumentationData> {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

  const docsPath = path.join(process.cwd(), 'docs');
  const documentationFiles = await scanDocumentationFiles(docsPath);
  const apiEndpoints = await extractApiEndpoints();
  const databaseSchema = await extractDatabaseSchema();
  const components = await extractComponentInfo();
  const dependencies = extractDependencies(packageJson);

  // Extract enhanced documentation data
  const [enhancedSchema, hooksAndUtilities, testing, codePatterns] = await Promise.all([
    extractEnhancedSchemaAnalysis(),
    extractHooksAndUtilities(),
    extractTestingDocumentation(),
    extractCodePatterns(),
  ]);
  const businessFlows = extractEnhancedBusinessFlows();

  return {
    projectOverview: {
      name: packageJson.name || 'Koveo Gestion',
      description: packageJson.description || 'AI-powered property management SaaS platform',
      version: packageJson.version || '1.0.0',
      architecture: 'React/TypeScript frontend with Node.js/Express backend, PostgreSQL database',
      lastUpdated: new Date().toISOString(),
    },
    components,
    apis: apiEndpoints,
    database: databaseSchema,
    dependencies,
    documentationFiles,
    enhancedSchema,
    hooksAndUtilities,
    testing,
    codePatterns,
    businessFlows,
  };
}

// Legacy business flows return for backward compatibility  
function getLegacyBusinessFlows(): Array<{
  name: string;
  description: string;
  tables: string[];
  flow: string;
}> {
  return [
    {
      name: 'User Registration and Assignment',
      description: 'Complete user onboarding flow from invitation to residence assignment',
      tables: ['invitations', 'users', 'user_residences', 'buildings', 'residences'],
      flow: 'invitation_audit_logs → invitations → users → user_residences → residences → buildings',
    },
    {
      name: 'Property Management Lifecycle',
      description: 'End-to-end property management from setup to resident assignment',
      tables: ['organizations', 'buildings', 'residences', 'users', 'user_residences'],
      flow: 'organizations → buildings → residences (auto-generated) → user_residences ← users',
    },
    {
      name: 'Financial Management Flow',
      description: 'Monthly billing cycle and budget management',
      tables: ['buildings', 'residences', 'bills', 'budgets', 'monthly_budgets'],
      flow: 'buildings → residences → bills (generated monthly) ↔ budgets ← monthly_budgets',
    },
    {
      name: 'Maintenance Request Process',
      description: 'From request submission to completion with notifications',
      tables: ['users', 'buildings', 'maintenance_requests', 'notifications'],
      flow: 'users → maintenance_requests → buildings (assignment) → notifications (updates)',
    },
    {
      name: 'Document Management Flow',
      description: 'Document upload, categorization, and access control',
      tables: ['users', 'buildings', 'residences', 'documents', 'user_residences'],
      flow: 'users → documents → buildings/residences (association) ← user_residences (access control)',
    },
    {
      name: 'Quebec Compliance Workflow',
      description: 'Law 25 data protection and regulatory compliance tracking',
      tables: ['users', 'invitation_audit_logs', 'documents', 'bills'],
      flow: 'users (consent tracking) → invitation_audit_logs (audit trail) → documents (retention) → bills (tax compliance)',
    },
  ];
}

// Export new functions for external use
export {
  extractEnhancedSchemaAnalysis,
  extractHooksAndUtilities,
  extractTestingDocumentation,
  extractCodePatterns,
  extractEnhancedBusinessFlows,
}

// Legacy helper function to extract tables from schema file content
function extractTablesFromSchema(content: string): Array<{
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    primary: boolean;
  }>;
}> {
  const tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      primary: boolean;
    }>;
  }> = [];

  // Extract table definitions using regex
  const tablePattern = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{([^}]+)\}/g;
  
  let match;
  while ((match = tablePattern.exec(content)) !== null) {
    const tableName = match[2]; // The string name, not the variable name
    const columnsContent = match[3];
    
    const columns = extractColumnsFromTableDefinition(columnsContent);
    
    tables.push({
      name: tableName,
      columns,
    });
  }

  return tables;
}

// Helper function to extract columns from table definition
function extractColumnsFromTableDefinition(columnsContent: string): Array<{
  name: string;
  type: string;
  nullable: boolean;
  primary: boolean;
}> {
  const columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    primary: boolean;
  }> = [];

  // Split by lines and process each column definition
  const lines = columnsContent.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('//')) {
      const columnMatch = trimmedLine.match(/(\w+):\s*(\w+)\s*\(/);
      if (columnMatch) {
        const columnName = columnMatch[1];
        const columnType = columnMatch[2];
        
        const isNullable = !trimmedLine.includes('.notNull()');
        const isPrimary = trimmedLine.includes('.primaryKey()');
        
        columns.push({
          name: columnName,
          type: columnType,
          nullable: isNullable,
          primary: isPrimary,
        });
      }
    }
  }

  return columns;
}

// Helper function to extract component information
async function extractComponentInfo() {
  const components: Array<{
    name: string;
    type: string;
    dependencies: string[];
    exports: string[];
    complexity: number;
  }> = [];

  try {
    const clientPath = path.join(process.cwd(), 'client', 'src');
    
    // Scan components directory
    const componentsPath = path.join(clientPath, 'components');
    await scanComponentsDirectory(componentsPath, components, 'Component');
    
    // Scan pages directory
    const pagesPath = path.join(clientPath, 'pages');
    await scanComponentsDirectory(pagesPath, components, 'Page');
    
  } catch (error) {
    console.warn('⚠️ Could not extract component information:', error);
  }

  return components;
}

// Helper function to scan components directory
async function scanComponentsDirectory(dirPath: string, components: Array<{
  name: string;
  type: string;
  dependencies: string[];
  exports: string[];
  complexity: number;
}>, type: string) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await scanComponentsDirectory(fullPath, components, type);
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) && !entry.name.endsWith('.test.ts')) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const componentInfo = extractComponentFromFile(content, entry.name, type);
          if (componentInfo) {
            components.push(componentInfo);
          }
        } catch (error) {
          console.warn(`⚠️ Could not read component file ${entry.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️ Could not scan components directory ${dirPath}:`, error);
  }
}

// Helper function to extract component info from file
function extractComponentFromFile(content: string, filename: string, type: string): {
  name: string;
  type: string;
  dependencies: string[];
  exports: string[];
  complexity: number;
} | null {
  // Extract imports
  const imports = [];
  const importMatches = content.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g);
  if (importMatches) {
    for (const importMatch of importMatches) {
      const libMatch = importMatch.match(/from\s+['"`]([^'"`]+)['"`]/);
      if (libMatch) {
        imports.push(libMatch[1]);
      }
    }
  }

  // Extract exports
  const exports = [];
  const exportMatches = content.match(/export\s+(default\s+)?(function|const|class)\s+(\w+)/g);
  if (exportMatches) {
    for (const exportMatch of exportMatches) {
      const nameMatch = exportMatch.match(/export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)/);
      if (nameMatch) {
        exports.push(nameMatch[1]);
      }
    }
  }

  // Calculate basic complexity (lines of code, number of functions, etc.)
  const lines = content.split('\n').length;
  const functionCount = (content.match(/function\s+\w+|const\s+\w+\s*=.*?=>/g) || []).length;
  const complexity = Math.round((lines / 10) + functionCount);

  const componentName = filename.replace(/\.(tsx?|jsx?)$/, '');
  
  if (exports.length > 0 || imports.length > 0) {
    return {
      name: componentName,
      type,
      dependencies: imports,
      exports,
      complexity,
    };
  }

  return null;
}

// Helper function to extract dependencies from package.json
function extractDependencies(packageJson: any): Array<{
  name: string;
  version: string;
  type: 'production' | 'development';
  description: string;
}> {
  const dependencies: Array<{
    name: string;
    version: string;
    type: 'production' | 'development';
    description: string;
  }> = [];

  // Production dependencies
  if (packageJson.dependencies) {
    for (const [name, version] of Object.entries(packageJson.dependencies)) {
      dependencies.push({
        name,
        version: version as string,
        type: 'production',
        description: getPackageDescription(name),
      });
    }
  }

  // Development dependencies
  if (packageJson.devDependencies) {
    for (const [name, version] of Object.entries(packageJson.devDependencies)) {
      dependencies.push({
        name,
        version: version as string,
        type: 'development',
        description: getPackageDescription(name),
      });
    }
  }

  return dependencies;
}

// Helper function to get package description
function getPackageDescription(packageName: string): string {
  const descriptions: Record<string, string> = {
    'react': 'Frontend UI library',
    'typescript': 'Type-safe JavaScript',
    'express': 'Web application framework',
    'drizzle-orm': 'TypeScript ORM',
    'vite': 'Frontend build tool',
    '@tanstack/react-query': 'Server state management',
    'tailwindcss': 'CSS framework',
    'wouter': 'React router',
    'zod': 'Runtime type validation',
    'bcryptjs': 'Password hashing',
    'multer': 'File upload middleware',
    'cors': 'Cross-origin resource sharing',
    'helmet': 'Security headers',
    'jest': 'Testing framework',
    'eslint': 'Code linting',
    'prettier': 'Code formatting',
    // Add more as needed
  };

  return descriptions[packageName] || 'Library dependency';
}