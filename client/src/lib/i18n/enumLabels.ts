/**
 * Centralised enum → human-readable label helper.
 *
 * Usage (inside a React component):
 *   const { language } = useLanguage();
 *   const label = enumLabels.role('super_admin', language);  // "Super administrateur" in FR
 *
 * Usage (outside React — plain TypeScript):
 *   enumLabels.orgType('syndicate', 'fr');  // "Syndicat"
 *
 * This file is intentionally dependency-free so it can be imported from
 * both components and pure utility code.
 */

export type Language = 'en' | 'fr';

export type RoleKey =
  | 'tenant'
  | 'resident'
  | 'manager'
  | 'admin'
  | 'super_admin'
  | 'demo_tenant'
  | 'demo_resident'
  | 'demo_manager';

export type OrgTypeKey =
  | 'condo_association'
  | 'syndicate'
  | 'management_company'
  | 'demo'
  | 'rental'
  | 'apartment'
  | 'cooperative';

/**
 * All persisted building_type enum values.
 * 'appartement' is a legacy French alias for 'apartment' kept for backward
 * compatibility with rows written before the enum was normalised.
 */
export type BuildingTypeKey =
  | 'condo'
  | 'apartment'
  | 'appartement'
  | 'rental'
  | 'townhouse'
  | 'commercial'
  | 'mixed_use'
  | 'other';

const ROLE_LABELS: Record<string, Record<Language, string>> = {
  tenant: { en: 'Tenant', fr: 'Locataire' },
  resident: { en: 'Resident', fr: 'Résident' },
  manager: { en: 'Manager', fr: 'Gestionnaire' },
  admin: { en: 'Admin', fr: 'Administrateur' },
  super_admin: { en: 'Super Admin', fr: 'Super administrateur' },
  demo_tenant: { en: 'Demo Tenant', fr: 'Locataire démo' },
  demo_resident: { en: 'Demo Resident', fr: 'Résident démo' },
  demo_manager: { en: 'Demo Manager', fr: 'Gestionnaire démo' },
};

const ORG_TYPE_LABELS: Record<string, Record<Language, string>> = {
  condo_association: { en: 'Condo Association', fr: 'Association de copropriété' },
  syndicate: { en: 'Syndicate', fr: 'Syndicat' },
  management_company: { en: 'Management Company', fr: 'Société de gestion' },
  demo: { en: 'Demo', fr: 'Démo' },
  rental: { en: 'Rental', fr: 'Locatif' },
  apartment: { en: 'Apartment', fr: 'Appartement' },
  cooperative: { en: 'Cooperative', fr: 'Coopérative' },
};

/**
 * Building type labels. 'appartement' is a legacy alias for 'apartment'
 * kept for rows written before the enum was normalised. The FR label for
 * 'condo' is "Condo" (the word is the same in Quebec French; the legal
 * term "copropriété" is used only in formal/administrative contexts).
 */
const BUILDING_TYPE_LABELS: Record<string, Record<Language, string>> = {
  condo: { en: 'Condo', fr: 'Condo' },
  apartment: { en: 'Apartment', fr: 'Appartement' },
  appartement: { en: 'Apartment', fr: 'Appartement' },
  rental: { en: 'Rental', fr: 'Locatif' },
  townhouse: { en: 'Townhouse', fr: 'Maison en rangée' },
  commercial: { en: 'Commercial', fr: 'Commercial' },
  mixed_use: { en: 'Mixed Use', fr: 'Usage mixte' },
  other: { en: 'Other', fr: 'Autre' },
};

export const enumLabels = {
  /**
   * Returns the human-readable label for a role enum value.
   * Falls back to the raw enum string if the key is unknown.
   */
  role(key: string, lang: Language = 'en'): string {
    const entry = ROLE_LABELS[key];
    return entry ? entry[lang] : key;
  },

  /**
   * Returns the human-readable label for an organisation-type enum value.
   * Falls back to the raw enum string if the key is unknown.
   */
  orgType(key: string, lang: Language = 'en'): string {
    const entry = ORG_TYPE_LABELS[key];
    return entry ? entry[lang] : key;
  },

  /**
   * Returns the human-readable label for a building_type enum value.
   * Handles the legacy 'appartement' alias and the 'rental' type.
   * Falls back to the raw enum string if an unknown variant is encountered.
   */
  buildingType(key: string, lang: Language = 'en'): string {
    const entry = BUILDING_TYPE_LABELS[key];
    return entry ? entry[lang] : key;
  },
};
