import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Search, Filter, Eye, Edit2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Types
interface Demand {
  id: string;
  type: 'maintenance' | 'complaint' | 'information' | 'other';
  description: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'in_progress' | 'completed';
  submitterId: string;
  buildingId: string;
  residenceId?: string;
  assignationBuildingId?: string;
  assignationResidenceId?: string;
  createdAt: string;
  updatedAt: string;
  reviewNotes?: string;
}

interface Building {
  id: string;
  name: string;
}

interface Residence {
  id: string;
  name: string;
  buildingId: string;
}

// Form schemas
const demandSchema = z.object({
  type: z.enum(['maintenance', 'complaint', 'information', 'other']),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  buildingId: z.string().min(1, 'Building is required'),
  residenceId: z.string().optional(),
  assignationBuildingId: z.string().optional(),
  assignationResidenceId: z.string().optional(),
});

const commentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty'),
});

type DemandFormData = z.infer<typeof demandSchema>;
type CommentFormData = z.infer<typeof commentSchema>;

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-emerald-100 text-emerald-800',
};

const typeLabels = {
  maintenance: 'Maintenance',
  complaint: 'Complaint',
  information: 'Information',
  other: 'Other',
};

export default function ResidentDemandsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const [isNewDemandOpen, setIsNewDemandOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  // Fetch demands
  const { data: demands = [], isLoading } = useQuery({
    queryKey: ['/api/demands'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch buildings
  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
  });

  // Fetch residences
  const { data: residences = [] } = useQuery<Residence[]>({
    queryKey: ['/api/residences'],
  });

  // Create demand mutation
  const createDemandMutation = useMutation({
    mutationFn: async (data: DemandFormData) => {
      const response = await fetch('/api/demands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to create demand');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
      setIsNewDemandOpen(false);
      toast({
        title: 'Success',
        description: 'Demand created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create demand',
        variant: 'destructive',
      });
    },
  });

  // Update demand mutation
  const updateDemandMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DemandFormData> }) => {
      const response = await fetch(`/api/demands/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update demand');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
      setIsEditOpen(false);
      toast({
        title: 'Success',
        description: 'Demand updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update demand',
        variant: 'destructive',
      });
    },
  });

  // Submit demand mutation
  const submitDemandMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/demands/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'submitted' }),
      });
      if (!response.ok) {
        throw new Error('Failed to submit demand');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
      toast({
        title: 'Success',
        description: 'Demand submitted for review',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to submit demand',
        variant: 'destructive',
      });
    },
  });

  // Forms
  const newDemandForm = useForm<DemandFormData>({
    resolver: zodResolver(demandSchema),
    defaultValues: {
      type: 'maintenance',
      description: '',
      buildingId: '',
      residenceId: '',
      assignationBuildingId: '',
      assignationResidenceId: '',
    },
  });

  const editDemandForm = useForm<DemandFormData>({
    resolver: zodResolver(demandSchema),
  });

  // Filter demands
  const filteredDemands = (demands as Demand[]).filter((demand: Demand) => {
    const matchesSearch = demand.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         typeLabels[demand.type].toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || demand.status === statusFilter;
    const matchesType = typeFilter === 'all' || demand.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Group demands by status
  const draftDemands = filteredDemands.filter((d: Demand) => d.status === 'draft');
  const activeDemands = filteredDemands.filter((d: Demand) => 
    ['submitted', 'under_review', 'approved', 'in_progress'].includes(d.status)
  );
  const completedDemands = filteredDemands.filter((d: Demand) => 
    ['completed', 'rejected'].includes(d.status)
  );

  const handleCreateDemand = (data: DemandFormData) => {
    createDemandMutation.mutate(data);
  };

  const handleUpdateDemand = (data: DemandFormData) => {
    if (selectedDemand) {
      updateDemandMutation.mutate({ id: selectedDemand.id, data });
    }
  };

  const handleSubmitDemand = (demand: Demand) => {
    submitDemandMutation.mutate(demand.id);
  };

  const handleViewDemand = (demand: Demand) => {
    setSelectedDemand(demand);
    setIsViewOpen(true);
  };

  const handleEditDemand = (demand: Demand) => {
    setSelectedDemand(demand);
    editDemandForm.reset({
      type: demand.type,
      description: demand.description,
      buildingId: demand.buildingId,
      residenceId: demand.residenceId || '',
      assignationBuildingId: demand.assignationBuildingId || '',
      assignationResidenceId: demand.assignationResidenceId || '',
    });
    setIsEditOpen(true);
  };

  const DemandCard = ({ demand }: { demand: Demand }) => {
    const building = buildings.find(b => b.id === demand.buildingId);
    const residence = residences.find(r => r.id === demand.residenceId);

    return (
      <Card className="cursor-pointer hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{typeLabels[demand.type]}</Badge>
              <Badge className={statusColors[demand.status]}>
                {demand.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewDemand(demand);
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
              {(demand.status === 'draft') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditDemand(demand);
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDemand(demand);
                  setIsCommentsOpen(true);
                }}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardTitle className="text-base line-clamp-2">
            {demand.description.substring(0, 100)}
            {demand.description.length > 100 && '...'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Building:</strong> {building?.name || 'Unknown'}</p>
            {residence && <p><strong>Residence:</strong> {residence.name}</p>}
            <p><strong>Created:</strong> {new Date(demand.createdAt).toLocaleDateString()}</p>
            {demand.status === 'draft' && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSubmitDemand(demand);
                }}
              >
                Submit for Review
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">Loading demands...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Demands</h1>
          <p className="text-muted-foreground">
            Submit and track your requests
          </p>
        </div>
        <Dialog open={isNewDemandOpen} onOpenChange={setIsNewDemandOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Demand
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Demand</DialogTitle>
              <DialogDescription>
                Submit a new request or complaint
              </DialogDescription>
            </DialogHeader>
            <Form {...newDemandForm}>
              <form onSubmit={newDemandForm.handleSubmit(handleCreateDemand)} className="space-y-4">
                <FormField
                  control={newDemandForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="complaint">Complaint</SelectItem>
                          <SelectItem value="information">Information</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={newDemandForm.control}
                  name="buildingId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Building</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select building" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {buildings.map((building) => (
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
                <FormField
                  control={newDemandForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your request in detail..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={createDemandMutation.isPending}
                  >
                    {createDemandMutation.isPending ? 'Creating...' : 'Create Draft'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search demands..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="complaint">Complaint</SelectItem>
            <SelectItem value="information">Information</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Demands List */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="drafts">
            Drafts ({draftDemands.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({activeDemands.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedDemands.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="drafts" className="space-y-4">
          {draftDemands.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No draft demands</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {draftDemands.map((demand: Demand) => (
                <DemandCard key={demand.id} demand={demand} />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="active" className="space-y-4">
          {activeDemands.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No active demands</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeDemands.map((demand: Demand) => (
                <DemandCard key={demand.id} demand={demand} />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="completed" className="space-y-4">
          {completedDemands.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No completed demands</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedDemands.map((demand: Demand) => (
                <DemandCard key={demand.id} demand={demand} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* View Demand Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Demand Details</DialogTitle>
          </DialogHeader>
          {selectedDemand && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{typeLabels[selectedDemand.type]}</Badge>
                <Badge className={statusColors[selectedDemand.status]}>
                  {selectedDemand.status.replace('_', ' ')}
                </Badge>
              </div>
              <div>
                <Label>Description</Label>
                <p className="mt-1 text-sm">{selectedDemand.description}</p>
              </div>
              {selectedDemand.reviewNotes && (
                <div>
                  <Label>Review Notes</Label>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedDemand.reviewNotes}</p>
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                <p><strong>Created:</strong> {new Date(selectedDemand.createdAt).toLocaleString()}</p>
                <p><strong>Updated:</strong> {new Date(selectedDemand.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Demand Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Demand</DialogTitle>
          </DialogHeader>
          <Form {...editDemandForm}>
            <form onSubmit={editDemandForm.handleSubmit(handleUpdateDemand)} className="space-y-4">
              <FormField
                control={editDemandForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="complaint">Complaint</SelectItem>
                        <SelectItem value="information">Information</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editDemandForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your request in detail..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={updateDemandMutation.isPending}
                >
                  {updateDemandMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}