import { db } from './server/db/index.js';
import { uniformatCodes } from './shared/schemas/maintenance.js';
import { UNIFORMAT_CATALOG } from './shared/data/uniformat-catalog.js';

async function seedUniformat() {
  console.log('Populating UNIFORMAT codes...');
  
  try {
    for (const item of UNIFORMAT_CATALOG) {
      await db.insert(uniformatCodes)
        .values({
          code: item.code,
          level: item.level,
          parentCode: item.parentCode || null,
          nameFr: item.nameFr,
          nameEn: item.nameEn,
          descriptionFr: item.descriptionFr || null,
          descriptionEn: item.descriptionEn || null,
          typicalLifespan: item.typicalLifespan || null,
          category: item.category,
        })
        .onConflictDoNothing();
    }
    
    console.log('✅ UNIFORMAT codes populated successfully');
    console.log(`✅ Total entries: ${UNIFORMAT_CATALOG.length}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error populating UNIFORMAT codes:', error);
    process.exit(1);
  }
}

seedUniformat();