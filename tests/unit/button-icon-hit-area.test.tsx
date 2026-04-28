/**
 * Snapshot test for the shared Button primitive.
 *
 * WCAG 2.5.5 "Target Size" requires interactive hit areas of at least
 * 44×44 CSS pixels. We enforce this on the `icon` size variant via the
 * `min-h-11 min-w-11` Tailwind classes (1 Tailwind unit = 4 px, so 11 = 44 px).
 *
 * This test asserts that the rendered icon button contains those classes so
 * a future change cannot silently regress the minimum hit area.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import { Button } from '../../client/src/components/ui/button';
import { Settings } from 'lucide-react';

describe('Button – icon size variant (WCAG 2.5.5 hit-area)', () => {
  it('contains min-h-11 class to enforce 44px minimum height', () => {
    const { getByRole } = render(
      <Button variant='ghost' size='icon' aria-label='Settings'>
        <Settings />
      </Button>
    );
    const btn = getByRole('button', { name: 'Settings' });
    expect(btn.className).toContain('min-h-11');
  });

  it('contains min-w-11 class to enforce 44px minimum width', () => {
    const { getByRole } = render(
      <Button variant='ghost' size='icon' aria-label='Settings'>
        <Settings />
      </Button>
    );
    const btn = getByRole('button', { name: 'Settings' });
    expect(btn.className).toContain('min-w-11');
  });

  it('snapshot – icon button rendered output is stable', () => {
    const { container } = render(
      <Button variant='ghost' size='icon' aria-label='Settings'>
        <Settings />
      </Button>
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
