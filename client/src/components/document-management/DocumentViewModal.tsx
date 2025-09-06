import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Edit, FileText, Calendar, User, Building, MapPin, Eye, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface UserPermissions {
  canDownload: boolean;
  canEdit: boolean;
  canDelete?: boolean;
  canView?: boolean;
}

interface DocumentViewModalProps {
  documentId: string;
  userPermissions: UserPermissions;
  onEditClick: (documentId: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

interface DocumentDetails {
  id: string;
  name: string;
  description?: string;
  documentType: string;
  filePath: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  isVisibleToTenants?: boolean;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
  
  // Optional associated entities
  residenceId?: string;
  buildingId?: string;
  attachedToType?: string;
  attachedToId?: string;
  
  // Populated relations
  uploadedBy?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  residence?: {
    unitNumber?: string;
    address?: string;
  };
  building?: {
    name?: string;
    address?: string;
  };
}

/**
 * DocumentViewModal - A responsive modal to display document details
 * Features role-based permissions and secure API integration
 */
export function DocumentViewModal({
  documentId,
  userPermissions,
  onEditClick,
  isOpen,
  onOpenChange,
  className
}: DocumentViewModalProps) {
  
  // Fetch document details using TanStack Query
  const {
    data: document,
    isLoading,
    error,
    refetch
  } = useQuery<DocumentDetails>({
    queryKey: ['/api/documents', documentId],
    enabled: isOpen && !!documentId,
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Format file size for display
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get document type display name
  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'bylaw': 'Bylaw',
      'financial': 'Financial Document',
      'maintenance': 'Maintenance Record',
      'legal': 'Legal Document',
      'meeting_minutes': 'Meeting Minutes',
      'insurance': 'Insurance Document',
      'contracts': 'Contract',
      'permits': 'Permit',
      'inspection': 'Inspection Report',
      'lease': 'Lease Document',
      'correspondence': 'Correspondence',
      'utilities': 'Utilities Document',
      'other': 'Other Document'
    };
    return labels[type] || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get file type icon and color
  const getFileTypeInfo = (mimeType?: string) => {
    if (!mimeType) return { icon: FileText, color: 'text-gray-500' };
    
    if (mimeType.startsWith('image/')) {
      return { icon: FileText, color: 'text-blue-500' };
    }
    
    switch (mimeType) {
      case 'application/pdf':
        return { icon: FileText, color: 'text-red-500' };
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return { icon: FileText, color: 'text-blue-600' };
      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return { icon: FileText, color: 'text-green-600' };
      default:
        return { icon: FileText, color: 'text-gray-500' };
    }
  };

  // Handle download
  const handleDownload = () => {
    if (!userPermissions.canDownload || !document) return;
    
    const link = window.document.createElement('a');
    link.href = `/api/documents/${document.id}/file?download=true`;
    link.download = document.fileName || document.name;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  // Handle view file (open in new tab)
  const handleViewFile = () => {
    if (!document) return;
    
    const fileUrl = `/api/documents/${document.id}/file`;
    window.open(fileUrl, '_blank');
  };

  // Handle edit
  const handleEdit = () => {
    if (!userPermissions.canEdit) return;
    onEditClick(documentId);
  };

  const fileTypeInfo = getFileTypeInfo(document?.mimeType);
  const FileIcon = fileTypeInfo.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-2xl max-h-[90vh] overflow-y-auto", className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileIcon className={cn("w-5 h-5", fileTypeInfo.color)} />
            <span className="truncate">
              {isLoading ? 'Loading...' : document?.name || 'Document Details'}
            </span>
          </DialogTitle>
          <DialogDescription>
            View document details and manage access permissions
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load document details. Please try again.
              <Button 
                variant="link" 
                className="p-0 h-auto ml-2" 
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {document && !isLoading && !error && (
          <div className="space-y-6">
            {/* Document metadata */}
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {getDocumentTypeLabel(document.documentType)}
                </Badge>
                
                {document.isVisibleToTenants && (
                  <Badge variant="outline" className="border-green-300 text-green-700 dark:border-green-600 dark:text-green-400">
                    👥 Visible to Tenants
                  </Badge>
                )}
                
                <Badge variant="outline" className={fileTypeInfo.color}>
                  {document.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}
                </Badge>
              </div>

              {document.description && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Description
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {document.description}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* File information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">File name:</span>
                  <span className="font-medium">{document.fileName || 'N/A'}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">Created:</span>
                  <span className="font-medium">{formatDate(document.createdAt)}</span>
                </div>
                
                {document.fileSize && (
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">Size:</span>
                    <span className="font-medium">{formatFileSize(document.fileSize)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {document.uploadedBy && (
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">Uploaded by:</span>
                    <span className="font-medium">
                      {document.uploadedBy.firstName && document.uploadedBy.lastName
                        ? `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}`
                        : document.uploadedBy.email || 'Unknown'
                      }
                    </span>
                  </div>
                )}
                
                {document.building && (
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">Building:</span>
                    <span className="font-medium">{document.building.name}</span>
                  </div>
                )}
                
                {document.residence && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">Unit:</span>
                    <span className="font-medium">{document.residence.unitNumber}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button 
                onClick={handleViewFile}
                className="flex-1"
                data-testid="button-view-file"
              >
                <Eye className="w-4 h-4 mr-2" />
                View File
              </Button>
              
              {userPermissions.canDownload && (
                <Button 
                  variant="outline" 
                  onClick={handleDownload}
                  className="flex-1"
                  data-testid="button-download"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              )}
              
              {userPermissions.canEdit && (
                <Button 
                  variant="outline" 
                  onClick={handleEdit}
                  className="flex-1"
                  data-testid="button-edit"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>

            {/* Permission notice for restricted users */}
            {(!userPermissions.canDownload || !userPermissions.canEdit) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Some actions may be restricted based on your role and permissions.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}