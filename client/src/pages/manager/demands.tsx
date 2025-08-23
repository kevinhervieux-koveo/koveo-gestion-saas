import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import DemandDetailsPopup from '@/components/demands/demand-details-popup';
import { Header } from '@/components/layout/header';

// Types
/**
 *
 */
interface Demand {
  id: string;
  type: 'maintenance' | 'complaint' | 'information' | 'other';
  description: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'cancelled';
  submitterId: string;
  buildingId: string;
  residenceId?: string;
  assignationBuildingId?: string;
  assignationResidenceId?: string;
  createdAt: string;
  updatedAt: string;
  reviewNotes?: string;
  submitter?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  residence?: {
    id: string;
    unitNumber: string;
    buildingId: string;
  };
  building?: {
    id: string;
    name: string;
    address: string;
  };
}

/**
 *
 */
interface Building {
  id: string;
  name: string;
}

/**
 *
 */
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

/**
 *
 */
type DemandFormData = z.infer<typeof demandSchema>;

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const typeLabels = {
  maintenance: 'Maintenance',
  complaint: 'Complaint',
  information: 'Information',
  other: 'Other',
};

/**
 *
 */
export default function /**
   * Manager demands page function.
   */ /**
   * Manager demands page function.
   */

 ManagerDemandsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const [isNewDemandOpen, setIsNewDemandOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Fetch demands
  const { data: demands = [], isLoading } = useQuery({
    queryKey: ['/api/demands'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Debug: Log demands data
  console.log('Demands data:', demands, 'Length:', demands.length);

  // Fetch buildings
  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
  });

  // Fetch residences
  const { data: residences = [] } = useQuery<Residence[]>({
    queryKey: ['/api/residences'],
  });

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/user'],
  });

  // Provide default user to prevent type errors
  const defaultUser = currentUser || { id: '', role: 'tenant' as const, email: '' };

  // Create demand mutation
  const createDemandMutation = useMutation({
    mutationFn: async (data: DemandFormData) => {
      const response = await fetch('/api/demands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }); /**
   * If function.
   * @param !response.ok - !response.ok parameter.
   */ /**
   * If function.
   * @param !response.ok - !response.ok parameter.
   */


      if (!response.ok) {
        throw new Error('Failed to create demand');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
      setIsNewDemandOpen(false);
      newDemandForm.reset();
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

  // Filter demands
  const filteredDemands = (demands as Demand[]).filter((demand: Demand) => {
    const matchesSearch = demand.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         typeLabels[demand.type]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         demand.submitter?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         demand.submitter?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         demand.building?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || demand.status === statusFilter;
    const matchesType = typeFilter === 'all' || demand.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Debug: Log filtering results
  console.log('Filtered demands:', filteredDemands.length, 'Search:', searchTerm, 'Status:', statusFilter, 'Type:', typeFilter);

  // Group demands by status for manager view
  const pendingDemands = filteredDemands.filter((d: Demand) => 
    ['submitted', 'under_review'].includes(d.status)
  );
  const activeDemands = filteredDemands.filter((d: Demand) => 
    ['approved', 'in_progress'].includes(d.status)
  );
  const completedDemands = filteredDemands.filter((d: Demand) => 
    ['completed', 'rejected', 'cancelled'].includes(d.status)
  );
  const allDemands = filteredDemands;

  const handleCreateDemand = (data: DemandFormData) => {
    createDemandMutation.mutate(data);
  };

  const handleDemandClick = (demand: Demand) => {
    setSelectedDemand(demand);
    setIsDetailsOpen(true);
  };

  const handleDemandUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
  };

  const DemandCard = ({ demand }: { demand: Demand }) => {
    const building = buildings.find(b => b.id === demand.buildingId);
    const residence = residences.find(r => r.id === demand.residenceId);

    return (
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => handleDemandClick(demand)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{typeLabels[demand.type]}</Badge>
              <Badge className={statusColors[demand.status]}>
                {demand.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <CardTitle className="text-base line-clamp-2">
            {demand.description.substring(0, 100)}
            {demand.description.length > 100 && '...'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Submitted by:</strong> {demand.submitter?.firstName} {demand.submitter?.lastName}</p>
            <p><strong>Building:</strong> {building?.name || 'Unknown'}</p>
            {residence && <p><strong>Residence:</strong> {residence.name}</p>}
            <p><strong>Created:</strong> {new Date(demand.createdAt).toLocaleDateString()}</p>
          </div>
        </CardContent>
      </Card>
    );
  }; /**
   * If function.
   * @param isLoading - IsLoading parameter.
   */ /**
   * If function.
   * @param isLoading - IsLoading parameter.
   */



  if (isLoading) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='Demands Management' subtitle='Manage maintenance requests and demands' />
        <div className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">Loading demands...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Demands Management' subtitle='Manage maintenance requests and demands' />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">All Demands</h2>
              <p className="text-muted-foreground">
                Review and manage resident demands
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
                    Create a demand on behalf of a resident
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
                              placeholder="Describe the demand in detail..."
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
                        {createDemandMutation.isPending ? 'Creating...' : 'Create'}
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
                <SelectItem value="cancelled">Cancelled</SelectItem>
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
          <Tabs defaultValue="pending" className="w-full">
            <TabsList>
              <TabsTrigger value="pending">
                Pending Review ({pendingDemands.length})
              </TabsTrigger>
              <TabsTrigger value="active">
                Active ({activeDemands.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({completedDemands.length})
              </TabsTrigger>
              <TabsTrigger value="all">
                All ({allDemands.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="pending" className="space-y-4">
              {pendingDemands.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">No demands pending review</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {pendingDemands.map((demand: Demand) => (
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

            <TabsContent value="all" className="space-y-4">
              {allDemands.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">No demands found</p>
                    {demands.length > 0 && (
                      <p className="text-sm text-gray-400 mt-2">
                        ({demands.length} total demands loaded, but filtered out)
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {allDemands.map((demand: Demand) => (
                    <DemandCard key={demand.id} demand={demand} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Demand Details Popup */}
          <DemandDetailsPopup
            demand={selectedDemand}
            isOpen={isDetailsOpen}
            onClose={() => setIsDetailsOpen(false)}
            user={defaultUser}
            onDemandUpdated={handleDemandUpdated}
          />
        </div>
      </div>
    </div>
  );
}