import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type DocumentMode = 'file' | 'text';

interface DocumentTypeSelectorProps {
  mode: DocumentMode;
  onModeChange: (mode: DocumentMode) => void;
  onFileSelect?: (file: File | null) => void;
  textContent?: string;
  onTextChange?: (text: string) => void;
  fileInputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  textAreaProps?: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
  showFileInput?: boolean;
  showTextArea?: boolean;
  className?: string;
}

export function DocumentTypeSelector({
  mode,
  onModeChange,
  onFileSelect,
  textContent = '',
  onTextChange,
  fileInputProps = {},
  textAreaProps = {},
  showFileInput = true,
  showTextArea = true,
  className = ''
}: DocumentTypeSelectorProps) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    onFileSelect?.(file);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-base font-medium text-gray-900">Choose Document Type</h3>
      
      {/* Document Type Selection */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => onModeChange('file')}
          className={`flex-1 px-6 py-3 rounded-full border-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            mode === 'file'
              ? 'border-blue-500 bg-blue-50 text-blue-600'
              : 'border-gray-300 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
          }`}
          data-testid="button-upload-file"
        >
          📁 Upload File
        </button>
        <button
          type="button"
          onClick={() => onModeChange('text')}
          className={`flex-1 px-6 py-3 rounded-full border-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            mode === 'text'
              ? 'border-blue-500 bg-blue-50 text-blue-600'
              : 'border-gray-300 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
          }`}
          data-testid="button-text-document"
        >
          📄 Text Document
        </button>
      </div>

      {/* Dynamic Content Based on Selection */}
      {mode === 'file' && showFileInput && (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-gray-700">Select File to Upload</Label>
          <Input
            type="file"
            onChange={handleFileChange}
            className="cursor-pointer"
            data-testid="input-file-select"
            {...fileInputProps}
          />
        </div>
      )}

      {mode === 'text' && showTextArea && (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-gray-700">Document Content</Label>
          <textarea
            value={textContent}
            onChange={(e) => onTextChange?.(e.target.value)}
            rows={6}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-vertical"
            placeholder="Enter your document content..."
            data-testid="textarea-document-content"
            {...textAreaProps}
          />
          <p className="text-xs text-gray-500">
            Add text content that will be saved as a document.
          </p>
        </div>
      )}
    </div>
  );
}

export default DocumentTypeSelector;