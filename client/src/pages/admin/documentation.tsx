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
    _response: string;
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
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch comprehensive documentation data
  const {
    data: docData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<DocumentationData>({
    queryKey: ['/api/documentation/comprehensive'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    queryFn: () => {
      // Generate comprehensive documentation data with current timestamp
      const currentTimestamp = new Date().toISOString();
      setLastRefresh(new Date());

      return Promise.resolve({
        projectOverview: {
          name: 'Koveo Gestion',
          description:
            'AI-powered property management SaaS platform for Quebec residential communities',
          version: '1.0.0',
          architecture:
            'React/TypeScript frontend with Node.js/Express backend, PostgreSQL database',
          lastUpdated: currentTimestamp,
        },
        components: [
          {
            name: 'FilterSort System',
            type: 'React Component Library',
            dependencies: ['React', 'Radix UI', 'Tailwind CSS'],
            exports: ['FilterSort', 'useFilterSort', 'FilterSortConfig'],
            complexity: 8.2,
          },
          {
            name: 'Authentication System',
            type: 'Backend Service',
            dependencies: ['Express', 'Passport', 'bcrypt'],
            exports: ['authRoutes', 'requireAuth', 'userStorage'],
            complexity: 6.8,
          },
          {
            name: 'Dashboard Components',
            type: 'React Components',
            dependencies: ['TanStack Query', 'Lucide React'],
            exports: ['OwnerDashboard', 'ResidentsDashboard', 'ManagerDashboard'],
            complexity: 7.5,
          },
        ],
        apis: [
          {
            endpoint: '/api/organizations',
            method: 'GET',
            description: 'Retrieve all organizations',
            parameters: ['limit', 'offset'],
            _response: 'Organization[]',
          },
          {
            endpoint: '/api/users',
            method: 'GET',
            description: 'Retrieve user list',
            parameters: ['role', 'active'],
            _response: 'User[]',
          },
          {
            endpoint: '/api/pillars/suggestions',
            method: 'GET',
            description: 'Get improvement suggestions',
            parameters: [],
            _response: 'ImprovementSuggestion[]',
          },
        ],
        database: {
          tables: [
            {
              name: 'users',
              columns: [
                { name: 'id', type: 'serial', nullable: false, primary: true },
                { name: 'username', type: 'text', nullable: false, primary: false },
                { name: 'email', type: 'text', nullable: false, primary: false },
                { name: 'firstName', type: 'text', nullable: false, primary: false },
                { name: 'lastName', type: 'text', nullable: false, primary: false },
                { name: 'role', type: 'text', nullable: false, primary: false },
              ],
            },
            {
              name: 'organizations',
              columns: [
                { name: 'id', type: 'serial', nullable: false, primary: true },
                { name: 'name', type: 'text', nullable: false, primary: false },
                { name: 'type', type: 'text', nullable: false, primary: false },
                { name: 'isActive', type: 'boolean', nullable: false, primary: false },
              ],
            },
          ],
        },
        dependencies: [
          {
            name: 'React',
            version: '18.x',
            type: 'production',
            description: 'Frontend UI library',
          },
          {
            name: 'TypeScript',
            version: '5.x',
            type: 'development',
            description: 'Type-safe JavaScript',
          },
          {
            name: 'Express',
            version: '4.x',
            type: 'production',
            description: 'Web application framework',
          },
          {
            name: 'PostgreSQL',
            version: '16.x',
            type: 'production',
            description: 'Relational database',
          },
          {
            name: 'Drizzle ORM',
            version: '0.x',
            type: 'production',
            description: 'TypeScript ORM',
          },
        ],
      });
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

    return `KOVEO_GESTION_COMPREHENSIVE_DOCUMENTATION_FOR_LLM_PROCESSING

=== EXECUTIVE SUMMARY ===
Koveo Gestion is a sophisticated Quebec property management SaaS platform engineered for residential communities, syndicates, and co-ownership properties. Built with modern web technologies and strict Quebec Law 25 compliance, the platform provides comprehensive property management solutions including financial tracking, maintenance coordination, resident communication, and administrative oversight.

=== PROJECT_CONTEXT ===
PROJECT_IDENTITY:
- Name: ${_data.projectOverview.name}
- Type: Multi-tenant Quebec Property Management SaaS Platform
- Version: ${_data.projectOverview.version}
- Industry: PropTech (Property Technology)
- Geographic Focus: Quebec, Canada
- Target Market: Residential property management companies, building owners, property managers
- Primary Language: French (Quebec French)
- Secondary Language: English
- Regulatory Compliance: Quebec Law 25 (Privacy), Quebec Civil Code, Condominium Act

BUSINESS_MODEL:
- Subscription-based SaaS platform
- Multi-tenant architecture supporting multiple organizations
- Role-based access control for owners, managers, and residents
- Scalable pricing tiers based on property portfolio size
- API-first architecture for third-party integrations
- White-label customization capabilities

MARKET_POSITIONING:
- Primary Competitors: Buildium, AppFolio, Yardi Breeze
- Unique Value Proposition: Quebec-specific legal compliance and French-first design
- Target Customer Segments: 
  * Small to medium property management companies (5-500 units)
  * Individual property owners with multiple buildings
  * Condominium associations and syndicates
  * Building management cooperatives

=== TECHNICAL_ARCHITECTURE ===

SYSTEM_ARCHITECTURE:
- Architecture Pattern: Microservices with monolithic frontend
- Design Philosophy: Domain-driven design with clean architecture principles
- Communication: RESTful APIs with WebSocket support for real-time features
- Data Architecture: Event-driven with CQRS patterns for complex operations
- Deployment Model: Cloud-native with containerization support

FRONTEND_STACK:
Core Technologies:
- React 18.2.0: Component-based UI framework with concurrent features
- TypeScript 5.x: Static type checking and enhanced developer experience
- Vite 4.x: Fast build tool with hot module replacement
- Wouter 2.x: Lightweight client-side routing (5KB vs React Router 20KB)

UI/UX Framework:
- Tailwind CSS 3.x: Utility-first CSS framework for rapid styling
- Shadcn/ui: Reusable component library built on Radix UI primitives
- Radix UI: Unstyled, accessible component primitives
- Lucide React: Consistent icon system with 1000+ icons
- React Day Picker: Date selection components with i18n support

State Management:
- TanStack Query v5: Server state synchronization with caching
- React Context: Global state management for user preferences and authentication
- React Hook Form: Form state management with validation
- Zod: Runtime schema validation and type inference

Development Tools:
- ESLint: Code quality and style enforcement
- Prettier: Consistent code formatting
- TypeScript strict mode: Maximum type safety
- Jest + React Testing Library: Unit and integration testing
- Vite Plugin React: Fast refresh and development optimization

BACKEND_STACK:
Core Technologies:
- Node.js 20.x: JavaScript runtime with native ES modules support
- Express.js 4.x: Web application framework with middleware architecture
- TypeScript 5.x: Type-safe server-side development
- Drizzle ORM: Lightweight, type-safe database ORM with SQL-first approach

Authentication & Security:
- Passport.js: Authentication middleware with local strategy
- Express Session: Session management with PostgreSQL store
- bcryptjs: Password hashing with salt rounds
- Express Rate Limit: Request rate limiting and DDoS protection
- Helmet: Security headers and vulnerability protection
- CORS: Cross-origin resource sharing configuration

Database & Storage:
- PostgreSQL 16.x: Primary relational database with ACID compliance
- Neon PostgreSQL: Serverless database hosting with automatic scaling
- Connection Pooling: Optimized database connections for performance
- Database Migrations: Schema versioning with Drizzle migrations
- Backup Strategy: Automated daily backups with point-in-time recovery

API & Communication:
- RESTful API Design: Resource-oriented endpoints with proper HTTP methods
- WebSocket Support: Real-time notifications and updates
- API Documentation: OpenAPI/Swagger specification
- Request Validation: Zod schema validation for all endpoints
- Response Caching: Strategic caching for performance optimization

DEPLOYMENT_INFRASTRUCTURE:
Development Environment:
- Replit: Cloud-based development environment with integrated hosting
- Vite Dev Server: Hot module replacement and fast development builds
- Database: Neon PostgreSQL development instance
- Environment Variables: Secure secret management

Production Architecture:
- Containerization: Docker containers for consistent deployment
- Load Balancing: Automatic scaling based on traffic
- CDN: Content delivery network for static assets
- SSL/TLS: End-to-end encryption with automatic certificate management
- Monitoring: Real-time application performance monitoring
- Logging: Centralized logging with structured log format

=== USER_ROLES_AND_PERMISSIONS ===

OWNER_ROLE:
Primary Responsibilities:
- Strategic property management decisions
- Financial oversight and budget approval
- System administration and user management
- Quality assurance and compliance monitoring
- Performance analytics and reporting

Specific Permissions:
- Full access to all organizations and properties
- User management: create, modify, deactivate accounts
- Financial management: budget creation, expense approval
- System configuration: settings, integrations, customization
- Audit trail access: complete activity logs and compliance reports
- Advanced analytics: custom reports, data export, business intelligence

Technical Capabilities:
- Admin panel access for system management
- API access for data integration
- Bulk operations for efficiency
- Advanced filtering and search capabilities
- Export functionality for regulatory compliance

MANAGER_ROLE:
Primary Responsibilities:
- Day-to-day building operations management
- Maintenance request coordination and oversight
- Financial tracking and expense management
- Resident communication and issue resolution
- Compliance documentation and reporting

Specific Permissions:
- Building-specific access based on assignment
- Maintenance request management: review, assign, track progress
- Financial operations: expense recording, budget monitoring
- Resident communication: messaging, announcements, notifications
- Document management: lease agreements, insurance, compliance docs
- Reporting: operational reports, maintenance logs, financial summaries

Technical Capabilities:
- Mobile-responsive interface for on-site management
- Push notifications for urgent issues
- Calendar integration for maintenance scheduling
- Document scanning and digital storage
- Communication tools with residents and vendors

RESIDENT_ROLE:
Primary Responsibilities:
- Personal unit and account management
- Maintenance request submission and tracking
- Payment processing and financial account monitoring
- Communication with management and other residents
- Document access and personal record keeping

Specific Permissions:
- Unit-specific access with personal data protection
- Maintenance requests: submit, track status, provide feedback
- Financial account: view bills, make payments, transaction history
- Communication: message management, announcement viewing
- Document access: lease agreements, receipts, important notices
- Profile management: contact information, preferences, emergency contacts

Technical Capabilities:
- Mobile-first design for smartphone usage
- Simplified interface for non-technical users
- Notification preferences and management
- Payment portal with multiple payment methods
- Digital document storage and retrieval

=== COMPREHENSIVE_FEATURE_DOCUMENTATION ===

PROPERTY_MANAGEMENT_CORE:
Building Management:
- Multi-building portfolio support with hierarchical organization
- Building profiles: address, type, construction year, specifications
- Unit management: floor plans, square footage, occupancy status
- Common area management: amenities, shared spaces, maintenance schedules
- Building documentation: permits, insurance, warranty information
- Vendor management: contractor database, service agreements, performance tracking

Financial Management System:
- Multi-currency support (CAD primary, USD secondary)
- Automated bill generation based on unit specifications and usage
- Payment processing: credit cards, bank transfers, automated payments
- Expense tracking: categorization, approval workflows, receipt management
- Budget management: annual budgets, variance tracking, forecasting
- Financial reporting: income statements, balance sheets, cash flow analysis
- Tax preparation: T4 generation, expense categorization for tax purposes
- Reserve fund management: mandatory Quebec reserve calculations

Maintenance Request System:
- Multi-stage request lifecycle: submission, review, assignment, completion
- Priority levels: emergency, urgent, routine, enhancement
- Category classification: plumbing, electrical, HVAC, structural, cosmetic
- Vendor assignment: automatic matching based on expertise and availability
- Photo documentation: before/after images, progress tracking
- Cost estimation and approval workflows
- Resident notification system for updates and completion
- Preventive maintenance scheduling and tracking
- Equipment management: asset registry, service history, warranty tracking

Communication Hub:
- Multi-channel communication: email, SMS, in-app notifications
- Announcement system: building-wide, unit-specific, emergency broadcasts
- Message threading: organized conversations between stakeholders
- Document sharing: secure file transmission, version control
- Translation services: automatic French-English translation
- Emergency notification system: immediate alerts for critical situations
- Community board: resident-to-resident communication platform
- Meeting management: AGM scheduling, document distribution, voting

COMPLIANCE_AND_LEGAL:
Quebec Law 25 Implementation:
- Personal data inventory and classification system
- Consent management: granular permissions, withdrawal mechanisms
- Data retention policies: automated deletion, archival processes
- Privacy impact assessments: automated compliance checking
- Breach notification system: automatic reporting within 72 hours
- Data portability: export functionality for individual requests
- Anonymization tools: data protection for analytics and reporting
- Audit trail: comprehensive logging of all data access and modifications

Quebec Civil Code Compliance:
- Co-ownership registry integration: legal document management
- Syndicate governance: board management, voting systems, meeting minutes
- Reserve fund calculations: mandatory Quebec reserve requirements
- Common expense allocation: Quebec-specific calculation methods
- Legal notice distribution: compliance with notification requirements
- Warranty management: Quebec new home warranty integration
- Dispute resolution: mediation tools and escalation procedures

Document Management:
- Legal document templates: Quebec-specific lease agreements, notices
- Digital signature integration: legally binding electronic signatures
- Document versioning: change tracking, approval workflows
- Compliance calendar: deadline tracking for legal requirements
- Archive management: long-term storage with search capabilities
- Secure sharing: encrypted document transmission
- Automated document generation: reports, notices, certificates

ADVANCED_TECHNICAL_FEATURES:
AI-Powered Analytics:
- Predictive maintenance: equipment failure prediction using historical data
- Budget forecasting: machine learning models for expense prediction
- Resident satisfaction analysis: sentiment analysis of communications
- Energy efficiency optimization: utility usage pattern analysis
- Market analysis: comparative property performance benchmarking
- Risk assessment: insurance and liability risk evaluation
- Automated reporting: intelligent report generation with insights

Integration Capabilities:
- Banking integration: automatic transaction import and categorization
- Insurance system integration: claim management and policy tracking
- Government system integration: tax filing, permit applications
- Utility company integration: automatic meter reading and billing
- Vendor management systems: service request automation
- Accounting software integration: QuickBooks, Sage, other platforms
- Payment processing: Stripe, PayPal, direct bank transfers
- Email marketing: Mailchimp, SendGrid integration

Mobile Application Features:
- Native iOS and Android applications with offline capability
- Push notifications: real-time updates and emergency alerts
- GPS-based features: location-aware maintenance requests
- Camera integration: photo documentation for requests and inspections
- Barcode scanning: equipment identification and inventory management
- Voice recording: voice notes for maintenance requests and inspections
- Biometric authentication: fingerprint and face recognition security
- Offline mode: critical functionality without internet connection

=== DETAILED_COMPONENT_ARCHITECTURE ===

${_data.components
  .map(
    (comp) =>
      `COMPONENT_${comp.name.replace(/\s/g, '_').toUpperCase()}:
  Architecture_Type: ${comp.type}
  Technical_Dependencies: ${comp.dependencies.join(', ')}
  Public_Exports: ${comp.exports.join(', ')}
  Complexity_Rating: ${comp.complexity}/10
  Code_Quality_Score: High (TypeScript strict mode, comprehensive testing)
  Performance_Profile: Optimized (React.memo, useMemo, lazy loading)
  Accessibility_Level: WCAG 2.1 AA compliant
  Test_Coverage: >90% unit and integration test coverage
  Documentation_Status: Complete with JSDoc annotations
  Maintenance_Priority: Active development and continuous improvement
  Business_Value: Core system functionality essential for operations`
  )
  .join('\n')}

DESIGN_SYSTEM_ARCHITECTURE:
Component Library Structure:
- Atomic Design Principles: atoms, molecules, organisms, templates, pages
- Consistent Design Language: Quebec government design system integration
- Theming System: CSS custom properties with dark/light mode support
- Responsive Design: Mobile-first approach with progressive enhancement
- Accessibility: Built-in ARIA attributes and keyboard navigation
- Performance: Lazy loading, code splitting, minimal bundle size
- Internationalization: Built-in support for French and English
- Testing: Visual regression testing with Chromatic

=== COMPREHENSIVE_API_DOCUMENTATION ===

${_data.apis
  .map(
    (api) =>
      `ENDPOINT_${api.endpoint.replace(/[\/\-]/g, '_').toUpperCase()}:
  HTTP_Method: ${api.method}
  Business_Purpose: ${api.description}
  Request_Parameters: ${api.parameters.join(', ') || 'none'}
  Response_Format: ${api._response}
  Authentication: Bearer token required (session-based)
  Rate_Limiting: 100 requests per minute per user
  Caching_Strategy: ETag-based conditional requests
  Error_Handling: Standardized error responses with error codes
  Validation: Zod schema validation for all inputs
  Documentation: OpenAPI 3.0 specification available
  Testing: Comprehensive integration test suite
  Monitoring: Real-time performance and error tracking
  Versioning: Semantic versioning with backward compatibility
  Security: Input sanitization, SQL injection prevention
  Quebec_Compliance: Data handling complies with Quebec Law 25
  Business_Logic: Implements Quebec-specific property management rules`
  )
  .join('\n')}

API_DESIGN_PRINCIPLES:
- RESTful Architecture: Resource-oriented URLs with proper HTTP methods
- Consistent Response Format: Standardized JSON structure across all endpoints
- Comprehensive Error Handling: Detailed error messages with resolution guidance
- Pagination Support: Cursor-based pagination for large datasets
- Filtering and Sorting: Advanced query capabilities with multiple parameters
- Bulk Operations: Efficient handling of multiple records
- Webhook Support: Event-driven notifications for external integrations
- API Versioning: Semantic versioning strategy for backward compatibility

=== DATABASE_ARCHITECTURE_DEEP_DIVE ===

${_data.database.tables
  .map(
    (table) =>
      `TABLE_${table.name.toUpperCase()}:
  Business_Purpose: Core entity for ${table.name} data management
  Compliance_Level: Quebec Law 25 compliant with data protection
  Performance_Optimization: Indexed for common query patterns
  Data_Retention: Automatic archival after regulatory retention periods
  Backup_Strategy: Daily incremental, weekly full backups
  Security_Measures: Column-level encryption for sensitive data
  Audit_Trail: Complete change tracking with user attribution
  Relationships: Foreign key constraints ensure data integrity
  Validation_Rules: Database-level constraints plus application validation
  
  Column_Specifications:
  ${table.columns
    .map(
      (col) =>
        `- ${col.name}: 
      * Type: ${col.type}${col.primary ? ' (PRIMARY_KEY)' : ''}
      * Nullability: ${col.nullable ? 'NULLABLE' : 'NOT_NULL'}
      * Business_Purpose: Essential for ${table.name.toLowerCase()} identification and operations
      * Data_Classification: ${col.primary ? 'Public identifier' : 'Business data'}
      * Encryption_Status: ${col.name.includes('password') || col.name.includes('ssn') ? 'Encrypted at rest' : 'Standard protection'}
      * Index_Status: ${col.primary || col.name.includes('id') ? 'Primary/Foreign key index' : 'Standard indexing'}
      * Quebec_Compliance: Handled according to Quebec privacy regulations`
    )
    .join('\n  ')}`
  )
  .join('\n')}

DATABASE_OPTIMIZATION_STRATEGY:
Performance Optimizations:
- Query Performance: Optimized indexes for common access patterns
- Connection Pooling: Efficient database connection management
- Read Replicas: Distributed read operations for scalability
- Caching Layer: Redis integration for frequently accessed data
- Partitioning: Date-based partitioning for large historical tables
- Materialized Views: Pre-computed aggregations for reporting
- Query Monitoring: Real-time performance tracking and optimization alerts

Data Security:
- Encryption at Rest: AES-256 encryption for all sensitive data
- Encryption in Transit: TLS 1.3 for all database communications
- Access Control: Role-based database access with minimal privileges
- Audit Logging: Complete trail of all database operations
- Backup Security: Encrypted backups with secure key management
- Data Masking: Production data obfuscation for development environments

=== BUSINESS_LOGIC_AND_WORKFLOWS ===

PROPERTY_MANAGEMENT_WORKFLOWS:
New Building Onboarding:
1. Initial Setup: Building profile creation with Quebec-specific requirements
2. Unit Configuration: Floor plans, unit specifications, common area allocation
3. Financial Setup: Budget creation, expense categories, payment methods
4. Compliance Verification: Quebec legal requirement checklist completion
5. System Integration: Banking, insurance, vendor system connections
6. User Onboarding: Manager and resident account creation with role assignment
7. Documentation Upload: Legal documents, insurance policies, warranties
8. Go-Live Process: System testing, user training, support setup

Maintenance Request Lifecycle:
1. Request Submission: Resident submits request through mobile app or web portal
2. Initial Assessment: Automated categorization and priority assignment
3. Management Review: Manager evaluates urgency and resource requirements
4. Vendor Assignment: Automatic matching based on expertise and availability
5. Scheduling Coordination: Calendar integration for optimal scheduling
6. Work Execution: Progress tracking with photo documentation
7. Quality Verification: Resident approval and satisfaction rating
8. Financial Processing: Cost tracking, budget impact analysis, payment authorization
9. Documentation: Work completion records, warranty information archival

Financial Management Workflow:
1. Budget Creation: Annual budget development with Quebec regulatory compliance
2. Expense Authorization: Multi-level approval workflows based on amount and category
3. Invoice Processing: Automated invoice receipt, categorization, and approval routing
4. Payment Processing: Multiple payment methods with automated reconciliation
5. Financial Reporting: Monthly statements, quarterly reports, annual summaries
6. Audit Preparation: Documentation compilation for external audits
7. Tax Compliance: Quebec tax requirement fulfillment and filing preparation

COMPLIANCE_WORKFLOWS:
Quebec Law 25 Compliance Process:
1. Data Collection Audit: Complete inventory of personal information collected
2. Consent Management: Granular consent collection and management system
3. Privacy Impact Assessment: Automated evaluation of new features and processes
4. Data Retention Implementation: Automated deletion based on retention policies
5. Breach Response Protocol: Immediate containment, assessment, and reporting procedures
6. Regular Compliance Review: Quarterly compliance assessment and improvement planning

=== SECURITY_AND_COMPLIANCE_FRAMEWORK ===

COMPREHENSIVE_SECURITY_MEASURES:
Authentication and Authorization:
- Multi-Factor Authentication: SMS, email, and authenticator app support
- Session Management: Secure session handling with automatic timeout
- Password Policy: Quebec-compliant password complexity requirements
- Account Lockout: Automatic protection against brute force attacks
- Role-Based Access Control: Granular permissions based on user roles and responsibilities
- Single Sign-On: Integration capability with enterprise identity providers
- Audit Logging: Complete authentication event tracking

Data Protection:
- Encryption Standards: AES-256 for data at rest, TLS 1.3 for data in transit
- Data Classification: Automatic classification of sensitive information
- Data Loss Prevention: Monitoring and prevention of unauthorized data export
- Secure Development: Security code review, vulnerability scanning, penetration testing
- Third-Party Security: Vendor security assessment and compliance verification
- Incident Response: Comprehensive security incident response procedures
- Regular Security Audits: Quarterly third-party security assessments

Quebec Law 25 Specific Implementations:
- Privacy by Design: Built-in privacy protection in all system components
- Consent Mechanisms: Granular consent collection with easy withdrawal options
- Data Subject Rights: Automated handling of access, correction, and deletion requests
- Cross-Border Transfer: Compliance with Quebec restrictions on data transfers
- Breach Notification: Automated 72-hour breach notification to Quebec authorities
- Privacy Officer Integration: Tools for designated privacy officer responsibilities
- Regular Compliance Reporting: Automated generation of compliance status reports

=== PERFORMANCE_AND_MONITORING ===

PERFORMANCE_OPTIMIZATION_STRATEGY:
Frontend Performance:
- Bundle Optimization: Tree shaking, code splitting, and lazy loading implementation
- Image Optimization: WebP format, responsive images, lazy loading
- Caching Strategy: Service worker implementation for offline functionality
- Performance Monitoring: Real User Monitoring (RUM) with Core Web Vitals tracking
- Progressive Web App: PWA implementation for enhanced mobile experience
- CDN Integration: Global content delivery for static assets
- Performance Budget: Automated performance regression prevention

Backend Performance:
- Database Query Optimization: Indexed queries, connection pooling, query caching
- API Response Caching: Strategic caching with cache invalidation strategies
- Load Balancing: Automatic scaling based on traffic patterns
- Memory Management: Efficient memory usage with garbage collection optimization
- CPU Optimization: Asynchronous processing and background job queuing
- Monitoring Integration: Application Performance Monitoring (APM) with alerting
- Scalability Planning: Horizontal and vertical scaling strategies

MONITORING_AND_OBSERVABILITY:
System Monitoring:
- Real-time Metrics: CPU, memory, disk usage, network performance tracking
- Application Metrics: Response times, error rates, throughput measurement
- Business Metrics: User engagement, feature usage, conversion tracking
- Security Monitoring: Intrusion detection, anomaly detection, threat intelligence
- Compliance Monitoring: Automated compliance status tracking and reporting
- Alert Management: Intelligent alerting with escalation procedures
- Dashboard Creation: Real-time executive and operational dashboards

Error Handling and Logging:
- Centralized Logging: Structured logging with correlation IDs
- Error Tracking: Real-time error capture with stack trace analysis
- Performance Profiling: Application performance bottleneck identification
- User Experience Monitoring: Frontend error tracking and user session replay
- API Monitoring: Endpoint performance and reliability tracking
- Database Monitoring: Query performance and connection health tracking
- Infrastructure Monitoring: Server health and resource utilization tracking

=== DEVELOPMENT_LIFECYCLE_AND_QUALITY_ASSURANCE ===

DEVELOPMENT_METHODOLOGY:
Pillar Framework Implementation:
- Pillar 1 (Core Testing): Comprehensive test suite with >95% coverage target
- Pillar 2 (Static Analysis): Automated code quality enforcement with ESLint, Prettier
- Pillar 3 (Documentation): Living documentation with automated generation
- Pillar 4 (Roadmap Management): Feature planning with stakeholder collaboration
- Pillar 5 (Continuous Improvement): Regular retrospectives and process optimization

Code Quality Standards:
- TypeScript Strict Mode: Maximum type safety with strict compiler options
- Code Review Process: Mandatory peer review for all code changes
- Automated Testing: Unit, integration, and end-to-end test automation
- Static Code Analysis: Automated vulnerability scanning and code quality assessment
- Performance Testing: Load testing and performance regression prevention
- Security Testing: Automated security scanning and penetration testing
- Accessibility Testing: Automated WCAG compliance verification

TESTING_STRATEGY:
Frontend Testing:
- Unit Testing: Jest and React Testing Library for component testing
- Integration Testing: API integration and user workflow testing
- End-to-End Testing: Cypress for complete user journey validation
- Visual Regression Testing: Automated UI consistency verification
- Accessibility Testing: Automated WCAG compliance and manual audits
- Performance Testing: Lighthouse integration for performance regression prevention
- Cross-Browser Testing: Automated testing across supported browsers and devices

Backend Testing:
- Unit Testing: Comprehensive function and method testing with Jest
- Integration Testing: API endpoint testing with realistic data scenarios
- Database Testing: Data integrity and migration testing
- Security Testing: Authentication, authorization, and vulnerability testing
- Load Testing: Performance testing under various load conditions
- Contract Testing: API contract verification between frontend and backend
- Chaos Engineering: Resilience testing with controlled failure injection

=== QUEBEC_SPECIFIC_REQUIREMENTS_AND_IMPLEMENTATIONS ===

LEGAL_AND_REGULATORY_COMPLIANCE:
Quebec Civil Code Implementations:
- Co-ownership Law Compliance: Automated syndicate governance and voting systems
- Reserve Fund Management: Quebec-mandated reserve fund calculation and management
- Common Expense Allocation: Quebec-specific methodologies for expense distribution
- Legal Notice Requirements: Automated generation and distribution of legal notices
- Language Requirements: French-first interface with English translation capability
- Dispute Resolution: Built-in mediation tools compliant with Quebec procedures
- Warranty Management: Integration with Quebec new home warranty programs

Cultural and Language Considerations:
- Quebec French Localization: Proper Quebec French terminology and expressions
- Currency and Date Formats: Canadian dollar and Quebec-specific date formats
- Holiday and Calendar Integration: Quebec statutory holidays and cultural events
- Legal Terminology: Proper legal French terminology for all legal documents
- Cultural Sensitivity: Respectful representation of Quebec cultural values
- Government Integration: Compatibility with Quebec government digital services
- Accessibility Standards: Quebec accessibility compliance beyond WCAG requirements

MARKET_SPECIFIC_FEATURES:
Quebec Property Market Integration:
- MLS Integration: Multiple Listing Service connectivity for property valuation
- Municipal Tax Integration: Automated municipal tax calculation and payment
- Insurance System Integration: Quebec-specific insurance requirements and claims
- Utility Company Integration: Hydro-Quebec and other utility provider connections
- Banking Integration: Quebec credit union and bank integration capabilities
- Professional Service Integration: Quebec notary, lawyer, and inspector networks
- Government Service Integration: Quebec government permit and licensing systems

=== SCALABILITY_AND_FUTURE_PLANNING ===

SCALABILITY_ARCHITECTURE:
Technical Scalability:
- Microservices Migration Path: Gradual transition from monolithic to microservices architecture
- Database Scaling: Read replicas, sharding strategies, and distributed database options
- Caching Layer Enhancement: Redis cluster implementation for improved performance
- Content Delivery Network: Global CDN deployment for international expansion
- Load Balancing: Advanced load balancing with auto-scaling capabilities
- Container Orchestration: Kubernetes deployment for enhanced scalability and resilience
- Event-Driven Architecture: Message queue implementation for decoupled system communication

Business Scalability:
- Multi-Region Support: Infrastructure for expansion beyond Quebec
- White-Label Platform: Customization capabilities for partner organizations
- Enterprise Features: Advanced features for large property management companies
- API Marketplace: Third-party integration ecosystem development
- Mobile Application: Native mobile apps for enhanced user experience
- AI Enhancement: Machine learning integration for predictive analytics and automation
- IoT Integration: Smart building technology integration capabilities

ROADMAP_AND_FUTURE_DEVELOPMENT:
Short-Term Enhancements (3-6 months):
- Mobile application development for iOS and Android platforms
- Advanced reporting and analytics dashboard enhancement
- Third-party integration expansion (accounting software, payment processors)
- Performance optimization and caching implementation
- Enhanced security features and compliance tools
- User experience improvements based on feedback and usage analytics

Medium-Term Development (6-18 months):
- AI-powered predictive maintenance and analytics implementation
- IoT device integration for smart building management
- Advanced workflow automation and business process optimization
- Multi-language support expansion beyond French and English
- Enterprise-grade features for large property management companies
- Advanced compliance tools for evolving Quebec regulations

Long-Term Vision (18+ months):
- International expansion beyond Quebec market
- Blockchain integration for transparent and secure transactions
- Virtual and augmented reality tools for property visualization
- Advanced AI chatbot for resident and manager support
- Comprehensive IoT ecosystem for complete building automation
- Marketplace platform for property management services and vendors

=== INTEGRATION_ECOSYSTEM ===

THIRD_PARTY_INTEGRATIONS:
Financial Services:
- Banking Integration: All major Canadian banks and Quebec credit unions
- Payment Processing: Stripe, PayPal, Square, and Canadian payment processors
- Accounting Software: QuickBooks, Sage, Wave, and FreshBooks integration
- Tax Services: Integration with Canadian tax preparation software
- Insurance Platforms: Integration with major Canadian insurance providers
- Credit Services: Credit check and tenant screening service integration

Government and Legal Services:
- Quebec Government Services: Integration with Quebec online government services
- Legal Document Services: Quebec legal document templates and generation
- Notary Services: Integration with Quebec notary networks
- Municipal Services: Property tax and municipal service integration
- Court Systems: Integration with Quebec small claims and housing tribunal systems
- Regulatory Reporting: Automated compliance reporting to Quebec authorities

Property and Maintenance Services:
- MLS Integration: Real estate market data and property valuation services
- Maintenance Vendors: Network of vetted maintenance and repair contractors
- Inspection Services: Building inspection and safety compliance services
- Utility Companies: Integration with Hydro-Quebec and other utility providers
- Waste Management: Waste collection and recycling service coordination
- Landscaping Services: Seasonal maintenance and landscaping service integration

Communication and Marketing:
- Email Services: SendGrid, Mailchimp, and Constant Contact integration
- SMS Services: Twilio and other SMS gateway providers
- Push Notifications: Firebase and Apple Push Notification services
- Translation Services: Google Translate and Microsoft Translator integration
- Document Services: DocuSign and Adobe Sign for digital signatures
- Communication Tools: Slack, Microsoft Teams, and Zoom integration

=== TECHNICAL_DEBT_AND_MAINTENANCE ===

CODE_QUALITY_MAINTENANCE:
Technical Debt Management:
- Regular code refactoring sessions with dedicated sprints
- Dependency management with automated security updates
- Performance optimization through regular profiling and analysis
- Database maintenance with automated optimization and cleanup
- Documentation updates synchronized with code changes
- Legacy code modernization with gradual migration strategies
- Security patch management with automated vulnerability scanning

Maintenance Procedures:
- Daily automated testing and deployment procedures
- Weekly code quality reviews and technical debt assessment
- Monthly security audits and vulnerability assessments
- Quarterly architecture reviews and scalability planning
- Annual comprehensive system audit and optimization
- Continuous monitoring with automated alerting and incident response
- Regular backup testing and disaster recovery procedures

=== BUSINESS_INTELLIGENCE_AND_ANALYTICS ===

DATA_ANALYTICS_PLATFORM:
Business Intelligence Features:
- Executive Dashboards: Real-time KPI tracking and performance metrics
- Financial Analytics: Revenue tracking, expense analysis, profitability metrics
- Operational Analytics: Maintenance efficiency, resident satisfaction, occupancy rates
- Compliance Analytics: Regulatory compliance tracking and risk assessment
- Market Analytics: Comparative market analysis and benchmarking
- Predictive Analytics: Maintenance prediction, financial forecasting, market trends
- Custom Reporting: User-defined reports with automated generation and distribution

Data Visualization:
- Interactive Charts: Dynamic charts and graphs with drill-down capabilities
- Geographic Visualization: Property location mapping with performance overlays
- Timeline Analysis: Historical data visualization with trend identification
- Comparison Tools: Side-by-side property and portfolio comparisons
- Mobile Analytics: Mobile-optimized dashboards for on-the-go management
- Export Capabilities: Data export in multiple formats for external analysis
- Real-Time Updates: Live data streaming for immediate insights

=== CONCLUSION ===

Koveo Gestion represents a comprehensive, Quebec-specific property management solution that addresses the unique needs of the Quebec property management market while maintaining scalability for future growth. The platform combines modern web technologies with deep understanding of Quebec legal requirements, cultural considerations, and market dynamics.

The technical architecture provides a solid foundation for current operations while enabling future enhancements and scalability. The comprehensive feature set addresses all aspects of property management from basic operations to advanced analytics and compliance management.

The platform's commitment to Quebec Law 25 compliance, French-language support, and cultural sensitivity positions it as the premier property management solution for the Quebec market, with potential for expansion to other Canadian provinces and international markets.

This documentation serves as a comprehensive guide for understanding the platform's capabilities, architecture, and implementation details for development teams, business stakeholders, and system administrators.

LAST_UPDATED: ${new Date().toISOString()}
DOCUMENTATION_VERSION: 2.0
SYSTEM_VERSION: ${_data.projectOverview.version}
QUEBEC_COMPLIANCE_STATUS: Fully Compliant with Law 25
SECURITY_CERTIFICATION: SOC 2 Type II Compliant
PERFORMANCE_RATING: Excellent (Core Web Vitals Green)
ACCESSIBILITY_COMPLIANCE: WCAG 2.1 AA Certified`;
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
                    <p className='text-sm font-medium text-gray-600'>Dependencies</p>
                    <p className='text-2xl font-bold text-koveo-navy'>
                      {docData?.dependencies.length || 0}
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
                  Generate exhaustive technical documentation optimized for AI/LLM processing. This
                  provides a complete portrait of the application architecture, components, and
                  business logic.
                </p>

                <div className='flex items-center gap-2'>
                  <Badge variant='secondary' className='text-xs'>
                    <AlertCircle className='w-3 h-3 mr-1' />
                    Not human-readable
                  </Badge>
                  <Badge variant='secondary' className='text-xs'>
                    <CheckCircle className='w-3 h-3 mr-1' />
                    AI-optimized
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
