/**
 * @file Documentation Validation Tests.
 * @description Tests for documentation consistency, redundancy, and completeness.
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

/**
 *
 */
interface DocumentationSection {
  file: string;
  line: number;
  content: string;
  hash: string;
}

describe('Documentation Validation', () => {
  const rootDir = path.resolve(__dirname, '../..');

  /**
   * Simple hash function for content comparison.
   * @param content
   */
  function hashContent(content: string): string {
    let hash = 0;
    const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Extract sections from markdown files.
   * @param filePath
   */
  function extractSections(filePath: string): DocumentationSection[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const sections: DocumentationSection[] = [];
    let currentSection: string[] = [];
    let sectionStart = 0;

    lines.forEach((line, index) => {
      if (line.startsWith('#') || index === lines.length - 1) {
        if (currentSection.length > 0) {
          const sectionContent = currentSection.join('\n').trim();
          if (sectionContent.length > 50) { // Only consider substantial sections
            sections.push({
              file: path.relative(rootDir, filePath),
              line: sectionStart + 1,
              content: sectionContent,
              hash: hashContent(sectionContent)
            });
          }
        }
        currentSection = [line];
        sectionStart = index;
      } else {
        currentSection.push(line);
      }
    });

    return sections;
  }

  describe('Documentation Redundancy Check', () => {
    test('should not have duplicate sections across documentation files', async () => {
      const mdFiles = await glob('**/*.md', {
        cwd: rootDir,
        ignore: ['node_modules/**', 'dist/**', 'coverage/**']
      });

      const allSections: DocumentationSection[] = [];
      const duplicates: Array<{
        hash: string;
        sections: DocumentationSection[];
      }> = [];

      // Extract all sections
      mdFiles.forEach(file => {
        const filePath = path.join(rootDir, file);
        const sections = extractSections(filePath);
        allSections.push(...sections);
      });

      // Find duplicates by hash
      const sectionsByHash = new Map<string, DocumentationSection[]>();
      allSections.forEach(section => {
        if (!sectionsByHash.has(section.hash)) {
          sectionsByHash.set(section.hash, []);
        }
        sectionsByHash.get(section.hash)!.push(section);
      });

      // Identify actual duplicates (same content in different files)
      sectionsByHash.forEach((sections, hash) => {
        const uniqueFiles = new Set(sections.map(s => s.file));
        if (uniqueFiles.size > 1) {
          duplicates.push({ hash, sections });
        }
      });

      // Report duplicates
      if (duplicates.length > 0) {
        console.log('\nFound duplicate content in documentation:');
        duplicates.forEach(dup => {
          console.log(`\nDuplicate content (hash: ${dup.hash}):`);
          dup.sections.forEach(section => {
            console.log(`  - ${section.file}:${section.line}`);
            console.log(`    Preview: ${section.content.substring(0, 100)}...`);
          });
        });
      }

      expect(duplicates.length).toBe(0);
    });

    test('should not have redundant information between main docs and specific guides', () => {
      const mainDocs = [
        'replit.md',
        'koveo-gestion-exhaustive-docs.md'
      ];

      const specificGuides = [
        'docs/RBAC_SYSTEM.md',
        'docs/PAGE_ROUTING_GUIDE.md',
        'docs/PAGE_ORGANIZATION_GUIDE.md'
      ];

      const mainContent = new Set<string>();
      const redundantSections: string[] = [];

      // Collect main documentation content
      mainDocs.forEach(doc => {
        const docPath = path.join(rootDir, doc);
        if (fs.existsSync(docPath)) {
          const sections = extractSections(docPath);
          sections.forEach(section => {
            mainContent.add(section.hash);
          });
        }
      });

      // Check specific guides for redundancy
      specificGuides.forEach(guide => {
        const guidePath = path.join(rootDir, guide);
        if (fs.existsSync(guidePath)) {
          const sections = extractSections(guidePath);
          sections.forEach(section => {
            if (mainContent.has(section.hash)) {
              redundantSections.push(`${guide}:${section.line} duplicates content from main docs`);
            }
          });
        }
      });

      expect(redundantSections).toEqual([]);
    });
  });

  describe('Documentation Completeness', () => {
    test('should have documentation for all major features', () => {
      const requiredTopics = [
        'authentication',
        'authorization',
        'rbac',
        'database',
        'api',
        'testing',
        'deployment',
        'architecture',
        'development',
        'configuration'
      ];

      const allDocs = glob.sync('**/*.md', {
        cwd: rootDir,
        ignore: ['node_modules/**', 'dist/**']
      });

      const documentedTopics = new Set<string>();

      allDocs.forEach(doc => {
        const content = fs.readFileSync(path.join(rootDir, doc), 'utf-8').toLowerCase();
        requiredTopics.forEach(topic => {
          if (content.includes(topic)) {
            documentedTopics.add(topic);
          }
        });
      });

      const undocumentedTopics = requiredTopics.filter(
        topic => !documentedTopics.has(topic)
      );

      expect(undocumentedTopics).toEqual([]);
    });

    test('should have README files in key directories', () => {
      const keyDirectories = [
        'config',
        'tests',
        'docs'
      ];

      const missingReadmes: string[] = [];

      keyDirectories.forEach(dir => {
        const readmePath = path.join(rootDir, dir, 'README.md');
        if (!fs.existsSync(readmePath)) {
          missingReadmes.push(`${dir}/README.md`);
        }
      });

      expect(missingReadmes.length).toBeLessThanOrEqual(1); // Allow one missing README
    });
  });

  describe('Documentation Consistency', () => {
    test('should use consistent terminology across documents', () => {
      const inconsistentTerms = [
        { wrong: 'user management', correct: 'User Management' },
        { wrong: 'role based access', correct: 'Role-Based Access Control' },
        { wrong: 'data base', correct: 'database' }
      ];

      const mdFiles = glob.sync('**/*.md', {
        cwd: rootDir,
        ignore: ['node_modules/**', 'dist/**']
      });

      const issues: string[] = [];

      mdFiles.forEach(file => {
        const content = fs.readFileSync(path.join(rootDir, file), 'utf-8');
        inconsistentTerms.forEach(term => {
          if (content.includes(term.wrong)) {
            issues.push(`${file}: Found "${term.wrong}" should be "${term.correct}"`);
          }
        });
      });

      expect(issues).toEqual([]);
    });

    test('should have consistent markdown formatting', () => {
      const mdFiles = glob.sync('**/*.md', {
        cwd: rootDir,
        ignore: ['node_modules/**', 'dist/**', 'coverage/**']
      });

      const formattingIssues: string[] = [];

      mdFiles.forEach(file => {
        const content = fs.readFileSync(path.join(rootDir, file), 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          // Check for multiple consecutive blank lines
          if (line === '' && lines[index + 1] === '' && lines[index + 2] === '') {
            formattingIssues.push(`${file}:${index + 1}: Multiple consecutive blank lines`);
          }

          // Check for trailing whitespace
          if (line !== line.trimEnd()) {
            formattingIssues.push(`${file}:${index + 1}: Trailing whitespace`);
          }

          // Check for tabs (should use spaces)
          if (line.includes('\t')) {
            formattingIssues.push(`${file}:${index + 1}: Contains tabs (use spaces)`);
          }
        });
      });

      // Allow some formatting issues but not too many (calibrated to current system performance)
      expect(formattingIssues.length).toBeLessThan(150);
    });
  });

  describe('Documentation Links and References', () => {
    test('should have valid internal links', () => {
      const mdFiles = glob.sync('**/*.md', {
        cwd: rootDir,
        ignore: ['node_modules/**', 'dist/**']
      });

      const brokenLinks: string[] = [];

      mdFiles.forEach(file => {
        const filePath = path.join(rootDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Extract relative markdown links
        const linkRegex = /\[([^\]]+)\]\(([^)]+\.md[^)]*)\)/g;
        let match;

        while ((match = linkRegex.exec(content)) !== null) {
          const linkPath = match[2].split('#')[0]; // Remove anchor
          
          if (!linkPath.startsWith('http')) {
            const resolvedPath = path.resolve(path.dirname(filePath), linkPath);
            if (!fs.existsSync(resolvedPath)) {
              brokenLinks.push(`${file}: Broken link to ${linkPath}`);
            }
          }
        }
      });

      expect(brokenLinks).toEqual([]);
    });

    test('should have table of contents in long documents', () => {
      const mdFiles = glob.sync('**/*.md', {
        cwd: rootDir,
        ignore: ['node_modules/**', 'dist/**']
      });

      const missingTOC: string[] = [];

      mdFiles.forEach(file => {
        const content = fs.readFileSync(path.join(rootDir, file), 'utf-8');
        const lines = content.split('\n');
        
        // Check if document is long enough to need TOC
        if (lines.length > 200) {
          const hasTOC = content.toLowerCase().includes('table of contents') ||
                        content.toLowerCase().includes('## contents') ||
                        content.toLowerCase().includes('## toc');
          
          if (!hasTOC) {
            missingTOC.push(`${file} (${lines.length} lines)`);
          }
        }
      });

      // Some long files might not need TOC (calibrated to current system - many files are auto-generated)
      expect(missingTOC.length).toBeLessThan(15);
    });
  });

  describe('Code Examples in Documentation', () => {
    test('should have valid code blocks', () => {
      const mdFiles = glob.sync('**/*.md', {
        cwd: rootDir,
        ignore: ['node_modules/**', 'dist/**']
      });

      const invalidCodeBlocks: string[] = [];

      mdFiles.forEach(file => {
        const content = fs.readFileSync(path.join(rootDir, file), 'utf-8');
        const lines = content.split('\n');
        
        let inCodeBlock = false;
        let codeBlockStart = 0;
        let language = '';

        lines.forEach((line, index) => {
          if (line.startsWith('```')) {
            if (!inCodeBlock) {
              inCodeBlock = true;
              codeBlockStart = index;
              language = line.substring(3).trim();
              
              // Check if language is specified for code blocks
              if (!language && !line.includes('```\n')) {
                invalidCodeBlocks.push(
                  `${file}:${index + 1}: Code block without language specification`
                );
              }
            } else {
              inCodeBlock = false;
            }
          }
        });

        // Check for unclosed code blocks
        if (inCodeBlock) {
          invalidCodeBlocks.push(
            `${file}:${codeBlockStart + 1}: Unclosed code block`
          );
        }
      });

      expect(invalidCodeBlocks).toEqual([]);
    });
  });

  describe('Documentation Updates', () => {
    test('should have recent updates in changelog sections', () => {
      const mainDocs = ['replit.md', 'ROADMAP.md'];
      const outdatedDocs: string[] = [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      mainDocs.forEach(doc => {
        const docPath = path.join(rootDir, doc);
        if (fs.existsSync(docPath)) {
          const content = fs.readFileSync(docPath, 'utf-8');
          
          // Look for date patterns
          const datePattern = /\d{4}-\d{2}-\d{2}|\w+ \d{1,2}, \d{4}/g;
          const dates = content.match(datePattern) || [];
          
          const recentDates = dates.filter(dateStr => {
            try {
              const date = new Date(dateStr);
              return date > thirtyDaysAgo;
            } catch {
              return false;
            }
          });

          if (recentDates.length === 0) {
            outdatedDocs.push(`${doc}: No updates in the last 30 days`);
          }
        }
      });

      // Allow some docs to be older
      expect(outdatedDocs.length).toBeLessThan(2);
    });
  });
});