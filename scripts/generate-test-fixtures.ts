/**
 * Generates binary test fixture files for the unit test suite.
 *
 * Usage:
 *   npx tsx scripts/generate-test-fixtures.ts
 *
 * Fixtures produced
 * -----------------
 * tests/fixtures/nocentris-broken-page-tree.pdf
 *   A hand-crafted 237-byte minimal PDF whose /Catalog points its /Pages
 *   entry at object 99 0 R, which is never defined anywhere in the file.
 *
 *   Behaviour under real pdf-lib (v1.17.1):
 *     PDFDocument.load(bytes, LENIENT)  → succeeds (lenient parser skips
 *                                         undefined refs during xref scan)
 *     doc.getPageCount()                → throws "Expected instance of
 *                                         PDFDict, but got instance of
 *                                         undefined"  (catalog.Pages()
 *                                         tries context.lookup(99 0 R,
 *                                         PDFDict) → not in indirectObjects)
 *     doc.save()                        → same throw (computePages is called
 *                                         internally during serialisation)
 *
 *   This makes it a TRULY UNRECOVERABLE fixture: neither the save→reload
 *   re-encode pass in loadPdfForBulkImport nor any in-process fallback can
 *   repair the missing object.  The fixture is used by the fixture-based
 *   NoCentris regression test in
 *   tests/unit/api/bulk-import-set-sorting-decision.test.ts to confirm
 *   that the endpoint returns a classified 400 (MERGE_PDF_COPY_FAILED)
 *   instead of leaking a 500.
 */

import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { PDFDocument, ParseSpeeds } from 'pdf-lib';

const LENIENT = {
  ignoreEncryption: true,
  throwOnInvalidObject: false,
  updateMetadata: false,
  parseSpeed: ParseSpeeds.Fastest,
};

async function generateNoCentrisFixture(): Promise<void> {
  // Build a minimal traditional-xref PDF manually so we can precisely
  // control every object without relying on pdf-lib's save() (which would
  // itself throw when given a broken /Pages reference).
  const header   = '%PDF-1.4\n';
  // Catalog whose /Pages ref (99 0 R) does not exist in the file.
  const obj1     = '1 0 obj\n<< /Type /Catalog /Pages 99 0 R >>\nendobj\n';
  const obj2     = '2 0 obj\n<< /Creator (NoCentris test fixture) >>\nendobj\n';
  const body     = header + obj1 + obj2;
  const off1     = header.length;
  const off2     = off1 + obj1.length;
  const xrefOff  = body.length;
  const xref     =
    `xref\n0 3\n` +
    `0000000000 65535 f \n` +
    `${String(off1).padStart(10, '0')} 00000 n \n` +
    `${String(off2).padStart(10, '0')} 00000 n \n`;
  const trailer  = `trailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`;

  const pdfBytes = Buffer.from(body + xref + trailer, 'latin1');

  // --- Verify expected behaviour before writing to disk ---
  const doc = await PDFDocument.load(new Uint8Array(pdfBytes), LENIENT);

  let getPageCountThrew = false;
  let saveThrew         = false;

  try { doc.getPageCount(); }
  catch { getPageCountThrew = true; }

  try { await doc.save(); }
  catch { saveThrew = true; }

  if (!getPageCountThrew) throw new Error('Fixture verification failed: getPageCount() did not throw');
  if (!saveThrew)         throw new Error('Fixture verification failed: save() did not throw');

  // --- Write ---
  mkdirSync('tests/fixtures', { recursive: true });
  writeFileSync('tests/fixtures/nocentris-broken-page-tree.pdf', pdfBytes);
  console.log(`✓ tests/fixtures/nocentris-broken-page-tree.pdf (${pdfBytes.length} bytes)`);
  console.log(`  load()        → OK`);
  console.log(`  getPageCount() → throws ✓`);
  console.log(`  save()         → throws ✓  (unrecoverable)`);
}

generateNoCentrisFixture().catch((err) => {
  console.error('fixture generation failed:', err);
  process.exit(1);
});
