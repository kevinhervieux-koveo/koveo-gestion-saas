import { sql } from 'drizzle-orm';
import { db } from '../db';
import { documentTags } from '../../shared/schemas/documents';
import { logInfo, logError } from '../utils/logger';

type SeedTag = {
  name: string;
  description: string;
  scope: 'building' | 'residence' | 'any';
  importance: 'obligatoire' | 'nice_to_have' | 'extra';
  suggestedProfessionals: string[];
};

export const KOVEO_DEFAULT_TAGS: SeedTag[] = [
  {
    name: "Déclaration de copropriété (acte constitutif + règlement + état descriptif des fractions)",
    description:
      "Document notarié fondateur du syndicat. Doit contenir: l'acte constitutif (destination de l'immeuble, fractions communes/privatives), le règlement de l'immeuble (jouissance, administration, AG), et l'état descriptif des fractions (numérotation, quote-parts).",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Notaire', 'Avocat'],
  },
  {
    name: "Procès-verbaux",
    description:
      "Procès-verbaux de toutes les assemblées (AG annuelle, extraordinaire, conseil d'administration). Doit inclure: date, ordre du jour, résolutions adoptées, votes, signatures.",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Gestionnaire', 'Secrétaire'],
  },
  {
    name: "Certificat état de l'unité",
    description:
      "Certificat délivré par le syndicat pour une unité privative. Doit contenir: solde des contributions, état du fonds de prévoyance, créances pendantes, travaux votés affectant l'unité.",
    scope: 'residence',
    importance: 'obligatoire',
    suggestedProfessionals: ['Gestionnaire', 'Notaire'],
  },
  {
    name: "Certificat de localisation",
    description:
      "Plan d'arpentage à jour de l'unité ou de l'immeuble. Doit contenir: limites du terrain, servitudes, empiètements, rapport de l'arpenteur-géomètre signé.",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Arpenteur-géomètre'],
  },
  {
    name: "Règlement de l'immeuble",
    description:
      "Règlement intérieur applicable à l'immeuble. Doit contenir: règles de jouissance des parties privatives et communes, animaux, bruit, stationnement, locations à court terme, sanctions et procédure de modification.",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Avocat', 'Gestionnaire'],
  },
  {
    name: "Registre des copropriétaires",
    description:
      "Registre tenu par le syndicat. Doit contenir: identité et coordonnées des copropriétaires, fractions détenues, dates d'acquisition, mandataires éventuels.",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Gestionnaire'],
  },
  {
    name: "Plan et devis de l'immeuble",
    description:
      "Plans architecturaux, structuraux, mécaniques, électriques. Doit contenir: plans d'origine ou tels-que-construits, devis, schémas des réseaux (plomberie, électricité, ventilation).",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Architecte', 'Ingénieur'],
  },
  {
    name: "Rapport inspection antérieure",
    description:
      "Rapports d'inspection passés de l'immeuble. Doit contenir: date d'inspection, inspecteur, composants vérifiés, déficiences relevées, recommandations et estimés de coûts.",
    scope: 'building',
    importance: 'nice_to_have',
    suggestedProfessionals: ['Inspecteur en bâtiment', 'Ingénieur'],
  },
  {
    name: "Guide du résident",
    description:
      "Document d'accueil pour les copropriétaires et locataires. Doit contenir: règles de vie, contacts utiles, gestion des déchets, procédure pour signaler un problème, accès aux espaces communs.",
    scope: 'building',
    importance: 'nice_to_have',
    suggestedProfessionals: ['Gestionnaire'],
  },
  {
    name: "Manuel d'utilisation des équipements",
    description:
      "Manuels des équipements installés dans l'immeuble (chaudières, ascenseurs, ventilation, contrôles d'accès). Doit contenir: instructions d'utilisation, entretien préventif, contacts du fabricant.",
    scope: 'building',
    importance: 'nice_to_have',
    suggestedProfessionals: ['Entrepreneur', 'Fabricant'],
  },
  {
    name: "Contacts importants",
    description:
      "Liste des contacts clés. Doit contenir: gestionnaire, président du conseil, fournisseurs (plomberie, électricité, ascenseur, ménage), urgences, assureur, notaire.",
    scope: 'any',
    importance: 'nice_to_have',
    suggestedProfessionals: ['Gestionnaire'],
  },
  {
    name: "Documentation plateforme SAAS",
    description:
      "Documentation et accès aux outils numériques utilisés par le syndicat. Doit contenir: identifiants administratifs, guides d'utilisation, contrats de service.",
    scope: 'building',
    importance: 'extra',
    suggestedProfessionals: ['Gestionnaire'],
  },
  {
    name: "Fiche technique (composants)",
    description:
      "Fiches techniques par composant majeur de l'immeuble. Doit contenir: marque, modèle, année d'installation, durée de vie estimée, fournisseur, coût de remplacement.",
    scope: 'building',
    importance: 'nice_to_have',
    suggestedProfessionals: ['Ingénieur', 'Entrepreneur'],
  },
  {
    name: "Garanties",
    description:
      "Garanties actives sur les composants ou travaux. Doit contenir: dates de couverture, étendue, exclusions, procédure de réclamation, contact garant.",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Entrepreneur', 'Gestionnaire'],
  },
  {
    name: "Historique des plaintes",
    description:
      "Registre chronologique des plaintes reçues. Doit contenir: date, plaignant, nature, action prise, statut de résolution.",
    scope: 'building',
    importance: 'nice_to_have',
    suggestedProfessionals: ['Gestionnaire'],
  },
  {
    name: "Plan d'urgence",
    description:
      "Plan de mesures d'urgence pour l'immeuble. Doit contenir: évacuation, points de rassemblement, contacts d'urgence, procédures incendie/inondation/panne, responsables.",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Préventionniste', 'Gestionnaire'],
  },
  {
    name: "Fiche technique standardisée des unités privatives",
    description:
      "Fiche normalisée par unité. Doit contenir: superficie, nombre de pièces, équipements, finis, modifications déclarées, date de la dernière mise à jour.",
    scope: 'residence',
    importance: 'nice_to_have',
    suggestedProfessionals: ['Gestionnaire', 'Arpenteur'],
  },
  {
    name: "Devis et soumissions pour travaux futurs",
    description:
      "Devis et soumissions reçus pour des travaux à venir. Doit contenir: description détaillée, prix, échéancier, conditions, validité, références de l'entrepreneur.",
    scope: 'building',
    importance: 'nice_to_have',
    suggestedProfessionals: ['Entrepreneur', 'Ingénieur'],
  },
  {
    name: "Bail",
    description:
      "Bail signé du locataire. Doit contenir: parties, durée, loyer, conditions, annexes (règlement, état des lieux), formulaire obligatoire de la Régie du logement.",
    scope: 'residence',
    importance: 'obligatoire',
    suggestedProfessionals: ['Propriétaire', 'Avocat'],
  },
  {
    name: "Étude du fonds de prévoyance",
    description:
      "Étude actuarielle du fonds de prévoyance (Loi 16). Doit contenir: inventaire des composants, durée de vie résiduelle, coûts de remplacement, projection sur 25-30 ans, contributions recommandées.",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Ingénieur', 'Comptable'],
  },
  {
    name: "Carnet d'entretien de l'immeuble",
    description:
      "Carnet d'entretien obligatoire (Loi 16). Doit contenir: inventaire des composants, calendrier d'entretien préventif, historique des interventions, responsables.",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Ingénieur', 'Gestionnaire'],
  },
  {
    name: "Attestation du syndicat",
    description:
      "Attestation officielle du syndicat (vente, financement). Doit contenir: créances dues, litiges en cours, procédures spéciales, conformité du copropriétaire.",
    scope: 'residence',
    importance: 'obligatoire',
    suggestedProfessionals: ['Gestionnaire', 'Notaire'],
  },
  {
    name: "États financiers annuels / vérification comptable",
    description:
      "États financiers annuels du syndicat. Doit contenir: bilan, résultats, fonds d'administration et de prévoyance, notes, rapport du comptable ou vérificateur.",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Comptable (CPA)'],
  },
  {
    name: "Budget annuel approuvé",
    description:
      "Budget annuel adopté en AG. Doit contenir: revenus prévus, dépenses par catégorie, contributions au fonds de prévoyance, date d'adoption, signature.",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Gestionnaire', 'Comptable'],
  },
  {
    name: "Police d'assurance du syndicat",
    description:
      "Police d'assurance de l'immeuble. Doit contenir: assureur, numéro de police, montants de couverture (bâtiment, responsabilité), franchise, dates de validité, exclusions.",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Courtier en assurance'],
  },
  {
    name: "Rapports d'inspection réglementaires (ascenseurs / alarme incendie / gicleurs / façades)",
    description:
      "Rapports obligatoires d'inspection des systèmes critiques. Doit contenir: date, inspecteur certifié, résultat, déficiences, échéance pour correction, certificat de conformité.",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Inspecteur certifié', 'Ingénieur'],
  },
  {
    name: "Avis de cotisation et appels de fonds",
    description:
      "Avis envoyés aux copropriétaires pour les contributions. Doit contenir: période visée, montant, date d'échéance, mode de paiement, ventilation.",
    scope: 'residence',
    importance: 'obligatoire',
    suggestedProfessionals: ['Gestionnaire'],
  },
  {
    name: "Avis de cotisation spéciale",
    description:
      "Avis de cotisation spéciale votée en AG. Doit contenir: motif (travaux, déficit), montant, échéancier, résolution adoptée, date d'AG.",
    scope: 'residence',
    importance: 'obligatoire',
    suggestedProfessionals: ['Gestionnaire'],
  },
  {
    name: "Convocations et avis d'assemblée",
    description:
      "Convocations aux assemblées (AG ou extraordinaire). Doit contenir: date, heure, lieu, ordre du jour, pièces jointes, mode d'envoi, délais légaux respectés.",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Gestionnaire', 'Secrétaire'],
  },
  {
    name: "Permis municipaux et de rénovation",
    description:
      "Permis émis par la municipalité. Doit contenir: numéro de permis, nature des travaux, conditions, dates de validité, plans approuvés.",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Architecte', 'Entrepreneur'],
  },
  {
    name: "Contrats de service",
    description:
      "Contrats avec fournisseurs (déneigement, ménage, ascenseur, ventilation, gestion). Doit contenir: parties, services, prix, durée, renouvellement, résiliation, assurances.",
    scope: 'building',
    importance: 'obligatoire',
    suggestedProfessionals: ['Gestionnaire', 'Avocat'],
  },
  {
    name: "Certificat d'assurance habitation du copropriétaire/locataire",
    description:
      "Preuve d'assurance habitation. Doit contenir: assureur, numéro de police, dates de validité, responsabilité civile, améliorations locatives.",
    scope: 'residence',
    importance: 'obligatoire',
    suggestedProfessionals: ['Courtier en assurance'],
  },
  {
    name: "Avis au locataire (renouvellement, modification, reprise)",
    description:
      "Avis légaux entre propriétaire et locataire. Doit contenir: type d'avis, motif, dates légales, modifications proposées, droits du locataire, accusés de réception.",
    scope: 'residence',
    importance: 'obligatoire',
    suggestedProfessionals: ['Propriétaire', 'Avocat'],
  },
  {
    name: "Factures et reçus",
    description:
      "Factures et reçus liés à l'immeuble ou à l'unité. Doit contenir: fournisseur, date, description, montant, taxes, mode de paiement, lien à l'opération budgétaire.",
    scope: 'any',
    importance: 'nice_to_have',
    suggestedProfessionals: ['Comptable', 'Gestionnaire'],
  },
];

