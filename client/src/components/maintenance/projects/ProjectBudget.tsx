import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ColumnDef, Row } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/ui/data-table';
// Removed Form imports since we're no longer using forms for budget categories
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { cn, parseDateOnly } from '@/lib/utils';
import {
  DollarSign,
  Plus,
  MoreHorizontal,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  Building,
  Wrench,
  FileText,
  Download,
  Calculator,
  PieChart,
  Eye,
} from 'lucide-react';

export interface ProjectBudgetProps {
  project: MaintenanceProject;
  className?: string;
  variant?: 'overview' | 'detailed';
  showChangeOrders?: boolean;
  showElementAllocation?: boolean;
  editable?: boolean;
}

interface BudgetBreakdown {
  category: string;
  description: string;
  budgetAmount: number;
  actualAmount: number;
  elementCount?: number;
  vendorCount?: number;
}

interface BudgetSummary {
  totalBudget: number;
  totalActual: number;
  totalAllocated: number;
  utilizationPercentage: number;
  isOverBudget: boolean;
  remainingBudget: number;
  elementAllocations: BudgetBreakdown[];
  historyBreakdown: {
    vendorCosts: number;
    materialCosts: number;
    laborCosts: number;
    otherCosts: number;
  };
}

// Removed budget category form schema since we're now aggregate-only

const budgetCategories = [
  { name: 'Element Allocations', description: 'Budget allocated to specific building elements', icon: Building },
  { name: 'Vendor Costs', description: 'Historical contractor and vendor expenses', icon: Wrench },
  { name: 'Materials', description: 'Material and supply costs from history', icon: FileText },
  { name: 'Labor', description: 'Labor costs from project work', icon: Target },
  { name: 'Unallocated', description: 'Budget not yet allocated to specific elements', icon: DollarSign },
];

/**
 * ProjectBudget component for comprehensive budget tracking and cost management
 * Features budget breakdown, change orders, approval workflows, and cost allocation
 */
