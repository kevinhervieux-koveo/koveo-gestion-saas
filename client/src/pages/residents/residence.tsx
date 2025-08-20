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
  Trash2,
  FileText,
  Download,
  Calendar
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
  createdAt: string;
  updatedAt: string;
}

const DOCUMENT_CATEGORIES = [
  { value: 'lease', label: 'Lease Documents' },
  { value: 'inspection', label: 'Inspections' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'financial', label: 'Financial' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'legal', label: 'Legal' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'permits', label: 'Permits' },
  { value: 'utilities', label: 'Utilities' },
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
  type: z.enum(['lease', 'inspection', 'maintenance', 'financial', 'insurance', 'legal', 'correspondence', 'permits', 'utilities', 'other']),
  dateReference: z.string().refine((dateStr) => {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }, {
    message: 'Valid date is required',
  }),
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
      const response = await fetch(`/api/documents?residenceId=${selectedResidence?.id}`);
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      return data.documents || [];
    },
    enabled: !!selectedResidence?.id,
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

  const handleAddDocument = async (data: DocumentFormData) => {
    if (!selectedResidence) return;

    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          type: data.type,
          dateReference: data.dateReference,
          residenceId: selectedResidence.id,
          uploadedBy: 'current-user', // Will be set properly by the server
          documentType: 'resident'
        }),
      });

      if (!response.ok) throw new Error('Failed to add document');

      await queryClient.invalidateQueries({
        queryKey: ['/api/documents', 'residence', selectedResidence.id],
      });

      setIsDocumentDialogOpen(false);
      documentForm.reset();
      toast({ title: 'Document added successfully' });
    } catch (error) {
      toast({ 
        title: 'Error adding document', 
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

              {/* Documents */}
              <Card>
                <CardHeader>
                  <div className='flex items-center justify-between'>
                    <CardTitle className='flex items-center gap-2'>
                      <FileText className='w-5 h-5' />
                      Documents
                    </CardTitle>
                    <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant='outline' size='sm'>
                          <Plus className='w-4 h-4 mr-2' />
                          Add Document
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Document</DialogTitle>
                        </DialogHeader>
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
                            <div className='flex justify-end gap-2'>
                              <Button type='button' variant='outline' onClick={() => setIsDocumentDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button type='submit'>Add Document</Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {documentsLoading ? (
                    <p>Loading documents...</p>
                  ) : documents && documents.length > 0 ? (
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                      {documents.map((document) => (
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
                                  setIsEditingDocument(true);
                                  documentForm.reset({
                                    name: document.name,
                                    type: document.type as any,
                                    dateReference: document.dateReference ? document.dateReference.split('T')[0] : new Date().toISOString().split('T')[0],
                                  });
                                }}
                              >
                                <Edit className='w-4 h-4' />
                              </Button>
                              {document.fileUrl && (
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  onClick={() => window.open(document.fileUrl, '_blank')}
                                >
                                  <Download className='w-4 h-4' />
                                </Button>
                              )}
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => handleDeleteDocument(document.id)}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}