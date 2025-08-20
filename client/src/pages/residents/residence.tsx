import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { ObjectUploader } from '@/components/ObjectUploader';
import { Textarea } from '@/components/ui/textarea';
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
  Calendar,
  Eye,
  Filter,
  Upload
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
  id: string;
  name: string;
  email?: string;
  phone?: string;
  entity: string;
  entityId: string;
  contactCategory: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserResidence {
  residenceId: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  dateReference?: string;
  fileName?: string;
  fileSize?: string;
  mimeType?: string;
  fileUrl?: string;
  uploadedBy: string;
  isVisibleToTenants?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Residence-specific document categories
const DOCUMENT_CATEGORIES = [
  { value: 'lease', label: 'Lease Documents' },
  { value: 'inspection', label: 'Inspections' },
  { value: 'maintenance', label: 'Maintenance Requests' },
  { value: 'financial', label: 'Financial Records' },
  { value: 'insurance', label: 'Insurance Documents' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'utilities', label: 'Utility Bills' },
  { value: 'renovation', label: 'Renovation/Modification' },
  { value: 'inventory', label: 'Inventory Lists' },
  { value: 'other', label: 'Other' },
] as const;

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  contactCategory: z.enum(['resident', 'manager', 'tenant', 'maintenance', 'emergency', 'other']),
});

const documentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  type: z.enum(['lease', 'inspection', 'maintenance', 'financial', 'insurance', 'correspondence', 'utilities', 'renovation', 'inventory', 'other']),
  dateReference: z.string().refine((dateStr) => {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }, {
    message: 'Valid date is required',
  }),
  isVisibleToTenants: z.boolean().default(false),
});

type ContactFormData = z.infer<typeof contactSchema>;
type DocumentFormData = z.infer<typeof documentSchema>;

