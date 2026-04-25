import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FallbackReasonBadge } from '../../../client/src/pages/admin/bulk-import-fallback-reason-badge';
import type { BulkImportFallbackReason } from '../../../shared/schemas/bulk-import';

/**
 * Locks down the visible badge text the bulk-document-import page renders
 * for every `fallbackReason` value coming back from the analyzer service.
 *
 * If a copy refactor or a missed branch in the badge mapping silently
 * changes what admins see during a bulk import, this suite fails — closing
 * the gap that the analyzer-side regression tests cannot cover (Task #523).
 */

const REASONS: ReadonlyArray<{
  reason: BulkImportFallbackReason;
  en: string;
  fr: string;
}> = [
  {
    reason: 'oversize',
    en: 'File too large to analyze',
    fr: 'Fichier trop volumineux pour l’analyse',
  },
  {
    reason: 'unsupported_mime',
    en: 'File type not supported by AI',
    fr: 'Type de fichier non pris en charge',
  },
  {
    reason: 'extraction_failed',
    en: 'Could not extract document text',
    fr: 'Extraction du texte impossible',
  },
  {
    reason: 'missing_file',
    en: 'Staged file unreadable',
    fr: 'Fichier en attente illisible',
  },
  {
    reason: 'no_api_key',
    en: 'AI unavailable',
    fr: 'IA indisponible',
  },
];

describe('FallbackReasonBadge (bulk-document-import)', () => {
  describe.each(REASONS)('reason "$reason"', ({ reason, en, fr }) => {
    it('renders the English label', () => {
      render(<FallbackReasonBadge reason={reason} isFr={false} />);
      const badge = screen.getByTestId(`badge-fallback-${reason}`);
      expect(badge).toHaveTextContent(en);
      expect(badge).toHaveAttribute('title', en);
    });

    it('renders the French label', () => {
      render(<FallbackReasonBadge reason={reason} isFr={true} />);
      const badge = screen.getByTestId(`badge-fallback-${reason}`);
      expect(badge).toHaveTextContent(fr);
      expect(badge).toHaveAttribute('title', fr);
    });
  });

  it('renders nothing when reason is null', () => {
    const { container } = render(
      <FallbackReasonBadge reason={null} isFr={false} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId(/^badge-fallback-/)).toBeNull();
  });

  it('renders nothing when reason is undefined', () => {
    const { container } = render(
      <FallbackReasonBadge reason={undefined} isFr={true} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId(/^badge-fallback-/)).toBeNull();
  });

  it('covers every BulkImportFallbackReason union member', () => {
    // If the union grows, this guard fails fast and tells the author to
    // also add a label assertion above instead of silently shipping a
    // missing badge.
    const exhaustive: Record<BulkImportFallbackReason, true> = {
      oversize: true,
      unsupported_mime: true,
      extraction_failed: true,
      missing_file: true,
      no_api_key: true,
    };
    const covered = new Set(REASONS.map((r) => r.reason));
    for (const key of Object.keys(exhaustive) as BulkImportFallbackReason[]) {
      expect(covered.has(key)).toBe(true);
    }
  });
});
