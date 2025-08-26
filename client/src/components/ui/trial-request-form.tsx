import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Building, Users, Mail, Phone, MapPin, MessageSquare, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface TrialRequestFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  numberOfBuildings: string;
  numberOfResidences: string;
  message: string;
}

interface TrialRequestFormProps {
  children: React.ReactNode;
}

/**
 * TrialRequestForm component.
 * @param props - Component props.
 * @param props.children - React children elements.
 * @returns JSX element.
 */
/**
 * Trial request form function.
 * @param { children } - { children } parameter.
 */
export function /**
 * Trial request form function.
 * @param { children } - { children } parameter.
 */ /**
 * Trial request form function.
 * @param { children } - { children } parameter.
 */  /**
   * Trial request form function.
   * @param { children } - { children } parameter.
   */


TrialRequestForm({ children }: TrialRequestFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<TrialRequestFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    city: '',
    province: 'QC',
    postalCode: '',
    numberOfBuildings: '',
    numberOfResidences: '',
    message: '',
  });

  const [errors, setErrors] = useState<Partial<TrialRequestFormData>>({});

  const validateForm = () => {
    const newErrors: Partial<TrialRequestFormData> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Le prénom est requis';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Le nom est requis';
    }
    if (!formData.email.trim()) {
      newErrors.email = "L'adresse courriel est requise";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Veuillez entrer une adresse courriel valide';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Le numéro de téléphone est requis';
    }
    if (!formData.company.trim()) {
      newErrors.company = "Le nom de l'entreprise est requis";
    }
    if (!formData.numberOfBuildings.trim()) {
      newErrors.numberOfBuildings = 'Le nombre de bâtiments est requis';
    } else if (parseInt(formData.numberOfBuildings) <= 0) {
      newErrors.numberOfBuildings = 'Veuillez entrer un nombre valide';
    }
    if (!formData.numberOfResidences.trim()) {
      newErrors.numberOfResidences = 'Le nombre de résidences est requis';
    } else if (parseInt(formData.numberOfResidences) <= 0) {
      newErrors.numberOfResidences = 'Veuillez entrer un nombre valide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof TrialRequestFormData, _value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value })); /**
     * If function.
     * @param errors[field] - errors[field] parameter.
     */ /**
     * If function.
     * @param errors[field] - errors[field] parameter.
     */  /**
   * If function.
   * @param errors[field] - errors[field] parameter.
   */


    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/trial-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      }); /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */ /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */  /**
   * If function.
   * @param !response.ok - !response.ok parameter.
   */


      if (!response.ok) {
        throw new Error('Failed to submit request');
      }

      toast({
        title: 'Demande envoyée avec succès!',
        description: 'Nous vous contacterons sous peu pour démarrer votre essai gratuit.',
        duration: 5000,
      });

      // Reset form and close dialog
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        address: '',
        city: '',
        province: 'QC',
        postalCode: '',
        numberOfBuildings: '',
        numberOfResidences: '',
        message: '',
      });
      setIsOpen(false);
    }  /**
   * Catch function.
   * @param _error - Error object.
   */
 catch (_error) {
      /**
       * Catch function.
       * @param error - Error object.
       */ /**
       * Catch function.
       * @param error - Error object.
       */

      console.error('Error submitting trial request:', _error);
      toast({
        title: 'Erreur',
        description:
          "Une erreur est survenue lors de l'envoi de votre demande. Veuillez réessayer.",
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className='sm:max-w-[600px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center space-x-2'>
            <Building className='h-5 w-5 text-blue-600' />
            <span>Démarrer votre essai gratuit</span>
          </DialogTitle>
          <DialogDescription>
            Complétez ce formulaire pour recevoir votre accès gratuit à Koveo Gestion. Nous vous
            contacterons rapidement pour configurer votre compte.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-6'>
          {/* Personal Information */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-lg flex items-center space-x-2'>
                <Users className='h-4 w-4' />
                <span>Informations personnelles</span>
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <Label htmlFor='firstName'>Prénom *</Label>
                  <Input
                    id='firstName'
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target._value)}
                    className={errors.firstName ? 'border-red-500' : ''}
                    data-testid='input-first-name'
                  />
                  {errors.firstName && (
                    <p className='text-sm text-red-500 mt-1'>{errors.firstName}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor='lastName'>Nom *</Label>
                  <Input
                    id='lastName'
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target._value)}
                    className={errors.lastName ? 'border-red-500' : ''}
                    data-testid='input-last-name'
                  />
                  {errors.lastName && (
                    <p className='text-sm text-red-500 mt-1'>{errors.lastName}</p>
                  )}
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <Label htmlFor='email'>Adresse courriel *</Label>
                  <Input
                    id='email'
                    type='email'
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target._value)}
                    className={errors.email ? 'border-red-500' : ''}
                    data-testid='input-email'
                  />
                  {errors.email && <p className='text-sm text-red-500 mt-1'>{errors.email}</p>}
                </div>
                <div>
                  <Label htmlFor='phone'>Téléphone *</Label>
                  <Input
                    id='phone'
                    type='tel'
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target._value)}
                    className={errors.phone ? 'border-red-500' : ''}
                    placeholder='(514) 555-0123'
                    data-testid='input-phone'
                  />
                  {errors.phone && <p className='text-sm text-red-500 mt-1'>{errors.phone}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor='company'>Nom de l'entreprise *</Label>
                <Input
                  id='company'
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target._value)}
                  className={errors.company ? 'border-red-500' : ''}
                  data-testid='input-company'
                />
                {errors.company && <p className='text-sm text-red-500 mt-1'>{errors.company}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-lg flex items-center space-x-2'>
                <MapPin className='h-4 w-4' />
                <span>Adresse</span>
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <Label htmlFor='address'>Adresse</Label>
                <Input
                  id='address'
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target._value)}
                  data-testid='input-address'
                />
              </div>
              <div className='grid grid-cols-3 gap-4'>
                <div>
                  <Label htmlFor='city'>Ville</Label>
                  <Input
                    id='city'
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target._value)}
                    data-testid='input-city'
                  />
                </div>
                <div>
                  <Label htmlFor='province'>Province</Label>
                  <select
                    id='province'
                    value={formData.province}
                    onChange={(e) => handleInputChange('province', e.target._value)}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    data-testid='select-province'
                  >
                    <option value='QC'>Québec</option>
                    <option value='ON'>Ontario</option>
                    <option value='BC'>Colombie-Britannique</option>
                    <option value='AB'>Alberta</option>
                    <option value='MB'>Manitoba</option>
                    <option value='SK'>Saskatchewan</option>
                    <option value='NS'>Nouvelle-Écosse</option>
                    <option value='NB'>Nouveau-Brunswick</option>
                    <option value='NL'>Terre-Neuve-et-Labrador</option>
                    <option value='PE'>Île-du-Prince-Édouard</option>
                    <option value='NT'>Territoires du Nord-Ouest</option>
                    <option value='NU'>Nunavut</option>
                    <option value='YT'>Yukon</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor='postalCode'>Code postal</Label>
                  <Input
                    id='postalCode'
                    value={formData.postalCode}
                    onChange={(e) => handleInputChange('postalCode', e.target.value.toUpperCase())}
                    placeholder='H1A 1A1'
                    data-testid='input-postal-code'
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property Information */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-lg flex items-center space-x-2'>
                <Building className='h-4 w-4' />
                <span>Informations sur les propriétés</span>
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <Label htmlFor='numberOfBuildings'>Nombre de bâtiments *</Label>
                  <Input
                    id='numberOfBuildings'
                    type='number'
                    min='1'
                    value={formData.numberOfBuildings}
                    onChange={(e) => handleInputChange('numberOfBuildings', e.target._value)}
                    className={errors.numberOfBuildings ? 'border-red-500' : ''}
                    data-testid='input-buildings'
                  />
                  {errors.numberOfBuildings && (
                    <p className='text-sm text-red-500 mt-1'>{errors.numberOfBuildings}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor='numberOfResidences'>Nombre de résidences *</Label>
                  <Input
                    id='numberOfResidences'
                    type='number'
                    min='1'
                    value={formData.numberOfResidences}
                    onChange={(e) => handleInputChange('numberOfResidences', e.target._value)}
                    className={errors.numberOfResidences ? 'border-red-500' : ''}
                    data-testid='input-residences'
                  />
                  {errors.numberOfResidences && (
                    <p className='text-sm text-red-500 mt-1'>{errors.numberOfResidences}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Message */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-lg flex items-center space-x-2'>
                <MessageSquare className='h-4 w-4' />
                <span>Message additionnel</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor='message'>Décrivez vos besoins spécifiques (optionnel)</Label>
                <Textarea
                  id='message'
                  value={formData.message}
                  onChange={(e) => handleInputChange('message', e.target._value)}
                  placeholder='Décrivez vos besoins en gestion immobilière, défis actuels, ou questions spécifiques...'
                  rows={4}
                  data-testid='textarea-message'
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className='flex justify-end space-x-3 pt-4 border-t'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
              data-testid='button-cancel'
            >
              Annuler
            </Button>
            <Button
              type='submit'
              disabled={isSubmitting}
              className='bg-blue-600 hover:bg-blue-700'
              data-testid='button-submit'
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className='mr-2 h-4 w-4' />
                  Envoyer la demande
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
