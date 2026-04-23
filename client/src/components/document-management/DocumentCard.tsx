import React from 'react';
import { Eye, FileText, Image, File, Calendar, User } from 'lucide-react';
import { StandardCard } from '@/components/common/StandardCard';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/hooks/use-language';

interface DocumentCardProps {
  title: string;
  documentId: string;
  onViewClick?: (documentId: string) => void;
  
  // Optional metadata for enhanced display
  documentType?: string;
  documentTypeLabel?: string;
  description?: string;
  createdAt?: string;
  effectiveDate?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: string;
  isVisibleToTenants?: boolean;
  isManagerOnly?: boolean;
  
  // Selection mode
  selectable?: boolean;
  selected?: boolean;
  onSelectionChange?: (documentId: string, selected: boolean) => void;
  
  // Visual customization
  className?: string;
  compact?: boolean;
  showMetadata?: boolean;
}

/**
 * DocumentCard - A standardized card component for displaying document summaries
 * Optimized for mobile interactions with large touch targets
 * Now uses StandardCard as its base for consistency across the application
 */
export function DocumentCard({
  title,
  documentId,
  onViewClick,
  documentType,
  documentTypeLabel,
  description,
  createdAt,
  effectiveDate,
  fileSize,
  mimeType,
  uploadedBy,
  isVisibleToTenants,
  isManagerOnly,
  selectable = false,
  selected = false,
  onSelectionChange,
  className,
  compact = false,
  showMetadata = true
}: DocumentCardProps) {
  const { t } = useLanguage();
  
  // Get appropriate icon based on document type/mime type
  const getDocumentIcon = () => {
    if (mimeType?.startsWith('image/')) {
      return <Image className="w-5 h-5 text-blue-500" />;
    }
    
    switch (mimeType) {
      case 'application/pdf':
        return <FileText className="w-5 h-5 text-red-500" />;
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return <FileText className="w-5 h-5 text-green-600" />;
      default:
        return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  // Format file size for display
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return null;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get document type badge color
  const getTypeColor = (type?: string) => {
    const colors: Record<string, string> = {
      'bylaw': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'financial': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'maintenance': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'legal': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'inspection': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'insurance': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    };
    return colors[type || ''] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  // Build badges array for StandardCard - only show in non-compact mode
  const badges = !compact && showMetadata ? [
    documentType && {
      text: documentTypeLabel || documentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      variant: 'secondary' as const,
      className: getTypeColor(documentType)
    },
    isVisibleToTenants && {
      text: '👥 Visible to Tenants',
      variant: 'outline' as const,
      className: 'border-green-300 text-green-700 dark:border-green-600 dark:text-green-400'
    },
    isManagerOnly && {
      text: t('managerOnly'),
      variant: 'outline' as const,
      className: 'border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400'
    }
  ].filter(Boolean) : [];

  // Build actions array for StandardCard
  const actions = onViewClick ? [
    {
      icon: <Eye className="w-4 h-4" />,
      label: 'View document',
      onClick: () => onViewClick(documentId),
      variant: 'ghost' as const,
      className: 'hover:bg-blue-50 dark:hover:bg-blue-950',
      testId: `view-document-${documentId}`
    }
  ] : [];

  // Build metadata array for StandardCard
  // In compact mode: only show minimal metadata (file size, date)
  // In normal mode: show all metadata (date, uploaded by, file size)
  // Prefer effectiveDate over createdAt for display
  const displayDate = effectiveDate || createdAt;
  
  const metadata = showMetadata ? (
    compact ? [
      fileSize && {
        value: formatFileSize(fileSize) || ''
      },
      displayDate && {
        icon: <Calendar className="w-3 h-3" />,
        value: formatDate(displayDate) || ''
      }
    ].filter(Boolean) : [
      displayDate && {
        icon: <Calendar className="w-3 h-3" />,
        value: formatDate(displayDate) || ''
      },
      uploadedBy && {
        icon: <User className="w-3 h-3" />,
        value: uploadedBy
      },
      fileSize && {
        value: formatFileSize(fileSize) || ''
      }
    ].filter(Boolean)
  ) : [];

  const handleCheckboxChange = (checked: boolean) => {
    if (onSelectionChange) {
      onSelectionChange(documentId, checked);
    }
  };

  if (selectable) {
    return (
      <div className="relative group">
        <StandardCard
          title={title}
          description={!compact ? description : undefined}
          icon={getDocumentIcon()}
          badges={badges}
          actions={actions}
          metadata={metadata}
          onClick={onViewClick ? () => onViewClick(documentId) : undefined}
          spacing={compact ? 'compact' : 'normal'}
          className={className}
          testId={`document-card-${documentId}`}
        />
        <div 
          className="absolute top-2 right-2 z-10"
          onClick={(e) => e.stopPropagation()}
          data-testid={`checkbox-select-${documentId}`}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={handleCheckboxChange}
            className="h-5 w-5 bg-white dark:bg-gray-800 border-2 shadow-sm"
          />
        </div>
      </div>
    );
  }

  return (
    <StandardCard
      title={title}
      description={!compact ? description : undefined}
      icon={getDocumentIcon()}
      badges={badges}
      actions={actions}
      metadata={metadata}
      onClick={onViewClick ? () => onViewClick(documentId) : undefined}
      spacing={compact ? 'compact' : 'normal'}
      className={className}
      testId={`document-card-${documentId}`}
    />
  );
}
