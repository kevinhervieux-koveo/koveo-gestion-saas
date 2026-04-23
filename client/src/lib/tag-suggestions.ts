import type { DocumentTag } from '@/components/document-tags/TagPicker';

const FR_STOPWORDS = new Set([
  'de', 'la', 'le', 'les', 'des', 'du', 'et', 'ou', 'un', 'une', 'en', 'aux',
  'au', 'dans', 'sur', 'par', 'pour', 'avec', 'sans', 'est', 'ce', 'ces',
  'son', 'ses', 'qui', 'que', 'pas', 'plus', 'aux', 'leur', 'leurs', 'mes',
  'tes', 'nos', 'vos', 'lui', 'elle', 'ils', 'cette', 'cet', 'tout', 'tous',
  'toute', 'toutes', 'doit', 'contenir', 'noter', 'cas', 'lors',
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length >= 4 && !FR_STOPWORDS.has(t));
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  bylaw: ['reglement', 'declaration', 'copropriete', 'regle'],
  financial: [
    'etats',
    'financiers',
    'budget',
    'cotisation',
    'facture',
    'recu',
    'fonds',
    'prevoyance',
    'comptable',
  ],
  maintenance: ['entretien', 'carnet', 'maintenance', 'reparation'],
  legal: ['acte', 'notarie', 'avocat', 'declaration', 'bail'],
  meeting_minutes: ['proces', 'verbal', 'verbaux', 'assemblee', 'convocation'],
  insurance: ['assurance', 'police', 'courtier', 'habitation'],
  contracts: ['contrat', 'service', 'bail', 'soumission', 'devis'],
  permits: ['permis', 'municipal', 'renovation'],
  inspection: [
    'inspection',
    'rapport',
    'ascenseur',
    'gicleurs',
    'facade',
    'incendie',
    'alarme',
  ],
  other: [],
};

export interface SuggestTagsArgs {
  tags: DocumentTag[];
  fileName?: string | null;
  extractedText?: string | null;
  category?: string;
  scope?: 'building' | 'residence';
  max?: number;
}

/**
 * Score and pick the top tag IDs that best match the supplied context.
 * Pure function — safe to call from render via useMemo.
 */
export function suggestTagIds({
  tags,
  fileName,
  extractedText,
  category,
  scope,
  max = 3,
}: SuggestTagsArgs): string[] {
  if (!tags || tags.length === 0) return [];

  const haystackParts: string[] = [];
  if (fileName) haystackParts.push(fileName);
  if (extractedText) haystackParts.push(extractedText.slice(0, 8000));
  if (category && CATEGORY_KEYWORDS[category]) {
    haystackParts.push(CATEGORY_KEYWORDS[category].join(' '));
  }

  const haystack = ' ' + normalize(haystackParts.join(' ')) + ' ';
  if (haystack.trim().length === 0) return [];

  const scoped = scope
    ? tags.filter((t) => t.scope === scope || t.scope === 'any')
    : tags;

  const scored = scoped.map((tag) => {
    const nameTokens = new Set(tokenize(tag.name));
    const descTokens = new Set(tokenize(tag.description || ''));
    let score = 0;
    let matched = 0;

    for (const tok of nameTokens) {
      if (haystack.includes(' ' + tok) || haystack.includes(tok + ' ')) {
        score += 3;
        matched++;
      }
    }
    for (const tok of descTokens) {
      if (nameTokens.has(tok)) continue;
      if (haystack.includes(' ' + tok) || haystack.includes(tok + ' ')) {
        score += 1;
        matched++;
      }
    }

    if (category && CATEGORY_KEYWORDS[category]) {
      for (const ck of CATEGORY_KEYWORDS[category]) {
        const n = normalize(ck);
        if (nameTokens.has(n)) score += 2;
      }
    }

    return { tag, score, matched };
  });

  return scored
    .filter((s) => s.score > 0 && s.matched >= 1)
    .sort((a, b) => b.score - a.score || a.tag.name.localeCompare(b.tag.name))
    .slice(0, max)
    .map((s) => s.tag.id);
}
