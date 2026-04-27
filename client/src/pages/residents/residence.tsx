import type { ReactNode } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { handleApiError } from '@/lib/demo-error-handler';
import { Link, useLocation } from 'wouter';
import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';
import { useAuth } from '@/hooks/use-auth';
import { PaginationControls } from '@/components/common/PaginationControls';
import { MaintenanceRequestDialog } from '@/components/maintenance/MaintenanceRequestDialog';

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
  showBackButton?: boolean;
  backButtonLabel?: ReactNode;
  onBack?: () => void;
}

/**
 * Residence page component for residents.
 */
function ResidencePageInner({ buildingId, showBackButton, backButtonLabel, onBack }: ResidenceProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
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

      // Get only the user's assigned residences (not all residences in the building)
      // This ensures all roles (including managers) only see residences they're assigned to
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
    enabled: !!user?.id,
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
  // Exception (task #229): contact mutations in this file route errors through
  // `handleApiError` for demo-mode/locale-aware messaging — kept as raw `useMutation`.
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
      handleApiError(
        error,
        language,
        language === 'fr' 
          ? 'Échec de l\'ajout du contact. Veuillez réessayer.'
          : 'Failed to add contact. Please try again.'
      );
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
      handleApiError(
        error,
        language,
        language === 'fr' 
          ? 'Échec de la mise à jour du contact. Veuillez réessayer.'
          : 'Failed to update contact. Please try again.'
      );
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
      handleApiError(
        error,
        language,
        language === 'fr' 
          ? 'Échec de la suppression du contact. Veuillez réessayer.'
          : 'Failed to delete contact. Please try again.'
      );
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
    const isResidentOrTenant = user?.role
      ? ['resident', 'tenant', 'demo_resident', 'demo_tenant'].includes(user.role)
      : false;
    const isAdminOrManager = user?.role && ['admin', 'manager'].includes(user.role);

    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header
          title={t('myResidence')}
          subtitle={t('viewResidenceInfo')}
        />

        <div className='flex-1 flex items-center justify-center p-6'>
          <NoDataCard
            icon={Home}
            titleKey={isResidentOrTenant ? 'noResidenceLinkedTitle' : 'noResidencesFound'}
            descriptionKey={
              isResidentOrTenant
                ? 'noResidenceLinkedDescription'
                : isAdminOrManager
                  ? 'noResidencesFoundOrg'
                  : 'notAssignedResidences'
            }
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

      {showBackButton && onBack && (
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center px-6 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="flex items-center gap-2"
              data-testid="button-back-to-selection"
            >
              <ArrowLeft className="w-4 h-4" />
              {backButtonLabel}
            </Button>
          </div>
        </div>
      )}

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
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
                      <MaintenanceRequestDialog
                        residenceId={residence.id}
                        unitNumber={residence.unitNumber}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredResidences.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            className="mt-6"
            showInfo={true}
          />
        </div>
      </div>
    </div>
  );
}

// Wrap with hierarchical selection HOC. Managers/admins keep the existing
// org → building → residence picker. Residents and tenants get the flat
// resident-scope flow (Task #678): a single residence link auto-forwards
// straight to the residence-documents page; multiple links show a flat
// "Building · Unit X" chooser instead of the org → building → residence
// picker that was leaking the generic "Gestion de bâtiments" header.
const ResidencePage = withHierarchicalSelection(ResidencePageInner, {
  hierarchy: ['organization', 'building', 'residence'],
  checkResidenceAccess: true,
  title: { en: 'My Residence', fr: 'Ma résidence' },
  subtitle: {
    en: 'View your residence information and contacts',
    fr: 'Voir les informations de votre résidence et les contacts',
  },
  onResidenceSelect: (residenceId) => `/residents/residences/${residenceId}/documents`
});

export default ResidencePage;