import { useState, useEffect, useMemo, ReactNode } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format, addYears, parseISO } from 'date-fns';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { BuildingElement } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  DollarSign,
  Wrench,
  Building,
  TrendingUp,
  User,
  Shield,
  Info,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

// Form schema for element history entries
const elementHistoryFormSchema = z.object({
  elementId: z.string().uuid(),
  eventType: z.enum(['construction', 'repair', 'minor_rehab', 'major_rehab', 'replacement']),
  eventDate: z.string(),
  vendorId: z.string().optional(),
  vendorName: z.string().optional(),
  cost: z.coerce.number().min(0).optional(),
  warrantyDuration: z.coerce.number().min(0).max(50).optional(),
  warrantyTerms: z.string().optional(),
  lifespanImpact: z.coerce.number().min(0).max(100).optional(),
  workDescription: z.string().min(1, 'Work description is required').max(1000),
  notes: z.string().optional(),
  autoCalculateLifespanImpact: z.boolean().optional(),
});

type ElementHistoryFormData = z.infer<typeof elementHistoryFormSchema>;

interface ElementHistoryEntry {
  id: string;
  elementId: string;
  eventType: 'construction' | 'repair' | 'minor_rehab' | 'major_rehab' | 'replacement';
  eventDate: string;
  vendorId?: string;
  vendorName?: string;
  cost?: number;
  warranty?: {
    duration?: number;
    terms?: string;
    expiryDate?: string;
  };
  lifespanImpact?: number;
  workDescription: string;
  notes?: string;
}

interface ElementHistoryFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  element: BuildingElement;
  historyEntry?: ElementHistoryEntry | null;
  onSuccess?: (entry: ElementHistoryEntry) => void;
  mode?: 'create' | 'edit';
}

/**
 * ElementHistoryForm component for creating and editing maintenance history entries
 * Supports different event types with automatic lifespan impact calculation
 */
