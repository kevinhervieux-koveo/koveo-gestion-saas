#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const i18nFilePath = 'client/src/lib/i18n.ts';

console.log('🔧 Fixing duplicate translation keys in i18n.ts...');

// Read the file
const content = fs.readFileSync(i18nFilePath, 'utf-8');

// Function to remove duplicate keys from a translation object
function removeDuplicateKeys(objectString) {
  const lines = objectString.split('\n');
  const processedLines = [];
  const seenKeys = new Set();
  
  for (const line of lines) {
    // Check if this line defines a key (has pattern "key:")
    const keyMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
    
    if (keyMatch) {
      const key = keyMatch[1];
      
      if (seenKeys.has(key)) {
        console.log(`   ❌ Removing duplicate key: ${key}`);
        continue; // Skip this duplicate key
      } else {
        seenKeys.add(key);
        processedLines.push(line);
      }
    } else {
      // Not a key definition line, keep it
      processedLines.push(line);
    }
  }
  
  return processedLines.join('\n');
}

// Split content to find the translation objects
const enSectionStart = content.indexOf('  en: {');
const enSectionEnd = content.indexOf('  },\n  fr: {');
const frSectionStart = content.indexOf('  fr: {');
const frSectionEnd = content.lastIndexOf('  },\n};');

if (enSectionStart === -1 || frSectionStart === -1) {
  console.error('❌ Could not find translation sections in the file');
  console.log('Debug: enSectionStart =', enSectionStart, 'frSectionStart =', frSectionStart);
  process.exit(1);
}

// Extract sections
const beforeTranslations = content.substring(0, enSectionStart);
const enSection = content.substring(enSectionStart, enSectionEnd);
const betweenSections = content.substring(enSectionEnd, frSectionStart);
const frSection = content.substring(frSectionStart, frSectionEnd);
const afterTranslations = content.substring(frSectionEnd);

console.log('🧹 Cleaning English translations...');
const cleanedEnSection = removeDuplicateKeys(enSection);

console.log('🧹 Cleaning French translations...');
const cleanedFrSection = removeDuplicateKeys(frSection);

// Reconstruct the file
const newContent = beforeTranslations + cleanedEnSection + betweenSections + cleanedFrSection + afterTranslations;

// Write the cleaned file
fs.writeFileSync(i18nFilePath, newContent, 'utf-8');

console.log('✅ Successfully removed duplicate translation keys!');
console.log('🔄 You should run npm run build again to verify the warnings are gone.');