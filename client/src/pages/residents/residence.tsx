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

/**
 *
 */
interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  type: string;
  residenceId: string;
}

const contactFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  type: z.enum(['primary', 'emergency', 'other']),
});

/**
 *
 */
type ContactFormData = z.infer<typeof contactFormSchema>;

/**
 *
 */
export default function Residence() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedResidenceId, setSelectedResidenceId] = useState<string>("");
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Form for contact management
  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      type: "primary",
    },
  });

  // Fetch user's accessible residences
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: () => apiRequest("GET", "/api/auth/user") as Promise<any>,
  });

  // Use different endpoints based on user role
  const { data: accessibleResidences = [], isLoading } = useQuery({
    queryKey: user?.role && ['admin', 'manager'].includes(user.role) ? ["/api/residences"] : ["/api/users/residences", user?.id],
    queryFn: () => {
      if (!user?.id) return Promise.resolve([]);
      
      // Admin and manager users can see all residences in their organizations
      if (user.role && ['admin', 'manager'].includes(user.role)) {
        return apiRequest("GET", "/api/residences") as Promise<Residence[]>;
      }
      
      // Residents see only their own residences
      return apiRequest("GET", `/api/users/${user.id}/residences`) as Promise<Residence[]>;
    },
    enabled: !!user?.id,
  });

  // Ensure accessibleResidences is always an array
  const safeAccessibleResidences = Array.isArray(accessibleResidences) ? accessibleResidences : [];

  // Select first residence by default
  const selectedResidence = useMemo(() => {
    if (!selectedResidenceId && safeAccessibleResidences.length > 0) {
      setSelectedResidenceId(safeAccessibleResidences[0].id);
      return safeAccessibleResidences[0];
    }
    return safeAccessibleResidences.find(r => r.id === selectedResidenceId) || null;
  }, [selectedResidenceId, safeAccessibleResidences]);

  // Fetch contacts for selected residence
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["/api/contacts", selectedResidenceId],
    queryFn: () => selectedResidenceId ? apiRequest("GET", `/api/contacts?residenceId=${selectedResidenceId}`) as Promise<Contact[]> : Promise.resolve([]),
    enabled: !!selectedResidenceId,
  });

  // Fetch building contacts (read-only for residents)
  const { data: buildingContacts = [], isLoading: buildingContactsLoading } = useQuery({
    queryKey: ["/api/contacts", "building", selectedResidence?.buildingId],
    queryFn: () => selectedResidence?.buildingId ? apiRequest("GET", `/api/contacts?buildingId=${selectedResidence.buildingId}`) as Promise<Contact[]> : Promise.resolve([]),
    enabled: !!selectedResidence?.buildingId,
  });

  // Mutations for contact management
  const addContactMutation = useMutation({
    mutationFn: (data: ContactFormData) => 
      apiRequest("POST", "/api/contacts", { ...data, residenceId: selectedResidenceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", selectedResidenceId] });
      setIsContactDialogOpen(false);
      setEditingContact(null);
      contactForm.reset();
      toast({
        title: "Success",
        description: "Contact added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add contact",
        variant: "destructive",
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContactFormData }) =>
      apiRequest("PUT", `/api/contacts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", selectedResidenceId] });
      setIsContactDialogOpen(false);
      setEditingContact(null);
      contactForm.reset();
      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => apiRequest("DELETE", `/api/contacts/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", selectedResidenceId] });
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  // Event handlers
  const handleAddContact = (data: ContactFormData) => {
    if (editingContact) {
      updateContactMutation.mutate({ id: editingContact.id, data });
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
      phone: contact.phone || "",
      type: contact.type as any,
    });
    setIsContactDialogOpen(true);
  };

  const handleDeleteContact = (contact: Contact) => {
    if (window.confirm(`Are you sure you want to delete ${contact.firstName} ${contact.lastName}?`)) {
      deleteContactMutation.mutate(contact.id);
    }
  };

  if (isLoading) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header 
          title={user?.role && ['admin', 'manager'].includes(user.role) ? 'Residences' : 'My Residence'} 
          subtitle={user?.role && ['admin', 'manager'].includes(user.role) ? 'Loading residence information...' : 'Loading residence information...'} 
        />
        <div className='flex-1 overflow-auto p-6'>
          <div className='text-center py-8'>Loading...</div>
        </div>
      </div>
    );
  }

  if (safeAccessibleResidences.length === 0) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header 
          title={user?.role && ['admin', 'manager'].includes(user.role) ? 'Residences' : 'My Residence'} 
          subtitle={user?.role && ['admin', 'manager'].includes(user.role) ? 'View and manage organization residences' : 'View and manage your residence information'} 
        />
        <div className='flex-1 overflow-auto p-6'>
          <div className='max-w-7xl mx-auto'>
            <Card>
              <CardContent className='p-8 text-center'>
                <Home className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>No Residences Found</h3>
                <p className='text-gray-500'>
                  {user?.role && ['admin', 'manager'].includes(user.role) 
                    ? 'No residences found in your organization.' 
                    : 'You are not associated with any residences.'
                  }
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header 
        title={user?.role && ['admin', 'manager'].includes(user.role) ? 'Residences' : 'My Residence'} 
        subtitle={user?.role && ['admin', 'manager'].includes(user.role) ? 'View and manage organization residences' : 'View and manage your residence information'} 
      />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Residence Filter */}
          {safeAccessibleResidences.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Home className='w-5 h-5' />
                  Select Residence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedResidenceId} onValueChange={setSelectedResidenceId}>
                  <SelectTrigger className='w-full max-w-md'>
                    <SelectValue placeholder='Select a residence' />
                  </SelectTrigger>
                  <SelectContent>
                    {safeAccessibleResidences.map((residence) => (
                      <SelectItem key={residence.id} value={residence.id}>
                        Unit {residence.unitNumber} - {residence.building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {selectedResidence && (
            <>
              {/* Residence General Info */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Home className='w-5 h-5' />
                    Unit {selectedResidence.unitNumber}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                    <div>
                      <Label className='text-sm font-medium'>Building</Label>
                      <p className='text-sm text-gray-700'>{selectedResidence.building.name}</p>
                    </div>
                    <div>
                      <Label className='text-sm font-medium'>Address</Label>
                      <p className='text-sm text-gray-700'>
                        {selectedResidence.building.address}, {selectedResidence.building.city}, {selectedResidence.building.province} {selectedResidence.building.postalCode}
                      </p>
                    </div>
                    {selectedResidence.floor && (
                      <div>
                        <Label className='text-sm font-medium'>Floor</Label>
                        <p className='text-sm text-gray-700'>{selectedResidence.floor}</p>
                      </div>
                    )}
                    {selectedResidence.squareFootage && (
                      <div>
                        <Label className='text-sm font-medium'>Square Footage</Label>
                        <p className='text-sm text-gray-700'>{selectedResidence.squareFootage} sq ft</p>
                      </div>
                    )}
                    {selectedResidence.bedrooms && (
                      <div>
                        <Label className='text-sm font-medium'>Bedrooms</Label>
                        <p className='text-sm text-gray-700'>{selectedResidence.bedrooms}</p>
                      </div>
                    )}
                    {selectedResidence.bathrooms && (
                      <div>
                        <Label className='text-sm font-medium'>Bathrooms</Label>
                        <p className='text-sm text-gray-700'>{selectedResidence.bathrooms}</p>
                      </div>
                    )}
                    {selectedResidence.parkingSpaceNumbers && selectedResidence.parkingSpaceNumbers.length > 0 && (
                      <div>
                        <Label className='text-sm font-medium'>Parking Spaces</Label>
                        <p className='text-sm text-gray-700'>{selectedResidence.parkingSpaceNumbers.join(', ')}</p>
                      </div>
                    )}
                    {selectedResidence.storageSpaceNumbers && selectedResidence.storageSpaceNumbers.length > 0 && (
                      <div>
                        <Label className='text-sm font-medium'>Storage Spaces</Label>
                        <p className='text-sm text-gray-700'>{selectedResidence.storageSpaceNumbers.join(', ')}</p>
                      </div>
                    )}
                  </div>
                  <div className='mt-6 flex gap-3'>
                    <Link href={`/residents/residences/${selectedResidence.id}/documents`}>
                      <Button variant="outline">
                        <FileText className='w-4 h-4 mr-2' />
                        View Documents
                      </Button>
                    </Link>
                    <Link href={`/residents/buildings/${selectedResidence.buildingId}/documents`}>
                      <Button variant="outline">
                        <Building className='w-4 h-4 mr-2' />
                        Building Documents
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Residence Contacts */}
              <Card>
                <CardHeader>
                  <div className='flex items-center justify-between'>
                    <CardTitle className='flex items-center gap-2'>
                      <User className='w-5 h-5' />
                      Residence Contacts
                    </CardTitle>
                    <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className='w-4 h-4 mr-2' />
                          Add Contact
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            {editingContact ? 'Edit Contact' : 'Add New Contact'}
                          </DialogTitle>
                          <DialogDescription>
                            {editingContact ? 'Update the contact information.' : 'Add a new contact for this residence.'}
                          </DialogDescription>
                        </DialogHeader>

                        <Form {...contactForm}>
                          <form onSubmit={contactForm.handleSubmit(handleAddContact)} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={contactForm.control}
                                name="firstName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>First Name</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Enter first name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={contactForm.control}
                                name="lastName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Last Name</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Enter last name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <FormField
                              control={contactForm.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email</FormLabel>
                                  <FormControl>
                                    <Input type="email" placeholder="Enter email address" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={contactForm.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Phone (Optional)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter phone number" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={contactForm.control}
                              name="type"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Contact Type</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select contact type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="primary">Primary</SelectItem>
                                      <SelectItem value="emergency">Emergency</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <DialogFooter>
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => {
                                  setIsContactDialogOpen(false);
                                  setEditingContact(null);
                                  contactForm.reset();
                                }}
                              >
                                Cancel
                              </Button>
                              <Button type="submit">
                                {editingContact ? 'Update Contact' : 'Add Contact'}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {contactsLoading ? (
                    <div className="text-center py-4">Loading contacts...</div>
                  ) : contacts.length === 0 ? (
                    <div className="text-center py-8">
                      <User className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500">No contacts added yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {contacts.map((contact) => (
                        <Card key={contact.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-medium">{contact.firstName} {contact.lastName}</h4>
                                <Badge variant="outline" className="mt-1">{contact.type}</Badge>
                              </div>
                              <div className="flex gap-1">
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handleEditContact(contact)}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handleDeleteContact(contact)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                <Mail className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-600">{contact.email}</span>
                              </div>
                              {contact.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3 h-3 text-gray-400" />
                                  <span className="text-gray-600">{contact.phone}</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Building Contacts (Read-only) */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Building className='w-5 h-5' />
                    Building Contacts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {buildingContactsLoading ? (
                    <div className="text-center py-4">Loading building contacts...</div>
                  ) : buildingContacts.length === 0 ? (
                    <div className="text-center py-8">
                      <Building className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500">No building contacts available</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {buildingContacts.map((contact) => (
                        <Card key={contact.id}>
                          <CardContent className="p-4">
                            <div className="mb-2">
                              <h4 className="font-medium">{contact.firstName} {contact.lastName}</h4>
                              <Badge variant="secondary" className="mt-1">{contact.type}</Badge>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                <Mail className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-600">{contact.email}</span>
                              </div>
                              {contact.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3 h-3 text-gray-400" />
                                  <span className="text-gray-600">{contact.phone}</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}