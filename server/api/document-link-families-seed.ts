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
