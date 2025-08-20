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
import { Upload, Download, Edit, Trash2, FileText, Search, Plus, Building, Calendar, Filter } from "lucide-react";
import { Header } from "@/components/layout/header";
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

// Form schema for creating/editing building documents
const documentFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  type: z.enum(['bylaw', 'financial', 'maintenance', 'legal', 'meeting_minutes', 'insurance', 'contracts', 'permits', 'inspection', 'other']),
  dateReference: z.string().refine((dateStr) => {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }, {
    message: "Valid date is required",
  }),
  buildingId: z.string().min(1, "Building ID is required"),
});

type DocumentFormData = z.infer<typeof documentFormSchema>;

interface BuildingDocument {
  id: string;
  name: string;
  type: string;
  dateReference: string;
  uploadDate: string;
  buildingId: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  fileUrl?: string;
}

interface User {
  id: string;
  role: string;
  [key: string]: any;
}

interface Building {
  id: string;
  name: string;
  address: string;
  [key: string]: any;
}

export default function BuildingDocuments() {
  // Get buildingId from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const buildingId = urlParams.get('buildingId');
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<BuildingDocument | null>(null);
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
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  // Get building info
  const { data: buildingsResponse } = useQuery<{ buildings: Building[] }>({
    queryKey: ["/api/manager/buildings"],
  });

  const building = buildingsResponse?.buildings?.find(b => b.id === buildingId);

  // Get documents for this specific building
  const { data: documentsResponse, isLoading: documentsLoading } = useQuery<{documents: BuildingDocument[]}>({
    queryKey: ["/api/documents", "building", buildingId],
    queryFn: async () => {
      if (!buildingId) return {documents: []};
      const response = await fetch(`/api/documents?type=building&buildingId=${buildingId}`);
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
    enabled: !!buildingId,
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
    const grouped: Record<string, BuildingDocument[]> = {};
    
    DOCUMENT_CATEGORIES.forEach(category => {
      grouped[category.value] = filteredDocuments.filter(doc => doc.type === category.value);
    });

    return grouped;
  }, [filteredDocuments]);

  // Create document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }
      
      // Use full user ID as string (backend now accepts any string)
      console.log("Creating document with user ID:", user.id, "(length:", user.id.length, ")"); // Debug log
      
      const documentData: any = {
        name: data.name,
        type: data.type, // This is the document category (bylaw, financial, etc.)
        dateReference: data.dateReference, // Send as YYYY-MM-DD string
        buildingId: data.buildingId,
        uploadedBy: user.id, // Use full user ID
      };
      
      // Add file data if uploaded
      if (uploadedFile) {
        documentData.fileUrl = uploadedFile.fileUrl;
        documentData.fileName = uploadedFile.fileName;
        documentData.fileSize = uploadedFile.fileSize.toString();
        documentData.mimeType = uploadedFile.mimeType;
      }
      
      console.log("Document data being sent:", documentData); // Debug log
      return apiRequest("POST", "/api/documents", documentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", "building", buildingId] });
      setIsCreateDialogOpen(false);
      setUploadedFile(null);
      form.reset();
      toast({
        title: "Success",
        description: uploadedFile ? "Document and file uploaded successfully!" : "Document created successfully.",
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
      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      if (data.type) updateData.type = data.type;
      if (data.dateReference) updateData.dateReference = data.dateReference; // Send as YYYY-MM-DD string
      if (data.buildingId) updateData.buildingId = data.buildingId;
      updateData.uploadedBy = user?.id; // Use full user ID
      return apiRequest("PUT", `/api/documents/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", "building", buildingId] });
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
      return apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", "building", buildingId] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/documents", "building", buildingId] });
      setUploadingDocumentId(null);
      toast({
        title: "File uploaded",
        description: "The file has been uploaded successfully.",
      });
    },
    onError: (error: any) => {
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
      buildingId: buildingId || "",
    },
  });

  const handleCreateDocument = (data: DocumentFormData) => {
    createDocumentMutation.mutate(data);
  };

  // Handle file upload for new document
  const handleNewDocumentUpload = async (): Promise<{ method: "PUT"; url: string }> => {
    setIsUploadingNewFile(true); // Start upload tracking
    const response = await fetch('/api/documents/upload-url', { 
      method: 'POST',
      credentials: 'include'
    });
    const data = await response.json();
    return { method: "PUT" as const, url: data.uploadURL };
  };

  const handleNewDocumentUploadComplete = (result: UploadResult<any, any>) => {
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

  const handleDeleteDocument = (document: BuildingDocument) => {
    if (window.confirm("Are you sure you want to delete this document?")) {
      deleteDocumentMutation.mutate(document.id);
    }
  };

  const handleFileUploadComplete = (documentId: string) => (result: UploadResult<any, any>) => {
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

  const handleDownloadDocument = async (document: BuildingDocument) => {
    try {
      const response = await fetch(`/api/documents/${document.id}/download`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.fileName || document.name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  if (!buildingId) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Building Documents" subtitle="Building ID is required" />
        <div className="flex-1 overflow-auto p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Building ID Required</h3>
              <p className="text-gray-500">Please provide a building ID to view documents.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header 
        title={`${building?.name || 'Building'} Documents`}
        subtitle={`Manage documents for ${building?.address || 'this building'} with category separation and year filtering`}
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
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                      Create a new document for this building. You can upload the file after creating.
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
            <Tabs defaultValue={DOCUMENT_CATEGORIES[0].value} className="w-full">
              <TabsList className="grid grid-cols-5 lg:grid-cols-10 mb-6">
                {DOCUMENT_CATEGORIES.map((category) => (
                  <TabsTrigger 
                    key={category.value} 
                    value={category.value}
                    className="text-xs"
                  >
                    {category.label}
                    <Badge variant="outline" className="ml-1 text-xs">
                      {documentsByCategory[category.value]?.length || 0}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              {DOCUMENT_CATEGORIES.map((category) => (
                <TabsContent key={category.value} value={category.value}>
                  <div className="space-y-4">
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
                        {documentsByCategory[category.value]?.map((document) => (
                          <Card key={document.id} className="hover:shadow-md transition-shadow">
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
                                {document.fileUrl ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDownloadDocument(document)}
                                    className="flex-1"
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    Download
                                  </Button>
                                ) : (
                                  <ObjectUploader
                                    onGetUploadParameters={async () => {
                                      const response = await fetch('/api/documents/upload-url', {
                                        method: 'POST',
                                        credentials: 'include'
                                      });
                                      const data = await response.json();
                                      return { method: "PUT", url: data.uploadURL };
                                    }}
                                    onComplete={handleFileUploadComplete(document.id)}
                                    buttonClassName="flex-1"
                                  >
                                    <Upload className="h-3 w-3 mr-1" />
                                    Upload File
                                  </ObjectUploader>
                                )}
                                
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteDocument(document)}
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
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}