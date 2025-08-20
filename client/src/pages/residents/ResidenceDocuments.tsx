import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { ObjectUploader } from '@/components/ObjectUploader';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  FileText,
  Download,
  Calendar,
  Eye,
  Filter,
  Upload,
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Home,
  Building,
  MapPin,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Link } from 'wouter';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'resident' | 'tenant';
}

interface Building {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  organizationId: string;
}

interface Residence {
  id: string;
  unitNumber: string;
  floor?: number;
  squareFootage?: string;
  bedrooms?: number;
  bathrooms?: string;
  buildingId: string;
}

interface ResidenceDocument {
  id: string;
  name: string;
  type: string;
  dateReference: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  mimeType?: string;
  uploadedBy: string;
  isVisibleToTenants?: boolean;
  residenceId: string;
  uploadDate: string;
}

const DOCUMENT_CATEGORIES = [
  { value: 'lease', label: 'Lease Agreement' },
  { value: 'inspection', label: 'Inspection Report' },
  { value: 'maintenance', label: 'Maintenance Request' },
  { value: 'financial', label: 'Financial Document' },
  { value: 'insurance', label: 'Insurance Document' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'renovation', label: 'Renovation' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'other', label: 'Other' }
];

const documentSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
  type: z.string().min(1, 'Document type is required'),
  dateReference: z.string().min(1, 'Reference date is required'),
  description: z.string().optional(),
  isVisibleToTenants: z.boolean().optional(),
});

