#!/usr/bin/env node

import fs from 'fs';

console.log('🔧 Fixing i18n.ts structure corruption...');

// Read the file
const content = fs.readFileSync('client/src/lib/i18n.ts', 'utf-8');

// Find the structure breaks
const lines = content.split('\n');
const fixedLines = [];
let inFrenchSection = false;
let skipTypeDefinitions = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect French section start
  if (line.trim() === 'fr: {') {
    inFrenchSection = true;
    fixedLines.push(line);
    // Add the proper French translations start
    fixedLines.push('    dashboard: \'Tableau de bord\',');
    fixedLines.push('    pillarFramework: \'Framework des piliers\',');
    continue;
  }
  
  // Skip TypeScript interface definitions that got mixed into French section
  if (inFrenchSection && (line.includes(': string;') || line.includes('export type') || line.includes('export interface'))) {
    skipTypeDefinitions = true;
    continue;
  }
  
  // Skip interface property definitions
  if (skipTypeDefinitions && line.includes(': string;')) {
    continue;
  }
  
  // Look for actual French translation content (format: key: 'value',)
  if (inFrenchSection && line.includes(': \'') && line.includes('\',')) {
    skipTypeDefinitions = false;
    fixedLines.push(line);
    continue;
  }
  
  // Stop skipping when we find valid content or reach the end
  if (skipTypeDefinitions && (line.trim() === '' || line.includes('// ') || line.trim() === '};')) {
    skipTypeDefinitions = false;
  }
  
  if (!skipTypeDefinitions) {
    fixedLines.push(line);
  }
}

// Write the fixed file
fs.writeFileSync('client/src/lib/i18n.ts', fixedLines.join('\n'), 'utf-8');

console.log('✅ Fixed i18n.ts structure corruption!');
console.log('🔄 Try building again.');