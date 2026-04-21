#!/usr/bin/env tsx

/**
 * Document Reconciliation Script
 * 
 * Reconciles 648+ documents with filename mismatches between database records 
 * and actual files on disk. Creates mapping report and executes safe migration.
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { createReadStream } from 'fs';
import { createHash } from 'crypto';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

interface DatabaseDocument {
  id: string;
  name: string;
  filePath: string;
  fileName?: string;
  documentType: string;
  createdAt: Date;
  uploadedById: string;
}

interface FileOnDisk {
  path: string;
  name: string;
  size: number;
  mtime: Date;
  hash?: string;
}

interface ReconciliationMatch {
  dbRecord: DatabaseDocument;
  diskFile?: FileOnDisk;
  matchType: 'exact' | 'normalized' | 'fuzzy' | 'pattern' | 'none';
  confidence: number;
  newPath?: string;
  reason?: string;
}

interface ReconciliationReport {
  totalDocuments: number;
  exactMatches: number;
  normalizedMatches: number;
  fuzzyMatches: number;
  patternMatches: number;
  noMatches: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  matches: ReconciliationMatch[];
}

/**
 * Get all documents from database
 */
async function getDatabaseDocuments(): Promise<DatabaseDocument[]> {
  console.log('📋 Querying database documents...');
  
  const docs = await db.select().from(schema.documents);
  
  return docs.map(doc => ({
    id: doc.id,
    name: doc.name,
    filePath: doc.filePath,
    fileName: doc.fileName || undefined,
    documentType: doc.documentType,
    createdAt: doc.createdAt,
    uploadedById: doc.uploadedById
  }));
}

/**
 * Scan all files on disk in uploads directory
 */
async function scanFilesOnDisk(): Promise<FileOnDisk[]> {
  console.log('📁 Scanning files on disk...');
  
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const files: FileOnDisk[] = [];
  
  async function scanDirectory(dir: string): Promise<void> {
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (item.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            const relativePath = path.relative(uploadsDir, fullPath);
            
            files.push({
              path: relativePath,
              name: item.name,
              size: stats.size,
              mtime: stats.mtime
            });
          } catch (error) {
            console.warn(`⚠️  Error reading file ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Error scanning directory ${dir}:`, error);
    }
  }
  
  await scanDirectory(uploadsDir);
  
  console.log(`📁 Found ${files.length} files on disk`);
  return files;
}

/**
 * Calculate file hash for deduplication
 */
async function calculateFileHash(filePath: string): Promise<string> {
  try {
    const hash = createHash('md5');
    const stream = createReadStream(filePath);
    
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    
    return hash.digest('hex');
  } catch {
    return '';
  }
}

/**
 * Normalize file path for comparison
 */
function normalizePath(filePath: string): string {
  return filePath
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-\.\/]/g, '')
    .trim();
}

/**
 * Extract identifiers from filename for pattern matching
 */
function extractIdentifiers(filename: string): string[] {
  const identifiers: string[] = [];
  
  // Extract common patterns: dates, invoice numbers, building codes, etc.
  const patterns = [
    /\b\d{4}-\d{1,2}-\d{1,2}\b/g,  // Dates: YYYY-MM-DD
    /\b\d{4}\b/g,                   // Years: YYYY
    /\b[A-Z]\d{3,4}\b/g,           // Building codes: C305, B17F6
    /\binvoice[-_]?\w+/gi,         // Invoice references
    /\breceipt[-_]?\w+/gi,         // Receipt references
    /\b[a-f0-9]{8}[-]?[a-f0-9]{4}[-]?[a-f0-9]{4}[-]?[a-f0-9]{4}[-]?[a-f0-9]{12}\b/gi, // UUIDs
    /\b\w{6,}\b/g                  // Long words that might be unique identifiers
  ];
  
  for (const pattern of patterns) {
    const matches = filename.match(pattern);
    if (matches) {
      identifiers.push(...matches.map(m => m.toLowerCase()));
    }
  }
  
  return [...new Set(identifiers)]; // Remove duplicates
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  
  return 1 - (matrix[str2.length][str1.length] / maxLength);
}

/**
 * Attempt to reconcile a database document with files on disk
 */
