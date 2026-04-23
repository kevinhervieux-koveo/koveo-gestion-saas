import { describe, it, expect } from '@jest/globals';
import { normalizeFilename } from '../utils/filenameNormalization';
import { documentService } from '../services/document-service';

describe('normalizeFilename (canonical shared helper)', () => {
  it('should normalize simple filenames', () => {
    expect(normalizeFilename('test-file.pdf')).toBe('test-file.pdf');
  });

  it('should convert uppercase to lowercase', () => {
    expect(normalizeFilename('TEST-FILE.PDF')).toBe('test-file.pdf');
  });

  it('should replace spaces with underscores', () => {
    expect(normalizeFilename('my test file.pdf')).toBe('my_test_file.pdf');
  });

  it('should remove accented characters', () => {
    expect(normalizeFilename('résumé-été.pdf')).toBe('resume-ete.pdf');
  });

  it('should replace special characters with underscores', () => {
    expect(normalizeFilename('file@#$%name.pdf')).toBe('file_name.pdf');
  });

  it('should collapse multiple underscores into one', () => {
    expect(normalizeFilename('file___name.pdf')).toBe('file_name.pdf');
  });

  it('should remove leading and trailing underscores from the whole string', () => {
    expect(normalizeFilename('_file_name_.pdf')).toBe('file_name_.pdf');
  });

  it('should truncate long filenames while preserving extension', () => {
    const longName = 'a'.repeat(250) + '.pdf';
    const result = normalizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith('.pdf')).toBe(true);
  });

  it('should generate fallback for empty filename', () => {
    expect(normalizeFilename('')).toMatch(/^file_[a-f0-9]{8}$/);
  });

  it('should generate fallback for null/undefined input', () => {
    expect(normalizeFilename(null)).toMatch(/^file_[a-f0-9]{8}$/);
    expect(normalizeFilename(undefined)).toMatch(/^file_[a-f0-9]{8}$/);
  });

  it('should handle French document names', () => {
    expect(normalizeFilename('Contrat de location été 2024.pdf'))
      .toBe('contrat_de_location_ete_2024.pdf');
  });

  it('produces the same result whether called via the shared helper or DocumentService', () => {
    // Deterministic samples: the DocumentService method must produce the
    // exact same canonical output as the shared helper. This guards against
    // drift between the `fileName` column and the Object Storage object key
    // for the same upload.
    const samples = [
      'reçu purlift 2025.pdf',
      'Côté & Associés.docx',
      'FACTURE_JANVIER.PDF',
      'Procès-verbal été 2024.pdf',
      'file with spaces.txt',
    ];

    for (const sample of samples) {
      expect(documentService.normalizeFilename(sample)).toBe(normalizeFilename(sample));
    }

    // Empty/falsy inputs return random fallbacks; just check both branches
    // produce the same `file_<uuid8>` shape.
    expect(documentService.normalizeFilename('')).toMatch(/^file_[a-f0-9]{8}$/);
  });
});
