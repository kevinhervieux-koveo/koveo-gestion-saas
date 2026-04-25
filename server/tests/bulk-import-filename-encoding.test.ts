import { describe, it, expect } from '@jest/globals';
import { fixLatin1MisdecodeFilename } from '../utils/filenameNormalization';

describe('fixLatin1MisdecodeFilename', () => {
  it('corrects a Latin-1 mis-decoded French filename with é', () => {
    // "Budget prévisionnel 2023-2024.pdf" mis-decoded as Latin-1
    const misdecoded = 'Budget pr\u00c3\u00a9visionnel 2023-2024.pdf';
    expect(fixLatin1MisdecodeFilename(misdecoded)).toBe('Budget prévisionnel 2023-2024.pdf');
  });

  it('corrects a Latin-1 mis-decoded filename with è', () => {
    // "Déclaration_de_propriété.pdf" mis-decoded
    const misdecoded = 'D\u00c3\u00a9claration_de_propri\u00c3\u00a9t\u00c3\u00a9.pdf';
    expect(fixLatin1MisdecodeFilename(misdecoded)).toBe('Déclaration_de_propriété.pdf');
  });

  it('returns a plain ASCII filename unchanged', () => {
    expect(fixLatin1MisdecodeFilename('report.pdf')).toBe('report.pdf');
  });

  it('returns an already-correct UTF-8 filename unchanged', () => {
    expect(fixLatin1MisdecodeFilename('Budget prévisionnel 2023-2024.pdf')).toBe(
      'Budget prévisionnel 2023-2024.pdf',
    );
  });

  it('handles filenames with multiple accent types', () => {
    // "Résumé été çà ô û ï.txt" — all encoded as UTF-8, mis-decoded as Latin-1
    const misdecoded = Buffer.from('Résumé été çà ô û ï.txt', 'utf8').toString('latin1');
    expect(fixLatin1MisdecodeFilename(misdecoded)).toBe('Résumé été çà ô û ï.txt');
  });

  it('does not corrupt a genuine Latin-1-only string that cannot be valid UTF-8', () => {
    // Lone 0x80 byte is invalid UTF-8 — should leave the string unchanged
    const genuineLatin1 = Buffer.from([0x80]).toString('latin1');
    const result = fixLatin1MisdecodeFilename(`file${genuineLatin1}.pdf`);
    expect(result).toBe(`file${genuineLatin1}.pdf`);
  });
});
