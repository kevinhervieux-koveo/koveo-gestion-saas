import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NoDataCard } from '@/components/ui/no-data-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { apiRequest } from '@/lib/queryClient';
import { Link, useLocation } from 'wouter';
import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';
import { useAuth } from '@/hooks/use-auth';

/**
 * Residence data structure
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
 * Contact data structure
 */
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

/**
 * Props for the residence page inner component
 */
interface ResidenceProps {
  buildingId?: string;
}

/**
 * Residence page component for residents.
 */
function ResidencePageInner({ buildingId }: ResidenceProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [selectedResidenceId, setSelectedResidenceId] = useState<string>('');
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleBackToBuilding = () => {
    navigate('/residents/residence');
  };

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

  // Fetch residences for the selected building
  const {
    data: accessibleResidences = [],
    isLoading,
    error: residencesError,
    refetch: refetchResidences,
  } = useQuery({
    queryKey: ['/api/users/residences', user?.id, buildingId],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }

      // Get all user's residences first
      const response = await fetch(`/api/users/${user.id}/residences`, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch residences');
      }
      
      const allResidences = await response.json();
      
      // Filter by building if buildingId is provided
      if (buildingId) {
        return allResidences.filter((residence: Residence) => residence.buildingId === buildingId);
      }
      
      return allResidences;
    },
    enabled: !!user?.id && !!buildingId,
    refetchOnMount: true,
    staleTime: 0,
  });

  // Ensure accessibleResidences is always an array
  const safeAccessibleResidences = Array.isArray(accessibleResidences) ? accessibleResidences : [];

  // Show all residences for the selected building
  const filteredResidences = safeAccessibleResidences;

  // Pagination calculations
  const totalPages = Math.ceil(filteredResidences.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentResidences = filteredResidences.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  // Select first residence by default
  const selectedResidence = useMemo(() => {
    if (!selectedResidenceId && filteredResidences.length > 0) {
      setSelectedResidenceId(filteredResidences[0].id);
      return filteredResidences[0];
    }
    return filteredResidences.find((r) => r.id === selectedResidenceId) || null;
  }, [selectedResidenceId, filteredResidences]);

  // Fetch contacts for selected residence
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['/api/contacts', selectedResidenceId],
    queryFn: async () => {
      if (!selectedResidenceId) {
        return [];
      }
      const response = await fetch(`/api/residences/${selectedResidenceId}/contacts`);
      if (!response.ok) {
        return [];
      }
      return response.json();
    },
    enabled: !!selectedResidenceId,
  });

  // Mutations for contact management
  const addContactMutation = useMutation({
    mutationFn: async (contactData: ContactFormData) => {
      return apiRequest('POST', `/api/residences/${selectedResidenceId}/contacts`, contactData);
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: t('contactAddedSuccessfully'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setIsContactDialogOpen(false);
      contactForm.reset();
      setEditingContact(null);
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error?.message || t('failedToAddContact'),
        variant: 'destructive',
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async (contactData: ContactFormData) => {
      return apiRequest('PUT', `/api/contacts/${editingContact?.id}`, contactData);
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: t('contactUpdatedSuccessfully'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setIsContactDialogOpen(false);
      contactForm.reset();
      setEditingContact(null);
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error?.message || t('failedToUpdateContact'),
        variant: 'destructive',
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      return apiRequest('DELETE', `/api/contacts/${contactId}`);
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: t('contactDeletedSuccessfully'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error?.message || t('failedToDeleteContact'),
        variant: 'destructive',
      });
    },
  });

  const handleSubmitContact = (data: ContactFormData) => {
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
          title={t('myResidence')}
          subtitle={t('viewResidenceInfo')}
        />

        <div className='flex-1 flex items-center justify-center'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4'></div>
            <p className='text-gray-600'>{t('loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (filteredResidences.length === 0) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header
          title={t('myResidence')}
          subtitle={t('viewResidenceInfo')}
        />

        <div className='flex-1 flex items-center justify-center p-6'>
          <NoDataCard
            icon={Home}
            titleKey="noResidencesFound"
            descriptionKey={user?.role && ['admin', 'manager'].includes(user.role)
              ? 'noResidencesFoundOrg'
              : 'notAssignedResidences'}
            testId="no-residences-message"
          />
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header
        title={t('myResidence')}
        subtitle={t('myResidenceInfo')}
      />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Back navigation is now handled automatically by the HOC */}

          {/* Residence Selection */}
          {filteredResidences.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Home className='w-5 h-5' />
                  Select Residence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='flex flex-col md:flex-row gap-4'>
                  <div className='flex-1'>
                    <Label className='text-sm font-medium mb-2 block'>
                      {t('selectResidence')}
                    </Label>
                    <Select value={selectedResidenceId} onValueChange={setSelectedResidenceId}>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder={t('selectAResidence')} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredResidences.map((residence) => (
                          <SelectItem key={residence.id} value={residence.id}>
                            {t('unit')} {residence.unitNumber} - {residence.building?.name || 'N/A'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Residence Cards */}
          {currentResidences.length > 0 && (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {currentResidences.map((residence) => (
                <Card key={residence.id} className='hover:shadow-lg transition-shadow'>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <Home className='w-5 h-5' />
                      {t('unit')} {residence.unitNumber}
                    </CardTitle>
                    <div className='text-sm text-gray-600'>
                      {residence.building?.name || t('buildingInfoUnavailable')}
                    </div>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='grid grid-cols-1 gap-3'>
                      <div>
                        <Label className='text-xs font-medium text-gray-500'>{t('address')}</Label>
                        <p className='text-sm text-gray-700'>
                          {residence.building?.address || t('addressUnavailable')}
                        </p>
                        <p className='text-sm text-gray-700'>
                          {residence.building?.city || 'N/A'},{' '}
                          {residence.building?.province || 'N/A'}{' '}
                          {residence.building?.postalCode || ''}
                        </p>
                      </div>

                      <div className='grid grid-cols-2 gap-3'>
                        {residence.floor && (
                          <div>
                            <Label className='text-xs font-medium text-gray-500'>{t('floor')}</Label>
                            <p className='text-sm text-gray-700'>{residence.floor}</p>
                          </div>
                        )}

                        {residence.squareFootage && (
                          <div>
                            <Label className='text-xs font-medium text-gray-500'>{t('squareFootage')}</Label>
                            <p className='text-sm text-gray-700'>{residence.squareFootage}</p>
                          </div>
                        )}

                        {residence.bedrooms && (
                          <div>
                            <Label className='text-xs font-medium text-gray-500'>{t('bedrooms')}</Label>
                            <p className='text-sm text-gray-700 flex items-center gap-1'>
                              <Bed className='w-4 h-4' />
                              {residence.bedrooms}
                            </p>
                          </div>
                        )}

                        {residence.bathrooms && (
                          <div>
                            <Label className='text-xs font-medium text-gray-500'>{t('bathrooms')}</Label>
                            <p className='text-sm text-gray-700 flex items-center gap-1'>
                              <Bath className='w-4 h-4' />
                              {residence.bathrooms}
                            </p>
                          </div>
                        )}
                      </div>

                      {residence.balcony && (
                        <div className='flex items-center gap-2'>
                          <Badge variant='secondary' className='text-xs'>
                            {t('balcony')}
                          </Badge>
                        </div>
                      )}

                      {residence.parkingSpaceNumbers && residence.parkingSpaceNumbers.length > 0 && (
                        <div>
                          <Label className='text-xs font-medium text-gray-500'>{t('parking')}</Label>
                          <div className='flex flex-wrap gap-1 mt-1'>
                            {residence.parkingSpaceNumbers.map((space, index) => (
                              <Badge key={index} variant='outline' className='text-xs flex items-center gap-1'>
                                <Car className='w-3 h-3' />
                                {space}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {residence.storageSpaceNumbers && residence.storageSpaceNumbers.length > 0 && (
                        <div>
                          <Label className='text-xs font-medium text-gray-500'>{t('storage')}</Label>
                          <div className='flex flex-wrap gap-1 mt-1'>
                            {residence.storageSpaceNumbers.map((space, index) => (
                              <Badge key={index} variant='outline' className='text-xs flex items-center gap-1'>
                                <Package className='w-3 h-3' />
                                {space}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className='pt-3 border-t space-y-2'>
                      <Link href={`/residents/residences/${residence.id}/documents`}>
                        <Button variant='outline' size='sm' className='w-full justify-start'>
                          <FileText className='w-4 h-4 mr-2' />
                          {t('documents')}
                        </Button>
                      </Link>
                      <Link href={`/residents/buildings/${residence.buildingId}/documents`}>
                        <Button variant='outline' size='sm' className='w-full justify-start'>
                          <Building className='w-4 h-4 mr-2' />
                          {t('buildingDocuments')}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex justify-center items-center space-x-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className='h-4 w-4' />
                {t('previous')}
              </Button>

              <div className='flex items-center space-x-1'>
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size='sm'
                      onClick={() => handlePageClick(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant='outline'
                size='sm'
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                {t('next')}
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          )}

          {/* Page info */}
          {filteredResidences.length > 0 && (
            <div className='text-center text-sm text-muted-foreground mt-4'>
              {t('showing')} {startIndex + 1} to {Math.min(endIndex, filteredResidences.length)} of{' '}
              {filteredResidences.length} {t('residences')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Wrap with hierarchical selection HOC using building hierarchy (residents only see buildings they have residences in)
const ResidencePage = withHierarchicalSelection(ResidencePageInner, {
  hierarchy: ['building']
});

export default ResidencePage;