function reconcileDocument(
  dbDoc: DatabaseDocument, 
  diskFiles: FileOnDisk[]
): ReconciliationMatch {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  
  // Strategy 1: Exact match
  const exactMatch = diskFiles.find(file => 
    file.path === dbDoc.filePath || 
    file.path === dbDoc.filePath.replace(/\\/g, '/')
  );
  
  if (exactMatch) {
    return {
      dbRecord: dbDoc,
      diskFile: exactMatch,
      matchType: 'exact',
      confidence: 100,
      newPath: exactMatch.path
    };
  }
  
  // Strategy 2: Normalized path match
  const normalizedDbPath = normalizePath(dbDoc.filePath);
  const normalizedMatch = diskFiles.find(file => 
    normalizePath(file.path) === normalizedDbPath
  );
  
  if (normalizedMatch) {
    return {
      dbRecord: dbDoc,
      diskFile: normalizedMatch,
      matchType: 'normalized',
      confidence: 95,
      newPath: normalizedMatch.path
    };
  }
  
  // Strategy 3: Filename similarity match
  const dbFilename = path.basename(dbDoc.filePath);
  let bestMatch: FileOnDisk | undefined;
  let bestSimilarity = 0;
  
  for (const file of diskFiles) {
    const similarity = calculateSimilarity(
      normalizePath(dbFilename),
      normalizePath(file.name)
    );
    
    if (similarity > bestSimilarity && similarity > 0.7) {
      bestSimilarity = similarity;
      bestMatch = file;
    }
  }
  
  if (bestMatch && bestSimilarity > 0.85) {
    return {
      dbRecord: dbDoc,
      diskFile: bestMatch,
      matchType: 'fuzzy',
      confidence: Math.round(bestSimilarity * 100),
      newPath: bestMatch.path
    };
  }
  
  // Strategy 4: Pattern-based matching using extracted identifiers
  const dbIdentifiers = extractIdentifiers(dbDoc.filePath + ' ' + dbDoc.name);
  if (dbIdentifiers.length > 0) {
    for (const file of diskFiles) {
      const fileIdentifiers = extractIdentifiers(file.path + ' ' + file.name);
      const commonIdentifiers = dbIdentifiers.filter(id => 
        fileIdentifiers.some(fid => fid.includes(id) || id.includes(fid))
      );
      
      if (commonIdentifiers.length >= 2) {
        const confidence = Math.min(90, 60 + (commonIdentifiers.length * 15));
        
        return {
          dbRecord: dbDoc,
          diskFile: file,
          matchType: 'pattern',
          confidence,
          newPath: file.path,
          reason: `Matched identifiers: ${commonIdentifiers.join(', ')}`
        };
      }
    }
  }
  
  // No match found
  return {
    dbRecord: dbDoc,
    matchType: 'none',
    confidence: 0,
    reason: `No matching file found for path: ${dbDoc.filePath}`
  };
}

/**
 * Generate reconciliation report
 */
async function generateReconciliationReport(matches: ReconciliationMatch[]): Promise<ReconciliationReport> {
  const report: ReconciliationReport = {
    totalDocuments: matches.length,
    exactMatches: 0,
    normalizedMatches: 0,
    fuzzyMatches: 0,
    patternMatches: 0,
    noMatches: 0,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    matches
  };
  
  for (const match of matches) {
    // Count by match type
    switch (match.matchType) {
      case 'exact':
        report.exactMatches++;
        break;
      case 'normalized':
        report.normalizedMatches++;
        break;
      case 'fuzzy':
        report.fuzzyMatches++;
        break;
      case 'pattern':
        report.patternMatches++;
        break;
      case 'none':
        report.noMatches++;
        break;
    }
    
    // Count by confidence level
    if (match.confidence >= 95) {
      report.highConfidence++;
    } else if (match.confidence >= 70) {
      report.mediumConfidence++;
    } else {
      report.lowConfidence++;
    }
  }
  
  return report;
}

/**
 * Save reconciliation report to CSV
 */
async function saveReportToCsv(report: ReconciliationReport, filename: string): Promise<void> {
  const csvHeader = [
    'db_id',
    'db_name', 
    'db_file_path',
    'disk_file_path',
    'match_type',
    'confidence',
    'new_path',
    'reason'
  ].join(',');
  
  const csvRows = report.matches.map(match => [
    match.dbRecord.id,
    `"${match.dbRecord.name.replace(/"/g, '""')}"`,
    `"${match.dbRecord.filePath.replace(/"/g, '""')}"`,
    match.diskFile ? `"${match.diskFile.path.replace(/"/g, '""')}"` : '',
    match.matchType,
    match.confidence,
    match.newPath ? `"${match.newPath.replace(/"/g, '""')}"` : '',
    match.reason ? `"${match.reason.replace(/"/g, '""')}"` : ''
  ].join(','));
  
  const csvContent = [csvHeader, ...csvRows].join('\n');
  
  await fs.writeFile(filename, csvContent, 'utf-8');
  console.log(`📊 Report saved to: ${filename}`);
}

