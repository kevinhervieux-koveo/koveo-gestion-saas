import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, Search, Calendar, Building, ArrowLeft, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocation } from "wouter";

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

/**
 *
 */
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
  isVisibleToTenants?: boolean;
}

/**
 *
 */
interface Building {
  id: string;
  name: string;
  address: string;
  [key: string]: any;
}

/**
 *
 * @param bytes
 */
/**
 * FormatFileSize function.
 * @param bytes
 * @returns Function result.
 */
function  /**
   * Format file size.
   * @param bytes? - bytes? parameter.
   * @returns String result.
   */
 formatFileSize(bytes?: number): string {  /**
   * If function.
   * @param !bytes - !bytes parameter.
   */

  if (!bytes) {return 'Unknown size';}
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 *
 * @param dateString
 */
/**
 * FormatDate function.
 * @param dateString
 * @returns Function result.
 */
function  /**
   * Format date.
   * @param dateString - dateString parameter.
   * @returns String result.
   */
 formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 *
 * @param value
 */
/**
 * GetCategoryLabel function.
 * @param value
 * @returns Function result.
 */
function  /**
   * Get category label.
   * @param value - Value to process.
   * @returns String result.
   */
 getCategoryLabel(value: string): string {
  // Return the actual document type as a formatted label
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 *
 */
export default function  /**
   * Residents building documents function.
   */
 ResidentsBuildingDocuments() {
  const [, navigate] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const buildingId = urlParams.get('buildingId');
  
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedVisibility, setSelectedVisibility] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  const { toast } = useToast();

  // Get building info
  const { data: buildingsResponse } = useQuery<{ buildings: Building[] }>({
    queryKey: ["/api/manager/buildings"],
  });

  const building = buildingsResponse?.buildings?.find(b => b.id === buildingId);

  // Get documents for this specific building
  const { data: documentsResponse, isLoading: documentsLoading } = useQuery<{documents: BuildingDocument[]}>({
    queryKey: ["/api/documents", "building", buildingId],
    queryFn: async () => {  /**
   * If function.
   * @param !buildingId - !buildingId parameter.
   */

      if (!buildingId) {return {documents: []};}
      const response = await fetch(`/api/documents?type=building&buildingId=${buildingId}`);  /**
   * If function.
   * @param !response.ok - !response.ok parameter.
   */
  /**
   * If function.
   * @param !response.ok - !response.ok parameter.
   */

      if (!response.ok) {throw new Error('Failed to fetch documents');}
      return response.json();
    },
    enabled: !!buildingId,
  });
  
  const documents = documentsResponse?.documents || [];
  

  // Get available categories from documents for this building
  const availableCategories = useMemo(() => {
    const buildingDocs = documents.filter(doc => doc.buildingId === buildingId);
    const categories = Array.from(new Set(buildingDocs.map(doc => doc.type || 'other')));
    return categories.sort();
  }, [documents, buildingId]);

  // Get available years from documents
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    documents.forEach(doc => {
      const year = new Date(doc.dateReference).getFullYear().toString();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [documents]);

  // Filter documents - first by building, then by user filters
  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // First ensure we only show documents for this building
    filtered = filtered.filter(doc => doc.buildingId === buildingId);

    // Apply user filters  /**
   * If function.
   * @param searchTerm - searchTerm parameter.
   */

    if (searchTerm) {
      filtered = filtered.filter(doc => 
        doc.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }  /**
   * If function.
   * @param selectedCategory !== "all" - selectedCategory !== "all" parameter.
   */


    if (selectedCategory !== "all") {
      filtered = filtered.filter(doc => doc.type === selectedCategory);
    }  /**
   * If function.
   * @param selectedYear !== "all" - selectedYear !== "all" parameter.
   */


    if (selectedYear !== "all") {
      filtered = filtered.filter(doc => 
        new Date(doc.dateReference).getFullYear().toString() === selectedYear
      );
    }  /**
   * If function.
   * @param selectedVisibility !== "all" - selectedVisibility !== "all" parameter.
   */


    if (selectedVisibility !== "all") {
      filtered = filtered.  /**
   * Filter .
   * @param doc => {
        if (selectedVisibility === "visible" - doc => {
        if (selectedVisibility === "visible" parameter.
   */
filter(doc => {
        if (selectedVisibility === "visible") {
          return doc.isVisibleToTenants === true;
        } else  /**
   * If function.
   * @param selectedVisibility === "hidden" - selectedVisibility === "hidden" parameter.
   */
 if (selectedVisibility === "hidden") {
          return doc.isVisibleToTenants === false || doc.isVisibleToTenants === undefined;
        }
        return true;
      });
    }

    return filtered;
  }, [documents, searchTerm, selectedCategory, selectedYear, selectedVisibility, buildingId]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedYear, selectedVisibility]);


  // Paginate filtered documents
  const paginatedDocuments = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredDocuments.slice(startIndex, endIndex);
  }, [filteredDocuments, currentPage, ITEMS_PER_PAGE]);

  // Calculate pagination info
  const totalPages = Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE);
  const startItem = filteredDocuments.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, filteredDocuments.length);

  // Group paginated documents by their actual types for display
  const documentsByCategory = useMemo(() => {
    const grouped: Record<string, BuildingDocument[]> = {};
    
    // Group documents by their actual type values
    paginatedDocuments.  /**
   * For each function.
   * @param doc => {
      const type = doc.type || 'other';
      if (!grouped[type] - doc => {
      const type = doc.type || 'other';
      if (!grouped[type] parameter.
   */
forEach(doc => {
      const type = doc.type || 'other';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(doc);
    });

    return grouped;
  }, [paginatedDocuments]);

  const handleDownloadDocument = async (document: BuildingDocument) => {
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
    }  /**
   * Catch function.
   * @param _error - _error parameter.
   */
  /**
   * Catch function.
   * @param _error - _error parameter.
   */
 catch (_error) {
      toast({
        title: "Download failed",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const handleViewDocument = async (document: BuildingDocument) => {
    try {  /**
   * If function.
   * @param document.fileUrl - document.fileUrl parameter.
   */

      if (document.fileUrl) {
        window.open(document.fileUrl, '_blank');
      } else {
        const response = await fetch(`/api/documents/${document.id}/view`);  /**
   * If function.
   * @param !response.ok - !response.ok parameter.
   */

        if (!response.ok) {throw new Error('Failed to get document view URL');}
        
        const data = await response.json();  /**
   * If function.
   * @param data.viewUrl - data.viewUrl parameter.
   */

        if (data.viewUrl) {
          window.open(data.viewUrl, '_blank');
        }
      }
    } catch (_error) {
      toast({
        title: "View failed",
        description: "Failed to open document for viewing",
        variant: "destructive",
      });
    }
  };  /**
   * If function.
   * @param !buildingId - !buildingId parameter.
   */


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
        subtitle={`View documents for ${building?.address || 'this building'}`}
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <div className="mb-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/residents/building')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Building
            </Button>
          </div>

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
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {getCategoryLabel(category)}
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

              <Select value={selectedVisibility} onValueChange={setSelectedVisibility}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Tenant visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Documents</SelectItem>
                  <SelectItem value="visible">Visible to Tenants</SelectItem>
                  <SelectItem value="hidden">Hidden from Tenants</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results summary */}
            <div className="text-sm text-muted-foreground mb-4">
              Showing {startItem}-{endItem} of {filteredDocuments.length} documents
              {selectedCategory !== 'all' && ` in ${getCategoryLabel(selectedCategory)}`}
              {selectedYear !== 'all' && ` from ${selectedYear}`}
              {selectedVisibility === 'visible' && ` (visible to tenants)`}
              {selectedVisibility === 'hidden' && ` (hidden from tenants)`}
            </div>
          </div>

          {/* Loading state */}
          {documentsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <>
              {filteredDocuments.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {searchTerm || selectedCategory !== 'all' || selectedYear !== 'all' 
                        ? 'No documents match your filters' 
                        : 'No documents available'
                      }
                    </h3>
                    <p className="text-gray-500">
                      {searchTerm || selectedCategory !== 'all' || selectedYear !== 'all' 
                        ? 'Try adjusting your search criteria or filters.'
                        : 'Documents will appear here when they are uploaded.'
                      }
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6">
                  {/* Show documents grouped by category if no specific category is selected */}
                  {selectedCategory === 'all' ? (
                    Object.entries(documentsByCategory).map(([categoryValue, categoryDocuments]) => {  /**
   * If function.
   * @param categoryDocuments.length === 0 - categoryDocuments.length === 0 parameter.
   */

                      if (categoryDocuments.length === 0) {return null;}
                      
                      return (
                        <Card key={categoryValue}>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <FileText className="w-5 h-5" />
                              {getCategoryLabel(categoryValue)}
                              <Badge variant="secondary" className="ml-auto">
                                {categoryDocuments.length}
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {categoryDocuments.map((document) => (
                                <div key={document.id} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3">
                                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                      <div className="min-w-0 flex-1">
                                        <h4 className="font-medium truncate">{document.name}</h4>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                          <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(document.dateReference)}
                                          </span>
                                          {document.fileName && (
                                            <span>{document.fileName}</span>
                                          )}
                                          {document.fileSize && (
                                            <span>{formatFileSize(document.fileSize)}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <div className="flex items-center gap-2">
                                      {document.isVisibleToTenants !== undefined && (
                                        <Badge variant={document.isVisibleToTenants ? "default" : "secondary"} className="text-xs">
                                          {document.isVisibleToTenants ? "Visible to Tenants" : "Hidden from Tenants"}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleViewDocument(document)}
                                      >
                                        <Eye className="w-4 h-4 mr-1" />
                                        View
                                      </Button>
                                      {document.fileUrl && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleDownloadDocument(document)}
                                        >
                                          <Download className="w-4 h-4 mr-1" />
                                          Download
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  ) : (
                    // Show all documents in a single list when a specific category is selected
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          {getCategoryLabel(selectedCategory)} Documents
                          <Badge variant="secondary" className="ml-auto">
                            {filteredDocuments.length}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {paginatedDocuments.map((document) => (
                            <div key={document.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3">
                                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <h4 className="font-medium truncate">{document.name}</h4>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {formatDate(document.dateReference)}
                                      </span>
                                      {document.fileName && (
                                        <span>{document.fileName}</span>
                                      )}
                                      {document.fileSize && (
                                        <span>{formatFileSize(document.fileSize)}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                  {document.isVisibleToTenants !== undefined && (
                                    <Badge variant={document.isVisibleToTenants ? "default" : "secondary"} className="text-xs">
                                      {document.isVisibleToTenants ? "Visible to Tenants" : "Hidden from Tenants"}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewDocument(document)}
                                  >
                                    <Eye className="w-4 h-4 mr-1" />
                                    View
                                  </Button>
                                  {document.fileUrl && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDownloadDocument(document)}
                                    >
                                      <Download className="w-4 h-4 mr-1" />
                                      Download
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
              
              {/* Pagination Controls */}
              {filteredDocuments.length > 0 && totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Page {currentPage} of {totalPages}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;  /**
   * If function.
   * @param pageNum > totalPages - pageNum > totalPages parameter.
   */

                        if (pageNum > totalPages) {return null;}
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === currentPage ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}