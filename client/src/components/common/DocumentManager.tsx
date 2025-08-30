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
/**
 *
 */
interface Document {
  id: string;
  name: string;
  description?: string;
  type: string;
  dateReference?: string;
  buildingId?: string;
  residenceId?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
  isVisibleToTenants?: boolean;
}

// Configuration for different document types
/**
 *
 */
interface DocumentManagerConfig {
  type: 'building' | 'residence';
  userRole: 'manager' | 'resident';
  entityId: string;
  entityName?: string;
  entityAddress?: string;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  showVisibilityToggle?: boolean;
}

// Form schema factory for unified document upload
const createDocumentFormSchema = (type: 'building' | 'residence') => {
  const baseSchema = {
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    description: z.string().optional(),
    documentType: z.enum([
      'bylaw',
      'financial',
      'maintenance',
      'legal',
      'meeting_minutes',
      'insurance',
      'contracts',
      'permits',
      'inspection',
      'lease',
      'communication',
      'photos',
      'other',
    ]),
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

/**
 *
 */
interface EditDocumentFormProps {
  document: Document;
  config: DocumentManagerConfig;
  onSave: (updatedDocument: Document) => void;
  onCancel: () => void;
}

/**
 *
 * @param root0
 * @param root0.document
 * @param root0.config
 * @param root0.onSave
 * @param root0.onCancel
 */
function EditDocumentForm({ document, config, onSave, onCancel }: EditDocumentFormProps) {
  const { toast } = useToast();
  const documentCategories =
    config.type === 'building' ? BUILDING_DOCUMENT_CATEGORIES : RESIDENCE_DOCUMENT_CATEGORIES;
  const schema = createDocumentFormSchema(config.type);

  const editForm = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: document.name,
      description: document.description || '',
      documentType: document.type as any,
      ...(config.type === 'building'
        ? { buildingId: document.buildingId }
        : { residenceId: document.residenceId }),
      isVisibleToTenants: document.isVisibleToTenants ?? false,
    },
  });

  const handleEditSave = async (data: any) => {
    try {
      const response = (await apiRequest('PUT', `/api/documents/${document.id}`, data)) as unknown as Document;
      onSave(response);
      toast({
        title: 'Success',
        description: 'Document updated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update document',
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...editForm}>
      <form onSubmit={editForm.handleSubmit(handleEditSave)} className='space-y-4'>
        <FormField
          control={editForm.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Document Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={editForm.control}
          name='description'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Input placeholder='Enter document description' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={editForm.control}
          name='documentType'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Document Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder='Select document type' />
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
        {config.showVisibilityToggle && (
          <FormField
            control={editForm.control}
            name='isVisibleToTenants'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>Visible to Tenants</FormLabel>
                  <div className='text-sm text-muted-foreground'>
                    Allow tenants to view this document
                  </div>
                </div>
                <FormControl>
                  <input type='checkbox' checked={field.value} onChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        )}
        <DialogFooter>
          <Button type='button' variant='outline' onClick={onCancel}>
            Cancel
          </Button>
          <Button type='submit'>Save Changes</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

/**
 *
 */
interface DocumentManagerProps {
  config: DocumentManagerConfig;
}

/**
 *
 * @param root0
 * @param root0.config
 */
export default function DocumentManager({ config }: DocumentManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // State variables
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [createMode, setCreateMode] = useState<'upload' | 'text'>('upload');
  const [textContent, setTextContent] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isTextEditorOpen, setIsTextEditorOpen] = useState(false);
  const [textEditorDocument, setTextEditorDocument] = useState<Document | null>(null);
  const itemsPerPage = 12;

  // Get document categories and form schema
  const documentCategories =
    config.type === 'building' ? BUILDING_DOCUMENT_CATEGORIES : RESIDENCE_DOCUMENT_CATEGORIES;
  const schema = createDocumentFormSchema(config.type);

  // Form setup
  const form = useForm({
    resolver: zodResolver(schema),
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

  // Fetch entity data (building or residence)
  const { data: entity } = useQuery({
    queryKey: [`/api/${config.type}s`, config.entityId],
    queryFn: () =>
      config.entityId
        ? (apiRequest('GET', `/api/${config.type}s/${config.entityId}`) as Promise<any>)
        : Promise.resolve(null),
    enabled: !!config.entityId,
  });

  // Fetch documents
  const queryKey =
    config.type === 'building'
      ? ['/api/documents', 'building', config.entityId]
      : ['/api/documents', 'residence', config.entityId];

  const queryParam =
    config.type === 'building' ? `buildingId=${config.entityId}` : `residenceId=${config.entityId}`;

  const { data: documentsResponse, isLoading: documentsLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!config.entityId) {
        return { documents: [] };
      }
      return await apiRequest('GET', `/api/documents?${queryParam}`);
    },
    enabled: !!config.entityId,
  });

  // Extract documents array from response
  const documents = Array.isArray(documentsResponse?.documents) ? documentsResponse.documents : [];

  // Calculate available years
  const availableYears = useMemo(() => {
    if (!Array.isArray(documents)) {
      return [];
    }
    const years = documents
      .map((doc: Document) => new Date(doc.dateReference).getFullYear().toString())
      .filter(Boolean);
    return [...new Set(years)].sort((a, b) => b.localeCompare(a));
  }, [documents]);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc: Document) => {
      const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || doc.type === selectedCategory;
      const matchesYear =
        selectedYear === 'all' ||
        new Date(doc.dateReference).getFullYear().toString() === selectedYear;
      return matchesSearch && matchesCategory && matchesYear;
    });
  }, [documents, searchTerm, selectedCategory, selectedYear]);

  // Group documents by category
  const documentsByCategory = useMemo(() => {
    const grouped: Record<string, Document[]> = {};
    documentCategories.forEach((category) => {
      grouped[category._value] = filteredDocuments.filter((doc) => doc.type === category._value);
    });
    return grouped;
  }, [filteredDocuments, documentCategories]);

  // Pagination
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage;
  const endItem = Math.min(startItem + itemsPerPage, filteredDocuments.length);
  const paginatedDocuments = filteredDocuments.slice(startItem, endItem);

  // Mutations
  const createDocumentMutation = useMutation({
    mutationFn: async (data: any) => {
      // Check if file is selected or text content is provided
      if (!selectedFile) {
        if (createMode === 'text') {
          throw new Error('Text content is required');
        } else {
          throw new Error('Please select a file to upload');
        }
      }

      // Create FormData object
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

      // Send POST request to the upload endpoint
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(errorData.message || `Upload failed with status ${response.status}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      // Invalidate all document queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey });
      setIsCreateDialogOpen(false);
      setSelectedFile(null);
      setCreateMode('upload');
      setTextContent('');
      form.reset();
      toast({
        title: 'Success',
        description: 'Document uploaded successfully!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload document',
        variant: 'destructive',
      });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => apiRequest('DELETE', `/api/documents/${documentId}`),
    onSuccess: () => {
      // Invalidate all document queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });
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
    if (createMode === 'text') {
      // Create a text file from content
      if (!textContent.trim()) {
        toast({
          title: 'Error',
          description: 'Please enter some text content',
          variant: 'destructive',
        });
        return;
      }
      
      // Create text file blob
      const blob = new Blob([textContent], { type: 'text/plain' });
      const fileName = `${data.name}.txt`;
      const textFile = new File([blob], fileName, { type: 'text/plain' });
      setSelectedFile(textFile);
      
      // Use the existing upload mutation
      createDocumentMutation.mutate(data);
    } else {
      // Regular file upload or document creation
      createDocumentMutation.mutate(data);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDeleteDocument = (document: Document) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      deleteDocumentMutation.mutate(document.id);
    }
  };

  const isTextFile = (document: Document) => {
    if (document.mimeType) {
      return document.mimeType.startsWith('text/') || document.mimeType === 'application/json';
    }
    if (document.fileName) {
      const ext = document.fileName.toLowerCase().split('.').pop();
      return ['txt', 'text', 'json', 'md', 'csv', 'log'].includes(ext || '');
    }
    return false;
  };

  const handleViewDocument = (document: Document) => {
    if (document.fileUrl) {
      if (isTextFile(document)) {
        setTextEditorDocument(document);
        setIsTextEditorOpen(true);
      } else {
        window.open(getDisplayableFileUrl(document.fileUrl), '_blank');
      }
    }
  };

  const handleDownloadDocument = (document: Document) => {
    if (document.fileUrl) {
      const link = window.document.createElement('a');
      link.href = getDisplayableFileUrl(document.fileUrl);
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
    if (!bytes) {
      return 'Unknown size';
    }
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

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header
        title={`${config.entityName || entity?.name || (config.type === 'residence' ? 'Residence' : 'Building')} Documents`}
        subtitle={`${config.userRole === 'manager' ? 'Manage' : 'View'} documents for ${config.entityName || entity?.name || `this ${config.type}`}${config.entityAddress || entity?.address ? ` - ${config.entityAddress || entity?.address}` : ''}`}
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
                  className='pl-9'
                  data-testid='search-documents'
                />
              </div>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className='w-full sm:w-48' data-testid='filter-category'>
                  <SelectValue placeholder='Filter by category' />
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

              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className='w-full sm:w-32' data-testid='filter-year'>
                  <SelectValue placeholder='Year' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Years</SelectItem>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {config.allowCreate && (
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className='w-full sm:w-auto' data-testid='button-add-document'>
                      <Plus className='h-4 w-4 mr-2' />
                      Add Document
                    </Button>
                  </DialogTrigger>
                  <DialogContent className='max-w-2xl'>
                    <DialogHeader>
                      <DialogTitle>Create New Document</DialogTitle>
                      <DialogDescription>
                        Add a new document to this {config.type}. You can attach a file or create a
                        document entry only.
                      </DialogDescription>
                    </DialogHeader>

                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit(handleCreateDocument)}
                        className='space-y-4'
                      >
                        <FormField
                          control={form.control}
                          name='name'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Document Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder='Enter document name'
                                  {...field}
                                  data-testid='input-document-name'
                                />
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
                                <Input
                                  placeholder='Enter document description'
                                  {...field}
                                  data-testid='input-document-description'
                                />
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
                                    <SelectValue placeholder='Select document category' />
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

                        {/* Creation Mode Selection */}
                        <div className='space-y-3'>
                          <Label>Document Creation Method</Label>
                          <div className='flex gap-4'>
                            <label className='flex items-center space-x-2 cursor-pointer'>
                              <input
                                type='radio'
                                value='upload'
                                checked={createMode === 'upload'}
                                onChange={(e) => setCreateMode(e.target.value as 'upload' | 'text')}
                                data-testid='radio-upload-mode'
                              />
                              <span>Upload File</span>
                            </label>
                            <label className='flex items-center space-x-2 cursor-pointer'>
                              <input
                                type='radio'
                                value='text'
                                checked={createMode === 'text'}
                                onChange={(e) => setCreateMode(e.target.value as 'upload' | 'text')}
                                data-testid='radio-text-mode'
                              />
                              <span>Create Text File</span>
                            </label>
                          </div>
                        </div>

                        {/* File Upload Field */}
                        {createMode === 'upload' && (
                          <div className='space-y-2'>
                            <Label htmlFor='file-upload'>Select File to Upload</Label>
                            <Input
                              id='file-upload'
                              type='file'
                              onChange={handleFileChange}
                              accept='.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.tiff'
                              data-testid='input-file-upload'
                            />
                            {selectedFile && (
                              <div className='text-sm text-gray-600 mt-1'>
                                Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                              </div>
                            )}
                          </div>
                        )}

                        {/* Text Content Field */}
                        {createMode === 'text' && (
                          <div className='space-y-2'>
                            <Label htmlFor='text-content'>Text Content</Label>
                            <textarea
                              id='text-content'
                              value={textContent}
                              onChange={(e) => setTextContent(e.target.value)}
                              placeholder='Enter your text content here...'
                              className='w-full min-h-32 p-3 border border-gray-300 rounded-md font-mono text-sm'
                              data-testid='textarea-text-content'
                            />
                          </div>
                        )}

                        {config.showVisibilityToggle && (
                          <FormField
                            control={form.control}
                            name='isVisibleToTenants'
                            render={({ field }) => (
                              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                                <div className='space-y-0.5'>
                                  <FormLabel className='text-base'>Visible to Tenants</FormLabel>
                                  <div className='text-sm text-muted-foreground'>
                                    Allow tenants to view this document
                                  </div>
                                </div>
                                <FormControl>
                                  <input
                                    type='checkbox'
                                    checked={field.value}
                                    onChange={field.onChange}
                                    data-testid='toggle-tenant-visibility'
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        )}


                        <DialogFooter>
                          <Button
                            type='button'
                            variant='outline'
                            onClick={() => {
                              setIsCreateDialogOpen(false);
                              setSelectedFile(null);
                              setCreateMode('upload');
                              setTextContent('');
                              form.reset();
                            }}
                            disabled={createDocumentMutation.isPending}
                            data-testid='button-cancel-document'
                          >
                            Cancel
                          </Button>
                          <Button
                            type='submit'
                            disabled={createDocumentMutation.isPending}
                            data-testid='button-create-document'
                          >
                            {createDocumentMutation.isPending
                              ? 'Creating...'
                              : createMode === 'text' 
                                ? 'Create Text File' 
                                : 'Upload Document'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Summary */}
            {config.userRole === 'resident' && (
              <div className='text-sm text-gray-600'>
                Showing {startItem + 1}-{endItem} of {filteredDocuments.length} documents
                {selectedCategory !== 'all' &&
                  ` in ${getCategoryLabel(documentCategories, selectedCategory)}`}
                {selectedYear !== 'all' && ` from ${selectedYear}`}
              </div>
            )}
          </div>

          {/* Documents Display */}
          {documentsLoading ? (
            <div className='text-center py-8'>Loading documents...</div>
          ) : (
            <>
              {filteredDocuments.length === 0 ? (
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
                  {/* Category View or Paginated View */}
                  {config.userRole === 'manager' || selectedCategory !== 'all' ? (
                    documentCategories.map((category) => {
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
                                        {document.fileUrl && (
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
                                        {config.allowDelete && (
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
                                      {formatDate(document.dateReference)}
                                    </p>
                                    {document.fileUrl && (
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
                    })
                  ) : (
                    /* Simple List View for Residents */
                    <Card>
                      <CardHeader>
                        <CardTitle className='flex items-center gap-2'>
                          <FileText className='h-5 w-5' />
                          All Documents
                          <Badge variant='secondary'>{filteredDocuments.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                          {paginatedDocuments.map((document) => (
                            <Card
                              key={document.id}
                              className='cursor-pointer hover:shadow-md transition-shadow'
                              data-testid={`document-card-${document.id}`}
                              onClick={() => handleViewDocument(document)}
                            >
                              <CardContent className='p-4'>
                                <div className='flex items-start justify-between mb-2'>
                                  <h4 className='font-medium text-sm truncate flex-1 mr-2'>
                                    {document.name}
                                  </h4>
                                  <div className='flex gap-1'>
                                    {document.fileUrl && (
                                      <>
                                        <Button
                                          size='sm'
                                          variant='ghost'
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewDocument(document);
                                          }}
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
                                        >
                                          <Download className='h-3 w-3' />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <p className='text-xs text-gray-500 mb-2'>
                                  {formatDate(document.dateReference)}
                                </p>
                                {document.fileUrl && (
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
                  )}

                  {/* Pagination for residents */}
                  {config.userRole === 'resident' && totalPages > 1 && (
                    <div className='flex items-center justify-center gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        data-testid='button-previous-page'
                      >
                        <ChevronLeft className='w-4 h-4 mr-1' />
                        Previous
                      </Button>
                      <div className='flex items-center gap-1'>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                          if (pageNum > totalPages) {
                            return null;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={pageNum === currentPage ? 'default' : 'outline'}
                              size='sm'
                              className='w-8 h-8 p-0'
                              onClick={() => setCurrentPage(pageNum)}
                              data-testid={`button-page-${pageNum}`}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        data-testid='button-next-page'
                      >
                        Next
                        <ChevronRight className='w-4 h-4 ml-1' />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Document Dialog */}
      <Dialog
        open={isViewDialogOpen && isEditMode}
        onOpenChange={(open) => {
          setIsViewDialogOpen(open);
          if (!open) {
            setIsEditMode(false);
            setSelectedDocument(null);
          }
        }}
      >
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>Update document information and settings.</DialogDescription>
          </DialogHeader>
          {selectedDocument && (
            <EditDocumentForm
              document={selectedDocument}
              config={config}
              onSave={(updatedDocument) => {
                setSelectedDocument(updatedDocument);
                setIsViewDialogOpen(false);
                setIsEditMode(false);
                queryClient.invalidateQueries({ queryKey });
              }}
              onCancel={() => {
                setIsViewDialogOpen(false);
                setIsEditMode(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Text File Editor */}
      {textEditorDocument && (
        <TextFileEditor
          document={textEditorDocument}
          isOpen={isTextEditorOpen}
          onClose={() => {
            setIsTextEditorOpen(false);
            setTextEditorDocument(null);
          }}
          onSave={(updatedDocument) => {
            queryClient.invalidateQueries({ queryKey });
            setIsTextEditorOpen(false);
            setTextEditorDocument(null);
          }}
          readOnly={!config.allowEdit}
        />
      )}
    </div>
  );
}
