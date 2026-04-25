import React, { useState } from 'react';
import { UnifiedDocumentViewer } from '@/components/document-management/UnifiedDocumentViewer';
import { DocumentProvider } from '@/components/document-management/DocumentContext';
import { useLanguage } from '@/hooks/use-language';

/**
 * Examples demonstrating unified document management patterns
 * across different entity types with consistent access control
 */

// Example: Building Documents (Manager View)
export function BuildingDocuments({ buildingId, buildingName, organizationId }: {
  buildingId: string;
  buildingName?: string;
  organizationId?: string;
}) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const user = { id: 'user-1', role: 'manager' as const };

  const config = {
    entityType: 'building' as const,
    entityId: buildingId,
    entityName: buildingName,
    canView: true,
    canEdit: true,
    canCreate: true,
    canDelete: true,
    showSearch: true,
    showFilter: true,
    showCreateButton: true,
    gridView: true,
    compact: false,
  };

  return (
    <DocumentProvider user={user} organizationId={organizationId} buildingId={buildingId}>
      <UnifiedDocumentViewer
        config={config}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        onDocumentCreate={() => {/* Create building document handler */}}
        onDocumentEdit={(id) => {/* Edit document handler */}}
      />
    </DocumentProvider>
  );
}

// Example: Residence Documents (Resident View)
export function ResidenceDocuments({ residenceId, residenceName, buildingId }: {
  residenceId: string;
  residenceName?: string;
  buildingId?: string;
}) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  const user = { id: 'user-2', role: 'resident' as const };

  const config = {
    entityType: 'residence' as const,
    entityId: residenceId,
    entityName: residenceName,
    canView: true,
    canEdit: true,
    canCreate: true,
    canDelete: true,
    showSearch: true,
    showFilter: false,
    showCreateButton: true,
    gridView: true,
    compact: false,
  };

  return (
    <DocumentProvider user={user} buildingId={buildingId} residenceId={residenceId}>
      <UnifiedDocumentViewer
        config={config}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onDocumentCreate={() => {/* Create residence document handler */}}
        onDocumentEdit={(id) => {/* Edit document handler */}}
      />
    </DocumentProvider>
  );
}

// Example: Project Documents (Manager View)
export function ProjectDocuments({ projectId, projectName, organizationId }: {
  projectId: string;
  projectName?: string;
  organizationId?: string;
}) {
  const { t } = useLanguage();
  const user = { id: 'user-1', role: 'manager' as const };

  const config = {
    entityType: 'project' as const,
    entityId: projectId,
    entityName: projectName,
    canView: true,
    canEdit: true,
    canCreate: true,
    canDelete: true,
    showSearch: false,
    showFilter: false,
    showCreateButton: true,
    gridView: true,
    compact: false,
  };

  return (
    <DocumentProvider user={user} organizationId={organizationId}>
      <UnifiedDocumentViewer
        config={config}
        onDocumentCreate={() => {/* Create project document handler */}}
        onDocumentEdit={(id) => {/* Edit document handler */}}
      />
    </DocumentProvider>
  );
}

// Example: Bill Documents (Tenant View - Read Only)
export function BillDocuments({ billId, billName, buildingId }: {
  billId: string;
  billName?: string;
  buildingId?: string;
}) {
  const { t } = useLanguage();
  const user = { id: 'user-3', role: 'tenant' as const };

  const config = {
    entityType: 'bill' as const,
    entityId: billId,
    entityName: billName,
    canView: true,
    canEdit: false,
    canCreate: false,
    canDelete: false,
    showSearch: false,
    showFilter: false,
    showCreateButton: false,
    gridView: false, // List view for bills
    compact: true,
  };

  return (
    <DocumentProvider user={user} buildingId={buildingId}>
      <UnifiedDocumentViewer config={config} />
    </DocumentProvider>
  );
}

// Example: Organization Documents (Admin View)
export function OrganizationDocuments({ organizationId, organizationName }: {
  organizationId: string;
  organizationName?: string;
}) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const user = { id: 'user-admin', role: 'admin' as const };

  const config = {
    entityType: 'organization' as const,
    entityId: organizationId,
    entityName: organizationName,
    canView: true,
    canEdit: true,
    canCreate: true,
    canDelete: true,
    showSearch: true,
    showFilter: true,
    showCreateButton: true,
    gridView: true,
    compact: false,
  };

  return (
    <DocumentProvider user={user} organizationId={organizationId}>
      <UnifiedDocumentViewer
        config={config}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        onDocumentCreate={() => {/* Create organization document handler */}}
        onDocumentEdit={(id) => {/* Edit document handler */}}
      />
    </DocumentProvider>
  );
}

// Example usage in a page component:
export function ExampleUsage() {
  const { t } = useLanguage();
  return (
    <div className="space-y-8 p-6">
      <div>
        <h2 className="text-xl font-bold mb-4">Building Documents (Manager)</h2>
        <BuildingDocuments 
          buildingId="building-123" 
          buildingName="Maple Heights Condos"
          organizationId="org-456"
        />
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Residence Documents (Resident)</h2>
        <ResidenceDocuments 
          residenceId="residence-789" 
          residenceName="Unit 4B"
          buildingId="building-123"
        />
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Project Documents</h2>
        <ProjectDocuments 
          projectId="project-456" 
          projectName="Roof Renovation 2024"
          organizationId="org-456"
        />
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">{t('billDocumentsTenantReadOnly')}</h2>
        <BillDocuments 
          billId="bill-123" 
          billName="January Utilities"
          buildingId="building-123"
        />
      </div>
    </div>
  );
}