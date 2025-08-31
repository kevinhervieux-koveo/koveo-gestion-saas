import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  gcsPath: string;
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
  const documentCategories = type === 'building' ? BUILDING_DOCUMENT_CATEGORIES : RESIDENCE_DOCUMENT_CATEGORIES;
  const validTypes = documentCategories.map((cat) => cat._value);

  const baseSchema = {
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    description: z.string().optional(),
    documentType: z.enum(validTypes as [string, ...string[]]),
    isVisibleToTenants: z.boolean().default(false),
  };

  if (type === 'building') {
    return z.object({
      ...baseSchema,
      buildingId: z.string().min(1, 'Building ID is required'),
    });
  } else {
    return z.object({
      ...baseSchema,
      residenceId: z.string().min(1, 'Residence ID is required'),
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
  const documentCategories = config.type === 'building' ? BUILDING_DOCUMENT_CATEGORIES : RESIDENCE_DOCUMENT_CATEGORIES;

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
  const queryKey = config.type === 'building' 
    ? [`/api/documents?buildingId=${config.entityId}`]
    : [`/api/documents?residenceId=${config.entityId}`];

  const { data: entity } = useQuery({
    queryKey: config.type === 'building' ? ['/api/manager/buildings', config.entityId] : ['/api/residences', config.entityId],
    enabled: !!config.entityId,
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey,
    enabled: !!config.entityId,
  });

  // Debug: Log what we're getting from the API
  console.log('🔍 DocumentManager DEBUG:', {
    queryKey,
    documents,
    documentsType: typeof documents,
    isArray: Array.isArray(documents),
    length: documents?.length,
    isLoading: documentsLoading,
    entityId: config.entityId
  });


  // Filter and group documents
  const filteredDocuments = useMemo(() => {
    // Ensure documents is an array before filtering
    if (!documents || !Array.isArray(documents)) {
      console.log('🔍 DocumentManager: Documents is not an array:', documents);
      return [];
    }
    
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

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: any) => {
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
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Document uploaded successfully',
      });
      queryClient.invalidateQueries({ queryKey });
      setIsUploadDialogOpen(false);
      form.reset();
      setSelectedFile(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload document',
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });
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
    await uploadMutation.mutateAsync(data);
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
    if (document.gcsPath) {
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
        title={`${config.type === 'building' ? (entity?.name || 'Building') : (entity?.unitNumber || entity?.unit_number ? `Unit ${entity?.unitNumber || entity?.unit_number}` : 'Residence')} Documents`}
        subtitle={`${config.userRole === 'manager' ? 'Manage' : 'View'} documents for ${config.type === 'building' ? (entity?.name || 'this building') : (entity?.unitNumber || entity?.unit_number ? `Unit ${entity?.unitNumber || entity?.unit_number}` : 'this residence')}`}
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
                  <DialogContent className='max-w-md'>
                    <DialogHeader>
                      <DialogTitle>Create New Document</DialogTitle>
                      <DialogDescription>
                        Add a new document to this {config.type}. You can attach a file or create a document entry only.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleCreateDocument)} className='space-y-4'>
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
                              Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                            </p>
                          )}
                        </div>

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

                        <DialogFooter>
                          <Button
                            type='button'
                            variant='outline'
                            onClick={() => setIsUploadDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button type='submit' disabled={uploadMutation.isPending} data-testid='button-create'>
                            {uploadMutation.isPending ? 'Uploading...' : 'Create'}
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
                                  {document.gcsPath && (
                                    <>
                                      <Button
                                        size='sm'
                                        variant='ghost'
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleViewDocument(document);
                                        }}
                                        data-testid={`button-view-${document.id}`}
                                      >
                                        <FileText className='h-3 w-3' />
                                      </Button>
                                      <Button
                                        size='sm'
                                        variant='ghost'
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadDocument(document);
                                        }}
                                        data-testid={`button-download-${document.id}`}
                                      >
                                        <Download className='h-3 w-3' />
                                      </Button>
                                    </>
                                  )}
                                  {(config.allowEdit) && (
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
                                  {(config.allowDelete) && (
                                    <Button
                                      size='sm'
                                      variant='ghost'
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteDocument(document);
                                      }}
                                      className='text-red-600 hover:text-red-700'
                                      data-testid={`button-delete-${document.id}`}
                                    >
                                      <Trash2 className='h-3 w-3' />
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
                              {document.gcsPath && (
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
                  <strong>Date:</strong>{' '}
                  {formatDate(selectedDocument.createdAt)}
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
                    if (selectedDocument.gcsPath) {
                      const fileUrl = `/api/documents/${selectedDocument.id}/file`;
                      window.open(fileUrl, '_blank');
                    }
                  }}
                  disabled={!selectedDocument.gcsPath}
                  data-testid='button-view'
                >
                  <FileText className='w-4 h-4 mr-2' />
                  View
                </Button>
                <Button
                  variant='outline'
                  onClick={() => {
                    if (selectedDocument.gcsPath) {
                      const link = window.document.createElement('a');
                      link.href = `/api/documents/${selectedDocument.id}/file?download=true`;
                      link.download = selectedDocument.fileName || selectedDocument.name;
                      window.document.body.appendChild(link);
                      link.click();
                      window.document.body.removeChild(link);
                    }
                  }}
                  disabled={!selectedDocument.gcsPath}
                  data-testid='button-download'
                >
                  <Download className='w-4 h-4 mr-2' />
                  Download
                </Button>
                {(config.allowEdit) && (
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
                {(config.allowDelete) && (
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
    </div>
  );
}