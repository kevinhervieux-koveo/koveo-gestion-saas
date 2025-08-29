import { useState } from 'react';
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
  Home,
} from 'lucide-react';
import { SearchInput } from '@/components/common/SearchInput';
import { FilterDropdown } from '@/components/common/FilterDropdown';
import { schemas, enumFields } from '@/lib/validations';

// Document categories
const DOCUMENT_CATEGORIES = [
  { value: 'bylaw', label: 'Bylaws' },
  { value: 'financial', label: 'Financial' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'legal', label: 'Legal' },
  { value: 'meeting_minutes', label: 'Meeting Minutes' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'contracts', label: 'Contracts' },
  { value: 'permits', label: 'Permits' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
] as const;

// Form schema for creating/editing documents
const documentFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().optional(),
  category: enumFields.buildingDocumentType,
  organizationId: z.string().optional(),
  buildingId: z.string().optional(),
  residenceId: z.string().optional(),
  isVisibleToTenants: z.boolean(),
});

/**
 *
 */
type DocumentFormData = z.infer<typeof documentFormSchema>;

/**
 *
 */
interface Document {
  id: string;
  title: string;
  description?: string;
  category: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  fileUrl?: string;
  organizationId?: string;
  buildingId?: string;
  residenceId?: string;
  isVisibleToTenants: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 *
 */
interface User {
  id: string;
  role: string;
  [_key: string]: any;
}

/**
 *
 */
interface Organization {
  id: string;
  name: string;
  [_key: string]: any;
}

/**
 *
 */
interface Building {
  id: string;
  name: string;
  [_key: string]: any;
}

/**
 *
 */
interface Residence {
  id: string;
  unitNumber: string;
  [_key: string]: any;
}

/**
 *
 */
export default function /**
 * Documents function.
 */ /**
 * Documents function.
 */

Documents() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [uploadingDocumentId, setUploadingDocumentId] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user info
  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });

  // Get documents
  const { data: documentsResponse, isLoading: documentsLoading } = useQuery<{
    documents: Document[];
  }>({
    queryKey: ['/api/documents'],
  });

  const documents = documentsResponse?.documents || [];

  // Get buildings for assignment
  const { data: buildingsResponse } = useQuery<{ buildings: Building[] }>({
    queryKey: ['/api/manager/buildings'],
  });

  // Get residences for assignment
  const { data: residences = [] } = useQuery<Residence[]>({
    queryKey: ['/api/residences'],
  });

  // Get organizations
  const { data: organizationsResponse } = useQuery<{ organizations: Organization[] }>({
    queryKey: ['/api/admin/organizations'],
  });

  const buildings = buildingsResponse?.buildings || [];
  const organizations = organizationsResponse?.organizations || [];

  // Create document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (_data: DocumentFormData) => {
      return apiRequest('POST', '/api/documents', _data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      setIsCreateDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Document created successfully. Now upload the file.',
      });
    },
    onError: (_error: unknown) => {
      toast({
        title: 'Error',
        description: (_error as any)?.message || 'Failed to create document',
        variant: 'destructive',
      });
    },
  });

  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DocumentFormData> }) => {
      return apiRequest('PUT', `/api/documents/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      setSelectedDocument(null);
      toast({
        title: 'Success',
        description: 'Document updated successfully',
      });
    },
    onError: (_error: unknown) => {
      toast({
        title: 'Error',
        description: (_error as any)?.message || 'Failed to update document',
        variant: 'destructive',
      });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });
    },
    onError: (_error: unknown) => {
      toast({
        title: 'Error',
        description: (_error as any)?.message || 'Failed to delete document',
        variant: 'destructive',
      });
    },
  });

  // Update document file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({
      id,
      fileData,
    }: {
      id: string;
      fileData: { fileUrl: string; fileName: string; fileSize: number; mimeType: string };
    }) => {
      return apiRequest('POST', `/api/documents/${id}/upload`, fileData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      setUploadingDocumentId(null);
      toast({
        title: 'File uploaded',
        description: 'The file has been uploaded successfully.',
      });
    },
    onError: (_error: unknown) => {
      setUploadingDocumentId(null);
      toast({
        title: 'Error',
        description: (_error as any)?.message || 'Failed to upload file',
        variant: 'destructive',
      });
    },
  });

  // Get upload URL
  const getUploadURL = async () => {
    const response = (await apiRequest('/api/objects/upload', 'POST')) as any;
    return response.uploadURL;
  };

  // Handle file upload completion
  const handleUploadComplete =
    (documentId: string) =>
    (_result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
      /**
       * If function.
       * @param result.successful && result.successful.length > 0 - result.successful && result.successful.length > 0 parameter.
       */ /**
       * If function.
       * @param result.successful && result.successful.length > 0 - result.successful && result.successful.length > 0 parameter.
       */

      if (_result.successful && _result.successful.length > 0) {
        const uploadedFile = _result.successful[0];
        const fileUrl = uploadedFile.uploadURL as string;
        const fileName = uploadedFile.name;
        const fileSize = uploadedFile.size || 0;
        const mimeType = uploadedFile.type || 'application/octet-stream';

        uploadFileMutation.mutate({
          id: documentId,
          fileData: { fileUrl, fileName, fileSize, mimeType },
        });
      }
    };

  // Forms
  const form = useForm({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'other' as const,
      organizationId: '',
      buildingId: '',
      residenceId: '',
      isVisibleToTenants: false,
    },
  });

  const updateForm = useForm({
    resolver: zodResolver(documentFormSchema),
    defaultValues: selectedDocument
      ? {
          title: selectedDocument.title,
          description: selectedDocument.description || '',
          category: selectedDocument.category as any,
          organizationId: selectedDocument.organizationId || '',
          buildingId: selectedDocument.buildingId || '',
          residenceId: selectedDocument.residenceId || '',
          isVisibleToTenants: selectedDocument.isVisibleToTenants,
        }
      : {
          title: '',
          description: '',
          category: 'other' as const,
          organizationId: '',
          buildingId: '',
          residenceId: '',
          isVisibleToTenants: false,
        },
  });

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      (doc.title && doc.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.description && doc.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory =
      !selectedCategory || selectedCategory === 'all' || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get organization name
  const getOrganizationName = (id: string) => {
    const org = organizations.find((o) => o.id === id);
    return org?.name || 'Unknown Organization';
  };

  // Get building name
  const getBuildingName = (id: string) => {
    const building = buildings.find((b) => b.id === id);
    return building?.name || 'Unknown Building';
  };

  // Get residence name
  const getResidenceName = (id: string) => {
    const residence = residences.find((r) => r.id === id);
    return residence?.unitNumber || 'Unknown Residence';
  };

  // Handle form submission
  const onSubmit = (_data: DocumentFormData) => {
    createDocumentMutation.mutate(_data);
    form.reset();
  };

  const onUpdate = (_data: DocumentFormData) => {
    /**
     * If function.
     * @param selectedDocument - SelectedDocument parameter.
     */ /**
     * If function.
     * @param selectedDocument - SelectedDocument parameter.
     */

    if (selectedDocument) {
      updateDocumentMutation.mutate({ id: selectedDocument.id, data: _data });
    }
  }; /**
   * If function.
   * @param documentsLoading - DocumentsLoading parameter.
   */ /**
   * If function.
   * @param documentsLoading - DocumentsLoading parameter.
   */

  if (documentsLoading) {
    return (
      <div className='p-6'>
        <div className='text-center'>Loading documents...</div>
      </div>
    );
  }

  return (
    <div className='p-6 max-w-7xl mx-auto'>
      <div className='flex justify-between items-center mb-6'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900'>Document Management</h1>
          <p className='text-gray-600 mt-2'>
            Manage documents for buildings and residences with role-based access control
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className='w-4 h-4 mr-2' />
              Add Document
            </Button>
          </DialogTrigger>
          <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
            <DialogHeader>
              <DialogTitle>Create New Document</DialogTitle>
              <DialogDescription>
                Add a new document to the system. You can upload the file after creating the
                document entry.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                id='create-document-form'
                onSubmit={form.handleSubmit(onSubmit)}
                className='space-y-4'
              >
                <FormField
                  control={form.control}
                  name='title'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder={t('documentTitle')} {...field} />
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('documentDescription')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='category'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('selectCategory')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DOCUMENT_CATEGORIES.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {user?.role === 'admin' && organizations.length > 0 && (
                  <FormField
                    control={form.control}
                    name='organizationId'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('selectOrganizationOptional')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {organizations.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {(user?.role === 'admin' || user?.role === 'manager') && buildings.length > 0 && (
                  <FormField
                    control={form.control}
                    name='buildingId'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Building</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('selectBuildingOptional')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {buildings.map((building) => (
                              <SelectItem key={building.id} value={building.id}>
                                {building.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {(user?.role === 'admin' || user?.role === 'manager') && residences.length > 0 && (
                  <FormField
                    control={form.control}
                    name='residenceId'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Residence</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('selectResidenceOptional')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {residences.map((residence) => (
                              <SelectItem key={residence.id} value={residence.id}>
                                Unit {residence.unitNumber}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name='isVisibleToTenants'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm'>
                      <div className='space-y-0.5'>
                        <FormLabel>Visible to Tenants</FormLabel>
                        <FormDescription>Allow tenants to view this document</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter className='mt-4'>
                  <Button type='submit' disabled={createDocumentMutation.isPending}>
                    {createDocumentMutation.isPending ? 'Creating...' : 'Create Document'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and filter controls */}
      <div className='flex gap-4 mb-6'>
        <div className='flex-1'>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t('searchDocuments')}
            iconColor='gray'
            data-testid='documents-search'
          />
        </div>
        <FilterDropdown
          value={selectedCategory}
          onValueChange={setSelectedCategory}
          options={[
            { value: 'all', label: 'All Categories' },
            ...DOCUMENT_CATEGORIES.map((cat) => ({ value: cat.value, label: cat.label })),
          ]}
          placeholder={t('filterByCategory')}
          width='w-48'
          data-testid='category-filter'
        />
      </div>

      {/* Documents grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {filteredDocuments.map((document) => (
          <Card key={document.id} className='hover:shadow-lg transition-shadow'>
            <CardHeader className='pb-3'>
              <div className='flex justify-between items-start'>
                <div className='flex-1 min-w-0'>
                  <CardTitle className='text-lg truncate'>{document.title}</CardTitle>
                  {document.description && (
                    <CardDescription className='mt-1 line-clamp-2'>
                      {document.description}
                    </CardDescription>
                  )}
                </div>
                <Badge variant='secondary' className='ml-2 shrink-0'>
                  {DOCUMENT_CATEGORIES.find((c) => c.value === document.category)?.label ||
                    document.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-3'>
              {/* Assignment info */}
              <div className='space-y-1 text-sm text-gray-600'>
                {document.organizationId && (
                  <div className='flex items-center gap-2'>
                    <Building className='w-4 h-4' />
                    <span>{getOrganizationName(document.organizationId)}</span>
                  </div>
                )}
                {document.buildingId && (
                  <div className='flex items-center gap-2'>
                    <Building className='w-4 h-4' />
                    <span>{getBuildingName(document.buildingId)}</span>
                  </div>
                )}
                {document.residenceId && (
                  <div className='flex items-center gap-2'>
                    <Home className='w-4 h-4' />
                    <span>{getResidenceName(document.residenceId)}</span>
                  </div>
                )}
              </div>

              {/* File info */}
              {document.fileName ? (
                <div className='flex items-center gap-2 text-sm text-gray-600'>
                  <FileText className='w-4 h-4' />
                  <span className='truncate'>{document.fileName}</span>
                  {document.fileSize && (
                    <span className='text-xs'>
                      ({(document.fileSize / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  )}
                </div>
              ) : (
                <div className='text-sm text-gray-500 italic'>No file uploaded</div>
              )}

              {/* Tenant visibility */}
              {document.isVisibleToTenants && (
                <Badge variant='outline' className='text-xs'>
                  Visible to Tenants
                </Badge>
              )}

              {/* Actions */}
              <div className='flex justify-between items-center pt-2'>
                <div className='flex gap-2'>
                  {document.fileUrl && (
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => window.open(document.fileUrl, '_blank')}
                    >
                      <Download className='w-4 h-4 mr-1' />
                      Download
                    </Button>
                  )}
                  {!document.fileName && (
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={50 * 1024 * 1024} // 50MB
                      onGetUploadParameters={async () => {
                        setUploadingDocumentId(document.id);
                        const url = await getUploadURL();
                        return { method: 'PUT' as const, url };
                      }}
                      onComplete={handleUploadComplete(document.id)}
                      buttonClassName='text-sm'
                    >
                      <Upload className='w-4 h-4 mr-1' />
                      Upload
                    </ObjectUploader>
                  )}
                </div>
                <div className='flex gap-1'>
                  {(user?.role === 'admin' ||
                    user?.role === 'manager' ||
                    document.uploadedBy === user?.id) && (
                    <>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => setSelectedDocument(document)}
                      >
                        <Edit className='w-4 h-4' />
                      </Button>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this document?')) {
                            deleteDocumentMutation.mutate(document.id);
                          }
                        }}
                      >
                        <Trash2 className='w-4 h-4' />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDocuments.length === 0 && (
        <div className='text-center py-12'>
          <FileText className='w-12 h-12 text-gray-400 mx-auto mb-4' />
          <h3 className='text-lg font-medium text-gray-900 mb-2'>{t('noDocumentsFound')}</h3>
          <p className='text-gray-600'>
            {searchTerm || selectedCategory
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by creating your first document.'}
          </p>
        </div>
      )}

      {/* Edit document dialog */}
      <Dialog open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)}>
        <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>Update the document information and settings.</DialogDescription>
          </DialogHeader>

          <Form {...updateForm}>
            <form
              id='update-document-form'
              onSubmit={updateForm.handleSubmit(onUpdate)}
              className='space-y-4'
            >
              <FormField
                control={updateForm.control}
                name='title'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder={t('documentTitle')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={updateForm.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder={t('documentDescription')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={updateForm.control}
                name='category'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectCategory')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DOCUMENT_CATEGORIES.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
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
                control={updateForm.control}
                name='isVisibleToTenants'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm'>
                    <div className='space-y-0.5'>
                      <FormLabel>Visible to Tenants</FormLabel>
                      <FormDescription>Allow tenants to view this document</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className='mt-4'>
                <Button type='submit' disabled={updateDocumentMutation.isPending}>
                  {updateDocumentMutation.isPending ? 'Updating...' : 'Update Document'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
