import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  FileText,
  Download,
  Calendar,
  ArrowLeft,
  Building,
  MapPin,
  Search,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BUILDING_DOCUMENT_CATEGORIES, getDisplayableFileUrl } from '@/lib/documents';

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

export default function BuildingDocuments() {
  const [, navigate] = useLocation();
  const params = useParams();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Get buildingId from URL (both path param and query param)
  const urlParams = new URLSearchParams(window.location.search);
  const buildingId = params.buildingId || urlParams.get('buildingId');

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      const response = await fetch('/api/auth/user', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
  });

  // Get building info
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

  const building = buildingData?.buildings?.find((b: any) => b.id === buildingId);

  // Fetch documents
  const { data: documentsData, isLoading } = useQuery({
    queryKey: ['/api/documents', 'building', buildingId],
    queryFn: async () => {
      const response = await fetch(`/api/documents?type=building&buildingId=${buildingId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
    enabled: !!buildingId,
  });

  const documents: Document[] = documentsData?.documents || [];
  const isUserTenant = user?.role === 'tenant';

  // Filter documents based on tenant visibility and search/category filters
  const filteredDocuments = documents
    .filter((doc) => !isUserTenant || doc.isVisibleToTenants)
    .filter((doc) => {
      const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || doc.type === selectedCategory;
      return matchesSearch && matchesCategory;
    });

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
          title="Building Documents"
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
        title={`${building?.name || 'Building'} Documents`}
        subtitle={
          isUserTenant
            ? 'View documents available to tenants'
            : 'Building documents and resources'
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Back button */}
          <Button
            variant="outline"
            onClick={() => navigate('/residents/building')}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Buildings
          </Button>

          {/* Building info */}
          {building && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Building className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-semibold">{building.name}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {building.address}, {building.city}, {building.province}
                    </p>
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
                      {BUILDING_DOCUMENT_CATEGORIES.map((category) => (
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

          {/* Documents count */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold" data-testid="text-documents-title">
              Documents ({filteredDocuments.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              {isUserTenant
                ? 'Showing documents available to tenants'
                : 'All building documents'}
            </p>
          </div>

          {/* Documents Grid */}
          {filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Documents Found</h3>
                <p className="text-gray-500">
                  {isUserTenant
                    ? 'No documents are currently available to tenants for this building.'
                    : searchTerm || selectedCategory !== 'all'
                    ? 'No documents match your search criteria.'
                    : 'No documents have been uploaded for this building yet.'}
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
                      {BUILDING_DOCUMENT_CATEGORIES.find(cat => cat._value === document.type)?.label || document.type}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {BUILDING_DOCUMENT_CATEGORIES.find(cat => cat._value === document.type)?.label || document.type} document
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