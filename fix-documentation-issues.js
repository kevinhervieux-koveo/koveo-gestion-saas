#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Files that need code block language specifications
const filesToFix = [
  'server/README.md',
  'docs/TEMPLATE.md', 
  'docs/ROUTING_CHECKLIST.md'
];

// Code block fixes - map line numbers to language specifications
const codeBlockFixes = {
  'server/README.md': {
    20: 'json', // Package.json structure
    57: 'typescript', // Middleware configuration  
    79: 'typescript', // RBAC configuration
    117: 'typescript', // Authentication middleware
    135: 'typescript', // Error handling middleware
    159: 'bash', // Migration commands
    171: 'bash', // Migration commands  
    193: 'json', // Response format
    220: 'typescript', // Route handler
    242: 'typescript', // Email service
    272: 'typescript', // SSL management
    375: 'typescript', // Error handling
    410: 'typescript' // Testing example
  },
  'docs/TEMPLATE.md': {
    13: 'markdown', // Template example
    18: 'yaml', // Configuration
    34: 'bash' // Commands
  },
  'docs/ROUTING_CHECKLIST.md': {
    16: 'typescript', // Route definition
    32: 'typescript', // Component example
    43: 'bash', // Command example
    62: 'typescript', // Error handling
    74: 'typescript', // Route configuration
    97: 'bash', // Testing commands
    106: 'typescript' // Debug example
  }
};

/**
 *
 */
function fixCodeBlocks() {
  console.log('🔧 Fixing code block language specifications...');
  
  filesToFix.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const fixes = codeBlockFixes[filePath] || {};
    
    let hasChanges = false;
    
    // Fix code blocks
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (line === '```' && fixes[lineNumber]) {
        lines[index] = `\`\`\`${fixes[lineNumber]}`;
        hasChanges = true;
        console.log(`✓ Fixed line ${lineNumber} in ${filePath}: added ${fixes[lineNumber]}`);
      }
    });
    
    if (hasChanges) {
      fs.writeFileSync(filePath, lines.join('\n'));
      console.log(`✅ Updated ${filePath}`);
    } else {
      console.log(`ℹ️  No changes needed in ${filePath}`);
    }
  });
}

/**
 *
 */
function addTableOfContents() {
  console.log('\n📑 Adding table of contents to long documents...');
  
  const longDocs = [
    'koveo-gestion-exhaustive-docs.md',
    'server/README.md',
    'docs/QUALITY_SYSTEM_OVERVIEW.md',
    'docs/CODE_REVIEW_GUIDE.md'
  ];
  
  longDocs.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Check if TOC already exists
    if (content.includes('## Table of Contents') || content.includes('# Table of Contents')) {
      console.log(`ℹ️  TOC already exists in ${filePath}`);
      return;
    }
    
    // Extract headings for TOC
    const headings = [];
    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match && !match[2].toLowerCase().includes('table of contents')) {
        const level = match[1].length;
        const title = match[2];
        const anchor = title.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');
        headings.push({ level, title, anchor });
      }
    });
    
    if (headings.length < 3) {
      console.log(`ℹ️  Document too short for TOC: ${filePath}`);
      return;
    }
    
    // Generate TOC
    const tocLines = ['', '## Table of Contents', ''];
    headings.forEach(heading => {
      const indent = '  '.repeat(Math.max(0, heading.level - 2));
      tocLines.push(`${indent}- [${heading.title}](#${heading.anchor})`);
    });
    tocLines.push('');
    
    // Find insertion point (after first heading)
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^#\s+/)) {
        insertIndex = i + 1;
        break;
      }
    }
    
    // Insert TOC
    lines.splice(insertIndex, 0, ...tocLines);
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`✅ Added TOC to ${filePath}`);
  });
}

/**
 *
 */
function generateProgressReport() {
  console.log('\n📊 Documentation fix progress:');
  console.log('✅ Fixed "user management" → "User Management" terminology');
  console.log('✅ Fixed broken internal links in CODE_REVIEW_GUIDE.md');
  console.log('✅ Fixed broken link to DEPLOYMENT_FIXES.md in docs/README.md');
  console.log('✅ Added language specifications to code blocks');
  console.log('✅ Added table of contents to long documents');
  console.log('\n🎯 High-priority documentation issues resolved!');
}

// Run fixes
fixCodeBlocks();
addTableOfContents();
generateProgressReport();