export function ElementHistoryForm({
  isOpen,
  onOpenChange,
  element,
  historyEntry,
  onSuccess,
  mode = historyEntry ? 'edit' : 'create',
}: ElementHistoryFormProps) {
  const { buildingId } = useBuildingContext();
  const { toast } = useToast();
  const [eventDate, setEventDate] = useState<Date | undefined>();
  const [autoCalculateLifespan, setAutoCalculateLifespan] = useState(true);

  const form = useForm({
    resolver: zodResolver(elementHistoryFormSchema),
    mode: 'onChange' as const,
    defaultValues: {
      elementId: element.id,
      eventType: 'repair' as const,
      eventDate: format(new Date(), 'yyyy-MM-dd'),
      vendorName: '',
      cost: 0,
      warrantyDuration: 0,
      warrantyTerms: '',
      lifespanImpact: 0,
      workDescription: '',
      notes: '',
      autoCalculateLifespanImpact: true,
    },
  });

  // Fetch vendors for selection
  const {
    data: vendorsResponse,
  } = useQuery({
    queryKey: ['/api/maintenance/vendors'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/maintenance/vendors');
      return await response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const vendors = vendorsResponse?.vendors || [];

  // Event type configurations
  const eventTypeConfig = useMemo(() => ({
    construction: {
      label: 'Original Construction',
      icon: Building,
      description: 'Initial construction or installation',
      lifespanMultiplier: 0,
      defaultWarranty: 12,
      color: 'blue',
    },
    repair: {
      label: 'Repair',
      icon: Wrench,
      description: 'Fix or restore to working condition',
      lifespanMultiplier: 0.1,
      defaultWarranty: 12,
      color: 'green',
    },
    minor_rehab: {
      label: 'Minor Rehabilitation',
      icon: TrendingUp,
      description: 'Minor improvements or restoration',
      lifespanMultiplier: 0.2,
      defaultWarranty: 24,
      color: 'orange',
    },
    major_rehab: {
      label: 'Major Rehabilitation',
      icon: TrendingUp,
      description: 'Significant renovation or restoration',
      lifespanMultiplier: 0.5,
      defaultWarranty: 60,
      color: 'purple',
    },
    replacement: {
      label: 'Replacement',
      icon: Building,
      description: 'Complete replacement of element',
      lifespanMultiplier: 1.0,
      defaultWarranty: 120,
      color: 'red',
    },
  }), []);

  // Update form when history entry changes
  useEffect(() => {
    if (historyEntry && mode === 'edit') {
      const formData = {
        ...historyEntry,
        eventDate: historyEntry.eventDate,
        warrantyDuration: historyEntry.warranty?.duration || 0,
        warrantyTerms: historyEntry.warranty?.terms || '',
        vendorName: historyEntry.vendorName || '',
        cost: historyEntry.cost || 0,
        notes: historyEntry.notes || '',
        autoCalculateLifespanImpact: false,
      };
      
      form.reset(formData);
      setEventDate(new Date(historyEntry.eventDate));
      setAutoCalculateLifespan(false);
    } else if (mode === 'create') {
      const today = new Date();
      form.reset({
        elementId: element.id,
        eventType: 'repair',
        eventDate: format(today, 'yyyy-MM-dd'),
        vendorName: '',
        cost: 0,
        warrantyDuration: 0,
        warrantyTerms: '',
        lifespanImpact: 0,
        workDescription: '',
        notes: '',
        autoCalculateLifespanImpact: true,
      });
      setEventDate(today);
      setAutoCalculateLifespan(true);
    }
  }, [historyEntry, mode, element.id, form]);

  // Auto-calculate lifespan impact based on event type and element
  const selectedEventType = form.watch('eventType') as ElementHistoryFormData['eventType'];
  const selectedCost = form.watch('cost') as number | undefined;

  useEffect(() => {
    if (autoCalculateLifespan && selectedEventType) {
      const config = eventTypeConfig[selectedEventType];
      const originalLifespan = element.originalLifespan || 25; // Default 25 years
      
      let impact = 0;
      
      if (config.lifespanMultiplier > 0) {
        // Base impact from event type
        impact = originalLifespan * config.lifespanMultiplier;
        
        // Adjust based on cost if available
        if (selectedCost && typeof selectedCost === 'number' && selectedCost > 0) {
          const costFactor = Math.min(selectedCost / 10000, 2); // Cap at 2x impact for $10k+
          impact *= (0.5 + costFactor * 0.5); // 50% to 150% of base impact
        }
        
        impact = Math.round(impact);
      }
      
      form.setValue('lifespanImpact', impact);
    }
  }, [autoCalculateLifespan, selectedEventType, selectedCost, eventTypeConfig, element.originalLifespan, form]);

  // Auto-set warranty duration based on event type
  useEffect(() => {
    if (selectedEventType && autoCalculateLifespan) {
      const config = eventTypeConfig[selectedEventType];
      form.setValue('warrantyDuration', config.defaultWarranty);
    }
  }, [selectedEventType, autoCalculateLifespan, eventTypeConfig, form]);

  // Create/update mutation
  const mutation = useMutation({
    mutationFn: async (data: ElementHistoryFormData) => {
      const payload = {
        ...data,
        eventDate: eventDate ? format(eventDate, 'yyyy-MM-dd') : data.eventDate,
        warranty: data.warrantyDuration ? {
          duration: data.warrantyDuration,
          terms: data.warrantyTerms || '',
          expiryDate: eventDate ? format(addYears(eventDate, data.warrantyDuration), 'yyyy-MM-dd') : undefined,
        } : undefined,
      };

      if (mode === 'edit' && historyEntry) {
        const response = await apiRequest('PATCH', `/api/maintenance/elements/${element.id}/history/${historyEntry.id}`, payload);
        return await response.json();
      } else {
        const response = await apiRequest('POST', `/api/maintenance/elements/${element.id}/history`, payload);
        return await response.json();
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/elements', element.id, 'history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'elements'] });
      onSuccess?.(data.historyEntry);
      onOpenChange(false);
      
      toast({
        title: mode === 'create' ? 'History entry created' : 'History entry updated',
        description: `The maintenance history has been ${mode === 'create' ? 'recorded' : 'updated'} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: mode === 'create' ? 'Creation failed' : 'Update failed',
        description: error.message || `Failed to ${mode} history entry`,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async (data: any) => {
    await mutation.mutateAsync(data as ElementHistoryFormData);
  };

  const selectedConfig = eventTypeConfig[selectedEventType];
  const currentLifespanImpact = (form.watch('lifespanImpact') as number) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="element-history-form">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add Maintenance History' : 'Edit Maintenance History'}
            {mode === 'edit' && (
              <Badge variant="secondary" className="ml-2">
                Edit Mode
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? `Record maintenance work performed on ${element.name}`
              : 'Update the maintenance history entry details'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...(form as any)}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="space-y-6">
              {/* Event Type Selection */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="eventType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        Event Type
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger data-testid="event-type-select">
                            <SelectValue placeholder="Select event type" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(eventTypeConfig).map(([key, config]) => (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <config.icon className="h-4 w-4" />
                                  <div className="flex flex-col">
                                    <span>{config.label}</span>
                                    <span className="text-xs text-muted-foreground">{config.description}</span>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Event type info card */}
                {selectedConfig && (
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <selectedConfig.icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                        <div className="space-y-2">
                          <div className="font-medium">{selectedConfig.label}</div>
                          <div className="text-sm text-muted-foreground">{selectedConfig.description}</div>
                          {typeof currentLifespanImpact === 'number' && currentLifespanImpact > 0 && (
                            <Badge variant="outline" className="text-green-600">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              +{currentLifespanImpact} years lifespan extension
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Separator />

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Event Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !eventDate && "text-muted-foreground"
                        )}
                        data-testid="event-date-button"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {eventDate ? format(eventDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={eventDate}
                        onSelect={setEventDate}
                        initialFocus
                        disabled={(date) => date > new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <FormField
                  control={form.control}
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost</FormLabel>
                      <FormDescription>Total cost of the work (optional)</FormDescription>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="pl-10"
                            data-testid="cost-input"
                            value={field.value ? String(field.value) : ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Work Description */}
              <FormField
                control={form.control}
                name="workDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Work Description
                      <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormDescription>Detailed description of the work performed</FormDescription>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe the maintenance work performed, materials used, and any specific details..."
                        rows={4}
                        data-testid="work-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              {/* Vendor Information */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Vendor Information
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vendorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor</FormLabel>
                        <FormDescription>Select from existing vendors or enter name below</FormDescription>
                        <FormControl>
                          <Select onValueChange={(value) => {
                            field.onChange(value);
                            const vendor = vendors.find((v: any) => v.id === value);
                            if (vendor) {
                              form.setValue('vendorName', vendor.name);
                            }
                          }}>
                            <SelectTrigger data-testid="vendor-select">
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">No vendor (Internal work)</SelectItem>
                              {vendors.map((vendor: any) => (
                                <SelectItem key={vendor.id} value={vendor.id}>
                                  <div className="flex flex-col">
                                    <span>{vendor.name}</span>
                                    <span className="text-xs text-muted-foreground">{vendor.specialty}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vendorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Name</FormLabel>
                        <FormDescription>Or enter vendor name manually</FormDescription>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter vendor name"
                            data-testid="vendor-name-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Warranty Information */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Warranty Information
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="warrantyDuration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty Duration (months)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="600"
                            placeholder="12"
                            data-testid="warranty-duration-input"
                            value={field.value ? String(field.value) : ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="warrantyTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty Terms</FormLabel>
                        <FormDescription>Brief description of warranty coverage</FormDescription>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Parts and labor warranty"
                            data-testid="warranty-terms-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {(() => {
                  const warrantyDuration = form.watch('warrantyDuration') as number;
                  return warrantyDuration && eventDate && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Warranty expires: {format(addYears(eventDate, warrantyDuration / 12), 'MMM d, yyyy')}
                    </div>
                  );
                })()}
              </div>

              <Separator />

              {/* Lifespan Impact */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Lifespan Impact
                  </h4>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={autoCalculateLifespan}
                      onCheckedChange={(checked) => setAutoCalculateLifespan(checked === true)}
                      data-testid="auto-calculate-lifespan"
                    />
                    <span className="text-xs text-muted-foreground">Auto-calculate</span>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="lifespanImpact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lifespan Extension (years)</FormLabel>
                      <FormDescription>Additional years added to element lifespan</FormDescription>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0"
                          disabled={autoCalculateLifespan}
                          data-testid="lifespan-impact-input"
                          value={field.value ? String(field.value) : ''}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {autoCalculateLifespan && typeof currentLifespanImpact === 'number' && currentLifespanImpact > 0 && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Automatically calculated based on event type and cost
                  </div>
                )}
              </div>

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormDescription>Any additional information or observations</FormDescription>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Additional notes, observations, or future recommendations..."
                        rows={3}
                        data-testid="notes-input"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <div className="flex flex-1 justify-between">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={mutation.isPending}
                    data-testid="cancel-button"
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    type="submit"
                    disabled={mutation.isPending}
                    data-testid="submit-button"
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {mode === 'create' ? 'Creating...' : 'Saving...'}
                      </>
                    ) : (
                      mode === 'create' ? 'Create' : 'Save Changes'
                    )}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export type { ElementHistoryFormProps };