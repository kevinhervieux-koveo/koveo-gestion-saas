import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  Trash2
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

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
  ownershipPercentage?: string;
  monthlyFees?: string;
  building: {
    id: string;
    name: string;
    address: string;
    city: string;
    province: string;
  };
}

interface Contact {
  contact: {
    id: string;
    userId: string;
    entity: string;
    entityId: string;
    contactCategory: string;
  };
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
}

interface UserResidence {
  residenceId: string;
}

const contactSchema = z.object({
  userId: z.string().min(1, 'User is required'),
  contactCategory: z.enum(['resident', 'manager', 'tenant', 'maintenance', 'other']),
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function MyResidence() {
  const [selectedResidenceId, setSelectedResidenceId] = useState<string>('');
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const { toast } = useToast();

  // Get user's residences
  const { data: userResidences } = useQuery<UserResidence[]>({
    queryKey: ['/api/user/residences'],
  });

  // Get detailed residence data
  const { data: residences, isLoading: residencesLoading } = useQuery<Residence[]>({
    queryKey: ['/api/residences'],
  });

  // Filter residences to only those the user has access to
  const accessibleResidences = residences?.filter(residence => 
    userResidences?.some(ur => ur.residenceId === residence.id)
  ) || [];

  // Get the selected residence
  const selectedResidence = accessibleResidences.find(r => r.id === selectedResidenceId) || accessibleResidences[0];

  // Update selected residence when residences are loaded
  if (selectedResidence && !selectedResidenceId && accessibleResidences.length > 0) {
    setSelectedResidenceId(selectedResidence.id);
  }

  // Get contacts for the selected residence
  const { data: contacts, isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ['/api/residences', selectedResidence?.id, 'contacts'],
    enabled: !!selectedResidence?.id,
  });

  // Get all users for contact selection
  const { data: users } = useQuery({
    queryKey: ['/api/users'],
  });

  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      contactCategory: 'resident',
    },
  });

  const handleAddContact = async (data: ContactFormData) => {
    if (!selectedResidence) return;

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          entity: 'residence',
          entityId: selectedResidence.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to add contact');

      await queryClient.invalidateQueries({
        queryKey: ['/api/residences', selectedResidence.id, 'contacts'],
      });

      setIsContactDialogOpen(false);
      contactForm.reset();
      toast({ title: 'Contact added successfully' });
    } catch (error) {
      toast({ 
        title: 'Error adding contact', 
        description: 'Please try again later',
        variant: 'destructive' 
      });
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete contact');

      await queryClient.invalidateQueries({
        queryKey: ['/api/residences', selectedResidence?.id, 'contacts'],
      });

      toast({ title: 'Contact deleted successfully' });
    } catch (error) {
      toast({ 
        title: 'Error deleting contact', 
        description: 'Please try again later',
        variant: 'destructive' 
      });
    }
  };

  if (residencesLoading) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='My Residence' subtitle='View and manage your residence information' />
        <div className='flex-1 overflow-auto p-6'>
          <div className='max-w-7xl mx-auto'>
            <div className='text-center py-8'>Loading residence information...</div>
          </div>
        </div>
      </div>
    );
  }

  if (accessibleResidences.length === 0) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='My Residence' subtitle='View and manage your residence information' />
        <div className='flex-1 overflow-auto p-6'>
          <div className='max-w-7xl mx-auto'>
            <Card>
              <CardContent className='p-8 text-center'>
                <Home className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>No Residences Found</h3>
                <p className='text-gray-500'>You are not associated with any residences.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='My Residence' subtitle='View and manage your residence information' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Residence Filter */}
          {accessibleResidences.length > 1 && (
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
                    {accessibleResidences.map((residence) => (
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
                    Residence General Info
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                    <div className='space-y-4'>
                      <div>
                        <Label className='text-sm font-medium text-gray-600'>Unit Number</Label>
                        <p className='text-lg font-semibold'>{selectedResidence.unitNumber}</p>
                      </div>
                      <div>
                        <Label className='text-sm font-medium text-gray-600'>Building</Label>
                        <p className='flex items-center gap-1'>
                          <Building className='w-4 h-4' />
                          {selectedResidence.building.name}
                        </p>
                      </div>
                      <div>
                        <Label className='text-sm font-medium text-gray-600'>Address</Label>
                        <p className='flex items-center gap-1'>
                          <MapPin className='w-4 h-4' />
                          {selectedResidence.building.address}, {selectedResidence.building.city}, {selectedResidence.building.province}
                        </p>
                      </div>
                    </div>
                    
                    <div className='space-y-4'>
                      {selectedResidence.floor && (
                        <div>
                          <Label className='text-sm font-medium text-gray-600'>Floor</Label>
                          <p>{selectedResidence.floor}</p>
                        </div>
                      )}
                      {selectedResidence.squareFootage && (
                        <div>
                          <Label className='text-sm font-medium text-gray-600'>Square Footage</Label>
                          <p>{selectedResidence.squareFootage} sq ft</p>
                        </div>
                      )}
                      <div className='flex items-center gap-4'>
                        {selectedResidence.bedrooms !== undefined && (
                          <span className='flex items-center gap-1'>
                            <Bed className='w-4 h-4' />
                            {selectedResidence.bedrooms} bed
                          </span>
                        )}
                        {selectedResidence.bathrooms && (
                          <span className='flex items-center gap-1'>
                            <Bath className='w-4 h-4' />
                            {selectedResidence.bathrooms} bath
                          </span>
                        )}
                      </div>
                      {selectedResidence.balcony && (
                        <Badge variant='secondary'>Has Balcony</Badge>
                      )}
                    </div>

                    <div className='space-y-4'>
                      {selectedResidence.parkingSpaceNumbers && selectedResidence.parkingSpaceNumbers.length > 0 && (
                        <div>
                          <Label className='text-sm font-medium text-gray-600'>Parking Spaces</Label>
                          <p className='flex items-center gap-1'>
                            <Car className='w-4 h-4' />
                            {selectedResidence.parkingSpaceNumbers.join(', ')}
                          </p>
                        </div>
                      )}
                      {selectedResidence.storageSpaceNumbers && selectedResidence.storageSpaceNumbers.length > 0 && (
                        <div>
                          <Label className='text-sm font-medium text-gray-600'>Storage Spaces</Label>
                          <p className='flex items-center gap-1'>
                            <Package className='w-4 h-4' />
                            {selectedResidence.storageSpaceNumbers.join(', ')}
                          </p>
                        </div>
                      )}
                      {selectedResidence.monthlyFees && (
                        <div>
                          <Label className='text-sm font-medium text-gray-600'>Monthly Fees</Label>
                          <p>${selectedResidence.monthlyFees}</p>
                        </div>
                      )}
                      {selectedResidence.ownershipPercentage && (
                        <div>
                          <Label className='text-sm font-medium text-gray-600'>Ownership</Label>
                          <p>{(parseFloat(selectedResidence.ownershipPercentage) * 100).toFixed(2)}%</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Info */}
              <Card>
                <CardHeader>
                  <div className='flex items-center justify-between'>
                    <CardTitle className='flex items-center gap-2'>
                      <User className='w-5 h-5' />
                      Contact Info
                    </CardTitle>
                    <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant='outline' size='sm'>
                          <Plus className='w-4 h-4 mr-2' />
                          Add Contact
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Contact</DialogTitle>
                        </DialogHeader>
                        <Form {...contactForm}>
                          <form onSubmit={contactForm.handleSubmit(handleAddContact)} className='space-y-4'>
                            <FormField
                              control={contactForm.control}
                              name='userId'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>User</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder='Select a user' />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {users?.map((user: any) => (
                                        <SelectItem key={user.id} value={user.id}>
                                          {user.firstName} {user.lastName} ({user.email})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={contactForm.control}
                              name='contactCategory'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Contact Category</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value='resident'>Resident</SelectItem>
                                      <SelectItem value='manager'>Manager</SelectItem>
                                      <SelectItem value='tenant'>Tenant</SelectItem>
                                      <SelectItem value='maintenance'>Maintenance</SelectItem>
                                      <SelectItem value='other'>Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className='flex justify-end gap-2'>
                              <Button type='button' variant='outline' onClick={() => setIsContactDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button type='submit'>Add Contact</Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {contactsLoading ? (
                    <p>Loading contacts...</p>
                  ) : contacts && contacts.length > 0 ? (
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                      {contacts.map((contact) => (
                        <div key={contact.contact.id} className='border rounded-lg p-4 space-y-2'>
                          <div className='flex items-center justify-between'>
                            <Badge variant='outline' className='capitalize'>
                              {contact.contact.contactCategory}
                            </Badge>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => handleDeleteContact(contact.contact.id)}
                            >
                              <Trash2 className='w-4 h-4' />
                            </Button>
                          </div>
                          <div>
                            <p className='font-semibold'>
                              {contact.user.firstName} {contact.user.lastName}
                            </p>
                            <p className='text-sm text-gray-600 flex items-center gap-1'>
                              <Mail className='w-3 h-3' />
                              {contact.user.email}
                            </p>
                            {contact.user.phone && (
                              <p className='text-sm text-gray-600 flex items-center gap-1'>
                                <Phone className='w-3 h-3' />
                                {contact.user.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className='text-gray-500 text-center py-8'>No contacts found for this residence.</p>
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