# Quebec Compliance Code Examples

This guide provides comprehensive code examples for implementing Quebec-specific compliance features in the Koveo Gestion application, including Law 25 privacy compliance, French language support, and Canadian standards.

## Table of Contents

- [Address and Postal Code Validation](#address-and-postal-code-validation)
- [Bilingual Form Implementation](#bilingual-form-implementation)
- [Law 25 Privacy Compliance](#law-25-privacy-compliance)
- [Canadian Date and Number Formatting](#canadian-date-and-number-formatting)
- [Quebec Business Registration](#quebec-business-registration)
- [Accessibility Standards (WCAG 2.1 AA)](#accessibility-standards-wcag-21-aa)

## Address and Postal Code Validation

### Canadian Postal Code Validation

```typescript
// lib/validation/quebec-validators.ts
import { z } from 'zod';

// Quebec/Canadian postal code validation
export const quebecPostalCodeSchema = z.string()
  .regex(
    /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/,
    'Format de code postal invalide. Utilisez le format H1A 1A1'
  )
  .transform((value) => {
    // Auto-format postal code: H1A1A1 -> H1A 1A1
    const cleaned = value.replace(/\s/g, '').toUpperCase();
    return cleaned.replace(/^([A-Z]\d[A-Z])(\d[A-Z]\d)$/, '$1 $2');
  });

// Quebec address validation with provinces
export const quebecAddressSchema = z.object({
  address: z.string()
    .min(1, 'L\'adresse est requise')
    .max(300, 'L\'adresse ne peut pas dépasser 300 caractères'),
  city: z.string()
    .min(1, 'La ville est requise')
    .max(100, 'Le nom de ville ne peut pas dépasser 100 caractères'),
  province: z.enum([
    'QC', 'ON', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'NT', 'NU', 'YT'
  ], {
    errorMap: () => ({ message: 'Province canadienne requise' }),
  }).default('QC'),
  postalCode: quebecPostalCodeSchema,
  country: z.string().default('Canada'),
});

// Canadian phone number validation
export const canadianPhoneSchema = z.string()
  .optional()
  .refine((value) => {
    if (!value) return true;

    // Support various Canadian phone formats
    const phoneRegex = /^(\+1\s?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}$/;
    return phoneRegex.test(value);
  }, {
    message: 'Numéro de téléphone canadien invalide. Format: (514) 555-0123',
  })
  .transform((value) => {
    if (!value) return value;

    // Normalize to Canadian format: +1 (XXX) XXX-XXXX
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return value;
  });

// Usage in React component
export function QuebecAddressForm() {
  const form = useForm<z.infer<typeof quebecAddressSchema>>({
    resolver: zodResolver(quebecAddressSchema),
    defaultValues: {
      address: '',
      city: '',
      province: 'QC',
      postalCode: '',
      country: 'Canada',
    },
  });

  return (
    <Form {...form}>
      <form className="space-y-4">
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adresse complète *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="123 Rue Saint-Laurent, Appartement 4B"
                  autoComplete="street-address"
                />
              </FormControl>
              <FormDescription>
                Incluez le numéro civique, le nom de la rue et l'unité si applicable
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ville *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Montréal"
                    autoComplete="address-level2"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="province"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Province *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="QC">Québec (QC)</SelectItem>
                    <SelectItem value="ON">Ontario (ON)</SelectItem>
                    <SelectItem value="BC">Colombie-Britannique (BC)</SelectItem>
                    <SelectItem value="AB">Alberta (AB)</SelectItem>
                    <SelectItem value="MB">Manitoba (MB)</SelectItem>
                    <SelectItem value="SK">Saskatchewan (SK)</SelectItem>
                    <SelectItem value="NS">Nouvelle-Écosse (NS)</SelectItem>
                    <SelectItem value="NB">Nouveau-Brunswick (NB)</SelectItem>
                    <SelectItem value="NL">Terre-Neuve-et-Labrador (NL)</SelectItem>
                    <SelectItem value="PE">Île-du-Prince-Édouard (PE)</SelectItem>
                    <SelectItem value="NT">Territoires du Nord-Ouest (NT)</SelectItem>
                    <SelectItem value="NU">Nunavut (NU)</SelectItem>
                    <SelectItem value="YT">Yukon (YT)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code postal *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="H1A 1A1"
                    maxLength={7}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      field.onChange(value);
                    }}
                    autoComplete="postal-code"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
```

## Bilingual Form Implementation

### Language Context and Form Labels

```typescript
// contexts/LanguageContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';

type Language = 'fr' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  fr: {
    // Form labels
    'form.firstName': 'Prénom',
    'form.lastName': 'Nom de famille',
    'form.email': 'Adresse courriel',
    'form.phone': 'Numéro de téléphone',
    'form.address': 'Adresse',
    'form.city': 'Ville',
    'form.province': 'Province',
    'form.postalCode': 'Code postal',
    'form.organization': 'Organisation',
    'form.role': 'Rôle',

    // Validation messages
    'validation.required': 'Ce champ est requis',
    'validation.email.invalid': 'Adresse courriel invalide',
    'validation.phone.invalid': 'Numéro de téléphone invalide',
    'validation.postalCode.invalid': 'Code postal invalide (format: H1A 1A1)',
    'validation.password.weak': 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre',

    // Buttons and actions
    'button.save': 'Sauvegarder',
    'button.cancel': 'Annuler',
    'button.delete': 'Supprimer',
    'button.edit': 'Modifier',
    'button.create': 'Créer',
    'button.submit': 'Soumettre',
    'button.send': 'Envoyer',

    // Success messages
    'success.saved': 'Sauvegardé avec succès',
    'success.created': 'Créé avec succès',
    'success.updated': 'Mis à jour avec succès',
    'success.deleted': 'Supprimé avec succès',
    'success.sent': 'Envoyé avec succès',

    // Error messages
    'error.generic': 'Une erreur est survenue',
    'error.network': 'Erreur de connexion réseau',
    'error.unauthorized': 'Accès non autorisé',
    'error.forbidden': 'Permissions insuffisantes',
    'error.notFound': 'Ressource non trouvée',

    // Roles
    'role.admin': 'Administrateur',
    'role.manager': 'Gestionnaire',
    'role.tenant': 'Locataire',
    'role.resident': 'Résident',

    // Quebec-specific terms
    'quebec.neq': 'Numéro d\'entreprise du Québec (NEQ)',
    'quebec.copropriete': 'Copropriété',
    'quebec.syndicat': 'Syndicat de copropriétaires',
    'quebec.regie': 'Régie du logement',

    // Privacy and Law 25
    'privacy.consent.title': 'Consentement à la collecte de renseignements personnels',
    'privacy.consent.description': 'Conformément à la Loi 25 du Québec, nous recueillons vos renseignements personnels pour la gestion de votre propriété.',
    'privacy.consent.agree': 'J\'accepte la collecte et l\'utilisation de mes renseignements personnels',
    'privacy.dataPortability': 'Portabilité des données',
    'privacy.rightToDelete': 'Droit à l\'effacement',
    'privacy.accessRequest': 'Demande d\'accès aux données',
  },
  en: {
    // Form labels
    'form.firstName': 'First Name',
    'form.lastName': 'Last Name',
    'form.email': 'Email Address',
    'form.phone': 'Phone Number',
    'form.address': 'Address',
    'form.city': 'City',
    'form.province': 'Province',
    'form.postalCode': 'Postal Code',
    'form.organization': 'Organization',
    'form.role': 'Role',

    // Validation messages
    'validation.required': 'This field is required',
    'validation.email.invalid': 'Invalid email address',
    'validation.phone.invalid': 'Invalid phone number',
    'validation.postalCode.invalid': 'Invalid postal code (format: H1A 1A1)',
    'validation.password.weak': 'Password must contain at least 8 characters, one uppercase, one lowercase, and one number',

    // Buttons and actions
    'button.save': 'Save',
    'button.cancel': 'Cancel',
    'button.delete': 'Delete',
    'button.edit': 'Edit',
    'button.create': 'Create',
    'button.submit': 'Submit',
    'button.send': 'Send',

    // Success messages
    'success.saved': 'Successfully saved',
    'success.created': 'Successfully created',
    'success.updated': 'Successfully updated',
    'success.deleted': 'Successfully deleted',
    'success.sent': 'Successfully sent',

    // Error messages
    'error.generic': 'An error occurred',
    'error.network': 'Network connection error',
    'error.unauthorized': 'Unauthorized access',
    'error.forbidden': 'Insufficient permissions',
    'error.notFound': 'Resource not found',

    // Roles
    'role.admin': 'Administrator',
    'role.manager': 'Manager',
    'role.tenant': 'Tenant',
    'role.resident': 'Resident',

    // Quebec-specific terms
    'quebec.neq': 'Quebec Business Number (NEQ)',
    'quebec.copropriete': 'Condominium',
    'quebec.syndicat': 'Condominium Association',
    'quebec.regie': 'Housing Board',

    // Privacy and Law 25
    'privacy.consent.title': 'Consent to Personal Information Collection',
    'privacy.consent.description': 'In accordance with Quebec Law 25, we collect your personal information for property management purposes.',
    'privacy.consent.agree': 'I agree to the collection and use of my personal information',
    'privacy.dataPortability': 'Data Portability',
    'privacy.rightToDelete': 'Right to Erasure',
    'privacy.accessRequest': 'Data Access Request',
  },
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('fr'); // Default to French for Quebec

  useEffect(() => {
    // Load saved language preference
    const savedLanguage = localStorage.getItem('koveo-language') as Language;
    if (savedLanguage && ['fr', 'en'].includes(savedLanguage)) {
      setLanguage(savedLanguage);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('koveo-language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

// Bilingual form component example
export function BilingualUserForm() {
  const { t, language } = useLanguage();

  const userSchema = z.object({
    firstName: z.string().min(1, t('validation.required')),
    lastName: z.string().min(1, t('validation.required')),
    email: z.string().email(t('validation.email.invalid')),
    phone: canadianPhoneSchema.refine(
      (val) => val !== undefined,
      { message: t('validation.phone.invalid') }
    ),
    role: z.enum(['admin', 'manager', 'tenant', 'resident']),
    privacyConsent: z.boolean().refine(val => val === true, {
      message: language === 'fr'
        ? 'Vous devez accepter la collecte de vos renseignements personnels'
        : 'You must agree to the collection of your personal information',
    }),
  });

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: 'resident',
      privacyConsent: false,
    },
  });

  return (
    <Form {...form}>
      <form className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.firstName')} *</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="given-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.lastName')} *</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="family-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.email')} *</FormLabel>
              <FormControl>
                <Input {...field} type="email" autoComplete="email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.phone')}</FormLabel>
              <FormControl>
                <Input {...field} type="tel" autoComplete="tel" />
              </FormControl>
              <FormDescription>
                {language === 'fr'
                  ? 'Format: (514) 555-0123'
                  : 'Format: (514) 555-0123'
                }
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.role')} *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="resident">{t('role.resident')}</SelectItem>
                  <SelectItem value="tenant">{t('role.tenant')}</SelectItem>
                  <SelectItem value="manager">{t('role.manager')}</SelectItem>
                  <SelectItem value="admin">{t('role.admin')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Law 25 Privacy Consent */}
        <FormField
          control={form.control}
          name="privacyConsent"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm font-medium">
                  {t('privacy.consent.title')}
                </FormLabel>
                <FormDescription className="text-sm">
                  {t('privacy.consent.description')}
                  <br />
                  <a
                    href="/privacy-policy"
                    className="text-blue-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {language === 'fr'
                      ? 'Voir notre politique de confidentialité'
                      : 'View our privacy policy'
                    }
                  </a>
                </FormDescription>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button type="button" variant="outline">
            {t('button.cancel')}
          </Button>
          <Button type="submit">
            {t('button.save')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

## Law 25 Privacy Compliance

### Data Collection Consent and User Rights

```typescript
// components/privacy/PrivacyConsent.tsx
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, Download, Trash2, Eye } from 'lucide-react';

interface PrivacyConsentProps {
  onConsentChange: (consented: boolean) => void;
  initialConsent?: boolean;
  showUserRights?: boolean;
}

export function PrivacyConsent({
  onConsentChange,
  initialConsent = false,
  showUserRights = true
}: PrivacyConsentProps) {
  const [consented, setConsented] = useState(initialConsent);
  const { t, language } = useLanguage();

  const handleConsentChange = (checked: boolean) => {
    setConsented(checked);
    onConsentChange(checked);
  };

  const dataTypes = language === 'fr' ? [
    'Nom et coordonnées',
    'Informations de contact (téléphone, courriel)',
    'Adresse de résidence',
    'Informations de facturation',
    'Historique des demandes de maintenance',
    'Communications avec la gestion',
  ] : [
    'Name and contact details',
    'Contact information (phone, email)',
    'Residence address',
    'Billing information',
    'Maintenance request history',
    'Communications with management',
  ];

  const purposes = language === 'fr' ? [
    'Gestion des propriétés et résidences',
    'Communication avec les résidents',
    'Facturation et paiements',
    'Maintenance et réparations',
    'Conformité réglementaire',
    'Amélioration des services',
  ] : [
    'Property and residence management',
    'Communication with residents',
    'Billing and payments',
    'Maintenance and repairs',
    'Regulatory compliance',
    'Service improvement',
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {t('privacy.consent.title')}
          </CardTitle>
          <CardDescription>
            {language === 'fr'
              ? 'Conformément à la Loi 25 sur la protection des renseignements personnels au Québec'
              : 'In accordance with Quebec Law 25 on personal information protection'
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">
              {language === 'fr'
                ? 'Types de renseignements collectés :'
                : 'Types of information collected:'
              }
            </h4>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              {dataTypes.map((type, index) => (
                <li key={index}>{type}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">
              {language === 'fr'
                ? 'Fins d\'utilisation :'
                : 'Purposes of use:'
              }
            </h4>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              {purposes.map((purpose, index) => (
                <li key={index}>{purpose}</li>
              ))}
            </ul>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="privacy-consent"
                checked={consented}
                onCheckedChange={handleConsentChange}
              />
              <label htmlFor="privacy-consent" className="text-sm">
                {t('privacy.consent.agree')}
                <br />
                <span className="text-xs text-gray-600">
                  {language === 'fr'
                    ? 'Vous pouvez retirer votre consentement à tout moment en nous contactant.'
                    : 'You may withdraw your consent at any time by contacting us.'
                  }
                </span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {showUserRights && (
        <Card>
          <CardHeader>
            <CardTitle>
              {language === 'fr'
                ? 'Vos droits en matière de protection des données'
                : 'Your data protection rights'
              }
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button variant="outline" size="sm" className="justify-start">
                <Eye className="w-4 h-4 mr-2" />
                {t('privacy.accessRequest')}
              </Button>

              <Button variant="outline" size="sm" className="justify-start">
                <Download className="w-4 h-4 mr-2" />
                {t('privacy.dataPortability')}
              </Button>

              <Button variant="outline" size="sm" className="justify-start">
                <Trash2 className="w-4 h-4 mr-2" />
                {t('privacy.rightToDelete')}
              </Button>
            </div>

            <p className="text-xs text-gray-600">
              {language === 'fr'
                ? 'Pour exercer vos droits, contactez notre responsable de la protection des données à privacy@koveo.ca'
                : 'To exercise your rights, contact our data protection officer at privacy@koveo.ca'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Data retention and deletion compliance
export function useDataRetention() {
  const { language } = useLanguage();

  const requestDataDeletion = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/privacy/delete-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to submit deletion request');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: language === 'fr' ? 'Demande soumise' : 'Request submitted',
        description: language === 'fr'
          ? 'Votre demande de suppression de données a été soumise. Nous vous contacterons sous 30 jours.'
          : 'Your data deletion request has been submitted. We will contact you within 30 days.',
      });
    },
  });

  const requestDataExport = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/privacy/export-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to submit export request');
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `personal-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: language === 'fr' ? 'Export terminé' : 'Export completed',
        description: language === 'fr'
          ? 'Vos données ont été téléchargées avec succès.'
          : 'Your data has been successfully downloaded.',
      });
    },
  });

  return {
    requestDataDeletion: requestDataDeletion.mutate,
    requestDataExport: requestDataExport.mutate,
    isDeletionPending: requestDataDeletion.isPending,
    isExportPending: requestDataExport.isPending,
  };
}
```

This guide provides comprehensive, production-ready code examples for Quebec compliance, ensuring your application meets all legal requirements while providing an excellent user experience in both French and English.
