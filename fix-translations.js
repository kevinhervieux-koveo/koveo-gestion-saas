#!/usr/bin/env node

/**
 * Script to fix missing translation keys between English and French
 */

import fs from 'fs';
import path from 'path';

const filePath = './client/src/lib/i18n.ts';

// Read the current content
const content = fs.readFileSync(filePath, 'utf8');

// Extract English keys
const enStart = content.indexOf('en: {');
const enEnd = content.indexOf('  },\n  fr: {');
const enSection = content.substring(enStart + 5, enEnd);

// Extract French keys  
const frStart = content.indexOf('fr: {');
const frEnd = content.lastIndexOf('  },');
const frSection = content.substring(frStart + 5, frEnd);

// Parse keys from sections
function extractKeys(section) {
  const keys = [];
  const lines = section.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('//') && trimmed.includes(':')) {
      const keyMatch = trimmed.match(/^\s*(\w+):/);
      if (keyMatch) {
        keys.push(keyMatch[1]);
      }
    }
  }
  return keys;
}

function extractKeyValuePairs(section) {
  const pairs = {};
  const lines = section.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('//') && trimmed.includes(':')) {
      const match = trimmed.match(/^\s*(\w+):\s*'([^']*)',?$/);
      if (match) {
        pairs[match[1]] = match[2];
      }
    }
  }
  return pairs;
}

const enKeys = extractKeys(enSection);
const frKeys = extractKeys(frSection);
const enPairs = extractKeyValuePairs(enSection);

// Find missing keys in French
const missingKeys = enKeys.filter(key => !frKeys.includes(key));

console.log(`English has ${enKeys.length} keys`);
console.log(`French has ${frKeys.length} keys`);
console.log(`Missing keys in French: ${missingKeys.length}`);

if (missingKeys.length > 0) {
  console.log('\nMissing keys:', missingKeys.slice(0, 10), '...');
  
  // Generate French translations for missing keys
  const frenchTranslations = [];
  
  for (const key of missingKeys) {
    const enValue = enPairs[key];
    if (enValue) {
      // Basic translation mapping for common terms
      let frValue = enValue
        .replace(/Building/g, 'Bâtiment')
        .replace(/building/g, 'bâtiment')
        .replace(/User/g, 'Utilisateur')
        .replace(/user/g, 'utilisateur')
        .replace(/Save/g, 'Enregistrer')
        .replace(/save/g, 'enregistrer')
        .replace(/Delete/g, 'Supprimer')
        .replace(/delete/g, 'supprimer')
        .replace(/Edit/g, 'Modifier')
        .replace(/edit/g, 'modifier')
        .replace(/Create/g, 'Créer')
        .replace(/create/g, 'créer')
        .replace(/Update/g, 'Mettre à jour')
        .replace(/update/g, 'mettre à jour')
        .replace(/Address/g, 'Adresse')
        .replace(/address/g, 'adresse')
        .replace(/Name/g, 'Nom')
        .replace(/name/g, 'nom')
        .replace(/Email/g, 'Courriel')
        .replace(/email/g, 'courriel')
        .replace(/Password/g, 'Mot de passe')
        .replace(/password/g, 'mot de passe')
        .replace(/Status/g, 'Statut')
        .replace(/status/g, 'statut')
        .replace(/Active/g, 'Actif')
        .replace(/active/g, 'actif')
        .replace(/Inactive/g, 'Inactif')
        .replace(/inactive/g, 'inactif')
        .replace(/Required/g, 'Requis')
        .replace(/required/g, 'requis')
        .replace(/Error/g, 'Erreur')
        .replace(/error/g, 'erreur')
        .replace(/Success/g, 'Succès')
        .replace(/success/g, 'succès')
        .replace(/Loading/g, 'Chargement')
        .replace(/loading/g, 'chargement')
        .replace(/Failed/g, 'Échec')
        .replace(/failed/g, 'échec')
        .replace(/Search/g, 'Rechercher')
        .replace(/search/g, 'rechercher')
        .replace(/Filter/g, 'Filtrer')
        .replace(/filter/g, 'filtrer')
        .replace(/Submit/g, 'Soumettre')
        .replace(/submit/g, 'soumettre')
        .replace(/Cancel/g, 'Annuler')
        .replace(/cancel/g, 'annuler')
        .replace(/Close/g, 'Fermer')
        .replace(/close/g, 'fermer')
        .replace(/Back/g, 'Retour')
        .replace(/back/g, 'retour')
        .replace(/Next/g, 'Suivant')
        .replace(/next/g, 'suivant')
        .replace(/Previous/g, 'Précédent')
        .replace(/previous/g, 'précédent')
        .replace(/Confirm/g, 'Confirmer')
        .replace(/confirm/g, 'confirmer')
        .replace(/Add/g, 'Ajouter')
        .replace(/add/g, 'ajouter')
        .replace(/Remove/g, 'Retirer')
        .replace(/remove/g, 'retirer')
        .replace(/Organization/g, 'Organisation')
        .replace(/organization/g, 'organisation')
        .replace(/Residence/g, 'Résidence')
        .replace(/residence/g, 'résidence')
        .replace(/Document/g, 'Document')
        .replace(/document/g, 'document')
        .replace(/Management/g, 'Gestion')
        .replace(/management/g, 'gestion')
        .replace(/Dashboard/g, 'Tableau de bord')
        .replace(/dashboard/g, 'tableau de bord')
        .replace(/Settings/g, 'Paramètres')
        .replace(/settings/g, 'paramètres');
        
      frenchTranslations.push(`    ${key}: '${frValue}',`);
    } else {
      frenchTranslations.push(`    ${key}: '${key}', // TODO: Translate`);
    }
  }
  
  // Insert missing translations into French section
  const beforeFr = content.substring(0, frStart);
  const afterFr = content.substring(frEnd + frStart + 5);
  const existingFr = content.substring(frStart + 5, frEnd);
  
  const newFrSection = existingFr.trimEnd() + '\n' + frenchTranslations.join('\n') + '\n  ';
  const newContent = beforeFr + 'fr: {\n' + newFrSection + afterFr;
  
  // Write back to file
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`\nAdded ${missingKeys.length} missing French translations!`);
} else {
  console.log('\nNo missing translations found.');
}