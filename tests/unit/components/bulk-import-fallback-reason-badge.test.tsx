import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FallbackReasonBadge, TextOnlyDegradedBadge } from '../../../client/src/pages/admin/bulk-import-fallback-reason-badge';
import type { BulkImportFallbackReason } from '../../../shared/schemas/bulk-import';

/**
 * Locks down the visible badge text the bulk-document-import page renders
 * for every `fallbackReason` value coming back from the analyzer service.
 *
 * If a copy refactor or a missed branch in the badge mapping silently
 * changes what admins see during a bulk import, this suite fails — closing
 * the gap that the analyzer-side regression tests cannot cover (Task #523).
 * Task #801 adds api_error and unreadable_response.
 */

const REASONS: ReadonlyArray<{
  reason: BulkImportFallbackReason;
  en: string;
  fr: string;
}> = [
  {
    reason: 'oversize',
    en: 'File too large to analyze',
    fr: 'Fichier trop volumineux pour l\u2019analyse',
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
  {
    reason: 'api_error',
    en: 'AI service error',
    fr: 'Erreur du service IA',
  },
  {
    reason: 'unreadable_response',
    en: 'AI response unreadable',
    fr: 'R\u00e9ponse de l\u2019IA illisible',
  },
  {
    reason: 'model_misconfigured',
    en: 'AI misconfigured',
    fr: 'IA mal configur\u00e9e',
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
      api_error: true,
      unreadable_response: true,
      model_misconfigured: true,
    };
    const covered = new Set(REASONS.map((r) => r.reason));
    for (const key of Object.keys(exhaustive) as BulkImportFallbackReason[]) {
      expect(covered.has(key)).toBe(true);
    }
  });
});

/**
 * Task #1217: TextOnlyDegradedBadge — shown when a large PDF was degraded
 * to text-only analysis. Distinct (blue, informational) from the amber error
 * FallbackReasonBadge. Badge MUST NOT appear when degraded is null or undefined.
 */
describe('TextOnlyDegradedBadge (Task #1217)', () => {
  it('renders the English label and tooltip when degraded is pdf_text_only', () => {
    render(<TextOnlyDegradedBadge degraded="pdf_text_only" isFr={false} />);
    const badge = screen.getByTestId('badge-text-only-degraded');
    expect(badge).toHaveTextContent('Analyzed from text only');
    expect(badge).toHaveAttribute('title');
    expect(badge.getAttribute('title')).toMatch(/extracted text/i);
  });

  it('renders the French label and tooltip when degraded is pdf_text_only and isFr is true', () => {
    render(<TextOnlyDegradedBadge degraded="pdf_text_only" isFr={true} />);
    const badge = screen.getByTestId('badge-text-only-degraded');
    expect(badge).toHaveTextContent('Analysé à partir du texte');
    expect(badge).toHaveAttribute('title');
    expect(badge.getAttribute('title')).toMatch(/texte extrait/i);
  });

  it('renders nothing when degraded is null', () => {
    const { container } = render(
      <TextOnlyDegradedBadge degraded={null} isFr={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when degraded is undefined', () => {
    const { container } = render(
      <TextOnlyDegradedBadge degraded={undefined} isFr={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('has blue styling (not amber) to convey informational intent', () => {
    render(<TextOnlyDegradedBadge degraded="pdf_text_only" isFr={false} />);
    const badge = screen.getByTestId('badge-text-only-degraded');
    // The badge must carry at least one blue Tailwind class — confirming it
    // uses a distinct colour from the amber FallbackReasonBadge.
    expect(badge.className).toMatch(/blue/);
  });
});
