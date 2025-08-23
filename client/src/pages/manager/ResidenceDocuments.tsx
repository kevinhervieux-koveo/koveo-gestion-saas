import { useState, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Upload, Download, Edit, Trash2, FileText, Search, Plus, Home, Calendar, Filter, Eye } from "lucide-react";
import { Header } from "@/components/layout/header";
import type { UploadResult } from "@uppy/core";

import { 
  getDisplayableFileUrl, 
  RESIDENCE_DOCUMENT_CATEGORIES as DOCUMENT_CATEGORIES,
  documentApi,
  getCategoryLabel,
  createUploadHandler
} from '@/lib/documents';
import { useDeleteMutation, useCreateUpdateMutation, useFormState } from '@/lib/common-hooks';

// Form schema for creating/editing residence documents
const documentFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  type: z.enum(['lease', 'inspection', 'maintenance', 'financial', 'insurance', 'legal', 'correspondence', 'permits', 'utilities', 'other']),
  dateReference: z.string().refine((dateStr) => {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }, {
    message: "Valid date is required",
  }),
  residenceId: z.string().min(1, "Residence ID is required"),
});

/*
 *

type DocumentFormData = z.infer<typeof documentFormSchema>;

// Edit Document Form Component
/*
 *

interface EditDocumentFormProps {
  document: ResidenceDocument;
  onSave: (updatedDocument: ResidenceDocument) => void;
  onCancel: () => void;
}

/*
 *
 * @param root0
 * @param root0.document
 * @param root0.onSave
 * @param root0.onCancel

/*
 * EditDocumentForm function.
 * @param root0
 * @param root0.document
 * @param root0.onSave
 * @param root0.onCancel
 * @returns Function result.

function
   * Edit document form function.

   * Edit document form function.


 EditDocumentForm({ document, onSave, onCancel }: EditDocumentFormProps) {
  const { toast } = useToast();
  
  const editForm = useForm<DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      name: document.name,
      type: document.type as any,
      dateReference: document.dateReference.split('T')[0], // Convert to YYYY-MM-DD format
      residenceId: document.residenceId,
    },
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async (_data: DocumentFormData) => {
      const response = await apiRequest('PUT', `/api/documents/${document.id}`, _data);
      return { response, data };
    },
    onSuccess: ({ response, data }: { _response: any; _data: DocumentFormData }) => {
      const queryClient = useQueryClient();
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      // Create updated document object with the response data
      const updatedDocument = {
        ...document,
        ...data,
        ...response
      };
      onSave(updatedDocument);
    },
    onError: (_error: unknown) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update document. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (_data: DocumentFormData) => {
    updateDocumentMutation.mutate(_data);
  };

  return (
    <Form {...editForm}>
      <form onSubmit={editForm.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={editForm.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Document Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter document name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={editForm.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
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
          control={editForm.control}
          name="dateReference"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reference Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 pt-4">
          <Button
            type="submit"
            disabled={updateDocumentMutation.isPending}
            className="flex-1"
          >
            {updateDocumentMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={updateDocumentMutation.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

/*
 *

interface ResidenceDocument {
  id: string;
  name: string;
  type: string;
  dateReference: string;
  uploadDate: string;
  residenceId: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  fileUrl?: string;
}

/*
 *

interface User {
  id: string;
  role: string;
  [_key: string]: any;
}

/*
 *

interface Residence {
  id: string;
  unitNumber: string;
  floor?: string;
  buildingId: string;
  [_key: string]: any;
}

/*
 *

interface Building {
  id: string;
  name: string;
  address: string;
  [_key: string]: any;
}

/*
 *

export default function
   * Residence documents function.

   * Residence documents function.


 ResidenceDocuments() {
  // Get residenceId from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const residenceId = urlParams.get('residenceId');
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ResidenceDocument | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [uploadingDocumentId, setUploadingDocumentId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  } | null>(null);
  const [isUploadingNewFile, setIsUploadingNewFile] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user info
  const { _data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  // Get residences info
  const { _data: residences = [] } = useQuery<Residence[]>({
    queryKey: ["/api/residences"],
  });

  // Get buildings info for context
  const { _data: buildingsResponse } = useQuery<{ buildings: Building[] }>({
    queryKey: ["/api/manager/buildings"],
  });

  const residence = residences.find(r => r.id === residenceId);
  const building = buildingsResponse?.buildings?.find(b => b.id === residence?.buildingId);

  // Get documents for this specific residence
  const { _data: documentsResponse, isLoading: documentsLoading } = useQuery<{documents: ResidenceDocument[]}>({
    queryKey: ["/api/documents", "residence", residenceId],
    queryFn: async () => {




      if (!residenceId) {return {documents: []};}
      const response = await fetch(`/api/documents?type=resident&residenceId=${residenceId}`);








      if (!response.ok) {throw new Error('Failed to fetch documents');}
      return response.json();
    },
    enabled: !!residenceId,
  });
  
  const documents = documentsResponse?.documents || [];

  // Get available years from documents
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    documents.forEach(doc => {
      const year = new Date(doc.dateReference).getFullYear().toString();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [documents]);

  // Filter documents based on search, category, and year
  const filteredDocuments = useMemo(() => {
    let filtered = documents;





    if (searchTerm) {
      filtered = filtered.filter(doc => 
        doc.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }





    if (selectedCategory !== "all") {
      filtered = filtered.filter(doc => doc.type === selectedCategory);
    }





    if (selectedYear !== "all") {
      filtered = filtered.filter(doc => 
        new Date(doc.dateReference).getFullYear().toString() === selectedYear
      );
    }

    return filtered;
  }, [documents, searchTerm, selectedCategory, selectedYear]);

  // Group documents by category for display
  const documentsByCategory = useMemo(() => {
    const grouped: Record<string, ResidenceDocument[]> = {};
    
    DOCUMENT_CATEGORIES.forEach(category => {
      grouped[category.value] = filteredDocuments.filter(doc => doc.type === category._value);
    });

    return grouped;
  }, [filteredDocuments]);

  // Create document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (_data: DocumentFormData) => {




      if (!user?.id) {
        throw new Error("User not authenticated");
      }
      
      // Use full user ID as string (backend now accepts any string)
      
      const documentData: unknown = {
        name: data.name,
        type: data.type, // This is the document category (lease, inspection, etc.)
        dateReference: data.dateReference, // Send as YYYY-MM-DD string
        residenceId: data.residenceId,
        uploadedBy: user.id, // Use full user ID
      };
      
      // Add file data if uploaded




      if (uploadedFile) {
        documentData.fileUrl = uploadedFile.fileUrl;
        documentData.fileName = uploadedFile.fileName;
        documentData.fileSize = uploadedFile.fileSize.toString();
        documentData.mimeType = uploadedFile.mimeType;
      }
      
      return apiRequest("POST", "/api/documents", documentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", "residence", residenceId] });
      setIsCreateDialogOpen(false);
      setUploadedFile(null);
      form.reset();
      toast({
        title: "Success",
        description: uploadedFile ? "Document and file uploaded successfully!" : "Document created successfully.",
      });
    },
    onError: (_error: unknown) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create document",
        variant: "destructive",
      });
    },
  });

  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; _data: Partial<DocumentFormData> }) => {
      const updateData: unknown = {};




      if (data.name) {updateData.name = data.name;}




      if (data.type) {updateData.type = data.type;}




      if (data.dateReference) {updateData.dateReference = data.dateReference;} // Send as YYYY-MM-DD string




      if (data.residenceId) {updateData.residenceId = data.residenceId;}
      updateData.uploadedBy = user?.id; // Use full user ID
      return apiRequest("PUT", `/api/documents/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", "residence", residenceId] });
      setSelectedDocument(null);
      toast({
        title: "Success",
        description: "Document updated successfully",
      });
    },
    onError: (_error: unknown) => {
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
      return apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", "residence", residenceId] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    },
    onError: (_error: unknown) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({ id, fileData }: { id: string; fileData: { fileUrl: string; fileName: string; fileSize: number; mimeType: string } }) => {
      return apiRequest("POST", `/api/documents/${id}/upload`, {
        fileUrl: fileData.fileUrl,
        fileName: fileData.fileName,
        fileSize: fileData.fileSize.toString(),
        mimeType: fileData.mimeType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", "residence", residenceId] });
      setUploadingDocumentId(null);
      toast({
        title: "File uploaded",
        description: "The file has been uploaded successfully.",
      });
    },
    onError: (_error: unknown) => {
      setUploadingDocumentId(null);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    },
  });

  // Form for creating documents
  const form = useForm<DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      name: "",
      type: "other",
      dateReference: new Date().toISOString().split('T')[0],
      residenceId: residenceId || "",
    },
  });

  const handleCreateDocument = (_data: DocumentFormData) => {
    createDocumentMutation.mutate(_data);
  };

  // Handle file upload for new document
  const handleNewDocumentUpload =
   * Async function.
   * @returns Promise resolving to .

   * Async function.
   * @returns Promise resolving to .


 async (): Promise<{ method: "PUT"; url: string }> => {
    setIsUploadingNewFile(true); // Start upload tracking




    
    if (!residence) {
      setIsUploadingNewFile(false);
      throw new Error('No residence selected');
    }

    const response = await fetch('/api/documents/upload-url', { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        organizationId: building?.organizationId,
        buildingId: residence.buildingId,
        residenceId: residence.id,
        documentType: 'residence'
      })
    });




    
    if (!response.ok) {
      setIsUploadingNewFile(false);
      throw new Error('Failed to get upload URL');
    }
    
    const data = await response.json();
    return { method: "PUT" as const, url: data.uploadURL };
  };

  const handleNewDocumentUploadComplete = (_result: UploadResult<any, any>) => {
    setIsUploadingNewFile(false); // Upload finished




    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      setUploadedFile({
        fileUrl: uploadedFile.uploadURL,
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size || 0,
        mimeType: uploadedFile.type || 'application/octet-stream',
      });
      toast({
        title: "File ready",
        description: "File uploaded! Now create the document to save it.",
      });
    }
  };

  const handleDeleteDocument = (document: ResidenceDocument) => {
    if (window.confirm("Are you sure you want to delete this document?")) {
      deleteDocumentMutation.mutate(document.id);
    }
  };

  const handleFileUploadComplete = (documentId: string) => (_result: UploadResult<any, any>) => {
    const uploadedFile = result.successful[0];




    if (uploadedFile && uploadedFile.uploadURL) {
      const fileData = {
        fileUrl: uploadedFile.uploadURL,
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size || 0,
        mimeType: uploadedFile.type || 'application/octet-stream',
      };
      uploadFileMutation.mutate({ id: documentId, fileData });
    }
  };

  const handleDownloadDocument = async (document: ResidenceDocument) => {
    try {
      const response = await fetch(`/api/documents/${document.id}/download`);
      if (!response.ok) {throw new Error('Download failed');}
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.fileName || document.name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
   * Catch function.


   * Catch function.

   * Catch function.



   * Catch function.

 catch (_error) {
      toast({
        title: "Download failed",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };





  if (!residenceId) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Residence Documents" subtitle="Residence ID is required" />
        <div className="flex-1 overflow-auto p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Home className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Residence ID Required</h3>
              <p className="text-gray-500">Please provide a residence ID to view documents.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header 
        title={`Unit ${residence?.unitNumber || residenceId} Documents`}
        subtitle={`Manage documents for ${building?.name || 'this residence'} - Unit ${residence?.unitNumber || ''}`}
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          {/* Search and Filter Controls */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target._value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {DOCUMENT_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Document
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Document</DialogTitle>
                    <DialogDescription>
                      Create a new document for this residence. You can upload the file after creating.
                    </DialogDescription>
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
                              <Input {...field} placeholder="Enter document name" />
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
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
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
                        name="dateReference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reference Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* File Upload Section */}
                      <div className="space-y-3">
                        <Label>Document File (Optional)</Label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                          {isUploadingNewFile ? (
                            <div className="flex flex-col items-center space-y-2">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                              <p className="text-sm text-gray-600">Uploading file...</p>
                              <p className="text-xs text-gray-500">Please wait before creating the document</p>
                            </div>
                          ) : !uploadedFile ? (
                            <ObjectUploader
                              onGetUploadParameters={handleNewDocumentUpload}
                              onComplete={handleNewDocumentUploadComplete}
                              buttonClassName="w-full"
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Document File
                            </ObjectUploader>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <FileText className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium">{uploadedFile.fileName}</span>
                                <Badge variant="secondary">
                                  {(uploadedFile.fileSize / 1024 / 1024).toFixed(2)} MB
                                </Badge>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setUploadedFile(null)}
                              >
                                Remove
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          Upload a file to attach to this document. You can also upload it later.
                        </p>
                      </div>

                      <DialogFooter>
                        <Button 
                          type="submit" 
                          disabled={createDocumentMutation.isPending || isUploadingNewFile}
                        >
                          {createDocumentMutation.isPending ? "Creating..." : 
                           isUploadingNewFile ? "Wait for upload..." : "Create Document"}
                        </Button>
                        {isUploadingNewFile && (
                          <p className="text-xs text-amber-600 mt-1">
                            ⚠️ File upload in progress. Please wait before creating the document.
                          </p>
                        )}
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* View/Edit Document Dialog */}
              <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className={isEditMode ? "sm:max-w-[500px] max-h-[90vh] overflow-y-auto" : "sm:max-w-[800px] max-h-[90vh] overflow-y-auto"}>
                  <DialogHeader>
                    <DialogTitle>
                      {isEditMode ? "Edit Document" : "View Document"}
                    </DialogTitle>
                    <DialogDescription>
                      {isEditMode ? "Modify document details below." : selectedDocument?.name}
                    </DialogDescription>
                  </DialogHeader>

                  {selectedDocument && (
                    <div className="space-y-4">
                      {!isEditMode ? (
                        /* VIEW MODE */
                        <>
                          {/* Document Viewer */}
                          {selectedDocument.fileUrl ? (
                            <div className="space-y-4">
                              {/* Document Preview */}
                              <div className="border rounded-lg bg-gray-50">
                                {selectedDocument.mimeType?.includes('pdf') ? (
                                  <iframe
                                    src={getDisplayableFileUrl(selectedDocument.fileUrl)}
                                    className="w-full h-96 rounded-lg"
                                    title="Document Preview"
                                  />
                                ) : selectedDocument.mimeType?.startsWith('image/') ? (
                                  <img
                                    src={getDisplayableFileUrl(selectedDocument.fileUrl)}
                                    alt={selectedDocument.fileName || 'Document'}
                                    className="w-full max-h-96 object-contain rounded-lg"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                                    <FileText className="h-16 w-16 text-gray-400 mb-4" />
                                    <h3 className="font-medium text-gray-900 mb-2">{selectedDocument.fileName}</h3>
                                    <p className="text-sm text-gray-500 mb-4">
                                      {selectedDocument.mimeType} • {selectedDocument.fileSize ? (selectedDocument.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown size'}
                                    </p>
                                    <Button
                                      onClick={() => {
                                        window.open(getDisplayableFileUrl(selectedDocument.fileUrl), '_blank');
                                      }}
                                      variant="outline"
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      Open in New Tab
                                    </Button>
                                  </div>
                                )}
                              </div>
                              
                              {/* Document Actions */}
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    window.open(getDisplayableFileUrl(selectedDocument.fileUrl), '_blank');
                                  }}
                                  variant="outline"
                                  className="flex-1"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Open in New Tab
                                </Button>
                                <Button
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = getDisplayableFileUrl(selectedDocument.fileUrl);
                                    link.download = selectedDocument.fileName || 'document';
                                    link.click();
                                  }}
                                  variant="outline"
                                  className="flex-1"
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <h3 className="text-lg font-medium text-gray-900 mb-2">No file attached</h3>
                              <p className="text-gray-500 mb-4">This document doesn't have a file attached yet.</p>
                              <ObjectUploader
                                onGetUploadParameters={async () => {
                                  const response = await fetch('/api/documents/upload-url', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json'
                                    },
                                    credentials: 'include',
                                    body: JSON.stringify({
                                      organizationId: building?.organizationId,
                                      buildingId: residence?.buildingId,
                                      residenceId: residence?.id,
                                      documentType: 'residence'
                                    })
                                  });
                                  const data = await response.json();
                                  return { method: "PUT", url: data.uploadURL };
                                }}
                                onComplete={async (_result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
                                  try {
                                    const uploadedFile = result.successful[0];




                                    if (uploadedFile?.uploadURL) {
                                      await apiRequest('POST', `/api/documents/${selectedDocument.id}/upload`, {
                                        fileUrl: uploadedFile.uploadURL,
                                        fileName: uploadedFile.name,
                                        fileSize: uploadedFile.size,
                                        mimeType: uploadedFile.type
                                      });
                                      
                                      toast({
                                        title: "File uploaded successfully",
                                        description: `${uploadedFile.name} has been uploaded to the document.`,
                                      });
                                      
                                      // Refresh the documents list
                                      const queryClient = useQueryClient();
                                      await queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
                                      
                                      // Update the selected document in the dialog
                                      const updatedDocument = {
                                        ...selectedDocument,
                                        fileUrl: uploadedFile.uploadURL,
                                        fileName: uploadedFile.name,
                                        fileSize: uploadedFile.size,
                                        mimeType: uploadedFile.type
                                      };
                                      setSelectedDocument(updatedDocument);
                                    }
                                  } catch (_error) {
                                    toast({
                                      title: "Upload failed",
                                      description: "Failed to upload file. Please try again.",
                                      variant: "destructive"
                                    });
                                  }
                                }}
                                buttonClassName="w-auto"
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Upload File
                              </ObjectUploader>
                            </div>
                          )}
                          
                          {/* Document Info */}
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                            <div>
                              <Label className="text-xs text-gray-500">Category</Label>
                              <p className="text-sm">{DOCUMENT_CATEGORIES.find(c => c.value === selectedDocument.type)?.label}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Date Reference</Label>
                              <p className="text-sm">{new Date(selectedDocument.dateReference).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        /* EDIT MODE */
                        <EditDocumentForm 
                          document={selectedDocument}
                          onSave={(updatedDocument) => {
                            setSelectedDocument(updatedDocument);
                            setIsEditMode(false);
                            toast({
                              title: "Document updated",
                              description: "Document has been successfully updated.",
                            });
                          }}
                          onCancel={() => setIsEditMode(false)}
                        />
                      )}
                      
                      {/* Bottom Actions */}
                      {!isEditMode && (
                        <div className="flex gap-2 pt-4 border-t">
                          <Button
                            variant="outline"
                            onClick={() => setIsEditMode(true)}
                            className="flex-1"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Document
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {documentsLoading ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-500">Loading documents...</p>
              </CardContent>
            </Card>
          ) : (
            <div className="w-full space-y-6">
              {DOCUMENT_CATEGORIES.map((category) => {
                const categoryDocuments = documentsByCategory[category.value] || [];




                if (categoryDocuments.length === 0) {return null;}
                
                return (
                  <div key={category.value} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium flex items-center">
                        <FileText className="h-5 w-5 mr-2" />
                        {category.label} Documents
                      </h3>
                      <Badge variant="outline">
                        {documentsByCategory[category.value]?.length || 0} documents
                      </Badge>
                    </div>

                    {documentsByCategory[category.value]?.length === 0 ? (
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center py-8">
                          <FileText className="h-12 w-12 text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No {category.label.toLowerCase()} documents</h3>
                          <p className="text-gray-500">Get started by creating your first document.</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {categoryDocuments.map((document) => (
                          <Card 
                            key={document.id} 
                            className="hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => {
                              setSelectedDocument(document);
                              setIsEditMode(false);
                              setIsViewDialogOpen(true);
                            }}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <CardTitle className="text-sm font-medium mb-1 line-clamp-2">
                                    {document.name}
                                  </CardTitle>
                                  <CardDescription className="text-xs">
                                    <Calendar className="h-3 w-3 inline mr-1" />
                                    {new Date(document.dateReference).toLocaleDateString()}
                                  </CardDescription>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {DOCUMENT_CATEGORIES.find(c => c.value === document.type)?.label}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDocument(document);
                                    setIsEditMode(false);
                                    setIsViewDialogOpen(true);
                                  }}
                                  className="flex-1"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                                
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDocument(document);
                                    setIsEditMode(true);
                                    setIsViewDialogOpen(true);
                                  }}
                                  className="flex-1"
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                                
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteDocument(document);
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}