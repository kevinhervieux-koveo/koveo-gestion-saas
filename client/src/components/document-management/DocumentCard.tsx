import React from 'react';
import { Eye, FileText, Image, File, Calendar, User } from 'lucide-react';
import { StandardCard } from '@/components/common/StandardCard';

interface DocumentCardProps {
  title: string;
  documentId: string;
  onViewClick: (documentId: string) => void;
  
  // Optional metadata for enhanced display
  documentType?: string;
  description?: string;
  createdAt?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: string;
  isVisibleToTenants?: boolean;
  
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
  description,
  createdAt,
  fileSize,
  mimeType,
  uploadedBy,
  isVisibleToTenants,
  className,
  compact = false,
  showMetadata = true
}: DocumentCardProps) {
  
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
      text: documentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      variant: 'secondary' as const,
      className: getTypeColor(documentType)
    },
    isVisibleToTenants && {
      text: '👥 Visible to Tenants',
      variant: 'outline' as const,
      className: 'border-green-300 text-green-700 dark:border-green-600 dark:text-green-400'
    }
  ].filter(Boolean) : [];

  // Build actions array for StandardCard
  const actions = [
    {
      icon: <Eye className="w-4 h-4" />,
      label: 'View document',
      onClick: () => onViewClick(documentId),
      variant: 'ghost' as const,
      className: 'hover:bg-blue-50 dark:hover:bg-blue-950',
      testId: `view-document-${documentId}`
    }
  ];

  // Build metadata array for StandardCard
  // In compact mode: only show minimal metadata (file size, date)
  // In normal mode: show all metadata (date, uploaded by, file size)
  const metadata = showMetadata ? (
    compact ? [
      fileSize && {
        value: formatFileSize(fileSize) || ''
      },
      createdAt && {
        icon: <Calendar className="w-3 h-3" />,
        value: formatDate(createdAt) || ''
      }
    ].filter(Boolean) : [
      createdAt && {
        icon: <Calendar className="w-3 h-3" />,
        value: formatDate(createdAt) || ''
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

  return (
    <StandardCard
      title={title}
      description={!compact ? description : undefined}
      icon={getDocumentIcon()}
      badges={badges}
      actions={actions}
      metadata={metadata}
      onClick={() => onViewClick(documentId)}
      spacing={compact ? 'compact' : 'normal'}
      className={className}
      testId={`document-card-${documentId}`}
    />
  );
}
