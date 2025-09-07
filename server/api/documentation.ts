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

// Helper function to extract database schema
async function extractDatabaseSchema() {
  const schema = {
    tables: [] as Array<{
      name: string;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        primary: boolean;
      }>;
    }>
  };

  try {
    // Read the main schema file
    const schemaPath = path.join(process.cwd(), 'shared', 'schema.ts');
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    
    // Extract table exports from schema files
    const schemasPath = path.join(process.cwd(), 'shared', 'schemas');
    try {
      const schemaFiles = await fs.readdir(schemasPath);
      
      for (const file of schemaFiles) {
        if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
          try {
            const content = await fs.readFile(path.join(schemasPath, file), 'utf-8');
            const tables = extractTablesFromSchema(content);
            schema.tables.push(...tables);
          } catch (error) {
            console.warn(`⚠️ Could not read schema file ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Schemas directory not accessible:', error);
    }
  } catch (error) {
    console.warn('⚠️ Could not extract database schema:', error);
  }

  return schema;
}

// Helper function to extract tables from schema file content
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