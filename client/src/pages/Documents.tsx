import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Upload, Download, Edit, Trash2, FileText, Search, Plus, Building, Home } from "lucide-react";
import type { UploadResult } from "@uppy/core";

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
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  description: z.string().optional(),
  category: z.enum(['bylaw', 'financial', 'maintenance', 'legal', 'meeting_minutes', 'insurance', 'contracts', 'permits', 'inspection', 'other']),
  organizationId: z.string().optional(),
  buildingId: z.string().optional(),
  residenceId: z.string().optional(),
  isVisibleToTenants: z.boolean().default(false),
});

type DocumentFormData = z.infer<typeof documentFormSchema>;

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

export default function Documents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [uploadingDocumentId, setUploadingDocumentId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user info
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // Get documents
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["/api/documents"],
  });

  // Get buildings for assignment
  const { data: buildings = [] } = useQuery({
    queryKey: ["/api/manager/buildings"],
  });

  // Get residences for assignment
  const { data: residences = [] } = useQuery({
    queryKey: ["/api/residences"],
  });

  // Get organizations
  const { data: organizations = [] } = useQuery({
    queryKey: ["/api/admin/organizations"],
  });

  // Create document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => {
      return apiRequest("/api/documents", {
        method: "POST",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Document created successfully. Now upload the file.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create document",
        variant: "destructive",
      });
    },
  });

  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DocumentFormData> }) => {
      return apiRequest(`/api/documents/${id}`, {
        method: "PUT",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setSelectedDocument(null);
      toast({
        title: "Success",
        description: "Document updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update document",
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/documents/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  // Update document file mutation
  const updateDocumentFileMutation = useMutation({
    mutationFn: async ({ 
      id, 
      fileUrl, 
      fileName, 
      fileSize, 
      mimeType 
    }: { 
      id: string; 
      fileUrl: string; 
      fileName: string; 
      fileSize: number; 
      mimeType: string; 
    }) => {
      return apiRequest(`/api/documents/${id}/file`, {
        method: "PUT",
        body: { fileUrl, fileName, fileSize, mimeType },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setUploadingDocumentId(null);
      toast({
        title: "Success",
        description: "Document file uploaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document file",
        variant: "destructive",
      });
      setUploadingDocumentId(null);
    },
  });

  // Form for creating/editing documents
  const form = useForm<DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "other",
      isVisibleToTenants: false,
    },
  });

  // Handle document file upload
  const handleGetUploadParameters = async () => {
    try {
      const response = await apiRequest("/api/documents/upload-url", {
        method: "POST",
      });
      return {
        method: "PUT" as const,
        url: response.uploadURL,
      };
    } catch (error) {
      console.error("Error getting upload URL:", error);
      throw error;
    }
  };

  const handleUploadComplete = (documentId: string) => (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const fileUrl = uploadedFile.uploadURL;
      const fileName = uploadedFile.name;
      const fileSize = uploadedFile.size || 0;
      const mimeType = uploadedFile.type || "application/octet-stream";

      updateDocumentFileMutation.mutate({
        id: documentId,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
      });
    }
  };

  // Handle document creation
  const handleCreateDocument = (data: DocumentFormData) => {
    createDocumentMutation.mutate(data);
  };

  // Handle document editing
  const handleEditDocument = (document: Document) => {
    setSelectedDocument(document);
    form.reset({
      title: document.title,
      description: document.description || "",
      category: document.category as any,
      organizationId: document.organizationId || "",
      buildingId: document.buildingId || "",
      residenceId: document.residenceId || "",
      isVisibleToTenants: document.isVisibleToTenants,
    });
  };

  // Handle document update
  const handleUpdateDocument = (data: DocumentFormData) => {
    if (selectedDocument) {
      updateDocumentMutation.mutate({
        id: selectedDocument.id,
        data,
      });
    }
  };

  // Handle document download
  const handleDownloadDocument = (document: Document) => {
    if (document.fileUrl) {
      window.open(`/api/documents/${document.id}/download`, '_blank');
    } else {
      toast({
        title: "No file",
        description: "This document has no file attached",
        variant: "destructive",
      });
    }
  };

  // Filter documents
  const filteredDocuments = documents.filter((doc: Document) => {
    const matchesSearch = !searchTerm || 
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !selectedCategory || doc.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Get assignment display text
  const getAssignmentText = (document: Document) => {
    if (document.residenceId) {
      const residence = residences.find((r: any) => r.id === document.residenceId);
      return residence ? `${residence.unit} - ${residence.building?.name || 'Building'}` : 'Residence';
    }
    if (document.buildingId) {
      const building = buildings.find((b: any) => b.id === document.buildingId);
      return building ? building.name : 'Building';
    }
    if (document.organizationId) {
      const org = organizations.find((o: any) => o.id === document.organizationId);
      return org ? org.name : 'Organization';
    }
    return 'General';
  };

  const canCreateDocuments = user?.role && ['admin', 'manager', 'resident'].includes(user.role);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Document Management</h1>
          <p className="text-muted-foreground">
            Manage property documents with role-based access control
          </p>
        </div>
        {canCreateDocuments && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Document</DialogTitle>
                <DialogDescription>
                  Add a new document to the system. You can upload the file after creating the document.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateDocument)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Document title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Document description (optional)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
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
                      name="organizationId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select organization" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">No organization</SelectItem>
                              {organizations.map((org: any) => (
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

                  {buildings.length > 0 && (
                    <FormField
                      control={form.control}
                      name="buildingId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Building (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select building" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">No building</SelectItem>
                              {buildings.map((building: any) => (
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

                  {residences.length > 0 && (
                    <FormField
                      control={form.control}
                      name="residenceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Residence (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select residence" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">No residence</SelectItem>
                              {residences.map((residence: any) => (
                                <SelectItem key={residence.id} value={residence.id}>
                                  {residence.unit} - {residence.building?.name || 'Building'}
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
                    name="isVisibleToTenants"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Visible to Tenants</FormLabel>
                          <FormDescription>
                            Allow tenants to view this document
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="submit" disabled={createDocumentMutation.isPending}>
                      {createDocumentMutation.isPending ? "Creating..." : "Create Document"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search and Filter */}
      <div className="flex space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All categories</SelectItem>
            {DOCUMENT_CATEGORIES.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Documents Grid */}
      {documentsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((document: Document) => (
            <Card key={document.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {document.title}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {document.description || "No description"}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {DOCUMENT_CATEGORIES.find(c => c.value === document.category)?.label || document.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    {document.residenceId ? (
                      <Home className="w-4 h-4 mr-1" />
                    ) : (
                      <Building className="w-4 h-4 mr-1" />
                    )}
                    {getAssignmentText(document)}
                  </div>
                  
                  {document.fileName && (
                    <div className="text-sm">
                      <p className="font-medium">{document.fileName}</p>
                      <p className="text-muted-foreground">{formatFileSize(document.fileSize)}</p>
                    </div>
                  )}
                  
                  {document.isVisibleToTenants && (
                    <Badge variant="secondary" className="text-xs">
                      Visible to Tenants
                    </Badge>
                  )}
                  
                  <div className="flex justify-between items-center pt-2">
                    <div className="flex space-x-2">
                      {document.fileUrl ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadDocument(document)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      ) : (
                        canCreateDocuments && (
                          <ObjectUploader
                            onGetUploadParameters={handleGetUploadParameters}
                            onComplete={handleUploadComplete(document.id)}
                            buttonClassName="h-8 text-xs"
                          >
                            <Upload className="w-4 h-4 mr-1" />
                            Upload File
                          </ObjectUploader>
                        )
                      )}
                    </div>
                    
                    {canCreateDocuments && (user?.role === 'admin' || document.uploadedBy === user?.id) && (
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditDocument(document)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteDocumentMutation.mutate(document.id)}
                          disabled={deleteDocumentMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredDocuments.length === 0 && !documentsLoading && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No documents found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || selectedCategory 
              ? "Try adjusting your search criteria" 
              : "Get started by creating your first document"}
          </p>
          {canCreateDocuments && !searchTerm && !selectedCategory && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Document
            </Button>
          )}
        </div>
      )}

      {/* Edit Document Dialog */}
      <Dialog open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Update document information
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateDocument)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Document title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Document description (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
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
                control={form.control}
                name="isVisibleToTenants"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Visible to Tenants</FormLabel>
                      <FormDescription>
                        Allow tenants to view this document
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit" disabled={updateDocumentMutation.isPending}>
                  {updateDocumentMutation.isPending ? "Updating..." : "Update Document"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}