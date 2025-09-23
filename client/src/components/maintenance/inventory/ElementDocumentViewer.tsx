import React from 'react';
import { UnifiedDocumentViewer } from '@/components/document-management/UnifiedDocumentViewer';

interface ElementDocumentViewerProps {
  elementId: string;
  elementName?: string;
  className?: string;
}

/**
 * ElementDocumentViewer - Displays documents associated with a building element
 * Now uses the unified document management pattern for consistency
 */
export function ElementDocumentViewer({ elementId, elementName, className }: ElementDocumentViewerProps) {
  const config = {
    entityType: 'element' as const,
    entityId: elementId,
    entityName: elementName,
    canView: true,
    canEdit: false,
    canCreate: false,
    canDelete: false,
    showSearch: false,
    showFilter: false,
    showCreateButton: false,
    gridView: true,
    compact: false,
  };

  return (
    <UnifiedDocumentViewer
      config={config}
      className={className}
    />
  );
}