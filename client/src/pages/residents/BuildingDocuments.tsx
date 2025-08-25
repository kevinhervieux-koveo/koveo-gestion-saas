import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import {
  Search,
  FileText,
  Building,
  Download,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { useLocation } from 'wouter';

import {
  getDisplayableFileUrl,
  BUILDING_DOCUMENT_CATEGORIES as DOCUMENT_CATEGORIES,
  getCategoryLabel,
} from '@/lib/documents';

/**
 *
 */
interface BuildingDocument {
  id: string;
  name: string;
  type: string;
  dateReference: string;
  buildingId: string;
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
interface BuildingDocumentsProps {
  buildingId?: string;
}

/**
 *
 * @param root0
 * @param root0.buildingId
 */
export default function BuildingDocuments({ buildingId }: BuildingDocumentsProps) {
  const [, navigate] = useLocation();

  // State variables
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedVisibility, setSelectedVisibility] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Fetch building data
  const { data: building } = useQuery({
    queryKey: ['/api/buildings', buildingId],
    queryFn: () =>
      buildingId
        ? (apiRequest('GET', `/api/buildings/${buildingId}`) as Promise<any>)
        : Promise.resolve(null),
    enabled: !!buildingId,
  });

  // Fetch documents
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['/api/documents', 'building', buildingId],
    queryFn: () =>
      buildingId
        ? (apiRequest(
            'GET',
            `/api/documents?buildingId=${buildingId}`
          ) as Promise<unknown> as Promise<BuildingDocument[]>)
        : Promise.resolve([]),
    enabled: !!buildingId,
  });

  // Calculate available years and categories
  const availableYears = useMemo(() => {
    if (!Array.isArray(documents)) {
      return [];
    }
    const years = documents
      .map((doc: BuildingDocument) => new Date(doc.dateReference).getFullYear().toString())
      .filter(Boolean);
    return [...new Set(years)].sort((a, b) => b.localeCompare(a));
  }, [documents]);

  const availableCategories = useMemo(() => {
    if (!Array.isArray(documents)) {
      return [];
    }
    const categories = documents.map((doc: BuildingDocument) => doc.type);
    return [...new Set(categories)];
  }, [documents]);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    if (!Array.isArray(documents)) {
      return [];
    }
    return documents.filter((doc: BuildingDocument) => {
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
    const grouped: Record<string, BuildingDocument[]> = {};
    DOCUMENT_CATEGORIES.forEach((category) => {
      grouped[category._value] = filteredDocuments.filter((doc) => doc.type === category._value);
    });
    return grouped;
  }, [filteredDocuments]);

  // Pagination
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage;
  const endItem = Math.min(startItem + itemsPerPage, filteredDocuments.length);
  const paginatedDocuments = filteredDocuments.slice(startItem, endItem);

  // Event handlers
  const handleViewDocument = (document: BuildingDocument) => {
    if (document.fileUrl) {
      window.open(getDisplayableFileUrl(document.fileUrl), '_blank');
    }
  };

  const handleDownloadDocument = (document: BuildingDocument) => {
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

  if (!buildingId) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='Building Documents' subtitle='Building ID is required' />
        <div className='flex-1 overflow-auto p-6'>
          <Card>
            <CardContent className='flex flex-col items-center justify-center py-12'>
              <Building className='h-12 w-12 text-gray-400 mb-4' />
              <h3 className='text-lg font-medium text-gray-900 mb-2'>Building ID Required</h3>
              <p className='text-gray-500'>Please provide a building ID to view documents.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header
        title={`${building?.name || 'Building'} Documents`}
        subtitle={`View documents for ${building?.address || 'this building'}`}
      />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-6xl mx-auto'>
          {/* Back Button */}
          <div className='mb-6'>
            <Button
              variant='ghost'
              onClick={() => navigate('/residents/buildings')}
              className='flex items-center gap-2'
            >
              <ArrowLeft className='w-4 h-4' />
              Back to Building
            </Button>
          </div>

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
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {getCategoryLabel(category, 'building')}
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
            </div>

            {/* Summary */}
            <div className='text-sm text-gray-600'>
              Showing {startItem + 1}-{endItem} of {filteredDocuments.length} documents
              {selectedCategory !== 'all' &&
                ` in ${getCategoryLabel(selectedCategory, 'building')}`}
              {selectedYear !== 'all' && ` from ${selectedYear}`}
            </div>
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
                        : 'No documents are available for this building.'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className='space-y-6'>
                  {/* Category View */}
                  {selectedCategory === 'all' ? (
                    DOCUMENT_CATEGORIES.map((category) => {
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
                                          onClick={() => handleViewDocument(document)}
                                          disabled={!document.fileUrl}
                                        >
                                          <FileText className='h-3 w-3' />
                                        </Button>
                                        <Button
                                          size='sm'
                                          variant='ghost'
                                          onClick={() => handleDownloadDocument(document)}
                                          disabled={!document.fileUrl}
                                        >
                                          <Download className='h-3 w-3' />
                                        </Button>
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
                      );
                    })
                  ) : (
                    /* Filtered View */
                    <Card>
                      <CardHeader>
                        <CardTitle className='flex items-center gap-2'>
                          <FileText className='h-5 w-5' />
                          {getCategoryLabel(selectedCategory, 'building')} Documents
                          <Badge variant='secondary'>{filteredDocuments.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                          {paginatedDocuments.map((document) => (
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
                                      onClick={() => handleViewDocument(document)}
                                      disabled={!document.fileUrl}
                                    >
                                      <FileText className='h-3 w-3' />
                                    </Button>
                                    <Button
                                      size='sm'
                                      variant='ghost'
                                      onClick={() => handleDownloadDocument(document)}
                                      disabled={!document.fileUrl}
                                    >
                                      <Download className='h-3 w-3' />
                                    </Button>
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

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className='flex items-center justify-center gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
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
    </div>
  );
}