export default function MyResidence() {
  const [selectedResidenceId, setSelectedResidenceId] = useState<string>('');
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [isViewingDocument, setIsViewingDocument] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [isUploadingNewFile, setIsUploadingNewFile] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<any>(null);
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

  // Get documents for the selected residence
  const { data: documents, isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: ['/api/documents', 'residence', selectedResidence?.id],
    queryFn: async () => {
      const response = await fetch(`/api/documents?type=resident`);
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      // Filter to only documents for the selected residence
      const residenceDocuments = data.documents?.filter((doc: any) => 
        doc.entityType === 'residence' && doc.entityId === selectedResidence?.id
      ) || [];
      return residenceDocuments;
    },
    enabled: !!selectedResidence?.id,
  });

  // Filter documents by category and year
  const filteredDocuments = documents?.filter(doc => {
    const categoryMatch = categoryFilter === 'all' || doc.type === categoryFilter;
    const docYear = doc.dateReference ? new Date(doc.dateReference).getFullYear().toString() : '';
    const yearMatch = yearFilter === 'all' || docYear === yearFilter;
    return categoryMatch && yearMatch;
  }) || [];

  // Get unique years from documents for year filter
  const availableYears = Array.from(new Set(
    documents?.map(doc => doc.dateReference ? new Date(doc.dateReference).getFullYear().toString() : '')
      .filter(year => year !== '') || []
  )).sort((a, b) => parseInt(b) - parseInt(a));

  // Get building contacts for the selected residence's building
  const { data: buildingContacts, isLoading: buildingContactsLoading } = useQuery<Contact[]>({
    queryKey: ['/api/contacts', 'building', selectedResidence?.building?.id],
    queryFn: async () => {
      const response = await fetch(`/api/contacts?entity=building&entityId=${selectedResidence?.building?.id}`);
      if (!response.ok) throw new Error('Failed to fetch building contacts');
      return response.json();
    },
    enabled: !!selectedResidence?.building?.id,
  });


  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      contactCategory: 'resident',
    },
  });

  const documentForm = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      name: '',
      type: 'other',
      dateReference: new Date().toISOString().split('T')[0],
      isVisibleToTenants: false,
    },
  });

  const handleAddContact = async (data: ContactFormData) => {
    if (!selectedResidence) return;

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email || undefined,
          phone: data.phone || undefined,
          entity: 'residence',
          entityId: selectedResidence.id,
          contactCategory: data.contactCategory,
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

  // File upload handlers
  const handleNewDocumentUpload = async (): Promise<{ method: "PUT"; url: string }> => {
    setIsUploadingNewFile(true);
    
    if (!selectedResidence) {
      setIsUploadingNewFile(false);
      throw new Error('No residence selected');
    }

    const response = await fetch('/api/documents/upload-url', { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        organizationId: selectedResidence.building?.organizationId,
        buildingId: selectedResidence.building?.id,
        residenceId: selectedResidence.id,
        documentType: 'residence'
      })
    });
    
    if (!response.ok) {
      setIsUploadingNewFile(false);
      throw new Error('Failed to get upload URL');
    }
    
    const data = await response.json();
    return { method: "PUT" as const, url: data.uploadURL };
  };

  const handleNewDocumentUploadComplete = (result: any) => {
    setIsUploadingNewFile(false);
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      setUploadedFile({
        fileUrl: uploadedFile.uploadURL,
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size || 0,
        mimeType: uploadedFile.type || 'application/octet-stream',
      });
      toast({
        title: "File ready",
        description: "File uploaded! Now create the document to save it.",
      });
    }
  };

  const handleAddDocument = async (data: DocumentFormData) => {
    if (!selectedResidence) return;

    try {
      const documentData = {
        name: data.name,
        type: data.type,
        dateReference: data.dateReference,
        residenceId: selectedResidence.id,
        isVisibleToTenants: data.isVisibleToTenants,
        uploadedBy: 'current-user', // Will be set properly by the server
        documentType: 'resident',
        ...(uploadedFile && {
          fileUrl: uploadedFile.fileUrl,
          fileName: uploadedFile.fileName,
          fileSize: uploadedFile.fileSize,
          mimeType: uploadedFile.mimeType,
        }),
      };

      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentData),
      });

      if (!response.ok) throw new Error('Failed to add document');

      await queryClient.invalidateQueries({
        queryKey: ['/api/documents', 'residence', selectedResidence.id],
      });

      setIsDocumentDialogOpen(false);
      setUploadedFile(null);
      documentForm.reset();
      toast({ title: 'Document created successfully' });
    } catch (error) {
      toast({ 
        title: 'Error creating document', 
        description: 'Please try again later',
        variant: 'destructive' 
      });
    }
  };

  const handleEditDocument = async (data: DocumentFormData) => {
    if (!selectedDocument) return;

    try {
      const response = await fetch(`/api/documents/${selectedDocument.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          type: data.type,
          dateReference: data.dateReference,
        }),
      });

      if (!response.ok) throw new Error('Failed to update document');

      await queryClient.invalidateQueries({
        queryKey: ['/api/documents', 'residence', selectedResidence?.id],
      });

      setSelectedDocument(null);
      setIsEditingDocument(false);
      toast({ title: 'Document updated successfully' });
    } catch (error) {
      toast({ 
        title: 'Error updating document', 
        description: 'Please try again later',
        variant: 'destructive' 
      });
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete document');

      await queryClient.invalidateQueries({
        queryKey: ['/api/documents', 'residence', selectedResidence?.id],
      });

      toast({ title: 'Document deleted successfully' });
    } catch (error) {
      toast({ 
        title: 'Error deleting document', 
        description: 'Please try again later',
        variant: 'destructive' 
      });
    }
  };

  const formatFileSize = (size?: string) => {
    if (!size) return 'Unknown size';
    const bytes = parseInt(size);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString();
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
                              name='name'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder='Enter contact name' {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={contactForm.control}
                              name='email'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email (Optional)</FormLabel>
                                  <FormControl>
                                    <Input type='email' placeholder='Enter email address' {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={contactForm.control}
                              name='phone'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Phone (Optional)</FormLabel>
                                  <FormControl>
                                    <Input placeholder='Enter phone number' {...field} />
                                  </FormControl>
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
                                      <SelectItem value='emergency'>Emergency</SelectItem>
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
                        <div key={contact.id} className='border rounded-lg p-4 space-y-2'>
                          <div className='flex items-center justify-between'>
                            <Badge variant='outline' className='capitalize'>
                              {contact.contactCategory}
                            </Badge>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => handleDeleteContact(contact.id)}
                            >
                              <Trash2 className='w-4 h-4' />
                            </Button>
                          </div>
                          <div>
                            <p className='font-semibold'>
                              {contact.name}
                            </p>
                            {contact.email && (
                              <p className='text-sm text-gray-600 flex items-center gap-1'>
                                <Mail className='w-3 h-3' />
                                {contact.email}
                              </p>
                            )}
                            {contact.phone && (
                              <p className='text-sm text-gray-600 flex items-center gap-1'>
                                <Phone className='w-3 h-3' />
                                {contact.phone}
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

              {/* Building Contacts */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Building className='w-5 h-5' />
                    Building Contacts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {buildingContactsLoading ? (
                    <p>Loading building contacts...</p>
                  ) : buildingContacts && buildingContacts.length > 0 ? (
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                      {buildingContacts.map((contact) => (
                        <div key={contact.id} className='border rounded-lg p-4 space-y-2 bg-gray-50'>
                          <div className='flex items-center justify-between'>
                            <Badge variant='outline' className='capitalize'>
                              {contact.contactCategory}
                            </Badge>
                          </div>
                          <div>
                            <p className='font-semibold'>
                              {contact.name}
                            </p>
                            {contact.email && (
                              <p className='text-sm text-gray-600 flex items-center gap-1'>
                                <Mail className='w-3 h-3' />
                                {contact.email}
                              </p>
                            )}
                            {contact.phone && (
                              <p className='text-sm text-gray-600 flex items-center gap-1'>
                                <Phone className='w-3 h-3' />
                                {contact.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className='text-gray-500 text-center py-8'>No building contacts available.</p>
                  )}
                </CardContent>
              </Card>

              {/* Documents */}
              <Card>
                <CardHeader>
                  <div className='flex items-center justify-between'>
                    <CardTitle className='flex items-center gap-2'>
                      <FileText className='w-5 h-5' />
                      Documents
                    </CardTitle>
                    <Dialog open={isDocumentDialogOpen} onOpenChange={(open) => {
                      setIsDocumentDialogOpen(open);
                      if (!open) {
                        setUploadedFile(null);
                        documentForm.reset();
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button variant='outline' size='sm'>
                          <Plus className='w-4 h-4 mr-2' />
                          Add Document
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Add New Document</DialogTitle>
                          <DialogDescription>
                            Upload a file or create a document entry for this residence.
                          </DialogDescription>
                        </DialogHeader>
                        
                        {/* File Upload Section */}
                        {!uploadedFile ? (
                          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Document File</h3>
                            <p className="text-gray-500 mb-4">Select a file to upload for this document (optional)</p>
                            <ObjectUploader
                              maxNumberOfFiles={1}
                              maxFileSize={50 * 1024 * 1024} // 50MB
                              onGetUploadParameters={handleNewDocumentUpload}
                              onComplete={handleNewDocumentUploadComplete}
                              buttonClassName="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                              disabled={isUploadingNewFile}
                            >
                              {isUploadingNewFile ? 'Uploading...' : 'Select File'}
                            </ObjectUploader>
                          </div>
                        ) : (
                          <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                            <div className="flex items-center">
                              <FileText className="h-8 w-8 text-green-600 mr-3" />
                              <div className="flex-1">
                                <p className="font-medium text-green-800">{uploadedFile.fileName}</p>
                                <p className="text-sm text-green-600">
                                  File ready to attach ({(uploadedFile.fileSize / 1024 / 1024).toFixed(2)} MB)
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setUploadedFile(null)}
                                className="text-green-600 hover:text-green-800"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        <Form {...documentForm}>
                          <form onSubmit={documentForm.handleSubmit(handleAddDocument)} className='space-y-4'>
                            <FormField
                              control={documentForm.control}
                              name='name'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Document Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder='Enter document name' {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={documentForm.control}
                              name='type'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Category</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {DOCUMENT_CATEGORIES.map((category) => (
                                        <SelectItem key={category.value} value={category.value}>
                                          {category.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={documentForm.control}
                              name='dateReference'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Reference Date</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="date" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={documentForm.control}
                              name='isVisibleToTenants'
                              render={({ field }) => (
                                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm'>
                                  <div className='space-y-0.5'>
                                    <FormLabel className='text-base'>
                                      Available For Tenants
                                    </FormLabel>
                                    <p className='text-sm text-muted-foreground'>
                                      Allow tenants to view this document
                                    </p>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <div className='flex justify-end gap-2 pt-4'>
                              <Button type='button' variant='outline' onClick={() => setIsDocumentDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button type='submit'>
                                Create Document
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                
                {/* Document Filters */}
                <div className='px-6 pb-4 border-b'>
                  <div className='flex flex-wrap items-center gap-4'>
                    <div className='flex items-center gap-2'>
                      <Filter className='w-4 h-4 text-gray-500' />
                      <Label className='text-sm font-medium'>Filter by:</Label>
                    </div>
                    
                    <div className='flex items-center gap-2'>
                      <Label className='text-sm'>Category:</Label>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className='w-32'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='all'>All</SelectItem>
                          {DOCUMENT_CATEGORIES.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className='flex items-center gap-2'>
                      <Label className='text-sm'>Year:</Label>
                      <Select value={yearFilter} onValueChange={setYearFilter}>
                        <SelectTrigger className='w-24'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='all'>All</SelectItem>
                          {availableYears.map((year) => (
                            <SelectItem key={year} value={year}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className='text-sm text-gray-500'>
                      {filteredDocuments.length} of {documents?.length || 0} documents
                    </div>
                  </div>
                </div>
                
                <CardContent>
                  {documentsLoading ? (
                    <p>Loading documents...</p>
                  ) : filteredDocuments && filteredDocuments.length > 0 ? (
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                      {filteredDocuments.map((document) => (
                        <div key={document.id} className='border rounded-lg p-4 space-y-3'>
                          <div className='flex items-center justify-between'>
                            <Badge variant='outline' className='capitalize'>
                              {DOCUMENT_CATEGORIES.find(cat => cat.value === document.type)?.label || document.type}
                            </Badge>
                            <div className='flex gap-1'>
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => {
                                  setSelectedDocument(document);
                                  setIsViewingDocument(true);
                                }}
                                title='View Details'
                              >
                                <Eye className='w-4 h-4' />
                              </Button>
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => {
                                  setSelectedDocument(document);
                                  setIsEditingDocument(true);
                                  documentForm.reset({
                                    name: document.name,
                                    type: document.type as any,
                                    dateReference: document.dateReference ? document.dateReference.split('T')[0] : new Date().toISOString().split('T')[0],
                                    isVisibleToTenants: document.isVisibleToTenants || false,
                                  });
                                }}
                                title='Edit Document'
                              >
                                <Edit className='w-4 h-4' />
                              </Button>
                              {document.fileUrl && (
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  onClick={() => window.open(document.fileUrl, '_blank')}
                                  title='Download File'
                                >
                                  <Download className='w-4 h-4' />
                                </Button>
                              )}
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => handleDeleteDocument(document.id)}
                                title='Delete Document'
                              >
                                <Trash2 className='w-4 h-4' />
                              </Button>
                            </div>
                          </div>
                          <div>
                            <p className='font-semibold text-sm'>{document.name}</p>
                            <div className='flex items-center gap-1 text-xs text-gray-600'>
                              <Calendar className='w-3 h-3' />
                              {formatDate(document.dateReference)}
                            </div>
                            {document.fileName && (
                              <div className='text-xs text-gray-500 mt-1'>
                                {document.fileName} • {formatFileSize(document.fileSize)}
                              </div>
                            )}
                            {document.isVisibleToTenants && (
                              <Badge variant="secondary" className="text-xs mt-2">
                                Available to Tenants
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className='text-gray-500 text-center py-8'>No documents found for this residence.</p>
                  )}
                </CardContent>
              </Card>

              {/* Edit Document Dialog */}
              <Dialog open={isEditingDocument} onOpenChange={(open) => {
                setIsEditingDocument(open);
                if (!open) {
                  setSelectedDocument(null);
                  documentForm.reset();
                }
              }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Document</DialogTitle>
                  </DialogHeader>
                  <Form {...documentForm}>
                    <form onSubmit={documentForm.handleSubmit(handleEditDocument)} className='space-y-4'>
                      <FormField
                        control={documentForm.control}
                        name='name'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Document Name</FormLabel>
                            <FormControl>
                              <Input placeholder='Enter document name' {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={documentForm.control}
                        name='type'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Document Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {DOCUMENT_CATEGORIES.map((category) => (
                                  <SelectItem key={category.value} value={category.value}>
                                    {category.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={documentForm.control}
                        name='dateReference'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reference Date</FormLabel>
                            <FormControl>
                              <Input type='date' {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={documentForm.control}
                        name='isVisibleToTenants'
                        render={({ field }) => (
                          <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm'>
                            <div className='space-y-0.5'>
                              <FormLabel className='text-base'>
                                Available For Tenants
                              </FormLabel>
                              <p className='text-sm text-muted-foreground'>
                                Allow tenants to view this document
                              </p>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className='flex justify-end gap-2'>
                        <Button type='button' variant='outline' onClick={() => setIsEditingDocument(false)}>
                          Cancel
                        </Button>
                        <Button type='submit'>Update Document</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* View Document Dialog */}
              <Dialog open={isViewingDocument} onOpenChange={(open) => {
                setIsViewingDocument(open);
                if (!open) {
                  setSelectedDocument(null);
                }
              }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Document Details</DialogTitle>
                  </DialogHeader>
                  {selectedDocument && (
                    <div className='space-y-4'>
                      <div>
                        <Label className='text-sm font-medium'>Document Name</Label>
                        <p className='text-sm text-gray-600 mt-1'>{selectedDocument.name}</p>
                      </div>
                      
                      <div>
                        <Label className='text-sm font-medium'>Category</Label>
                        <Badge variant='outline' className='ml-2 capitalize'>
                          {DOCUMENT_CATEGORIES.find(cat => cat.value === selectedDocument.type)?.label || selectedDocument.type}
                        </Badge>
                      </div>
                      
                      <div>
                        <Label className='text-sm font-medium'>Reference Date</Label>
                        <p className='text-sm text-gray-600 mt-1'>
                          {formatDate(selectedDocument.dateReference)}
                        </p>
                      </div>
                      
                      {selectedDocument.fileName && (
                        <div>
                          <Label className='text-sm font-medium'>File Information</Label>
                          <div className='text-sm text-gray-600 mt-1'>
                            <p><strong>Name:</strong> {selectedDocument.fileName}</p>
                            <p><strong>Size:</strong> {formatFileSize(selectedDocument.fileSize)}</p>
                            <p><strong>Type:</strong> {selectedDocument.mimeType}</p>
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <Label className='text-sm font-medium'>Upload Date</Label>
                        <p className='text-sm text-gray-600 mt-1'>
                          {formatDate(selectedDocument.createdAt)}
                        </p>
                      </div>
                      
                      <div className='flex items-center gap-2'>
                        <Label className='text-sm font-medium'>Available to Tenants:</Label>
                        <Badge variant={selectedDocument.isVisibleToTenants ? 'default' : 'secondary'}>
                          {selectedDocument.isVisibleToTenants ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      
                      {selectedDocument.fileUrl && (
                        <div className='flex justify-end'>
                          <Button
                            onClick={() => window.open(selectedDocument.fileUrl, '_blank')}
                            className='flex items-center gap-2'
                          >
                            <Download className='w-4 h-4' />
                            Download File
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
    </div>
  );
}