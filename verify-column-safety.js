// Verify which columns are safe to remove from production database
import { neon } from '@neondatabase/serverless';

const productionSql = neon(process.env.DATABASE_URL_KOVEO);

async function verifyColumnSafety() {
  try {
    console.log('🔍 Verifying column safety before deletion...\n');
    
    // 1. Check data migration quality for building_elements
    console.log('1. Checking data migration quality...');
    
    const migrationCheck = await productionSql`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(element_name) as has_element_name,
        COUNT(name) as has_name,
        COUNT(replacement_cost) as has_replacement_cost,
        COUNT(reconstruction_cost) as has_reconstruction_cost,
        COUNT(installation_date) as has_installation_date,
        COUNT(original_construction_date) as has_original_construction_date,
        COUNT(expected_life) as has_expected_life,
        COUNT(original_lifespan) as has_original_lifespan,
        COUNT(condition_rating) as has_condition_rating
      FROM building_elements
    `;
    
    const stats = migrationCheck[0];
    console.log('   Data migration status:');
    console.log(`     Total rows: ${stats.total_rows}`);
    console.log(`     element_name populated: ${stats.has_element_name}/${stats.total_rows}`);
    console.log(`     name populated: ${stats.has_name}/${stats.total_rows}`);
    console.log(`     replacement_cost populated: ${stats.has_replacement_cost}/${stats.total_rows}`);
    console.log(`     reconstruction_cost populated: ${stats.has_reconstruction_cost}/${stats.total_rows}`);
    console.log(`     installation_date populated: ${stats.has_installation_date}/${stats.total_rows}`);
    console.log(`     original_construction_date populated: ${stats.has_original_construction_date}/${stats.total_rows}`);
    console.log(`     expected_life populated: ${stats.has_expected_life}/${stats.total_rows}`);
    console.log(`     original_lifespan populated: ${stats.has_original_lifespan}/${stats.total_rows}`);
    console.log(`     condition_rating populated: ${stats.has_condition_rating}/${stats.total_rows}`);
    
    // 2. Check for data differences (should be same after migration)
    console.log('\n2. Checking for data consistency...');
    
    const consistencyCheck = await productionSql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN element_name != name THEN 1 END) as name_diff,
        COUNT(CASE WHEN replacement_cost != reconstruction_cost THEN 1 END) as cost_diff,
        COUNT(CASE WHEN installation_date != original_construction_date THEN 1 END) as date_diff,
        COUNT(CASE WHEN expected_life != original_lifespan THEN 1 END) as life_diff
      FROM building_elements 
      WHERE element_name IS NOT NULL 
        AND name IS NOT NULL
        AND replacement_cost IS NOT NULL 
        AND reconstruction_cost IS NOT NULL
    `;
    
    const consistency = consistencyCheck[0];
    console.log('   Data consistency check:');
    console.log(`     Total comparable rows: ${consistency.total}`);
    console.log(`     Name differences: ${consistency.name_diff}`);
    console.log(`     Cost differences: ${consistency.cost_diff}`);
    console.log(`     Date differences: ${consistency.date_diff}`);
    console.log(`     Lifespan differences: ${consistency.life_diff}`);
    
    // 3. List all columns that could be candidates for removal
    console.log('\n3. Potential columns for cleanup:');
    
    const redundantPairs = [
      { new_col: 'element_name', old_col: 'name', safe: stats.has_element_name >= stats.has_name },
      { new_col: 'replacement_cost', old_col: 'reconstruction_cost', safe: stats.has_replacement_cost >= stats.has_reconstruction_cost },
      { new_col: 'installation_date', old_col: 'original_construction_date', safe: stats.has_installation_date >= stats.has_original_construction_date },
      { new_col: 'expected_life', old_col: 'original_lifespan', safe: stats.has_expected_life >= stats.has_original_lifespan }
    ];
    
    const safeToRemove = [];
    const unsafeToRemove = [];
    
    redundantPairs.forEach(pair => {
      if (pair.safe && consistency[`${pair.old_col.replace('_', '')}_diff`] === 0) {
        safeToRemove.push(pair.old_col);
        console.log(`     ✅ ${pair.old_col} -> SAFE TO REMOVE (fully migrated to ${pair.new_col})`);
      } else {
        unsafeToRemove.push(pair.old_col);
        console.log(`     ❌ ${pair.old_col} -> UNSAFE (data migration incomplete or differs)`);
      }
    });
    
    // 4. Show other potentially unused columns
    console.log('\n4. Other columns to review:');
    const allColumns = await productionSql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'building_elements'
      AND column_name IN ('description', 'current_condition', 'current_lifespan')
      ORDER BY column_name
    `;
    
    allColumns.forEach(col => {
      console.log(`     📋 ${col.column_name} (${col.data_type}) - Manual review needed`);
    });
    
    // 5. Generate safe removal commands
    if (safeToRemove.length > 0) {
      console.log('\n5. Safe removal commands:');
      console.log('   If data verification passes, these columns can be safely removed:');
      safeToRemove.forEach(col => {
        console.log(`     ALTER TABLE building_elements DROP COLUMN ${col};`);
      });
    }
    
    console.log('\n✅ Column safety verification complete');
    
    return {
      safeToRemove,
      unsafeToRemove,
      totalRows: stats.total_rows,
      migrationComplete: safeToRemove.length === redundantPairs.length
    };
    
  } catch (error) {
    console.error('❌ Column safety verification failed:', error);
    return null;
  }
}

verifyColumnSafety().then((result) => {
  if (result && result.migrationComplete && result.safeToRemove.length > 0) {
    console.log('\n🎉 All redundant columns are safe to remove!');
  } else if (result) {
    console.log('\n⚠️ Some columns need further verification before removal');
  }
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});