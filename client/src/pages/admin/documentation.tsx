import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Book, FileText, ExternalLink, Search, Plus, Edit, Eye, Download, Upload } from 'lucide-react';
import { useState } from 'react';

interface Documentation {
  id: string;
  title: string;
  category: string;
  type: 'guide' | 'api' | 'tutorial' | 'reference';
  status: 'draft' | 'published' | 'archived';
  author: string;
  lastUpdated: string;
  views: number;
  url?: string;
}

interface DocumentationCategory {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  icon: string;
}

export default function Documentation() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Mock data - in real app this would come from API
  const { data: documentation = [], isLoading } = useQuery<Documentation[]>({
    queryKey: ['/api/documentation'],
    queryFn: () => Promise.resolve([
      {
        id: '1',
        title: 'Getting Started Guide',
        category: 'Getting Started',
        type: 'guide',
        status: 'published',
        author: 'Admin',
        lastUpdated: '2024-08-15',
        views: 156,
        url: '/docs/getting-started'
      },
      {
        id: '2', 
        title: 'Organizations API Reference',
        category: 'API Reference',
        type: 'api',
        status: 'published',
        author: 'Developer',
        lastUpdated: '2024-08-10',
        views: 89,
        url: '/docs/api/organizations'
      },
      {
        id: '3',
        title: 'Property Management Tutorial',
        category: 'Property Management',
        type: 'tutorial',
        status: 'published',
        author: 'Admin',
        lastUpdated: '2024-08-12',
        views: 234,
        url: '/docs/tutorials/property-management'
      },
      {
        id: '4',
        title: 'Quebec Law 25 Compliance',
        category: 'Quebec Compliance',
        type: 'reference',
        status: 'published',
        author: 'Legal',
        lastUpdated: '2024-08-08',
        views: 178,
        url: '/docs/compliance/law-25'
      },
      {
        id: '5',
        title: 'Financial Reporting Setup',
        category: 'Financial Management',
        type: 'guide',
        status: 'draft',
        author: 'Finance',
        lastUpdated: '2024-08-14',
        views: 45,
      }
    ])
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<DocumentationCategory[]>({
    queryKey: ['/api/documentation/categories'],
    queryFn: () => Promise.resolve([
      { id: '1', name: 'Getting Started', description: 'Basic setup and configuration', documentCount: 8, icon: '🚀' },
      { id: '2', name: 'Property Management', description: 'Managing buildings and residents', documentCount: 15, icon: '🏢' },
      { id: '3', name: 'Financial Management', description: 'Budgets, billing, and reports', documentCount: 12, icon: '💰' },
      { id: '4', name: 'Quebec Compliance', description: 'Legal requirements and regulations', documentCount: 6, icon: '⚖️' },
      { id: '5', name: 'API Reference', description: 'Technical documentation for developers', documentCount: 22, icon: '🔧' },
      { id: '6', name: 'Troubleshooting', description: 'Common issues and solutions', documentCount: 9, icon: '🔍' }
    ])
  });

  const filteredDocumentation = documentation.filter(doc =>
    (selectedCategory === 'all' || doc.category === selectedCategory) &&
    (doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
     doc.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'default';
      case 'draft':
        return 'secondary';
      case 'archived':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'guide':
        return <Book className="h-4 w-4" />;
      case 'api':
        return <FileText className="h-4 w-4" />;
      case 'tutorial':
        return <Eye className="h-4 w-4" />;
      case 'reference':
        return <ExternalLink className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header 
        title="Documentation Management"
        subtitle="Manage guides, API documentation, and knowledge base"
      />
      
      <div className="flex-1 p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{documentation.length}</div>
              <p className="text-xs text-muted-foreground">
                +3 from last month
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Published</CardTitle>
              <Book className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {documentation.filter(doc => doc.status === 'published').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Live documents
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
              <p className="text-xs text-muted-foreground">
                Documentation sections
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {documentation.reduce((sum, doc) => sum + doc.views, 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>
          
          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5" />
                    <CardTitle>Documentation</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      New Document
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search and Filters */}
                <div className="flex items-center space-x-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search documentation..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 border rounded-md"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Documents Table */}
                {isLoading ? (
                  <div className="text-center py-8">Loading documentation...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Views</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocumentation.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {getTypeIcon(doc.type)}
                              {doc.title}
                            </div>
                          </TableCell>
                          <TableCell>{doc.category}</TableCell>
                          <TableCell className="capitalize">{doc.type}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusColor(doc.status)}>
                              {doc.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{doc.author}</TableCell>
                          <TableCell>{doc.views}</TableCell>
                          <TableCell>{doc.lastUpdated}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {doc.url && (
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Book className="h-5 w-5" />
                    <CardTitle>Documentation Categories</CardTitle>
                  </div>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Category
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((category) => (
                    <Card key={category.id}>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{category.icon}</span>
                          <div>
                            <CardTitle className="text-lg">{category.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{category.description}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {category.documentCount} documents
                          </span>
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}