export default function ResidenceDocuments() {
  // Get residenceId from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const residenceId = urlParams.get('residenceId');
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [tenantVisibilityFilter, setTenantVisibilityFilter] = useState<string>("all");
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user info
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  // Get residences info
  const { data: residences = [] } = useQuery<Residence[]>({
    queryKey: ["/api/residences"],
  });

  // Get buildings info for context
  const { data: buildingsResponse } = useQuery<{ buildings: Building[] }>({
    queryKey: ["/api/manager/buildings"],
  });

  const residence = residences.find(r => r.id === residenceId);
  const building = buildingsResponse?.buildings?.find(b => b.id === residence?.buildingId);

  // Get documents for this specific residence
  const { data: documentsResponse, isLoading: documentsLoading } = useQuery<{documents: ResidenceDocument[]}>({
    queryKey: ["/api/documents", { type: "resident", residenceId }],
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

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "all" || doc.type === selectedCategory;
      const matchesYear = selectedYear === "all" || 
        new Date(doc.dateReference).getFullYear().toString() === selectedYear;
      const matchesTenantVisibility = tenantVisibilityFilter === "all" || 
        (tenantVisibilityFilter === "visible" && doc.isVisibleToTenants) ||
        (tenantVisibilityFilter === "hidden" && !doc.isVisibleToTenants);
      
      return matchesSearch && matchesCategory && matchesYear && matchesTenantVisibility;
    });
  }, [documents, searchTerm, selectedCategory, selectedYear, tenantVisibilityFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedYear, tenantVisibilityFilter]);

  // Form setup
  const form = useForm<z.infer<typeof documentSchema>>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      name: "",
      type: "",
      dateReference: new Date().toISOString().split('T')[0],
      description: "",
      isVisibleToTenants: true,
    },
  });

  // Handle document creation
  const handleCreateDocument = async (data: z.infer<typeof documentSchema>) => {
    try {
      const createData = {
        ...data,
        residenceId,
        fileUrl: uploadedFile?.fileUrl,
        fileName: uploadedFile?.fileName,
        fileSize: uploadedFile?.fileSize?.toString(),
        mimeType: uploadedFile?.mimeType,
        isVisibleToTenants: data.isVisibleToTenants ?? true,
      };

      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createData),
      });

      if (!response.ok) {
        throw new Error('Failed to create document');
      }

      toast({ title: "Success", description: "Document created successfully" });
      setIsCreateDialogOpen(false);
      setUploadedFile(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/documents", { type: "resident", residenceId }] });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to create document",
        variant: "destructive" 
      });
    }
  };

  // Handle document update
  const handleUpdateDocument = async (data: z.infer<typeof documentSchema>) => {
    if (!selectedDocument) return;

    try {
      const updateData = {
        ...data,
        fileUrl: uploadedFile?.fileUrl || selectedDocument.fileUrl,
        fileName: uploadedFile?.fileName || selectedDocument.fileName,
        fileSize: uploadedFile?.fileSize?.toString() || selectedDocument.fileSize,
        mimeType: uploadedFile?.mimeType || selectedDocument.mimeType,
        isVisibleToTenants: data.isVisibleToTenants ?? selectedDocument.isVisibleToTenants ?? true,
      };

      const response = await fetch(`/api/documents/${selectedDocument.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error('Failed to update document');
      }

      toast({ title: "Success", description: "Document updated successfully" });
      setIsViewDialogOpen(false);
      setIsEditMode(false);
      setSelectedDocument(null);
      setUploadedFile(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/documents", { type: "resident", residenceId }] });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to update document",
        variant: "destructive" 
      });
    }
  };

  // Handle document deletion
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      toast({ title: "Success", description: "Document deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", { type: "resident", residenceId }] });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to delete document",
        variant: "destructive" 
      });
    }
  };

  // Handle file upload for new documents
  const handleNewDocumentUpload = async () => {
    setIsUploadingNewFile(true);
    const response = await fetch('/api/objects/upload', { method: 'POST' });
    const { uploadURL } = await response.json();
    return { method: 'PUT' as const, url: uploadURL };
  };

  const handleNewDocumentUploadComplete = (result: any) => {
    setIsUploadingNewFile(false);
    if (result.successful && result.successful[0]) {
      const file = result.successful[0];
      setUploadedFile({
        fileUrl: file.uploadURL,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
    }
  };

  // Handle file upload for existing documents
  const handleFileUpload = async (documentId: string) => {
    setUploadingDocumentId(documentId);
    const response = await fetch('/api/objects/upload', { method: 'POST' });
    const { uploadURL } = await response.json();
    return { method: 'PUT' as const, url: uploadURL };
  };

  const handleFileUploadComplete = (result: any, documentId: string) => {
    setUploadingDocumentId(null);
    if (result.successful && result.successful[0]) {
      const file = result.successful[0];
      setUploadedFile({
        fileUrl: file.uploadURL,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
    }
  };

  if (!residenceId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-gray-500">No residence ID provided</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!residence) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-gray-500">Residence not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto p-6 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/residents/residence" className="hover:text-blue-600 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back to Residence
          </Link>
          <span>/</span>
          <span>Documents</span>
        </div>

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
            <div className="flex items-center gap-2 text-gray-600 mt-1">
              <Home className="w-4 h-4" />
              <span>Unit {residence.unitNumber}</span>
              {building && (
                <>
                  <span>•</span>
                  <Building className="w-4 h-4" />
                  <span>{building.name}</span>
                  <span>•</span>
                  <MapPin className="w-4 h-4" />
                  <span>{building.address}</span>
                </>
              )}
            </div>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Document
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Document</DialogTitle>
                <DialogDescription>
                  Upload a file or create a document entry for this residence.
                </DialogDescription>
              </DialogHeader>
              
              {/* File Upload Section */}
              {!uploadedFile ? (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Document File</h3>
                  <p className="text-gray-500 mb-4">Select a file to upload for this document (optional)</p>
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={50 * 1024 * 1024} // 50MB
                    onGetUploadParameters={handleNewDocumentUpload}
                    onComplete={handleNewDocumentUploadComplete}
                    buttonClassName="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                    disabled={isUploadingNewFile}
                  >
                    {isUploadingNewFile ? 'Uploading...' : 'Select File'}
                  </ObjectUploader>
                </div>
              ) : (
                <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-green-600 mr-3" />
                    <div className="flex-1">
                      <p className="font-medium text-green-800">{uploadedFile.fileName}</p>
                      <p className="text-sm text-green-600">
                        File ready to attach ({(uploadedFile.fileSize / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadedFile(null)}
                      className="text-green-600 hover:text-green-800"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateDocument)} className="space-y-4">
                  <FormField
                    control={form.control}
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
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select document type" />
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
                          <Input type="date" {...field} />
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
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add a description for this document"
                            className="min-h-[80px]"
                            {...field}
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
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base font-medium">Available For Tenant</FormLabel>
                          <div className="text-sm text-gray-500">
                            Allow tenants to view this document
                          </div>
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
                  
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="flex-1">
                      Create Document
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreateDialogOpen(false);
                        setUploadedFile(null);
                        form.reset();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="search" className="text-sm font-medium">Search Documents</Label>
                <Input
                  id="search"
                  placeholder="Search by document name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div className="flex gap-4">
                <div>
                  <Label className="text-sm font-medium">Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-40 mt-1">
                      <SelectValue />
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
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Year</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-24 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Tenant Access</Label>
                  <Select value={tenantVisibilityFilter} onValueChange={setTenantVisibilityFilter}>
                    <SelectTrigger className="w-32 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="visible">Visible</SelectItem>
                      <SelectItem value="hidden">Hidden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredDocuments.length)} of {filteredDocuments.length} documents
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Filtered results</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documents ({filteredDocuments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documentsLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading documents...</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">
                  {documents.length === 0 ? 'No documents found' : 'No documents match your filters'}
                </p>
                <p className="text-sm text-gray-400">
                  {documents.length === 0 
                    ? 'Add your first document using the button above'
                    : 'Try adjusting your search or filter criteria'
                  }
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {paginatedDocuments.map((document) => (
                  <div
                    key={document.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-gray-900 truncate">{document.name}</h3>
                          <Badge variant="outline" className="shrink-0">
                            {DOCUMENT_CATEGORIES.find(cat => cat.value === document.type)?.label || document.type}
                          </Badge>
                          <Badge 
                            variant={document.isVisibleToTenants ? "secondary" : "destructive"} 
                            className="shrink-0 text-xs"
                          >
                            {document.isVisibleToTenants ? "Tenant Visible" : "Tenant Hidden"}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(document.dateReference).toLocaleDateString()}
                          </div>
                          {document.fileName && (
                            <div className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              {document.fileName}
                            </div>
                          )}
                          {document.fileSize && (
                            <span>{(parseInt(document.fileSize) / 1024 / 1024).toFixed(2)} MB</span>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          Uploaded {new Date(document.uploadDate).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedDocument(document);
                            setIsViewDialogOpen(true);
                          }}
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        {document.fileUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(document.fileUrl, '_blank')}
                            title="Download File"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedDocument(document);
                            setIsEditMode(true);
                            setIsViewDialogOpen(true);
                            form.reset({
                              name: document.name,
                              type: document.type,
                              dateReference: document.dateReference ? document.dateReference.split('T')[0] : new Date().toISOString().split('T')[0],
                              description: '',
                              isVisibleToTenants: document.isVisibleToTenants ?? true,
                            });
                          }}
                          title="Edit Document"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDocument(document.id)}
                          title="Delete Document"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Pagination Controls */}
            {filteredDocuments.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* View/Edit Document Dialog */}
        <Dialog 
          open={isViewDialogOpen} 
          onOpenChange={(open) => {
            setIsViewDialogOpen(open);
            if (!open) {
              setSelectedDocument(null);
              setIsEditMode(false);
              setUploadedFile(null);
              form.reset();
            }
          }}
        >
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? 'Edit Document' : 'Document Details'}
              </DialogTitle>
            </DialogHeader>
            
            {selectedDocument && (
              <div className="space-y-4">
                {isEditMode ? (
                  <>
                    {/* File Upload Section for Edit */}
                    {!uploadedFile && !selectedDocument.fileUrl && (
                      <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                        <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500 mb-4">Add a file to this document</p>
                        <ObjectUploader
                          maxNumberOfFiles={1}
                          maxFileSize={50 * 1024 * 1024}
                          onGetUploadParameters={() => handleFileUpload(selectedDocument.id)}
                          onComplete={(result) => handleFileUploadComplete(result, selectedDocument.id)}
                          buttonClassName="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                          disabled={uploadingDocumentId === selectedDocument.id}
                        >
                          {uploadingDocumentId === selectedDocument.id ? 'Uploading...' : 'Select File'}
                        </ObjectUploader>
                      </div>
                    )}
                    
                    {(uploadedFile || selectedDocument.fileUrl) && (
                      <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                        <div className="flex items-center">
                          <FileText className="h-8 w-8 text-green-600 mr-3" />
                          <div className="flex-1">
                            <p className="font-medium text-green-800">
                              {uploadedFile?.fileName || selectedDocument.fileName || 'File attached'}
                            </p>
                            <p className="text-sm text-green-600">
                              {uploadedFile ? 
                                `New file (${(uploadedFile.fileSize / 1024 / 1024).toFixed(2)} MB)` :
                                `Current file${selectedDocument.fileSize ? ` (${(parseInt(selectedDocument.fileSize) / 1024 / 1024).toFixed(2)} MB)` : ''}`
                              }
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setUploadedFile(null)}
                            className="text-green-600 hover:text-green-800"
                          >
                            {uploadedFile ? 'Remove' : 'Replace'}
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleUpdateDocument)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
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
                          control={form.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Document Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
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
                                <Input type="date" {...field} />
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
                                <Textarea 
                                  placeholder="Add a description for this document"
                                  className="min-h-[80px]"
                                  {...field}
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
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base font-medium">Available For Tenant</FormLabel>
                                <div className="text-sm text-gray-500">
                                  Allow tenants to view this document
                                </div>
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
                        
                        <div className="flex gap-2 pt-4">
                          <Button type="submit" className="flex-1">
                            Update Document
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsEditMode(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Document Name</Label>
                        <p className="text-lg font-semibold">{selectedDocument.name}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Category</Label>
                          <p className="capitalize">
                            {DOCUMENT_CATEGORIES.find(cat => cat.value === selectedDocument.type)?.label || selectedDocument.type}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Reference Date</Label>
                          <p>{new Date(selectedDocument.dateReference).toLocaleDateString()}</p>
                        </div>
                      </div>
                      
                      {selectedDocument.fileUrl && (
                        <div>
                          <Label className="text-sm font-medium text-gray-600">File</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <FileText className="w-4 h-4" />
                            <span>{selectedDocument.fileName || 'Document file'}</span>
                            {selectedDocument.fileSize && (
                              <span className="text-sm text-gray-500">
                                ({(parseInt(selectedDocument.fileSize) / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(selectedDocument.fileUrl, '_blank')}
                              className="ml-auto"
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Upload Date</Label>
                        <p>{new Date(selectedDocument.uploadDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={() => setIsEditMode(true)}
                        className="flex-1"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Document
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsViewDialogOpen(false)}
                      >
                        Close
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}