/**
 * Execute migration for high confidence matches
 */
async function executeMigration(matches: ReconciliationMatch[]): Promise<void> {
  console.log('🚀 Executing migration for high confidence matches...');
  
  const highConfidenceMatches = matches.filter(m => m.confidence >= 95);
  let successCount = 0;
  let errorCount = 0;
  
  for (const match of highConfidenceMatches) {
    if (!match.newPath || !match.diskFile) continue;
    
    try {
      // Update database record with new file path
      await db
        .update(schema.documents)
        .set({ 
          filePath: match.newPath.replace(/\\/g, '/') // Ensure POSIX paths
        })
        .where(eq(schema.documents.id, match.dbRecord.id));
      
      successCount++;
      console.log(`✅ Updated: ${match.dbRecord.name} -> ${match.newPath}`);
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Failed to update ${match.dbRecord.name}:`, error);
    }
  }
  
  console.log(`🎯 Migration complete: ${successCount} success, ${errorCount} errors`);
}

/**
 * Main reconciliation function
 */
async function reconcileDocuments(): Promise<void> {
  console.log('🔄 Starting document reconciliation...\n');
  
  try {
    // Step 1: Get data
    const [dbDocuments, diskFiles] = await Promise.all([
      getDatabaseDocuments(),
      scanFilesOnDisk()
    ]);
    
    console.log(`📊 Found ${dbDocuments.length} documents in database`);
    console.log(`📁 Found ${diskFiles.length} files on disk\n`);
    
    // Step 2: Reconcile each document
    console.log('🔍 Starting reconciliation process...');
    const matches: ReconciliationMatch[] = [];
    
    for (let i = 0; i < dbDocuments.length; i++) {
      if (i % 50 === 0) {
        console.log(`Progress: ${i}/${dbDocuments.length} documents processed`);
      }
      
      const match = reconcileDocument(dbDocuments[i], diskFiles);
      matches.push(match);
    }
    
    // Step 3: Generate report
    console.log('\n📋 Generating reconciliation report...');
    const report = await generateReconciliationReport(matches);
    
    // Step 4: Display summary
    console.log('\n📊 RECONCILIATION SUMMARY');
    console.log('================================');
    console.log(`Total documents: ${report.totalDocuments}`);
    console.log(`Exact matches: ${report.exactMatches}`);
    console.log(`Normalized matches: ${report.normalizedMatches}`);
    console.log(`Fuzzy matches: ${report.fuzzyMatches}`);
    console.log(`Pattern matches: ${report.patternMatches}`);
    console.log(`No matches: ${report.noMatches}`);
    console.log(`\nConfidence levels:`);
    console.log(`High confidence (95%+): ${report.highConfidence}`);
    console.log(`Medium confidence (70-94%): ${report.mediumConfidence}`);
    console.log(`Low confidence (<70%): ${report.lowConfidence}`);
    
    const successRate = ((report.totalDocuments - report.noMatches) / report.totalDocuments * 100).toFixed(1);
    console.log(`\n🎯 Success rate: ${successRate}%`);
    
    // Step 5: Save detailed report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFilename = `reports/document-reconciliation-${timestamp}.csv`;
    
    // Ensure reports directory exists
    await fs.mkdir('reports', { recursive: true });
    await saveReportToCsv(report, reportFilename);
    
    // Step 6: Execute migration for high confidence matches
    if (report.highConfidence > 0) {
      console.log(`\n🚀 Ready to migrate ${report.highConfidence} high confidence matches`);
      
      // Ask for confirmation in interactive mode
      if (process.stdin.isTTY) {
        process.stdout.write('Execute migration? (y/N): ');
        // For now, skip interactive confirmation in script
        console.log('Skipping migration - run with --migrate flag to execute');
      } else if (process.argv.includes('--migrate')) {
        await executeMigration(matches);
      }
    }
    
    console.log('\n✅ Document reconciliation completed successfully!');
    console.log(`📄 Detailed report available at: ${reportFilename}`);
    
  } catch (error) {
    console.error('❌ Reconciliation failed:', error);
    throw error;
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  reconcileDocuments()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { reconcileDocuments };