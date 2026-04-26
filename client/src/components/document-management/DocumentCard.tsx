import React from 'react';
import { Eye, FileText, Image, File, Calendar, User, Link as LinkIcon } from 'lucide-react';
import { StandardCard } from '@/components/common/StandardCard';
import { Checkbox } from '@/components/ui/checkbox';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useLanguage } from '@/hooks/use-language';
import { parseDateOnlyLoose } from '@/lib/utils';

export interface DocumentLinkSummary {
  previous?: { id: string; name: string };
  next?: { id: string; name: string };
}

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
  links?: DocumentLinkSummary | null;
  
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
  links,
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
  // Uses parseDateOnlyLoose so date-only fields stored in a Postgres
  // `timestamp` column (notably `documents.effectiveDate`) are rendered for
  // the correct calendar day in negative-offset timezones (e.g.
  // America/Montreal). For real timestamps like `createdAt` we fall back to
  // `new Date(...)` which preserves the time-of-day-aware formatting.
  const formatDate = (dateString?: string, treatAsCalendarDay = false) => {
    if (!dateString) return null;
    if (treatAsCalendarDay) {
      const cd = parseDateOnlyLoose(dateString);
      if (!cd) return null;
      return cd.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
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
  // Prefer effectiveDate over createdAt for display. effectiveDate is a
  // user-chosen calendar day (stored in a `timestamp` column at UTC midnight)
  // so it must be parsed in local time to avoid an off-by-one in negative
  // timezones; createdAt is a real timestamp.
  const displayDate = effectiveDate || createdAt;
  const displayDateIsCalendarDay = !!effectiveDate;

  const metadata = showMetadata ? (
    compact ? [
      fileSize && {
        value: formatFileSize(fileSize) || ''
      },
      displayDate && {
        icon: <Calendar className="w-3 h-3" />,
        value: formatDate(displayDate, displayDateIsCalendarDay) || ''
      }
    ].filter(Boolean) : [
      displayDate && {
        icon: <Calendar className="w-3 h-3" />,
        value: formatDate(displayDate, displayDateIsCalendarDay) || ''
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

  // Linked-document indicator: shown when the document has at least one
  // explicit before/after link. Hovering (or tapping) the badge reveals the
  // names of the previous/next document so users can identify the chain
  // without opening the viewer.
  const hasLinks = !!links && (!!links.previous || !!links.next);
  const linkedBadge = hasLinks ? (
    <div
      className="absolute top-2 left-2 z-10"
      onClick={(e) => e.stopPropagation()}
      data-testid={`document-linked-indicator-${documentId}`}
    >
      <HoverCard openDelay={120} closeDelay={80}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-white/90 dark:bg-gray-800/90 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300 shadow-sm hover:bg-blue-50 dark:hover:bg-blue-950"
            aria-label={t('partOfSequence')}
            title={t('partOfSequence')}
            data-testid={`document-linked-trigger-${documentId}`}
          >
            <LinkIcon className="h-3 w-3" />
            <span>{t('partOfSequence')}</span>
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="w-64 p-3 text-xs"
          data-testid={`document-linked-hover-${documentId}`}
        >
          <div className="space-y-2">
            {links?.previous ? (
              <div>
                <div className="text-muted-foreground uppercase tracking-wide text-[10px]">
                  {t('linkedPrevious')}
                </div>
                <div
                  className="font-medium truncate"
                  data-testid={`document-linked-previous-${documentId}`}
                >
                  {links.previous.name}
                </div>
              </div>
            ) : null}
            {links?.next ? (
              <div>
                <div className="text-muted-foreground uppercase tracking-wide text-[10px]">
                  {t('linkedNext')}
                </div>
                <div
                  className="font-medium truncate"
                  data-testid={`document-linked-next-${documentId}`}
                >
                  {links.next.name}
                </div>
              </div>
            ) : null}
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  ) : null;

  const card = (
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

  if (selectable) {
    return (
      <div className="relative group">
        {card}
        {linkedBadge}
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

  if (linkedBadge) {
    return (
      <div className="relative group">
        {card}
        {linkedBadge}
      </div>
    );
  }

  return card;
}
