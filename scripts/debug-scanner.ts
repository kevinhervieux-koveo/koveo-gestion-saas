#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

async function debugScan() {
  const clientSrcPath = path.join(process.cwd(), '..', 'client/src');
  console.log('Client src path:', clientSrcPath);
  console.log('Exists?', fs.existsSync(clientSrcPath));

  // Test glob pattern
  const files = await glob('**/*.{tsx,ts}', {
    cwd: clientSrcPath,
    ignore: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}']
  });
  
  console.log('Found files:', files.length);
  console.log('First 5 files:', files.slice(0, 5));

  // Test translation extraction on home.tsx
  const homePath = path.join(clientSrcPath, 'pages/home.tsx');
  if (fs.existsSync(homePath)) {
    const content = fs.readFileSync(homePath, 'utf-8');
    
    // Test different regex patterns
    const patterns = [
      /t\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /\.t\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /t\(['"`]([^'"`]+)['"`]\)/g
    ];

    patterns.forEach((pattern, i) => {
      const matches = content.match(pattern);
      console.log(`Pattern ${i + 1} matches:`, matches?.length || 0);
      if (matches) {
        console.log('Sample matches:', matches.slice(0, 3));
      }
    });
  }
}

debugScan().catch(console.error);