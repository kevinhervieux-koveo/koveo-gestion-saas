import type { Translations } from '@/lib/i18n';

type TFn = (key: keyof Translations) => string;

export interface SystemFamilyDisplay {
  name: string;
  description: string | null;
}

type NameKey = keyof Translations & `sfName${string}`;
type DescKey = keyof Translations & `sfDesc${string}`;

interface FamilyTranslationEntry {
  nameKey: NameKey;
  descKey: DescKey;
}

export const SYSTEM_FAMILY_TRANSLATION_MAP: Record<string, FamilyTranslationEntry> = {
  'Sequence': { nameKey: 'sfNameSequence', descKey: 'sfDescSequence' },
  'Financial': { nameKey: 'sfNameFinancial', descKey: 'sfDescFinancial' },
  'Meetings (AGA)': { nameKey: 'sfNameMeetingsAGA', descKey: 'sfDescMeetingsAGA' },
  'Contracts': { nameKey: 'sfNameContracts', descKey: 'sfDescContracts' },
  'Maintenance': { nameKey: 'sfNameMaintenance', descKey: 'sfDescMaintenance' },
  'Déclaration de copropriété': { nameKey: 'sfNameDeclarationCopropriete', descKey: 'sfDescDeclarationCopropriete' },
  'Règlements de l\'immeuble': { nameKey: 'sfNameReglementsImmeuble', descKey: 'sfDescReglementsImmeuble' },
  'Certificat de localisation': { nameKey: 'sfNameCertificatLocalisation', descKey: 'sfDescCertificatLocalisation' },
  'Étude du fonds de prévoyance': { nameKey: 'sfNameEtudeFondsPrevoyance', descKey: 'sfDescEtudeFondsPrevoyance' },
  'Carnet d\'entretien': { nameKey: 'sfNameCarnetEntretien', descKey: 'sfDescCarnetEntretien' },
  'Procès-verbaux du conseil d\'administration': { nameKey: 'sfNameProcesVerbauxCA', descKey: 'sfDescProcesVerbauxCA' },
  'Avis aux copropriétaires': { nameKey: 'sfNameAvisCoproprietaires', descKey: 'sfDescAvisCoproprietaires' },
  'États financiers': { nameKey: 'sfNameEtatsFinanciers', descKey: 'sfDescEtatsFinanciers' },
  'Budgets annuels': { nameKey: 'sfNameBudgetsAnnuels', descKey: 'sfDescBudgetsAnnuels' },
  'Cotisations spéciales': { nameKey: 'sfNameCotisationsSpeciales', descKey: 'sfDescCotisationsSpeciales' },
  'Assurances': { nameKey: 'sfNameAssurances', descKey: 'sfDescAssurances' },
  'Sinistres et réclamations': { nameKey: 'sfNameSinistres', descKey: 'sfDescSinistres' },
  'Permis et autorisations': { nameKey: 'sfNamePermisAutorisations', descKey: 'sfDescPermisAutorisations' },
  'Inspections de l\'immeuble': { nameKey: 'sfNameInspectionsImmeuble', descKey: 'sfDescInspectionsImmeuble' },
  'Travaux majeurs': { nameKey: 'sfNameTravauxMajeurs', descKey: 'sfDescTravauxMajeurs' },
  'Baux': { nameKey: 'sfNameBaux', descKey: 'sfDescBaux' },
  'Dossier de copropriétaire / locataire': { nameKey: 'sfNameDossierCoproprietaire', descKey: 'sfDescDossierCoproprietaire' },
  'Mutations et ventes': { nameKey: 'sfNameMutationsVentes', descKey: 'sfDescMutationsVentes' },
  'Procédures juridiques': { nameKey: 'sfNameProceduresJuridiques', descKey: 'sfDescProceduresJuridiques' },
  'Évaluations municipales et taxes': { nameKey: 'sfNameEvaluationsMunicipales', descKey: 'sfDescEvaluationsMunicipales' },
  'Services publics': { nameKey: 'sfNameServicesPublics', descKey: 'sfDescServicesPublics' },
};

/**
 * Returns the localized name and description for a Koveo system family.
 * - When isSystem is true and the DB name matches a known canonical name,
 *   returns the translated label via the provided `t()` function.
 * - Otherwise falls back to the raw stored name / description (unchanged).
 * - Non-system / org-scoped families are always returned unchanged.
 */
export function getSystemFamilyDisplay(
  family: { name: string; description: string | null; isSystem: boolean },
  t: TFn,
): SystemFamilyDisplay {
  if (!family.isSystem) {
    return { name: family.name, description: family.description };
  }
  const entry = SYSTEM_FAMILY_TRANSLATION_MAP[family.name];
  if (!entry) {
    return { name: family.name, description: family.description };
  }
  return {
    name: t(entry.nameKey),
    description: t(entry.descKey) || family.description,
  };
}
