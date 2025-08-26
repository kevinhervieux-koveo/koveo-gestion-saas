import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Header } from '@/components/layout/header';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  FileText,
  Download,
  Eye,
  Upload,
  Plus,
  Trash2,
  Calendar,
  User,
  ArrowLeft,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { RESIDENCE_DOCUMENT_CATEGORIES, getDisplayableFileUrl } from '@/lib/documents';

const documentFormSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
  type: z.string().min(1, 'Document type is required'),
  description: z.string().optional(),
  isVisibleToTenants: z.boolean().optional().default(false),
});

type DocumentFormData = z.infer<typeof documentFormSchema>;

interface Document {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  dateReference?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  mimeType?: string;
  uploadedBy: string;
  isVisibleToTenants: boolean;
  documentCategory: string;
  entityType: string;
  entityId: string;
}

export default function ResidenceDocuments() {
  const [, navigate] = useLocation();
  const params = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingDocumentId, setUploadingDocumentId] = useState<string | null>(null);

  // Get residenceId from URL (both path param and query param)
  const urlParams = new URLSearchParams(window.location.search);
  const residenceId = params.residenceId || urlParams.get('residenceId');

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: () => apiRequest('GET', '/api/auth/user') as Promise<any>,
  });

  // Get residence info
  const { data: residence } = useQuery({
    queryKey: ['/api/residences', residenceId],
    queryFn: async () => {
      const response = await fetch(`/api/residences/${residenceId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch residence');
      return response.json();
    },
    enabled: !!residenceId,
  });

  // Fetch documents
  const { data: documentsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/documents', 'resident', residenceId],
    queryFn: async () => {
      console.log('🔍 Fetching documents for residence:', residenceId);
      const response = await fetch(`/api/documents?type=resident&residenceId=${residenceId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        console.error('❌ Documents API failed:', response.status, response.statusText);
        throw new Error('Failed to fetch documents');
      }
      const data = await response.json();
      console.log('📄 Documents API response:', data);
      console.log('📊 Documents array length:', data.documents?.length || 0);
      return data;
    },
    enabled: !!residenceId,
  });

  const documents: Document[] = documentsData?.documents || [];
  const isUserTenant = user?.role === 'tenant';
  const canUpload = !isUserTenant; // Tenants cannot upload

  // Debug logging
  console.log('🎯 ResidenceDocuments Debug:', {
    residenceId,
    documentsDataKeys: documentsData ? Object.keys(documentsData) : 'undefined',
    documentsLength: documents.length,
    userRole: user?.role,
    isLoading,
  });

  // Form for creating documents
  const form = useForm<DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      name: '',
      type: '',
      description: '',
      isVisibleToTenants: false,
    },
  });

  // Create document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => {
      const response = await apiRequest('POST', '/api/documents', {
        ...data,
        documentType: 'resident',
        residenceId,
        uploadedBy: user?.id,
      });
      return response;
    },
    onSuccess: (newDocument) => {
      if (selectedFile) {
        setUploadingDocumentId(newDocument.id);
        uploadFile(newDocument.id);
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/documents', 'resident', residenceId] });
        setIsAddDialogOpen(false);
        form.reset();
        toast({
          title: 'Document created',
          description: 'Document has been created successfully.',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create document',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => apiRequest('DELETE', `/api/documents/${documentId}?type=resident`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents', 'resident', residenceId] });
      toast({
        title: 'Document deleted',
        description: 'Document has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete document',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const uploadFile = async (documentId: string) => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      await apiRequest('POST', `/api/documents/${documentId}/upload`, formData);
      queryClient.invalidateQueries({ queryKey: ['/api/documents', 'resident', residenceId] });
      setIsAddDialogOpen(false);
      setSelectedFile(null);
      setUploadingDocumentId(null);
      form.reset();
      toast({
        title: 'Document uploaded',
        description: 'Document has been uploaded successfully.',
      });
    } catch (error: any) {
      setUploadingDocumentId(null);
      toast({
        title: 'Failed to upload file',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  const handleCreateDocument = (data: DocumentFormData) => {
    createDocumentMutation.mutate(data);
  };

  const handleDeleteDocument = (document: Document) => {
    if (confirm('Are you sure you want to delete this document?')) {
      deleteDocumentMutation.mutate(document.id);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDownload = (document: Document) => {
    if (document.fileUrl) {
      const url = getDisplayableFileUrl(document.fileUrl);
      window.open(url, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Residence Documents"
          subtitle="Loading documents..."
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title={`${residence?.unitNumber ? `Unit ${residence.unitNumber}` : 'Residence'} Documents`}
        subtitle={
          isUserTenant
            ? 'View documents available to you'
            : 'Manage documents for this residence'
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Back button */}
          <Button
            variant="outline"
            onClick={() => navigate('/residents/residence')}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Residences
          </Button>

          {/* Controls */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold" data-testid="text-documents-title">
                Documents ({documents.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                {isUserTenant
                  ? 'Documents available to tenants'
                  : 'All residence documents'}
              </p>
            </div>

            {canUpload && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-document">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Document
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Document</DialogTitle>
                  </DialogHeader>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreateDocument)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Document Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter document name"
                                {...field}
                                data-testid="input-document-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Document Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-document-type">
                                  <SelectValue placeholder="Select document type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {RESIDENCE_DOCUMENT_CATEGORIES.map((category) => (
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
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter document description"
                                {...field}
                                data-testid="textarea-document-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {user?.role !== 'tenant' && (
                        <FormField
                          control={form.control}
                          name="isVisibleToTenants"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <input
                                  type="checkbox"
                                  checked={field.value}
                                  onChange={field.onChange}
                                  data-testid="checkbox-visible-to-tenants"
                                />
                              </FormControl>
                              <FormLabel>Visible to tenants</FormLabel>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <div>
                        <Label>File (Optional)</Label>
                        <Input
                          type="file"
                          onChange={handleFileSelect}
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                          data-testid="input-file-upload"
                        />
                        {selectedFile && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Selected: {selectedFile.name}
                          </p>
                        )}
                      </div>

                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createDocumentMutation.isPending || uploadingDocumentId !== null}
                          data-testid="button-submit-document"
                        >
                          {uploadingDocumentId ? 'Uploading...' : 'Create Document'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Documents Grid */}
          {documents.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Documents Found</h3>
                <p className="text-gray-500">
                  {isUserTenant
                    ? 'No documents are currently available to tenants for this residence.'
                    : 'No documents have been uploaded for this residence yet.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents
                .filter((doc) => !isUserTenant || doc.isVisibleToTenants)
                .map((document) => (
                  <Card key={document.id} className="hover:shadow-lg transition-shadow" data-testid={`card-document-${document.id}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4" />
                        {document.name}
                      </CardTitle>
                      <Badge variant="outline" className="w-fit">
                        {RESIDENCE_DOCUMENT_CATEGORIES.find(cat => cat._value === document.type)?.label || document.type}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {RESIDENCE_DOCUMENT_CATEGORIES.find(cat => cat._value === document.type)?.label || document.type} document
                        </p>
                        
                        {document.fileUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(document)}
                            className="w-full"
                            data-testid={`button-download-${document.id}`}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            View Document
                          </Button>
                        )}

                        {canUpload && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDocument(document)}
                            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                            data-testid={`button-delete-${document.id}`}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}