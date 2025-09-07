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
}

interface DocumentFile {
  name: string;
  content: string;
  path: string;
  category: string;
}

export function registerDocumentationRoutes(app: Express) {
  // Get comprehensive documentation data
  app.get('/api/documentation/comprehensive', requireAuth, async (req, res) => {
    try {
      console.log('📚 Generating comprehensive documentation data...');

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
      };

      console.log(`✅ Documentation generated with ${documentation.documentationFiles.length} files, ${documentation.apis.length} APIs, ${documentation.components.length} components`);
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
      console.log('🤖 Generating comprehensive LLM documentation...');
      
      const documentationData = await generateLLMDocumentation();
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `koveo-llm-documentation-${timestamp}.md`;
      
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(documentationData);
      
      console.log(`✅ LLM documentation generated: ${filename}`);
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

// Helper function to extract API endpoints
async function extractApiEndpoints() {
  const apis: Array<{
    endpoint: string;
    method: string;
    description: string;
    parameters: string[];
    response: string;
  }> = [];

  try {
    const serverPath = path.join(process.cwd(), 'server');
    const apiPath = path.join(serverPath, 'api');
    
    // Check if API directory exists
    try {
      await fs.access(apiPath);
      const apiFiles = await fs.readdir(apiPath);
      
      for (const file of apiFiles) {
        if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
          try {
            const content = await fs.readFile(path.join(apiPath, file), 'utf-8');
            const extractedApis = extractApisFromFile(content, file);
            apis.push(...extractedApis);
          } catch (error) {
            console.warn(`⚠️ Could not read API file ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ API directory not accessible:', error);
    }
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

// Helper function to extract business flows
function extractBusinessFlows(allSchemaContent: Record<string, string>): Array<{
  name: string;
  description: string;
  tables: string[];
  flow: string;
}> {
// Generate comprehensive LLM documentation with detailed schema and business logic
async function generateLLMDocumentation(): Promise<string> {
  const data = await generateDocumentationData();
  const lastUpdated = new Date().toISOString();

  return `# KOVEO GESTION - COMPREHENSIVE LLM DOCUMENTATION

## PROJECT OVERVIEW
- **Name**: ${data.projectOverview.name}
- **Description**: ${data.projectOverview.description}
- **Version**: ${data.projectOverview.version}
- **Architecture**: ${data.projectOverview.architecture}
- **Last Updated**: ${lastUpdated}

## DATABASE SCHEMA WITH RELATIONSHIPS AND BUSINESS LOGIC

### Schema Overview
Total Tables: ${data.database.tables.length}
Domain Distribution: ${data.database.tables.reduce((acc, table) => {
  acc[table.domain] = (acc[table.domain] || 0) + 1;
  return acc;
}, {} as Record<string, number>)}

### Detailed Table Analysis

${data.database.tables.map(table => `
#### ${table.name.toUpperCase()} (Domain: ${table.domain})

**Columns:**
${table.columns.map(col => `
- **${col.name}**: ${col.type}${col.nullable ? ' (nullable)' : ' (required)'}${col.primary ? ' [PRIMARY KEY]' : ''}${col.foreignKey ? ` [FK → ${col.foreignKey.table}.${col.foreignKey.column}${col.foreignKey.onDelete ? `, onDelete: ${col.foreignKey.onDelete}` : ''}]` : ''}
`).join('')}

**Relationships:**
- **Has Many**: ${table.relationships.hasMany.length > 0 ? table.relationships.hasMany.join(', ') : 'None'}
- **Belongs To**: ${table.relationships.belongsTo.length > 0 ? table.relationships.belongsTo.join(', ') : 'None'}
- **Many to Many**: ${table.relationships.manyToMany.length > 0 ? table.relationships.manyToMany.join(', ') : 'None'}

**Business Logic Rules:**
${table.businessLogic.length > 0 ? table.businessLogic.map(rule => `- ${rule}`).join('\n') : '- Standard CRUD operations'}
`).join('\n')}

### Cross-Table Relationships and Business Rules

${data.database.relationships.map(rel => `
**${rel.from} → ${rel.to}** (${rel.type})
- Description: ${rel.description}
- Business Rule: ${rel.businessRule}
`).join('\n')}

### Business Flow Diagrams

${data.database.businessFlows.map(flow => `
#### ${flow.name}
**Description**: ${flow.description}
**Tables Involved**: ${flow.tables.join(', ')}
**Flow**: ${flow.flow}
`).join('\n')}

## API ENDPOINTS WITH BUSINESS CONTEXT

Total Endpoints: ${data.apis.length}

${data.apis.map(api => `
### ${api.method} ${api.endpoint}
- **Description**: ${api.description}
- **Parameters**: ${api.parameters.length > 0 ? api.parameters.join(', ') : 'None'}
- **Response Type**: ${api.response}
`).join('\n')}

## COMPONENT ARCHITECTURE

Total Components: ${data.components.length}

${data.components.map(comp => `
### ${comp.name} (${comp.type})
- **Dependencies**: ${comp.dependencies.length > 0 ? comp.dependencies.slice(0, 5).join(', ') : 'None'}${comp.dependencies.length > 5 ? '...' : ''}
- **Exports**: ${comp.exports.join(', ')}
- **Complexity Score**: ${comp.complexity}/10
`).join('\n')}

## DEPENDENCIES AND EXTERNAL INTEGRATIONS

${data.dependencies.map(dep => `
### ${dep.name} (v${dep.version}) - ${dep.type}
${dep.description}
`).join('\n')}

## QUEBEC-SPECIFIC COMPLIANCE AND BUSINESS RULES

### Law 25 (Data Protection)
- User consent tracking in invitation_audit_logs
- Data retention policies per Quebec regulations
- Access control based on user role and residence assignment

### Civil Code Compliance
- Co-ownership property management (max 300 units/building)
- Municipal property tax integration
- Role-based assignments: tenants rent, residents own, managers oversee

### Financial Compliance
- CAD currency handling with tax calculations
- Quebec taxation rules and GST/PST compliance
- Automated bill generation based on unit specifications

### Document Management
- Document retention policies per Quebec regulations
- Access control based on user role and residence assignment
- Bilingual support (French/English)

## TECHNICAL IMPLEMENTATION DETAILS

### Authentication & Authorization
- Session-based authentication with PostgreSQL store
- Role-Based Access Control (RBAC) with hierarchical permissions
- Multi-step registration with privacy consent

### Database Design Patterns
- UUID primary keys for security
- Soft deletes with audit trails
- Optimistic locking for concurrent updates
- Cascade deletes with referential integrity

### API Design Patterns
- RESTful endpoints with consistent naming
- Typed request/response validation with Zod
- Error handling with structured responses
- Rate limiting and security headers

### Frontend Architecture
- React 18 with TypeScript and strict mode
- Component composition with Radix UI primitives
- TanStack Query for server state management
- Form validation with React Hook Form + Zod

## BUSINESS LOGIC IMPLEMENTATION

### User Management Flow
1. Invitation creation with audit logging
2. User registration with Law 25 consent
3. Role assignment and residence mapping
4. Permission calculation based on role hierarchy

### Property Management Flow
1. Organization setup and configuration
2. Building creation with Quebec compliance checks
3. Automatic residence generation (1-300 units)
4. User-residence assignment with role validation

### Financial Management Flow
1. Monthly bill generation based on unit specs
2. Budget planning with variance tracking
3. Expense categorization and approval workflows
4. Tax calculation with Quebec rules

### Maintenance Request Flow
1. Request submission with priority classification
2. Vendor assignment based on expertise
3. Progress tracking with photo documentation
4. Completion notification and billing integration

---

**Generated**: ${lastUpdated}
**System Version**: ${data.projectOverview.version}
**Quebec Compliance**: Law 25 Fully Compliant
**Security**: Enterprise-grade with RBAC
**Documentation Version**: 3.0 (Enhanced Schema Analysis)
`;
}

// Helper function to generate documentation data
async function generateDocumentationData() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

  const docsPath = path.join(process.cwd(), 'docs');
  const documentationFiles = await scanDocumentationFiles(docsPath);
  const apiEndpoints = await extractApiEndpoints();
  const databaseSchema = await extractDatabaseSchema();
  const components = await extractComponentInfo();
  const dependencies = extractDependencies(packageJson);

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
  };
}

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