export function ProjectBudget({
  project,
  className,
  variant = 'overview',
  showChangeOrders = true,
  showElementAllocation = true,
  editable = true,
}: ProjectBudgetProps) {
  const { hasPermission, buildingId } = useBuildingContext();
  const { toast } = useToast();
  
  // State management - simplified for aggregate-only view
  const [selectedBreakdown, setSelectedBreakdown] = useState<BudgetBreakdown | null>(null);
  const [showBreakdownDetails, setShowBreakdownDetails] = useState(false);

  // Fetch project elements for cost allocation data
  const {
    data: projectElementsResponse,
    isLoading: isLoadingElements,
    error: elementsError,
  } = useQuery({
    queryKey: ['/api/maintenance/projects', project.id, 'elements'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/projects/${project.id}/elements`);
      return await response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch element history for historical cost data
  const {
    data: elementHistoryResponse,
    isLoading: isLoadingHistory,
  } = useQuery({
    queryKey: ['/api/maintenance/projects', project.id, 'history'],
    queryFn: async () => {
      // Get all elements in this project and their history
      const elementsResponse = await apiRequest('GET', `/api/maintenance/projects/${project.id}/elements`);
      const elementsData = await elementsResponse.json();
      
      if (!elementsData.elements?.length) {
        return { history: [] };
      }
      
      // Fetch history for each element
      const historyPromises = elementsData.elements.map(async (element: any) => {
        const historyResponse = await apiRequest('GET', `/api/maintenance/elements/${element.elementId}/history`);
        const historyData = await historyResponse.json();
        return historyData.data || [];
      });
      
      const allHistory = await Promise.all(historyPromises);
      return { history: allHistory.flat() };
    },
    enabled: !!project.id,
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch vendors for vendor cost analysis
  const {
    data: vendorsResponse,
  } = useQuery({
    queryKey: ['/api/maintenance/vendors'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/maintenance/vendors');
      return await response.json();
    },
  });

  // Parse response data
  const projectElements = projectElementsResponse?.elements || [];
  const elementHistory = elementHistoryResponse?.history || [];
  const vendors = vendorsResponse?.data || [];
  const isLoading = isLoadingElements || isLoadingHistory;
  const error = elementsError;

  // Calculate budget summary from existing data
  const budgetSummary: BudgetSummary = useMemo(() => {
    const totalBudget = parseFloat(project.totalBudget?.toString() || '0');
    const totalActual = parseFloat(project.actualCost?.toString() || '0');
    
    // Calculate total allocated to elements
    const totalAllocated = projectElements.reduce((sum: number, element: any) => {
      return sum + (element.costAllocation || 0);
    }, 0);
    
    // Calculate historical costs by category
    const vendorCosts = elementHistory.reduce((sum: number, entry: any) => {
      return sum + (entry.cost && entry.vendorId ? entry.cost : 0);
    }, 0);
    
    const materialCosts = elementHistory.reduce((sum: number, entry: any) => {
      return sum + (entry.cost && entry.eventType === 'materials' ? entry.cost : 0);
    }, 0);
    
    const laborCosts = elementHistory.reduce((sum: number, entry: any) => {
      return sum + (entry.cost && entry.eventType === 'repair' ? entry.cost : 0);
    }, 0);
    
    const otherCosts = elementHistory.reduce((sum: number, entry: any) => {
      return sum + (entry.cost && !entry.vendorId && entry.eventType !== 'materials' && entry.eventType !== 'repair' ? entry.cost : 0);
    }, 0);
    
    const utilizationPercentage = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
    const isOverBudget = totalActual > totalBudget;
    const remainingBudget = totalBudget - totalActual;
    
    return {
      totalBudget,
      totalActual,
      totalAllocated,
      utilizationPercentage,
      isOverBudget,
      remainingBudget,
      elementAllocations: [],
      historyBreakdown: {
        vendorCosts,
        materialCosts,
        laborCosts,
        otherCosts,
      },
    };
  }, [project, projectElements, elementHistory]);

  // Calculate budget breakdowns from existing data
  const budgetBreakdowns: BudgetBreakdown[] = useMemo(() => {
    const breakdowns: BudgetBreakdown[] = [];
    
    // Element Allocations breakdown
    const totalElementAllocation = projectElements.reduce((sum: number, element: any) => {
      return sum + (element.costAllocation || 0);
    }, 0);
    
    if (totalElementAllocation > 0) {
      breakdowns.push({
        category: 'Element Allocations',
        description: `Budget allocated to ${projectElements.length} building elements`,
        budgetAmount: totalElementAllocation,
        actualAmount: budgetSummary.historyBreakdown.vendorCosts + budgetSummary.historyBreakdown.laborCosts,
        elementCount: projectElements.length,
      });
    }
    
    // Vendor Costs breakdown
    if (budgetSummary.historyBreakdown.vendorCosts > 0) {
      const vendorCount = new Set(elementHistory
        .filter((entry: any) => entry.vendorId && entry.cost)
        .map((entry: any) => entry.vendorId)
      ).size;
      
      breakdowns.push({
        category: 'Vendor Costs',
        description: `Historical costs from ${vendorCount} vendors`,
        budgetAmount: 0, // No specific budget allocation
        actualAmount: budgetSummary.historyBreakdown.vendorCosts,
        vendorCount,
      });
    }
    
    // Materials breakdown
    if (budgetSummary.historyBreakdown.materialCosts > 0) {
      breakdowns.push({
        category: 'Materials',
        description: 'Material and supply costs',
        budgetAmount: 0,
        actualAmount: budgetSummary.historyBreakdown.materialCosts,
      });
    }
    
    // Labor breakdown
    if (budgetSummary.historyBreakdown.laborCosts > 0) {
      breakdowns.push({
        category: 'Labor',
        description: 'Labor costs from repair work',
        budgetAmount: 0,
        actualAmount: budgetSummary.historyBreakdown.laborCosts,
      });
    }
    
    // Unallocated budget
    const unallocated = budgetSummary.totalBudget - totalElementAllocation;
    if (unallocated > 0) {
      breakdowns.push({
        category: 'Unallocated',
        description: 'Budget not yet allocated to specific elements',
        budgetAmount: unallocated,
        actualAmount: 0,
      });
    }
    
    return breakdowns;
  }, [projectElements, elementHistory, budgetSummary]);
  
  const handleViewBreakdownDetails = (breakdown: BudgetBreakdown) => {
    setSelectedBreakdown(breakdown);
    setShowBreakdownDetails(true);
  };

  // Define table columns for budget breakdowns
  const columns: ColumnDef<BudgetBreakdown>[] = useMemo(() => {
    const baseColumns: ColumnDef<BudgetBreakdown>[] = [
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => {
          const breakdown = row.original;
          const categoryIcon = budgetCategories.find(cat => cat.name === breakdown.category)?.icon || DollarSign;
          const IconComponent = categoryIcon;
          
          return (
            <div className="space-y-1" data-testid={`breakdown-category-${breakdown.category.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="flex items-center gap-2">
                <IconComponent className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{breakdown.category}</span>
                {breakdown.elementCount && (
                  <Badge variant="outline">
                    {breakdown.elementCount} elements
                  </Badge>
                )}
                {breakdown.vendorCount && (
                  <Badge variant="outline">
                    {breakdown.vendorCount} vendors
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {breakdown.description}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'budgetAmount',
        header: 'Allocated',
        cell: ({ row }) => {
          const amount = row.getValue('budgetAmount') as number;
          return (
            <div className="text-sm font-medium" data-testid={`breakdown-budget-${row.original.category.toLowerCase().replace(/\s+/g, '-')}`}>
              {amount > 0 ? `$${amount.toLocaleString()}` : 'N/A'}
            </div>
          );
        },
      },
      {
        accessorKey: 'actualAmount',
        header: 'Actual',
        cell: ({ row }) => {
          const amount = row.getValue('actualAmount') as number;
          const budget = row.original.budgetAmount;
          const hasComparison = budget > 0;
          const isOverBudget = hasComparison && amount > budget;
          
          return (
            <div className="space-y-1" data-testid={`breakdown-actual-${row.original.category.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className={cn(
                "text-sm font-medium",
                hasComparison ? (isOverBudget ? "text-red-600" : "text-green-600") : "text-blue-600"
              )}>
                ${amount.toLocaleString()}
              </div>
              {hasComparison && (
                <div className="flex items-center gap-1 text-xs">
                  {isOverBudget ? (
                    <TrendingUp className="h-3 w-3 text-red-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-green-600" />
                  )}
                  <span className={isOverBudget ? "text-red-600" : "text-green-600"}>
                    {((amount / budget) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'variance',
        header: 'Variance',
        cell: ({ row }) => {
          const budget = row.original.budgetAmount;
          const actual = row.original.actualAmount;
          
          if (budget === 0) {
            return (
              <div className="text-sm text-muted-foreground">
                Historical only
              </div>
            );
          }
          
          const variance = budget - actual;
          const isOver = variance < 0;
          
          return (
            <div className={cn(
              "text-sm font-medium",
              isOver ? "text-red-600" : "text-green-600"
            )}>
              {isOver ? '+' : ''}${Math.abs(variance).toLocaleString()}
              {isOver && " over"}
            </div>
          );
        },
      },
    ];

    // Add view details action for breakdown analysis
    baseColumns.push({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const breakdown = row.original;
        
        return (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => handleViewBreakdownDetails(breakdown)}
            data-testid={`breakdown-details-${breakdown.category.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
        );
      },
    });

    return baseColumns;
  }, [budgetCategories]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Budget</h3>
          <p className="text-muted-foreground">
            There was an error loading the project budget. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)} data-testid={`project-budget-${project.id}`}>
      {/* Budget Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Budget Overview</CardTitle>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.open(`/maintenance/projects/${project.id}/elements`, '_blank')}
                data-testid="view-elements"
              >
                <Building className="h-4 w-4 mr-2" />
                View Elements
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowBreakdownDetails(true)}
                data-testid="export-budget"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Budget
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Budget</div>
                  <div className="text-lg font-semibold" data-testid="total-budget">
                    ${budgetSummary.totalBudget.toLocaleString()}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  budgetSummary.isOverBudget ? "bg-red-50" : "bg-green-50"
                )}>
                  <DollarSign className={cn(
                    "h-5 w-5",
                    budgetSummary.isOverBudget ? "text-red-600" : "text-green-600"
                  )} />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Actual Cost</div>
                  <div className={cn(
                    "text-lg font-semibold",
                    budgetSummary.isOverBudget ? "text-red-600" : "text-green-600"
                  )} data-testid="actual-cost">
                    ${budgetSummary.totalActual.toLocaleString()}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <PieChart className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Allocated</div>
                  <div className="text-lg font-semibold" data-testid="allocated-cost">
                    ${budgetSummary.totalAllocated.toLocaleString()}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  budgetSummary.remainingBudget < 0 ? "bg-red-50" : "bg-green-50"
                )}>
                  <Calculator className={cn(
                    "h-5 w-5",
                    budgetSummary.remainingBudget < 0 ? "text-red-600" : "text-green-600"
                  )} />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Remaining</div>
                  <div className={cn(
                    "text-lg font-semibold",
                    budgetSummary.remainingBudget < 0 ? "text-red-600" : "text-green-600"
                  )} data-testid="remaining-budget">
                    ${Math.abs(budgetSummary.remainingBudget).toLocaleString()}
                    {budgetSummary.remainingBudget < 0 && " over"}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Budget Utilization */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Budget Utilization</span>
              <span className={cn(
                "font-medium",
                budgetSummary.isOverBudget ? "text-red-600" : "text-green-600"
              )}>
                {budgetSummary.utilizationPercentage.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={Math.min(budgetSummary.utilizationPercentage, 100)} 
              className={cn(
                "h-3",
                budgetSummary.isOverBudget && "bg-red-100"
              )}
            />
            {budgetSummary.isOverBudget && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span>Project is over budget by ${(budgetSummary.totalActual - budgetSummary.totalBudget).toLocaleString()}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Budget Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Budget Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={budgetBreakdowns}
            isLoading={isLoading}
            searchPlaceholder="Search breakdown categories..."
            searchableColumn="category"
            enableFiltering={true}
            enableSorting={true}
            enableColumnVisibility={true}
            enablePagination={false}
            emptyState={{
              title: "No Budget Data",
              description: "No budget allocations or historical costs found for this project.",
              icon: PieChart,
            }}
            getRowId={(row) => row.category}
            className="bg-card"
          />
        </CardContent>
      </Card>

      {/* Budget Breakdown Details Dialog */}
      <Dialog open={showBreakdownDetails} onOpenChange={setShowBreakdownDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedBreakdown ? `${selectedBreakdown.category} Details` : 'Budget Breakdown Details'}
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown of costs and allocations for this budget category.
            </DialogDescription>
          </DialogHeader>
          
          {selectedBreakdown && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground">Allocated</div>
                  <div className="text-lg font-semibold">
                    {selectedBreakdown.budgetAmount > 0 
                      ? `$${selectedBreakdown.budgetAmount.toLocaleString()}`
                      : 'N/A'
                    }
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground">Actual</div>
                  <div className="text-lg font-semibold">
                    ${selectedBreakdown.actualAmount.toLocaleString()}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground">Count</div>
                  <div className="text-lg font-semibold">
                    {selectedBreakdown.elementCount || selectedBreakdown.vendorCount || 'N/A'}
                  </div>
                </Card>
              </div>
              
              {/* Related Items */}
              {selectedBreakdown.category === 'Element Allocations' && (
                <div>
                  <h4 className="font-medium mb-3">Project Elements</h4>
                  <div className="space-y-2">
                    {projectElements.map((element: any) => (
                      <div key={element.elementId} className="flex justify-between items-center p-3 border rounded">
                        <div>
                          <div className="font-medium">{element.elementName}</div>
                          <div className="text-sm text-muted-foreground">{element.uniformatCode}</div>
                        </div>
                        <div className="font-medium">
                          ${(element.costAllocation || 0).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedBreakdown.category === 'Vendor Costs' && (
                <div>
                  <h4 className="font-medium mb-3">Vendor History</h4>
                  <div className="space-y-2">
                    {elementHistory
                      .filter((entry: any) => entry.vendorId && entry.cost)
                      .map((entry: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-3 border rounded">
                          <div>
                            <div className="font-medium">{entry.vendorName || 'Unknown Vendor'}</div>
                            <div className="text-sm text-muted-foreground">
                              {entry.eventType} - {(parseDateOnly(entry.eventDate) ?? new Date(entry.eventDate)).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="font-medium">
                            ${entry.cost.toLocaleString()}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setShowBreakdownDetails(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