/**
 * Idempotently seed the Koveo system tags. Matched by (isSystem=true, name).
 * Re-runs are safe and only insert tags that don't already exist.
 */
export async function seedKoveoDocumentTags(): Promise<void> {
  try {
    const existing = await db
      .select({ name: documentTags.name })
      .from(documentTags)
      .where(sql`${documentTags.isSystem} = true`);
    const existingNames = new Set(existing.map((t) => t.name));

    const toInsert = KOVEO_DEFAULT_TAGS.filter((t) => !existingNames.has(t.name));

    if (toInsert.length === 0) {
      logInfo(`[DOC TAGS SEED] All ${KOVEO_DEFAULT_TAGS.length} Koveo system tags already present.`);
      return;
    }

    await db.insert(documentTags).values(
      toInsert.map((t) => ({
        organizationId: null,
        name: t.name,
        description: t.description,
        scope: t.scope,
        importance: t.importance,
        suggestedProfessionals: t.suggestedProfessionals,
        isSystem: true,
        source: 'koveo',
      })),
    );

    logInfo(`[DOC TAGS SEED] Inserted ${toInsert.length} Koveo system tags (skipped ${existing.length} existing).`);
  } catch (error) {
    logError('[DOC TAGS SEED] Failed to seed Koveo document tags', error as Error);
  }
}
