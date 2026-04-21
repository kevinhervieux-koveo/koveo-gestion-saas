import fs from 'fs';
import path from 'path';
import { objectStorageClient } from '../../server/objectStorage';
import {
  setObjectAclPolicy,
  type ObjectAclPolicy,
} from '../../server/objectAcl';

function buildPlaceholderPdf(): Buffer {
  const streamContent = 'BT /F1 18 Tf 50 100 Td (Koveo Gestion - Demo Document) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 200] ' +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream`,
  ];

  let body = '%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n';
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(body, 'binary'));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, 'binary');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    body += `${off.toString().padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'binary');
}

let cachedPdf: Buffer | null = null;
function getPlaceholderPdfBytes(): Buffer {
  if (!cachedPdf) cachedPdf = buildPlaceholderPdf();
  return cachedPdf;
}

function getPrivateObjectDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || '';
  if (!dir) {
    throw new Error(
      'PRIVATE_OBJECT_DIR not set. Cannot upload seeded demo document placeholders.'
    );
  }
  return dir;
}

function logicalPathToStoragePath(logicalPath: string): {
  bucketName: string;
  objectName: string;
} {
  if (!logicalPath.startsWith('/objects/')) {
    throw new Error(
      `Seeded document filePath must start with /objects/, got: ${logicalPath}`
    );
  }
  const parts = logicalPath.slice(1).split('/');
  if (parts.length < 2) {
    throw new Error(`Invalid seeded document filePath: ${logicalPath}`);
  }
  const entityId = parts.slice(1).join('/');
  let entityDir = getPrivateObjectDir();
  if (!entityDir.endsWith('/')) entityDir = `${entityDir}/`;
  const full = `${entityDir}${entityId}`;
  const full2 = full.startsWith('/') ? full : `/${full}`;
  const splitParts = full2.split('/');
  if (splitParts.length < 3) {
    throw new Error(`Cannot parse storage path from: ${full2}`);
  }
  return {
    bucketName: splitParts[1],
    objectName: splitParts.slice(2).join('/'),
  };
}

export async function uploadSeededDocumentPlaceholder(
  logicalPath: string,
  aclPolicy?: ObjectAclPolicy
): Promise<void> {
  const { bucketName, objectName } = logicalPathToStoragePath(logicalPath);
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(getPlaceholderPdfBytes(), {
    contentType: 'application/pdf',
    resumable: false,
    metadata: { contentType: 'application/pdf' },
  });
  if (aclPolicy) {
    // Attach ACL metadata so runtime access checks
    // (server/objectAcl.ts canAccessObject) allow the intended roles to
    // read these seeded files. Without this, the download endpoints would
    // deny access even though the bytes exist.
    await setObjectAclPolicy(file, aclPolicy);
  }
}

export function getSeededPlaceholderPdfSize(): number {
  return getPlaceholderPdfBytes().length;
}

/**
 * Write the placeholder PDF to the local filesystem at the given absolute
 * path, creating parent directories as needed. Used for seed attachments on
 * entities (e.g. demands) whose server-side download handler reads from
 * `/tmp/uploads/...` rather than object storage.
 */
export async function writeSeededPlaceholderToLocalPath(
  absolutePath: string
): Promise<void> {
  await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.promises.writeFile(absolutePath, getPlaceholderPdfBytes());
}
