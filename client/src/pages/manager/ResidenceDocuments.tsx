import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
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
  Upload,
  Plus,
  Trash2,
  Calendar,
  User,
  ArrowLeft,
  Home,
  Building,
  MapPin,
  Search,
  Edit,
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
  isVisibleToTenants: z.boolean().default(false),
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingDocumentId, setUploadingDocumentId] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Get residenceId from URL
  const params = new URLSearchParams(window.location.search);
  const residenceId = params.get('residenceId') || window.location.pathname.split('/').slice(-2, -1)[0];

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

  // Get building info for context
  const { data: buildingData } = useQuery({
    queryKey: ['/api/manager/buildings'],
    queryFn: async () => {
      const response = await fetch('/api/manager/buildings', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch buildings');
      return response.json();
    },
  });

  const building = buildingData?.buildings?.find((b: any) => b.id === residence?.buildingId);

  // Fetch documents
  const { data: documentsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/documents', 'resident', residenceId],
    queryFn: async () => {
      const response = await fetch(`/api/documents?type=resident&residenceId=${residenceId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
    enabled: !!residenceId,
  });

  const documents: Document[] = documentsData?.documents || [];

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || doc.type === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Form for creating/editing documents
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

  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => {
      if (!editingDocument) throw new Error('No document selected');
      const response = await apiRequest('PUT', `/api/documents/${editingDocument.id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents', 'resident', residenceId] });
      setIsEditDialogOpen(false);
      setEditingDocument(null);
      form.reset();
      toast({
        title: 'Document updated',
        description: 'Document has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update document',
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

  const handleUpdateDocument = (data: DocumentFormData) => {
    updateDocumentMutation.mutate(data);
  };

  const handleDeleteDocument = (document: Document) => {
    if (confirm('Are you sure you want to delete this document?')) {
      deleteDocumentMutation.mutate(document.id);
    }
  };

  const handleEditDocument = (document: Document) => {
    setEditingDocument(document);
    form.reset({
      name: document.name,
      type: document.type,
      description: '', // We don't have description in the document interface
      isVisibleToTenants: document.isVisibleToTenants,
    });
    setIsEditDialogOpen(true);
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
        subtitle="Manage residence documents and control tenant visibility"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Back button */}
          <Button
            variant="outline"
            onClick={() => navigate('/manager/residences')}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Residences
          </Button>

          {/* Residence info */}
          {residence && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Home className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-semibold">Unit {residence.unitNumber}</h3>
                    {building && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        {building.name} • 
                        <MapPin className="w-3 h-3 ml-1" />
                        {building.address}, {building.city}, {building.province}
                      </p>
                    )}
                    {residence.bedrooms && (
                      <p className="text-sm text-muted-foreground">
                        {residence.bedrooms} bedrooms • {residence.bathrooms} bathrooms
                        {residence.squareFootage && ` • ${residence.squareFootage} sq ft`}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Search and filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search documents..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-documents"
                    />
                  </div>
                </div>
                <div className="w-full md:w-48">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger data-testid="select-document-category">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {RESIDENCE_DOCUMENT_CATEGORIES.map((category) => (
                        <SelectItem key={category._value} value={category._value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Controls */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold" data-testid="text-documents-title">
                Documents ({filteredDocuments.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                Manage residence documents and control visibility to tenants
              </p>
            </div>

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
          </div>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Document</DialogTitle>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleUpdateDocument)} className="space-y-4">
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
                            data-testid="input-edit-document-name"
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
                            <SelectTrigger data-testid="select-edit-document-type">
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
                    name="isVisibleToTenants"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            data-testid="checkbox-edit-visible-to-tenants"
                          />
                        </FormControl>
                        <FormLabel>Visible to tenants</FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateDocumentMutation.isPending}
                      data-testid="button-update-document"
                    >
                      Update Document
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Documents Grid */}
          {filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Documents Found</h3>
                <p className="text-gray-500">
                  {searchTerm || selectedCategory !== 'all'
                    ? 'No documents match your search criteria.'
                    : 'No documents have been uploaded for this residence yet.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocuments.map((document) => (
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
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        Uploaded: {new Date(document.uploadDate).toLocaleDateString()}
                      </div>
                      
                      {document.fileName && (
                        <div className="text-muted-foreground">
                          File: {document.fileName}
                        </div>
                      )}

                      {document.fileSize && (
                        <div className="text-muted-foreground">
                          Size: {document.fileSize}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Badge variant={document.isVisibleToTenants ? "default" : "secondary"} className="text-xs">
                          {document.isVisibleToTenants ? 'Visible to tenants' : 'Manager only'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      {document.fileUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(document)}
                          className="flex-1"
                          data-testid={`button-download-${document.id}`}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditDocument(document)}
                        data-testid={`button-edit-${document.id}`}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteDocument(document)}
                        className="text-red-600 hover:text-red-700"
                        data-testid={`button-delete-${document.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
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