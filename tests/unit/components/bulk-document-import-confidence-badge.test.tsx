import { describe, it, expect } from '@jest/globals';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { ConfidenceBadge } from '@/pages/admin/bulk-document-import';
import type { BulkImportFallbackReason } from '@shared/schemas/bulk-import';

const FALLBACK_REASONS: ReadonlyArray<BulkImportFallbackReason> = [
  'oversize',
  'unsupported_mime',
  'extraction_failed',
  'missing_file',
  'no_api_key',
];

const NOT_RUN_TOOLTIP_EN =
  'The AI did not analyze this file. Nothing is auto-discarded based on confidence — a low score means "needs review", not "discard this".';
const NOT_RUN_TOOLTIP_FR =
  "L'IA n'a pas pu analyser ce fichier. Aucun fichier n'est exclu automatiquement selon la confiance — un score faible signifie « à vérifier », pas « à rejeter ».";

afterEach(() => {
  cleanup();
});

describe('ConfidenceBadge — fallback path', () => {
  describe.each(FALLBACK_REASONS)('reason "%s"', (reason) => {
    it('renders the EN "AI not run" pill and hides any percentage', () => {
      render(
        <ConfidenceBadge value={0.2} fallbackReason={reason} isFr={false} />,
      );
      const badge = screen.getByTestId('badge-confidence-not-run');
      expect(badge).toHaveTextContent('AI not run');
      expect(screen.queryByTestId('badge-confidence-low')).toBeNull();
      expect(screen.queryByTestId('badge-confidence-medium')).toBeNull();
      expect(screen.queryByTestId('badge-confidence-high')).toBeNull();
      expect(badge).not.toHaveTextContent('20%');
    });

    it('renders the FR "IA non exécutée" pill and hides any percentage', () => {
      render(
        <ConfidenceBadge value={0.2} fallbackReason={reason} isFr={true} />,
      );
      const badge = screen.getByTestId('badge-confidence-not-run');
      expect(badge).toHaveTextContent('IA non exécutée');
      expect(screen.queryByTestId('badge-confidence-low')).toBeNull();
      expect(badge).not.toHaveTextContent('20%');
    });

    it('shows the EN tooltip', () => {
      render(
        <ConfidenceBadge value={null} fallbackReason={reason} isFr={false} />,
      );
      expect(
        screen.getByTestId('badge-confidence-not-run'),
      ).toHaveAttribute('title', NOT_RUN_TOOLTIP_EN);
    });

    it('shows the FR tooltip', () => {
      render(
        <ConfidenceBadge value={null} fallbackReason={reason} isFr={true} />,
      );
      expect(
        screen.getByTestId('badge-confidence-not-run'),
      ).toHaveAttribute('title', NOT_RUN_TOOLTIP_FR);
    });
  });

  it('takes the fallback branch when value is undefined', () => {
    render(
      <ConfidenceBadge
        value={undefined}
        fallbackReason="no_api_key"
        isFr={false}
      />,
    );
    expect(screen.getByTestId('badge-confidence-not-run')).toHaveTextContent(
      'AI not run',
    );
    expect(screen.queryByTestId('badge-confidence-low')).toBeNull();
  });
});

describe('ConfidenceBadge — real low-score path', () => {
  it('renders the low-band percentage when fallbackReason is null', () => {
    render(<ConfidenceBadge value={0.2} fallbackReason={null} isFr={false} />);
    const badge = screen.getByTestId('badge-confidence-low');
    expect(badge).toHaveTextContent('20%');
    expect(screen.queryByTestId('badge-confidence-not-run')).toBeNull();
  });

  it('renders the low-band percentage when fallbackReason is undefined', () => {
    render(
      <ConfidenceBadge value={0.2} fallbackReason={undefined} isFr={false} />,
    );
    const badge = screen.getByTestId('badge-confidence-low');
    expect(badge).toHaveTextContent('20%');
    expect(screen.queryByTestId('badge-confidence-not-run')).toBeNull();
  });

  it('shows the EN tooltip for a real low score', () => {
    render(<ConfidenceBadge value={0.2} fallbackReason={null} isFr={false} />);
    const title = screen
      .getByTestId('badge-confidence-low')
      .getAttribute('title');
    expect(title).toContain('AI confidence: 20%');
    expect(title).toContain('The AI ran and returned a low score');
    expect(title).toContain('Nothing is auto-discarded based on confidence');
  });

  it('shows the FR tooltip for a real low score', () => {
    render(<ConfidenceBadge value={0.2} fallbackReason={null} isFr={true} />);
    const title = screen
      .getByTestId('badge-confidence-low')
      .getAttribute('title');
    expect(title).toContain("Confiance de l'IA : 20%");
    expect(title).toContain("L'IA a retourné un score faible");
    expect(title).toContain(
      "Aucun fichier n'est exclu automatiquement selon la confiance",
    );
  });
});
