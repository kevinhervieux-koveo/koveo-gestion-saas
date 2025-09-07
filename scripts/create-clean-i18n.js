#!/usr/bin/env node

import fs from 'fs';

console.log('🔧 Creating clean i18n.ts file...');

// Read the corrupted file to extract unique translations
const content = fs.readFileSync('client/src/lib/i18n.ts', 'utf-8');

// Extract all unique translation keys from both English and French sections
const englishTranslations = new Map();
const frenchTranslations = new Map();

// Parse lines to find translation patterns
const lines = content.split('\n');
let currentSection = null;

for (const line of lines) {
  // Detect section starts
  if (line.trim() === 'en: {') {
    currentSection = 'en';
    continue;
  }
  if (line.trim() === 'fr: {') {
    currentSection = 'fr';
    continue;
  }
  if (line.trim() === '},') {
    currentSection = null;
    continue;
  }
  
  // Extract translation pairs (key: 'value',)
  const match = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*'([^']+)',?\s*$/);
  if (match && currentSection) {
    const [, key, value] = match;
    if (currentSection === 'en') {
      englishTranslations.set(key, value);
    } else if (currentSection === 'fr') {
      frenchTranslations.set(key, value);
    }
  }
}

console.log(`Found ${englishTranslations.size} English translations`);
console.log(`Found ${frenchTranslations.size} French translations`);

// Create a clean i18n.ts file
const cleanContent = `/**
 * Supported languages for the Quebec property management platform.
 * Provides bilingual support as required by Quebec regulations.
 */
export type Language = 'en' | 'fr';

/**
 * Translation keys interface for multilingual support.
 * Defines all translatable text keys used throughout the application.
 * Supports Quebec's bilingual requirements with French and English translations.
 */
export interface Translations {
${Array.from(englishTranslations.keys()).map(key => `  ${key}: string;`).join('\n')}
}

/**
 * All translations for the Quebec property management platform.
 * Supports bilingual requirements with comprehensive coverage.
 */
export const translations: Record<Language, Translations> = {
  en: {
${Array.from(englishTranslations.entries()).map(([key, value]) => `    ${key}: '${value}',`).join('\n')}
  },
  fr: {
${Array.from(frenchTranslations.entries()).map(([key, value]) => `    ${key}: '${value}',`).join('\n')}
  },
};

/**
 * Default language for the application.
 * Set to French to comply with Quebec language requirements.
 */
export const DEFAULT_LANGUAGE: Language = 'fr';

/**
 * Get translation by key for current language
 */
export function getTranslation(key: keyof Translations, language: Language): string {
  return translations[language][key] || translations['en'][key] || key;
}

/**
 * Available language options for language selector
 */
export const LANGUAGE_OPTIONS = [
  { value: 'fr' as const, label: 'Français' },
  { value: 'en' as const, label: 'English' },
] as const;
`;

// Write the clean file
fs.writeFileSync('client/src/lib/i18n.ts', cleanContent, 'utf-8');

console.log('✅ Created clean i18n.ts file with no duplicates!');
console.log('🔄 Try building again.');