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
 * TrialRequestForm component for requesting trial access.
 */
export function TrialRequestForm({ children }: TrialRequestFormProps) {
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

  const handleInputChange = (field: keyof TrialRequestFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiRequest('POST', '/api/trial-requests', {
        data: formData,
      });

      if (response.ok) {
        toast({
          title: 'Demande envoyée avec succès',
          description: 'Nous vous contacterons dans les plus brefs délais.',
        });
        setIsOpen(false);
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
        setErrors({});
      } else {
        throw new Error('Failed to submit trial request');
      }
    } catch (error) {
      console.error('Error submitting trial request:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur lors de l\'envoi',
        description: 'Une erreur est survenue. Veuillez réessayer.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const provinces = [
    { value: 'AB', label: 'Alberta' },
    { value: 'BC', label: 'Colombie-Britannique' },
    { value: 'MB', label: 'Manitoba' },
    { value: 'NB', label: 'Nouveau-Brunswick' },
    { value: 'NL', label: 'Terre-Neuve-et-Labrador' },
    { value: 'NS', label: 'Nouvelle-Écosse' },
    { value: 'NT', label: 'Territoires du Nord-Ouest' },
    { value: 'NU', label: 'Nunavut' },
    { value: 'ON', label: 'Ontario' },
    { value: 'PE', label: 'Île-du-Prince-Édouard' },
    { value: 'QC', label: 'Québec' },
    { value: 'SK', label: 'Saskatchewan' },
    { value: 'YT', label: 'Yukon' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-koveo-navy" />
            Demande d'essai gratuit
          </DialogTitle>
          <DialogDescription>
            Découvrez Koveo Gestion avec un essai gratuit de 30 jours. Remplissez le formulaire ci-dessous et
            notre équipe vous contactera rapidement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Informations personnelles
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  data-testid="input-first-name"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="Votre prénom"
                />
                {errors.firstName && (
                  <p className="text-sm text-red-600" data-testid="error-first-name">
                    {errors.firstName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  data-testid="input-last-name"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Votre nom"
                />
                {errors.lastName && (
                  <p className="text-sm text-red-600" data-testid="error-last-name">
                    {errors.lastName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Adresse courriel *</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="input-email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="votre@courriel.com"
                />
                {errors.email && (
                  <p className="text-sm text-red-600" data-testid="error-email">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  data-testid="input-phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="(514) 123-4567"
                />
                {errors.phone && (
                  <p className="text-sm text-red-600" data-testid="error-phone">
                    {errors.phone}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-4 w-4" />
                Informations sur l'entreprise
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company">Nom de l'entreprise *</Label>
                <Input
                  id="company"
                  data-testid="input-company"
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  placeholder="Nom de votre entreprise"
                />
                {errors.company && (
                  <p className="text-sm text-red-600" data-testid="error-company">
                    {errors.company}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Input
                    id="address"
                    data-testid="input-address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="123 Rue Principale"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    data-testid="input-city"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="Montréal"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="province">Province</Label>
                  <select
                    id="province"
                    data-testid="select-province"
                    value={formData.province}
                    onChange={(e) => handleInputChange('province', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {provinces.map((prov) => (
                      <option key={prov.value} value={prov.value}>
                        {prov.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postalCode">Code postal</Label>
                  <Input
                    id="postalCode"
                    data-testid="input-postal-code"
                    value={formData.postalCode}
                    onChange={(e) => handleInputChange('postalCode', e.target.value)}
                    placeholder="H1A 1A1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-4 w-4" />
                Informations sur les propriétés
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numberOfBuildings">Nombre de bâtiments *</Label>
                <Input
                  id="numberOfBuildings"
                  type="number"
                  min="1"
                  data-testid="input-buildings-count"
                  value={formData.numberOfBuildings}
                  onChange={(e) => handleInputChange('numberOfBuildings', e.target.value)}
                  placeholder="1"
                />
                {errors.numberOfBuildings && (
                  <p className="text-sm text-red-600" data-testid="error-buildings-count">
                    {errors.numberOfBuildings}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="numberOfResidences">Nombre total de résidences *</Label>
                <Input
                  id="numberOfResidences"
                  type="number"
                  min="1"
                  data-testid="input-residences-count"
                  value={formData.numberOfResidences}
                  onChange={(e) => handleInputChange('numberOfResidences', e.target.value)}
                  placeholder="50"
                />
                {errors.numberOfResidences && (
                  <p className="text-sm text-red-600" data-testid="error-residences-count">
                    {errors.numberOfResidences}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Informations supplémentaires
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="message">Message (optionnel)</Label>
                <Textarea
                  id="message"
                  data-testid="textarea-message"
                  value={formData.message}
                  onChange={(e) => handleInputChange('message', e.target.value)}
                  placeholder="Décrivez vos besoins spécifiques ou posez-nous vos questions..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              data-testid="button-cancel"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-submit-trial"
              className="bg-koveo-navy hover:bg-koveo-navy/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
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