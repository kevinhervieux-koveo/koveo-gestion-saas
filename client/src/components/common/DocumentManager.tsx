import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import type { Building as BuildingType, Residence } from '@shared/schemas/property';
import {
  Upload,
  Download,
  Edit,
  Trash2,
  FileText,
  Search,
  Plus,
  Building,
  Calendar,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { useLocation } from 'wouter';

import {
  getDisplayableFileUrl,
  BUILDING_DOCUMENT_CATEGORIES,
  RESIDENCE_DOCUMENT_CATEGORIES,
  getCategoryLabel,
} from '@/lib/documents';
import TextFileEditor from './TextFileEditor';

// Common document interface
interface Document {
  id: string;
  name: string;
  description?: string;
  documentType: string;
  dateReference?: string;
  buildingId?: string;
  residenceId?: string;
  filePath: string;
  fileName?: string;
  fileSize?: number;
  isVisibleToTenants?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DocumentManagerConfig {
  type: 'building' | 'residence';
  entityId: string;
  entityName?: string;
  entityAddress?: string;
  userRole: 'manager' | 'resident';
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  allowUpload?: boolean;
  showVisibilityToggle?: boolean;
}

const createDocumentSchema = (type: 'building' | 'residence') => {
  const documentCategories =
    type === 'building' ? BUILDING_DOCUMENT_CATEGORIES : RESIDENCE_DOCUMENT_CATEGORIES;
  const validTypes = documentCategories.map((cat) => cat._value);

  const baseSchema = {
    name: z.string().min(1, 'Document name is required (example: Monthly Meeting Minutes - January 2025)').max(255, 'Document name must be less than 255 characters'),
    description: z.string().max(500, 'Description must be less than 500 characters').optional(),
    documentType: z.enum(validTypes as [string, ...string[]]),
    isVisibleToTenants: z.boolean().default(false),
  };

  if (type === 'building') {
    return z.object({
      ...baseSchema,
      buildingId: z.string().min(1, 'Building selection is required'),
    });
  } else {
    return z.object({
      ...baseSchema,
      residenceId: z.string().min(1, 'Residence selection is required'),
    });
  }
};

export default function DocumentManager({ config }: { config: DocumentManagerConfig }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // State management
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'file' | 'text'>('file');
  const [textContent, setTextContent] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isTextEditorOpen, setIsTextEditorOpen] = useState(false);
  const [textEditorDocument, setTextEditorDocument] = useState<Document | null>(null);

  const itemsPerPage = 12;
  const documentSchema = createDocumentSchema(config.type);
  const documentCategories =
    config.type === 'building' ? BUILDING_DOCUMENT_CATEGORIES : RESIDENCE_DOCUMENT_CATEGORIES;

  // Form setup
  const form = useForm({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      name: '',
      description: '',
      documentType: 'other',
      ...(config.type === 'building'
        ? { buildingId: config.entityId }
        : { residenceId: config.entityId }),
      isVisibleToTenants: false,
    },
  });

  // API queries and mutations
  const queryKey =
    config.type === 'building'
      ? [`/api/documents?buildingId=${config.entityId}`]
      : [`/api/documents?residenceId=${config.entityId}`];

  const { data: entity } = useQuery<BuildingType | Residence>({
    queryKey:
      config.type === 'building'
        ? ['/api/manager/buildings', config.entityId]
        : ['/api/residences', config.entityId],
    enabled: !!config.entityId,
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey,
    enabled: !!config.entityId,
    queryFn: async () => {
      const response = await fetch(queryKey[0], {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      // The API returns {documents: Array, total: number, ...} but we need just the documents array
      return data.documents || [];
    },
  });

  // Filter and group documents
  const filteredDocuments = useMemo(() => {
    const filtered = documents.filter((doc: Document) => {
      const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || doc.documentType === selectedCategory;
      const matchesYear =
        selectedYear === 'all' || new Date(doc.createdAt).getFullYear().toString() === selectedYear;
      return matchesSearch && matchesCategory && matchesYear;
    });
    return filtered;
  }, [documents, searchTerm, selectedCategory, selectedYear]);

  const documentsByCategory = useMemo(() => {
    const grouped: Record<string, Document[]> = {};
    documentCategories.forEach((category) => {
      grouped[category._value] = filteredDocuments.filter(
        (doc) => doc.documentType === category._value
      );
    });
    return grouped;
  }, [filteredDocuments, documentCategories]);

  // Create mutation (supports both file upload and text-only)
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (createMode === 'file') {
        if (!selectedFile) {
          throw new Error('No file selected');
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('name', data.name);
        formData.append('description', data.description || '');
        formData.append('documentType', data.documentType);
        formData.append('isVisibleToTenants', data.isVisibleToTenants.toString());

        if (data.residenceId) {
          formData.append('residenceId', data.residenceId);
        }
        if (data.buildingId) {
          formData.append('buildingId', data.buildingId);
        }

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Internal server error');
        }

        return response.json();
      } else {
        // Text-only document creation
        const payload = {
          name: data.name,
          description: data.description || '',
          documentType: data.documentType,
          isVisibleToTenants: data.isVisibleToTenants,
          textContent: textContent,
          ...( data.residenceId ? { residenceId: data.residenceId } : {}),
          ...( data.buildingId ? { buildingId: data.buildingId } : {}),
        };

        return apiRequest('POST', '/api/documents', payload);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: createMode === 'file' ? 'Document uploaded successfully' : 'Document created successfully',
      });
      queryClient.invalidateQueries({ queryKey });
      setIsUploadDialogOpen(false);
      form.reset();
      setSelectedFile(null);
      setTextContent('');
      setCreateMode('file');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || (createMode === 'file' ? 'Failed to upload document' : 'Failed to create document'),
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest('DELETE', `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete document',
        variant: 'destructive',
      });
    },
  });

  // Event handlers
  const handleCreateDocument = async (data: any) => {
    await createMutation.mutateAsync(data);
  };

  const handleDeleteDocument = async (document: Document) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      await deleteMutation.mutateAsync(document.id);
    }
  };

  const handleViewDocument = (document: Document) => {
    setSelectedDocument(document);
    setIsViewDialogOpen(true);
  };

  const handleDownloadDocument = (document: Document) => {
    if (document.filePath) {
      const link = window.document.createElement('a');
      link.href = `/api/documents/${document.id}/file?download=true`;
      link.download = document.fileName || document.name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (!config.entityId) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header
          title={`${config.type === 'building' ? 'Building' : 'Residence'} Documents`}
          subtitle='Entity ID is required'
        />
        <div className='flex-1 overflow-auto p-6'>
          <Card>
            <CardContent className='flex flex-col items-center justify-center py-12'>
              <Building className='h-12 w-12 text-gray-400 mb-4' />
              <h3 className='text-lg font-medium text-gray-900 mb-2'>
                {config.type === 'building' ? 'Building' : 'Residence'} ID Required
              </h3>
              <p className='text-gray-500'>Please provide a {config.type} ID to view documents.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const entityNotFound = config.entityId && !entity && !documentsLoading;

  if (entityNotFound) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header
          title={`${config.type === 'building' ? 'Building' : 'Residence'} Not Found`}
          subtitle={`The ${config.type} ID provided does not exist`}
        />
        <div className='flex-1 overflow-auto p-6'>
          <Card>
            <CardContent className='flex flex-col items-center justify-center py-12'>
              <Building className='h-12 w-12 text-gray-400 mb-4' />
              <h3 className='text-lg font-medium text-gray-900 mb-2'>
                {config.type === 'building' ? 'Building' : 'Residence'} Not Found
              </h3>
              <p className='text-gray-500'>
                The {config.type} with ID "{config.entityId}" does not exist or you don't have
                access to it.
              </p>
              <Button
                variant='outline'
                className='mt-4'
                onClick={() => navigate(`/${config.userRole}s/${config.type}s`)}
              >
                Back to {config.type === 'building' ? 'Buildings' : 'Residences'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header
        title={`${config.type === 'building' ? (entity as BuildingType)?.name || 'Building' : (entity as Residence)?.unitNumber ? `Unit ${(entity as Residence).unitNumber}` : 'Residence'} Documents`}
        subtitle={`${config.userRole === 'manager' ? 'Manage' : 'View'} documents for ${config.type === 'building' ? (entity as BuildingType)?.name || 'this building' : (entity as Residence)?.unitNumber ? `Unit ${(entity as Residence).unitNumber}` : 'this residence'}`}
      />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto'>
          {/* Back Button for residents */}
          {config.userRole === 'resident' && (
            <div className='mb-6'>
              <Button
                variant='ghost'
                onClick={() => navigate(`/${config.userRole}s/${config.type}s`)}
                className='flex items-center gap-2'
              >
                <ArrowLeft className='w-4 h-4' />
                Back to {config.type === 'building' ? 'Building' : 'Residence'}
              </Button>
            </div>
          )}

          {/* Search and Filter Controls */}
          <div className='mb-6'>
            <div className='flex flex-col sm:flex-row gap-4 mb-4'>
              <div className='relative flex-1'>
                <Search className='absolute left-3 top-3 h-4 w-4 text-gray-400' />
                <Input
                  placeholder='Search documents...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='pl-10'
                  data-testid='input-search'
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className='w-full sm:w-48' data-testid='select-category'>
                  <SelectValue placeholder='All Categories' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Categories</SelectItem>
                  {documentCategories.map((category) => (
                    <SelectItem key={category._value} value={category._value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Upload Button */}
            {(config.allowUpload || config.allowCreate) && (
              <div className='flex justify-between items-center'>
                <div></div>
                <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid='button-upload'>
                      <Plus className='w-4 h-4 mr-2' />
                      Upload Document
                    </Button>
                  </DialogTrigger>
                  <DialogContent className='max-w-md max-h-[90vh] overflow-y-auto'>
                    <DialogHeader>
                      <DialogTitle>Create New Document</DialogTitle>
                      <DialogDescription>
                        Add a new document to this {config.type}. You can attach a file or create a
                        text-only document entry.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit(handleCreateDocument)}
                        className='space-y-6'
                      >
                        {/* TOP SECTION: Manual Input Fields */}
                        <div className='space-y-4'>
                          <FormField
                            control={form.control}
                            name='name'
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Document Name</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid='input-document-name' />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name='description'
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid='input-description' />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name='documentType'
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Document Category</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid='select-document-type'>
                                      <SelectValue placeholder='Select category' />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {documentCategories.map((category) => (
                                      <SelectItem key={category._value} value={category._value}>
                                        {category.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Visibility Toggle */}
                          {config.showVisibilityToggle && (
                            <FormField
                              control={form.control}
                              name='isVisibleToTenants'
                              render={({ field }) => (
                                <FormItem className='flex flex-row items-center space-x-3 space-y-0'>
                                  <FormControl>
                                    <input
                                      type='checkbox'
                                      checked={field.value}
                                      onChange={(e) => field.onChange(e.target.checked)}
                                      data-testid='checkbox-visible-tenants'
                                    />
                                  </FormControl>
                                  <div className='space-y-1 leading-none'>
                                    <FormLabel>Visible to Tenants</FormLabel>
                                    <p className='text-sm text-muted-foreground'>
                                      Allow tenants to view this document
                                    </p>
                                  </div>
                                </FormItem>
                              )}
                            />
                          )}
                        </div>

                        {/* BOTTOM SECTION: Upload Method Selection */}
                        <div className='space-y-4 border-t pt-4'>
                          <Label className='text-sm font-medium'>Choose Document Type</Label>
                          <div className='flex space-x-3'>
                            <button
                              type='button'
                              onClick={() => setCreateMode('file')}
                              className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                                createMode === 'file'
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              data-testid='button-file-mode'
                            >
                              📁 Upload File
                            </button>
                            <button
                              type='button'
                              onClick={() => setCreateMode('text')}
                              className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                                createMode === 'text'
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              data-testid='button-text-mode'
                            >
                              📝 Text Document
                            </button>
                          </div>

                          {/* Dynamic Content Based on Selection */}
                          {createMode === 'file' ? (
                            <div>
                              <Label htmlFor='file-upload'>Select File to Upload</Label>
                              <Input
                                id='file-upload'
                                type='file'
                                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                className='mt-1'
                                data-testid='input-file'
                              />
                              {selectedFile && (
                                <p className='text-sm text-gray-500 mt-1'>
                                  Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)}{' '}
                                  KB)
                                </p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <Label htmlFor='text-content'>Document Content</Label>
                              <Textarea
                                id='text-content'
                                value={textContent}
                                onChange={(e) => setTextContent(e.target.value)}
                                placeholder='Enter the document content here...'
                                className='mt-1 min-h-[120px]'
                                data-testid='textarea-content'
                              />
                              <p className='text-sm text-gray-500 mt-1'>
                                This will create a text document that can be viewed and edited online.
                              </p>
                            </div>
                          )}
                        </div>

                        <DialogFooter>
                          <Button
                            type='button'
                            variant='outline'
                            onClick={() => setIsUploadDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type='submit'
                            disabled={createMutation.isPending || (createMode === 'file' && !selectedFile) || (createMode === 'text' && !textContent.trim())}
                            data-testid='button-create'
                          >
                            {createMutation.isPending 
                              ? (createMode === 'file' ? 'Uploading...' : 'Creating...') 
                              : 'Create'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>

          {/* Documents Display - Always grouped by category */}
          {documentsLoading ? (
            <div className='text-center py-8'>Loading documents...</div>
          ) : filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className='p-8 text-center'>
                <FileText className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>No Documents Found</h3>
                <p className='text-gray-500'>
                  {searchTerm || selectedCategory !== 'all' || selectedYear !== 'all'
                    ? 'No documents match your current filters.'
                    : `No documents are available for this ${config.type}.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className='space-y-6'>
              {/* Category View - Always show documents grouped by category */}
              {documentCategories.map((category) => {
                const categoryDocuments = documentsByCategory[category._value] || [];
                if (categoryDocuments.length === 0) {
                  return null;
                }

                return (
                  <Card key={category._value} data-testid={`category-${category._value}`}>
                    <CardHeader>
                      <CardTitle className='flex items-center gap-2'>
                        <FileText className='h-5 w-5' />
                        {category.label}
                        <Badge variant='secondary'>{categoryDocuments.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                        {categoryDocuments.map((document) => (
                          <Card
                            key={document.id}
                            className='cursor-pointer hover:shadow-md transition-shadow'
                            data-testid={`document-card-${document.id}`}
                            onClick={() => handleViewDocument(document)}
                          >
                            <CardContent className='p-4'>
                              <div className='flex items-start justify-between mb-2'>
                                <h4
                                  className='font-medium text-sm truncate flex-1 mr-2'
                                  data-testid={`document-name-${document.id}`}
                                >
                                  {document.name}
                                </h4>
                                <div className='flex gap-1'>
                                  {config.allowEdit && (
                                    <Button
                                      size='sm'
                                      variant='ghost'
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDocument(document);
                                        setIsEditMode(true);
                                        setIsViewDialogOpen(true);
                                      }}
                                      data-testid={`button-edit-${document.id}`}
                                    >
                                      <Edit className='h-3 w-3' />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <p
                                className='text-xs text-gray-500 mb-2'
                                data-testid={`document-date-${document.id}`}
                              >
                                {formatDate(document.createdAt)}
                              </p>
                              {document.filePath && (
                                <Badge variant='outline' className='text-xs'>
                                  {formatFileSize(document.fileSize)}
                                </Badge>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* View Document Dialog */}
      <Dialog
        open={isViewDialogOpen && !isEditMode}
        onOpenChange={(open) => {
          setIsViewDialogOpen(open);
          if (!open) {
            setSelectedDocument(null);
          }
        }}
      >
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
            <DialogDescription>View document information and access options.</DialogDescription>
          </DialogHeader>
          {selectedDocument && (
            <div className='space-y-4'>
              <div>
                <h3 className='text-lg font-semibold'>{selectedDocument.name}</h3>
                {selectedDocument.description && (
                  <p className='text-gray-600 mt-2'>{selectedDocument.description}</p>
                )}
              </div>

              <div className='grid grid-cols-2 gap-4 text-sm'>
                <div>
                  <strong>Category:</strong>{' '}
                  {getCategoryLabel(documentCategories, selectedDocument.documentType) ||
                    selectedDocument.documentType ||
                    'Unknown'}
                </div>
                <div>
                  <strong>Date:</strong> {formatDate(selectedDocument.createdAt)}
                </div>
                {selectedDocument.fileSize && (
                  <div>
                    <strong>Size:</strong> {formatFileSize(selectedDocument.fileSize)}
                  </div>
                )}
                {selectedDocument.fileName && (
                  <div>
                    <strong>File:</strong> {selectedDocument.fileName}
                  </div>
                )}
              </div>

              <div className='flex gap-2 pt-4'>
                <Button
                  onClick={() => {
                    if (selectedDocument.filePath) {
                      const fileUrl = `/api/documents/${selectedDocument.id}/file`;
                      window.open(fileUrl, '_blank');
                    }
                  }}
                  disabled={!selectedDocument.filePath}
                  data-testid='button-view'
                >
                  <FileText className='w-4 h-4 mr-2' />
                  View
                </Button>
                <Button
                  variant='outline'
                  onClick={() => {
                    if (selectedDocument.filePath) {
                      const link = window.document.createElement('a');
                      link.href = `/api/documents/${selectedDocument.id}/file?download=true`;
                      link.download = selectedDocument.fileName || selectedDocument.name;
                      window.document.body.appendChild(link);
                      link.click();
                      window.document.body.removeChild(link);
                    }
                  }}
                  disabled={!selectedDocument.filePath}
                  data-testid='button-download'
                >
                  <Download className='w-4 h-4 mr-2' />
                  Download
                </Button>
                {config.allowEdit && (
                  <Button
                    variant='outline'
                    onClick={() => {
                      setIsEditMode(true);
                    }}
                  >
                    <Edit className='w-4 h-4 mr-2' />
                    Edit
                  </Button>
                )}
                {config.allowDelete && (
                  <Button
                    variant='outline'
                    onClick={() => {
                      handleDeleteDocument(selectedDocument);
                      setIsViewDialogOpen(false);
                    }}
                    className='text-red-600 hover:text-red-700'
                  >
                    <Trash2 className='w-4 h-4 mr-2' />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Document Dialog */}
      <Dialog
        open={isViewDialogOpen && isEditMode}
        onOpenChange={(open) => {
          setIsViewDialogOpen(open);
          if (!open) {
            setSelectedDocument(null);
            setIsEditMode(false);
          }
        }}
      >
        <DialogContent className='max-w-md max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Update the document information. Note: File content cannot be changed, only metadata.
            </DialogDescription>
          </DialogHeader>
          {selectedDocument && (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(async (data) => {
                  try {
                    const response = await apiRequest('PUT', `/api/documents/${selectedDocument.id}`, data);
                    toast({
                      title: 'Success',
                      description: 'Document updated successfully',
                    });
                    queryClient.invalidateQueries({ queryKey });
                    setIsViewDialogOpen(false);
                    setIsEditMode(false);
                    setSelectedDocument(null);
                  } catch (error: any) {
                    toast({
                      title: 'Error',
                      description: error.message || 'Failed to update document',
                      variant: 'destructive',
                    });
                  }
                })}
                className='space-y-4'
              >
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Name</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || selectedDocument.name} data-testid='input-edit-name' />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='description'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || selectedDocument.description || ''} data-testid='input-edit-description' />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='documentType'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || selectedDocument.documentType}>
                        <FormControl>
                          <SelectTrigger data-testid='select-edit-type'>
                            <SelectValue placeholder='Select category' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {documentCategories.map((category) => (
                            <SelectItem key={category._value} value={category._value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='isVisibleToTenants'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center space-x-3 space-y-0'>
                      <FormControl>
                        <input
                          type='checkbox'
                          checked={field.value !== undefined ? field.value : selectedDocument.isVisibleToTenants}
                          onChange={(e) => field.onChange(e.target.checked)}
                          data-testid='checkbox-edit-visible-tenants'
                        />
                      </FormControl>
                      <div className='space-y-1 leading-none'>
                        <FormLabel>Visible to Tenants</FormLabel>
                        <p className='text-sm text-muted-foreground'>
                          Allow tenants to view this document
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => {
                      setIsEditMode(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type='submit' data-testid='button-save-edit'>
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
