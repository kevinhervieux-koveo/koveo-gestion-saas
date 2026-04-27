import { sql } from 'drizzle-orm';
import { db } from '../db';
import { documentLinkFamilies } from '../../shared/schemas/documents';
import { logInfo, logError } from '../utils/logger';

type SeedFamily = {
  name: string;
  description: string;
};

export const KOVEO_DEFAULT_LINK_FAMILIES: SeedFamily[] = [
  {
    name: 'Sequence',
    description: 'General sequential order (e.g. version history or reading order)',
  },
  {
    name: 'Financial',
    description: 'Financial documents linked in chronological order (budgets, statements)',
  },
  {
    name: 'Meetings (AGA)',
    description: 'Annual general assembly minutes and related documents',
  },
  {
    name: 'Contracts',
    description: 'Contracts and amendments linked across versions or renewals',
  },
  {
    name: 'Maintenance',
    description: 'Maintenance reports, inspections, and follow-up documents',
  },
  {
    name: 'Déclaration de copropriété',
    description: 'Versions and amendments of the founding act registered at the Registre foncier',
  },
  {
    name: 'Règlements de l\'immeuble',
    description: 'Adoption and amendments of internal building bylaws',
  },
  {
    name: 'Certificat de localisation',
    description: 'Successive certificates of location issued for the building',
  },
  {
    name: 'Étude du fonds de prévoyance',
    description: 'Quinquennial contingency fund studies and updates (Loi 16)',
  },
  {
    name: 'Carnet d\'entretien',
    description: 'Entries and updates of the official maintenance logbook (Loi 16)',
  },
  {
    name: 'Procès-verbaux du conseil d\'administration',
    description: 'Board meeting minutes and resolutions (distinct from the AGA chain)',
  },
  {
    name: 'Avis aux copropriétaires',
    description: 'Official notices: convocations, avis de cotisation, avis art. 1069, etc.',
  },
  {
    name: 'États financiers',
    description: 'Annual financial statements, mission d\'examen, and audit reports',
  },
  {
    name: 'Budgets annuels',
    description: 'Yearly budget approvals and revisions',
  },
  {
    name: 'Cotisations spéciales',
    description: 'Life cycle of a special assessment: résolution → avis → quittances',
  },
  {
    name: 'Assurances',
    description: 'Annual insurance policy renewals and endorsements (avenants)',
  },
  {
    name: 'Sinistres et réclamations',
    description: 'A single loss event: declaration → expert reports → settlement',
  },
  {
    name: 'Permis et autorisations',
    description: 'Municipal permits and amendments tied to a project',
  },
  {
    name: 'Inspections de l\'immeuble',
    description: 'Recurring façade, toiture, garage, ascenseur, and environment inspections',
  },
  {
    name: 'Travaux majeurs',
    description: 'Full project life: soumissions → contrat → avenants → décompte progressif → quittances',
  },
  {
    name: 'Baux',
    description: 'Lease renewals per rental unit (TAL-compliant chain)',
  },
  {
    name: 'Dossier de copropriétaire / locataire',
    description: 'Per-resident document history',
  },
  {
    name: 'Mutations et ventes',
    description: 'Documents tied to a unit sale: attestation art. 1069, état des charges, suivi notaire',
  },
  {
    name: 'Procédures juridiques',
    description: 'Life of a dispute: mise en demeure → procédures → jugement → exécution',
  },
  {
    name: 'Évaluations municipales et taxes',
    description: 'Annual rôle d\'évaluation and tax bills',
  },
  {
    name: 'Services publics',
    description: 'Recurring utility bill series (Hydro, gaz, eau, télécom) per account/meter',
  },
];

/**
 * Idempotently seed the Koveo system link families. Safe to re-run.
 */
export async function seedKoveoDocumentLinkFamilies(): Promise<void> {
  try {
    const existing = await db
      .select({ name: documentLinkFamilies.name })
      .from(documentLinkFamilies)
      .where(sql`${documentLinkFamilies.isSystem} = true`);
    const existingNames = new Set(existing.map((f) => f.name));

    const toInsert = KOVEO_DEFAULT_LINK_FAMILIES.filter((f) => !existingNames.has(f.name));

    if (toInsert.length === 0) {
      logInfo(
        `[DOC LINK FAMILIES SEED] All ${KOVEO_DEFAULT_LINK_FAMILIES.length} Koveo system families already present.`,
      );
      return;
    }

    await db.insert(documentLinkFamilies).values(
      toInsert.map((f) => ({
        organizationId: null,
        name: f.name,
        description: f.description,
        isSystem: true,
        source: 'koveo',
      })),
    );

    logInfo(
      `[DOC LINK FAMILIES SEED] Inserted ${toInsert.length} Koveo system families (skipped ${existing.length} existing).`,
    );
  } catch (error) {
    logError('[DOC LINK FAMILIES SEED] Failed to seed Koveo link families', error as Error);
  }
}
