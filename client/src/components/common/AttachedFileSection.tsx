import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileText, Download } from 'lucide-react';

interface AttachedFileSectionProps {
  // Entity information
  entityType: 'document' | 'bug' | 'feature-request';
  entityId: string;
  
  // File information
  filePath?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  
  // Permissions
  canView?: boolean;
  canDownload?: boolean;
  
  // Optional styling
  className?: string;
  
  // Optional fallback name
  fallbackName?: string;
}

export function AttachedFileSection({
  entityType,
  entityId,
  filePath,
  fileName,
  fileSize,
  canView = true,
  canDownload = true,
  className = '',
  fallbackName = 'Attachment'
}: AttachedFileSectionProps) {
  // Don't render if no file is attached
  if (!filePath) {
    return null;
  }

  // Generate API endpoint based on entity type
  const getApiEndpoint = (download = false) => {
    const downloadParam = download ? '?download=true' : '';
    switch (entityType) {
      case 'document':
        return `/api/documents/${entityId}/file${downloadParam}`;
      case 'bug':
        return `/api/bugs/${entityId}/file${downloadParam}`;
      case 'feature-request':
        return `/api/feature-requests/${entityId}/file${downloadParam}`;
      default:
        return '';
    }
  };

  const handleViewFile = () => {
    if (!canView || !filePath) return;
    const fileUrl = getApiEndpoint(false);
    window.open(fileUrl, '_blank');
  };

  const handleDownloadFile = () => {
    if (!canDownload || !filePath) return;
    const link = window.document.createElement('a');
    link.href = getApiEndpoint(true);
    link.download = fileName || fallbackName;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const displayName = fileName || fallbackName;
  const sizeText = formatFileSize(fileSize);

  return (
    <div className={`border-t pt-4 ${className}`}>
      <Label className="text-sm font-medium">Attached File</Label>
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mt-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">{displayName}</span>
            {sizeText && <span className="text-xs text-gray-500">{sizeText}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {canView && (
            <Button
              type="button"
              onClick={handleViewFile}
              disabled={!filePath}
              data-testid="button-view-file"
            >
              <FileText className="w-4 h-4 mr-2" />
              View
            </Button>
          )}
          {canDownload && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadFile}
              disabled={!filePath}
              data-testid="button-download-file"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}