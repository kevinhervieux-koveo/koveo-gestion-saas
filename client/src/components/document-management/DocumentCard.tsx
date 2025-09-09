import React from 'react';
import { Eye, FileText, Image, File, Calendar, User } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StandardCard } from '@/components/ui/standard-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

  // Handle card click - entire card is clickable for mobile friendliness
  const handleCardClick = () => {
    onViewClick(documentId);
  };

  // Handle view button click (prevent event bubbling)
  const handleViewButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewClick(documentId);
  };

  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700",
        "active:scale-[0.98] transform", // Touch feedback
        compact ? "p-3" : "",
        className
      )}
      onClick={handleCardClick}
      data-testid={`document-card-${documentId}`}
    >
      <CardHeader className={cn("flex flex-row items-start justify-between space-y-0", compact ? "pb-2" : "pb-3")}>
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          {/* Document icon */}
          <div className="flex-shrink-0 mt-1">
            {getDocumentIcon()}
          </div>
          
          {/* Document info */}
          <div className="flex-1 min-w-0">
            <CardTitle className={cn(
              "text-left leading-tight break-words",
              compact ? "text-sm" : "text-base"
            )}>
              {title}
            </CardTitle>
            
            {description && !compact && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* View button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleViewButtonClick}
          className="flex-shrink-0 ml-2 min-h-[36px] min-w-[36px] hover:bg-blue-50 dark:hover:bg-blue-950"
          data-testid={`view-document-${documentId}`}
        >
          <Eye className="w-4 h-4" />
          <span className="sr-only">View document</span>
        </Button>
      </CardHeader>

      {showMetadata && !compact && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {/* Document type and visibility badges */}
            <div className="flex flex-wrap gap-2">
              {documentType && (
                <Badge variant="secondary" className={cn("text-xs", getTypeColor(documentType))}>
                  {documentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              )}
              
              {isVisibleToTenants && (
                <Badge variant="outline" className="text-xs border-green-300 text-green-700 dark:border-green-600 dark:text-green-400">
                  👥 Visible to Tenants
                </Badge>
              )}
            </div>

            {/* Metadata row */}
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-4">
                {createdAt && (
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(createdAt)}</span>
                  </div>
                )}
                
                {uploadedBy && (
                  <div className="flex items-center space-x-1">
                    <User className="w-3 h-3" />
                    <span className="truncate max-w-20">{uploadedBy}</span>
                  </div>
                )}
              </div>
              
              {fileSize && (
                <span className="text-gray-400 dark:text-gray-500">
                  {formatFileSize(fileSize)}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      )}

      {/* Compact metadata for compact mode */}
      {showMetadata && compact && (
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              {documentType && (
                <Badge variant="secondary" className="text-xs">
                  {documentType}
                </Badge>
              )}
              {createdAt && <span>{formatDate(createdAt)}</span>}
            </div>
            {fileSize && <span>{formatFileSize(fileSize)}</span>}
          </div>
        </CardContent>
      )}
    </Card>
  );
}