import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SharedUploader } from '@/components/document-management';
import { FileText, X } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import type { UploadContext } from '@shared/config/upload-config';

export interface PendingFile {
  id: string;
  file: File;
  name: string;
}

interface DocumentAttachmentSectionProps {
  pendingFiles: PendingFile[];
  onFileAdd: (file: File) => void;
  onFileRemove: (fileId: string) => void;
  uploadContext: UploadContext;
  formType?: string;
  title?: string;
  aiAnalysisEnabled?: boolean;
  showAiToggle?: boolean;
  allowedFileTypes?: string[];
  maxFileSize?: number;
  className?: string;
}

export function DocumentAttachmentSection({
  pendingFiles,
  onFileAdd,
  onFileRemove,
  uploadContext,
  formType = 'bills',
  title,
  aiAnalysisEnabled = false,
  showAiToggle = false,
  allowedFileTypes = ['image/*', 'application/pdf'],
  maxFileSize = 25,
  className = '',
}: DocumentAttachmentSectionProps) {
  const { language } = useLanguage();

  const displayTitle = title ?? (language === 'fr' ? 'Ajouter un document' : 'Add Document');

  const handleDocumentChange = (file: File | null, _text: string | null) => {
    if (file) {
      onFileAdd(file);
    }
  };

  return (
    <div className={`border-t pt-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{displayTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <SharedUploader
            onDocumentChange={handleDocumentChange}
            formType={formType}
            uploadContext={uploadContext}
            aiAnalysisEnabled={aiAnalysisEnabled}
            showAiToggle={showAiToggle}
            allowedFileTypes={allowedFileTypes}
            maxFileSize={maxFileSize}
          />
        </CardContent>
      </Card>

      {pendingFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {language === 'fr' ? 'Fichiers à joindre' : 'Files to attach'} ({pendingFiles.length})
          </h4>
          <div className="grid gap-2">
            {pendingFiles.map((pendingFile) => (
              <div
                key={pendingFile.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p
                      className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm"
                      title={pendingFile.name}
                    >
                      {pendingFile.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(pendingFile.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onFileRemove(pendingFile.id)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                  data-testid={`button-remove-file-${pendingFile.id}`}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
