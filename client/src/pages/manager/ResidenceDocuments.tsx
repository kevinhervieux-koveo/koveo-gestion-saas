import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ObjectUploader } from '@/components/ObjectUploader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Filter,
  Eye,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import type { UploadResult } from '@uppy/core';

import {
  getDisplayableFileUrl,
  RESIDENCE_DOCUMENT_CATEGORIES as DOCUMENT_CATEGORIES,
  documentApi,
  getCategoryLabel,
  createUploadHandler,
} from '@/lib/documents';
import { useDeleteMutation, useCreateUpdateMutation, useFormState } from '@/lib/common-hooks';

// Form schema for creating/editing residence documents
const documentFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  type: z.enum([
    'lease',
    'inspection',
    'maintenance',
    'legal',
    'insurance',
    'financial',
    'communication',
    'photos',
    'other',
  ]),
  dateReference: z.string().refine(
    (dateStr) => {
      const date = new Date(dateStr);
      return !isNaN(date.getTime());
    },
    {
      message: 'Valid date is required',
    }
  ),
  residenceId: z.string().min(1, 'Residence ID is required'),
});

/**
 *
 */
type DocumentFormData = z.infer<typeof documentFormSchema>;

/**
 *
 */
interface ResidenceDocument {
  id: string;
  name: string;
  type: string;
  dateReference: string;
  residenceId: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 *
 */
interface EditDocumentFormProps {
  document: ResidenceDocument;
  onSave: (updatedDocument: ResidenceDocument) => void;
  onCancel: () => void;
}

/**
 *
 * @param root0
 * @param root0.document
 * @param root0.onSave
 * @param root0.onCancel
 */
function EditDocumentForm({ document, onSave, onCancel }: EditDocumentFormProps) {
  const { toast } = useToast();

  const editForm = useForm<DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      name: document.name,
      type: document.type as any,
      dateReference: document.dateReference.split('T')[0],
      residenceId: document.residenceId,
    },
  });

  const handleEditSave = async (data: DocumentFormData) => {
    try {
      const response = await apiRequest('PUT', `/api/documents/${document.id}`, {
        ...data,
        dateReference: new Date(data.dateReference).toISOString(),
      });
      onSave(response as any);
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
          name='type'
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
                  {DOCUMENT_CATEGORIES.map((category) => (
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
          control={editForm.control}
          name='dateReference'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reference Date</FormLabel>
              <FormControl>
                <Input type='date' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
interface ResidenceDocumentsProps {
  residenceId?: string;
}

/**
 *
 * @param root0
 * @param root0.residenceId
 */
export default function ResidenceDocuments({ residenceId }: ResidenceDocumentsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State variables
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ResidenceDocument | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [isUploadingNewFile, setIsUploadingNewFile] = useState(false);

  // Form setup
  const form = useForm<DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      name: '',
      type: 'other',
      dateReference: new Date().toISOString().split('T')[0],
      residenceId: residenceId || '',
    },
  });

  // Fetch residence data
  const { data: residence } = useQuery({
    queryKey: ['/api/residences', residenceId],
    queryFn: () =>
      residenceId
        ? (apiRequest('GET', `/api/residences/${residenceId}`) as Promise<any>)
        : Promise.resolve(null),
    enabled: !!residenceId,
  });

  // Fetch building data for residence
  const { data: building } = useQuery({
    queryKey: ['/api/buildings', residence?.buildingId],
    queryFn: () =>
      residence?.buildingId
        ? (apiRequest('GET', `/api/buildings/${residence.buildingId}`) as Promise<any>)
        : Promise.resolve(null),
    enabled: !!residence?.buildingId,
  });

  // Fetch documents
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['/api/documents', 'residence', residenceId],
    queryFn: async () => {
      if (!residenceId) {
        return [];
      }
      const response = await apiRequest('GET', `/api/documents?residenceId=${residenceId}`);
      return response as ResidenceDocument[];
    },
    enabled: !!residenceId,
  });

  // Calculate available years
  const availableYears = useMemo(() => {
    const years = documents
      .map((doc: ResidenceDocument) => new Date(doc.dateReference).getFullYear().toString())
      .filter(Boolean);
    return [...new Set(years)].sort((a, b) => b.localeCompare(a));
  }, [documents]);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc: ResidenceDocument) => {
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
    const grouped: Record<string, ResidenceDocument[]> = {};
    DOCUMENT_CATEGORIES.forEach((category) => {
      grouped[category._value] = filteredDocuments.filter((doc) => doc.type === category._value);
    });
    return grouped;
  }, [filteredDocuments]);

  // Mutations
  const createDocumentMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => {
      const documentData: any = {
        ...data,
        dateReference: new Date(data.dateReference).toISOString(),
      };

      if (uploadedFile) {
        documentData.fileUrl = uploadedFile.fileUrl;
        documentData.fileName = uploadedFile.fileName;
        documentData.fileSize = uploadedFile.fileSize.toString();
        documentData.mimeType = uploadedFile.mimeType;
      }

      return apiRequest('POST', '/api/documents', documentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents', 'residence', residenceId] });
      setIsCreateDialogOpen(false);
      setUploadedFile(null);
      form.reset();
      toast({
        title: 'Success',
        description: uploadedFile
          ? 'Document and file uploaded successfully!'
          : 'Document created successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create document',
        variant: 'destructive',
      });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => apiRequest('DELETE', `/api/documents/${documentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents', 'residence', residenceId] });
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
  const handleCreateDocument = async (data: DocumentFormData) => {
    createDocumentMutation.mutate(data);
  };

  const handleNewDocumentUpload = async () => {
    if (!building || !residence) {
      return null;
    }

    const response = await fetch('/api/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        organizationId: building.organizationId,
        residenceId: residence.id,
        documentType: 'residence',
      }),
    });

    if (!response.ok) {
      setIsUploadingNewFile(false);
      throw new Error('Failed to get upload URL');
    }

    const data = await response.json();
    return { method: 'PUT' as const, url: data.uploadURL };
  };

  const handleNewDocumentUploadComplete = (result: UploadResult<any, any>) => {
    setIsUploadingNewFile(false);

    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      setUploadedFile({
        fileUrl: uploadedFile.uploadURL,
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size || 0,
        mimeType: uploadedFile.type || 'application/octet-stream',
      });
      toast({
        title: 'File ready',
        description: 'File uploaded! Now create the document to save it.',
      });
    }
  };

  const handleDeleteDocument = (document: ResidenceDocument) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      deleteDocumentMutation.mutate(document.id);
    }
  };

  if (!residenceId) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='Residence Documents' subtitle='Residence ID is required' />
        <div className='flex-1 overflow-auto p-6'>
          <Card>
            <CardContent className='flex flex-col items-center justify-center py-12'>
              <Building className='h-12 w-12 text-gray-400 mb-4' />
              <h3 className='text-lg font-medium text-gray-900 mb-2'>Residence ID Required</h3>
              <p className='text-gray-500'>Please provide a residence ID to view documents.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header
        title={`${residence?.unitNumber || 'Residence'} Documents`}
        subtitle={`Manage documents for ${residence?.unitNumber || 'this residence'} with category separation and year filtering`}
      />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto'>
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
                />
              </div>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className='w-full sm:w-48'>
                  <SelectValue placeholder='Filter by category' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Categories</SelectItem>
                  {DOCUMENT_CATEGORIES.map((category) => (
                    <SelectItem key={category._value} value={category._value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className='w-full sm:w-32'>
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

              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className='w-full sm:w-auto'>
                    <Plus className='h-4 w-4 mr-2' />
                    Add Document
                  </Button>
                </DialogTrigger>
                <DialogContent className='max-w-2xl'>
                  <DialogHeader>
                    <DialogTitle>Create New Document</DialogTitle>
                    <DialogDescription>
                      Add a new document to this residence. You can attach a file or create a
                      document entry only.
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
                              <Input placeholder='Enter document name' {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name='type'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Document Category</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder='Select document category' />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {DOCUMENT_CATEGORIES.map((category) => (
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
                        name='dateReference'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reference Date</FormLabel>
                            <FormControl>
                              <Input type='date' {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* File Upload Section */}
                      <div className='space-y-4'>
                        <Label>Attach File (Optional)</Label>
                        <div className='border-2 border-dashed border-gray-300 rounded-lg p-4'>
                          {uploadedFile ? (
                            <div className='text-center'>
                              <FileText className='h-8 w-8 text-green-500 mx-auto mb-2' />
                              <p className='text-sm text-gray-600 mb-2'>
                                File ready: {uploadedFile.fileName}
                              </p>
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() => setUploadedFile(null)}
                              >
                                Remove File
                              </Button>
                            </div>
                          ) : (
                            <ObjectUploader
                              onUpload={handleNewDocumentUpload}
                              onComplete={handleNewDocumentUploadComplete}
                              disabled={isUploadingNewFile}
                            />
                          )}
                        </div>
                      </div>

                      <DialogFooter>
                        <Button
                          type='button'
                          variant='outline'
                          onClick={() => setIsCreateDialogOpen(false)}
                          disabled={createDocumentMutation.isPending || isUploadingNewFile}
                        >
                          Cancel
                        </Button>
                        <Button
                          type='submit'
                          disabled={createDocumentMutation.isPending || isUploadingNewFile}
                        >
                          {createDocumentMutation.isPending || isUploadingNewFile
                            ? 'Creating...'
                            : 'Create Document'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Documents Display */}
          {documentsLoading ? (
            <div className='text-center py-8'>Loading documents...</div>
          ) : (
            <div className='space-y-6'>
              {DOCUMENT_CATEGORIES.map((category) => {
                const categoryDocuments = documentsByCategory[category._value] || [];
                if (categoryDocuments.length === 0) {
                  return null;
                }

                return (
                  <Card key={category._value}>
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
                          >
                            <CardContent className='p-4'>
                              <div className='flex items-start justify-between mb-2'>
                                <h4 className='font-medium text-sm truncate flex-1 mr-2'>
                                  {document.name}
                                </h4>
                                <div className='flex gap-1'>
                                  <Button
                                    size='sm'
                                    variant='ghost'
                                    onClick={() => {
                                      setSelectedDocument(document);
                                      setIsEditMode(false);
                                      setIsViewDialogOpen(true);
                                    }}
                                  >
                                    <Eye className='h-3 w-3' />
                                  </Button>
                                  <Button
                                    size='sm'
                                    variant='ghost'
                                    onClick={() => {
                                      setSelectedDocument(document);
                                      setIsEditMode(true);
                                      setIsViewDialogOpen(true);
                                    }}
                                  >
                                    <Edit className='h-3 w-3' />
                                  </Button>
                                  <Button
                                    size='sm'
                                    variant='ghost'
                                    onClick={() => handleDeleteDocument(document)}
                                    className='text-red-600 hover:text-red-700'
                                  >
                                    <Trash2 className='h-3 w-3' />
                                  </Button>
                                </div>
                              </div>
                              <p className='text-xs text-gray-500 mb-2'>
                                {new Date(document.dateReference).toLocaleDateString()}
                              </p>
                              {document.fileUrl && (
                                <Badge variant='outline' className='text-xs'>
                                  Has File
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

          {/* View/Edit Document Dialog */}
          <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
            <DialogContent className='max-w-2xl'>
              <DialogHeader>
                <DialogTitle>{isEditMode ? 'Edit Document' : 'View Document'}</DialogTitle>
              </DialogHeader>

              {selectedDocument && (
                <div className='space-y-4'>
                  {isEditMode ? (
                    <EditDocumentForm
                      document={selectedDocument}
                      onSave={(updated) => {
                        setSelectedDocument(updated);
                        setIsEditMode(false);
                        toast({
                          title: 'Success',
                          description: 'Document updated successfully',
                        });
                      }}
                      onCancel={() => setIsEditMode(false)}
                    />
                  ) : (
                    <div className='space-y-4'>
                      <div>
                        <Label>Document Name</Label>
                        <p className='text-sm text-gray-700'>{selectedDocument.name}</p>
                      </div>
                      <div>
                        <Label>Category</Label>
                        <p className='text-sm text-gray-700'>
                          {DOCUMENT_CATEGORIES.find((cat) => cat._value === selectedDocument.type)
                            ?.label || selectedDocument.type}
                        </p>
                      </div>
                      <div>
                        <Label>Reference Date</Label>
                        <p className='text-sm text-gray-700'>
                          {new Date(selectedDocument.dateReference).toLocaleDateString()}
                        </p>
                      </div>
                      {selectedDocument.fileUrl && (
                        <div>
                          <Label>Attached File</Label>
                          <div className='flex items-center gap-2'>
                            <FileText className='h-4 w-4' />
                            <span className='text-sm text-gray-700'>
                              {selectedDocument.fileName}
                            </span>
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() =>
                                window.open(
                                  getDisplayableFileUrl(selectedDocument.fileUrl!),
                                  '_blank'
                                )
                              }
                            >
                              <Download className='h-3 w-3 mr-1' />
                              Download
                            </Button>
                          </div>
                        </div>
                      )}
                      <DialogFooter>
                        <Button variant='outline' onClick={() => setIsEditMode(true)}>
                          Edit Document
                        </Button>
                      </DialogFooter>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
