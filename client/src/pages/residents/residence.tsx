import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  Home, 
  Building, 
  MapPin, 
  Bed, 
  Bath, 
  Car, 
  Package, 
  Phone, 
  Mail, 
  User, 
  Edit,
  Plus,
  Trash2,
  FileText,
  Download,
  Calendar
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Link } from 'wouter';

/**
 *
 */
interface Residence {
  id: string;
  unitNumber: string;
  floor?: number;
  squareFootage?: string;
  bedrooms?: number;
  bathrooms?: string;
  balcony?: boolean;
  parkingSpaceNumbers?: string[];
  storageSpaceNumbers?: string[];
  isActive: boolean;
  buildingId: string;
  building: {
    id: string;
    name: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
  };
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  type: string;
}

// Contact form schema
const contactFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  type: z.enum(['primary', 'emergency', 'other']),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export default function Residence() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [selectedResidenceId, setSelectedResidenceId] = useState<string>("");
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Form for contact management
  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      type: 'primary',
    },
  });

  // Fetch current user
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: () => apiRequest("GET", "/api/auth/user") as Promise<any>,
  });

  // Fetch buildings for admin/manager users
  const { data: buildingsData } = useQuery({
    queryKey: ["/api/manager/buildings"],
    queryFn: () => apiRequest("GET", "/api/manager/buildings") as Promise<any>,
    enabled: !!user?.id && user?.role && ['admin', 'manager'].includes(user.role),
  });

  const buildings = buildingsData?.buildings || [];

  // Use different endpoints based on user role
  const { data: accessibleResidences = [], isLoading } = useQuery({
    queryKey: user?.role && ['admin', 'manager'].includes(user.role) ? ["/api/residences"] : ["/api/users/residences", user?.id],
    queryFn: () => {
      if (!user?.id) return Promise.resolve([]);
      
      // Admin and manager users can see all residences in their organizations
      if (user.role && ['admin', 'manager'].includes(user.role)) {
        return apiRequest("GET", "/api/residences");
      }
      
      // Residents see only their own residences
      return apiRequest("GET", `/api/users/${user.id}/residences`);
    },
    enabled: !!user?.id,
  });

  // Ensure accessibleResidences is always an array
  const safeAccessibleResidences = Array.isArray(accessibleResidences) ? accessibleResidences : [];

  // Filter residences based on selected building for admin/manager users
  const filteredResidences = useMemo(() => {
    if (user?.role && ['admin', 'manager'].includes(user.role)) {
      // If no building is selected, show all residences
      if (!selectedBuildingId) return safeAccessibleResidences;
      
      // Filter by selected building
      return safeAccessibleResidences.filter(r => r.buildingId === selectedBuildingId);
    }
    
    // For residents, return all their accessible residences
    return safeAccessibleResidences;
  }, [safeAccessibleResidences, selectedBuildingId, user?.role]);

  // Auto-select first building for admin/manager users
  useMemo(() => {
    if (user?.role && ['admin', 'manager'].includes(user.role) && buildings.length > 0 && !selectedBuildingId) {
      setSelectedBuildingId(buildings[0].id);
    }
  }, [buildings, selectedBuildingId, user?.role]);

  // Select first residence by default
  const selectedResidence = useMemo(() => {
    if (!selectedResidenceId && filteredResidences.length > 0) {
      setSelectedResidenceId(filteredResidences[0].id);
      return filteredResidences[0];
    }
    return filteredResidences.find(r => r.id === selectedResidenceId) || null;
  }, [selectedResidenceId, filteredResidences]);

  // Fetch contacts for selected residence
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["/api/contacts", selectedResidenceId],
    queryFn: () => selectedResidenceId ? apiRequest("GET", `/api/contacts?residenceId=${selectedResidenceId}`) : Promise.resolve([]),
    enabled: !!selectedResidenceId,
  });

  // Fetch building contacts (read-only for residents)
  const { data: buildingContacts = [], isLoading: buildingContactsLoading } = useQuery({
    queryKey: ["/api/contacts", "building", selectedResidence?.buildingId],
    queryFn: () => selectedResidence?.buildingId ? apiRequest("GET", `/api/contacts?buildingId=${selectedResidence.buildingId}`) : Promise.resolve([]),
    enabled: !!selectedResidence?.buildingId,
  });

  // Mutations for contact management
  const addContactMutation = useMutation({
    mutationFn: (data: ContactFormData) => 
      apiRequest("POST", "/api/contacts", {
        ...data,
        residenceId: selectedResidenceId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ["/api/contacts", selectedResidenceId]});
      setIsContactDialogOpen(false);
      setEditingContact(null);
      contactForm.reset();
      toast({
        title: "Contact added successfully",
        description: "The new contact has been added to this residence.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add contact",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: (data: ContactFormData) =>
      apiRequest("PATCH", `/api/contacts/${editingContact?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ["/api/contacts", selectedResidenceId]});
      setIsContactDialogOpen(false);
      setEditingContact(null);
      contactForm.reset();
      toast({
        title: "Contact updated successfully",
        description: "The contact information has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update contact",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) =>
      apiRequest("DELETE", `/api/contacts/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ["/api/contacts", selectedResidenceId]});
      toast({
        title: "Contact deleted successfully",
        description: "The contact has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete contact",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const handleAddContact = (data: ContactFormData) => {
    if (editingContact) {
      updateContactMutation.mutate(data);
    } else {
      addContactMutation.mutate(data);
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    contactForm.reset({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone || '',
      type: contact.type as any,
    });
    setIsContactDialogOpen(true);
  };

  const handleDeleteContact = (contact: Contact) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      deleteContactMutation.mutate(contact.id);
    }
  };

  if (isLoading) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header 
          title={user?.role && ['admin', 'manager'].includes(user.role) ? 'Residences' : 'My Residence'} 
          description={user?.role && ['admin', 'manager'].includes(user.role) ? 'View and manage organization residences' : 'View your residence information and contacts'}
        />

        <div className='flex-1 flex items-center justify-center'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4'></div>
            <p className='text-gray-600'>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (filteredResidences.length === 0) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header 
          title={user?.role && ['admin', 'manager'].includes(user.role) ? 'Residences' : 'My Residence'} 
          description={user?.role && ['admin', 'manager'].includes(user.role) ? 'View and manage organization residences' : 'View your residence information and contacts'}
        />

        <div className='flex-1 flex items-center justify-center'>
          <div className='text-center'>
            <Home className='w-16 h-16 mx-auto text-gray-400 mb-4' />
            <h3 className='text-lg font-medium mb-2'>No Residences Found</h3>
            <p className='text-gray-600'>
              {user?.role && ['admin', 'manager'].includes(user.role) 
                ? 'No residences found in your organization.'
                : 'You are not assigned to any residences.'
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header 
        title={user?.role && ['admin', 'manager'].includes(user.role) ? 'Residences' : 'My Residence'} 
        description={user?.role && ['admin', 'manager'].includes(user.role) ? 'View and manage organization residences' : 'View your residence information and contacts'}
      />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Building and Residence Filters */}
          {(user?.role && ['admin', 'manager'].includes(user.role) && buildings.length > 0) || filteredResidences.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Home className='w-5 h-5' />
                  {user?.role && ['admin', 'manager'].includes(user.role) ? 'Select Building & Residence' : 'Select Residence'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='flex flex-col md:flex-row gap-4'>
                  {/* Building Filter (Admin/Manager only) */}
                  {user?.role && ['admin', 'manager'].includes(user.role) && buildings.length > 0 && (
                    <div className='flex-1'>
                      <Label className='text-sm font-medium mb-2 block'>Building</Label>
                      <Select 
                        value={selectedBuildingId} 
                        onValueChange={(value) => {
                          setSelectedBuildingId(value);
                          setSelectedResidenceId(""); // Reset residence selection when building changes
                        }}
                      >
                        <SelectTrigger className='w-full'>
                          <SelectValue placeholder='Select a building' />
                        </SelectTrigger>
                        <SelectContent>
                          {buildings.map((building: any) => (
                            <SelectItem key={building.id} value={building.id}>
                              {building.name} - {building.address}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Residence Filter */}
                  {filteredResidences.length > 0 && (
                    <div className='flex-1'>
                      <Label className='text-sm font-medium mb-2 block'>
                        {user?.role && ['admin', 'manager'].includes(user.role) ? 'Residence' : 'Select Residence'}
                      </Label>
                      <Select value={selectedResidenceId} onValueChange={setSelectedResidenceId}>
                        <SelectTrigger className='w-full'>
                          <SelectValue placeholder='Select a residence' />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredResidences.map((residence) => (
                            <SelectItem key={residence.id} value={residence.id}>
                              Unit {residence.unitNumber}
                              {user?.role && !['admin', 'manager'].includes(user.role) && ` - ${residence.building.name}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Residence Cards */}
          {filteredResidences.length > 0 && (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {filteredResidences.map((residence) => (
                <Card key={residence.id} className='hover:shadow-lg transition-shadow'>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <Home className='w-5 h-5' />
                      Unit {residence.unitNumber}
                    </CardTitle>
                    <div className='text-sm text-gray-600'>
                      {residence.building.name}
                    </div>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='grid grid-cols-1 gap-3'>
                      <div>
                        <Label className='text-xs font-medium text-gray-500'>Address</Label>
                        <p className='text-sm text-gray-700'>
                          {residence.building.address}
                        </p>
                        <p className='text-sm text-gray-700'>
                          {residence.building.city}, {residence.building.province} {residence.building.postalCode}
                        </p>
                      </div>
                      
                      <div className='grid grid-cols-2 gap-3'>
                        {residence.floor && (
                          <div>
                            <Label className='text-xs font-medium text-gray-500'>Floor</Label>
                            <p className='text-sm text-gray-700'>{residence.floor}</p>
                          </div>
                        )}
                        {residence.squareFootage && (
                          <div>
                            <Label className='text-xs font-medium text-gray-500'>Sq Ft</Label>
                            <p className='text-sm text-gray-700'>{residence.squareFootage}</p>
                          </div>
                        )}
                        {residence.bedrooms && (
                          <div>
                            <Label className='text-xs font-medium text-gray-500'>Bedrooms</Label>
                            <div className='flex items-center gap-1'>
                              <Bed className='w-3 h-3' />
                              <span className='text-sm text-gray-700'>{residence.bedrooms}</span>
                            </div>
                          </div>
                        )}
                        {residence.bathrooms && (
                          <div>
                            <Label className='text-xs font-medium text-gray-500'>Bathrooms</Label>
                            <div className='flex items-center gap-1'>
                              <Bath className='w-3 h-3' />
                              <span className='text-sm text-gray-700'>{residence.bathrooms}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {residence.parkingSpaceNumbers && residence.parkingSpaceNumbers.length > 0 && (
                        <div>
                          <Label className='text-xs font-medium text-gray-500'>Parking</Label>
                          <div className='flex items-center gap-1'>
                            <Car className='w-3 h-3' />
                            <span className='text-sm text-gray-700'>{residence.parkingSpaceNumbers.join(', ')}</span>
                          </div>
                        </div>
                      )}
                      
                      {residence.storageSpaceNumbers && residence.storageSpaceNumbers.length > 0 && (
                        <div>
                          <Label className='text-xs font-medium text-gray-500'>Storage</Label>
                          <div className='flex items-center gap-1'>
                            <Package className='w-3 h-3' />
                            <span className='text-sm text-gray-700'>{residence.storageSpaceNumbers.join(', ')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className='flex flex-col gap-2 pt-4 border-t'>
                      <Link href={`/residents/residences/${residence.id}/documents`}>
                        <Button variant="outline" size="sm" className='w-full justify-start'>
                          <FileText className='w-4 h-4 mr-2' />
                          View Documents
                        </Button>
                      </Link>
                      <Link href={`/residents/buildings/${residence.buildingId}/documents`}>
                        <Button variant="outline" size="sm" className='w-full justify-start'>
                          <Building className='w-4 h-4 mr-2' />
                          Building Documents
                        </Button>
                      </Link>
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