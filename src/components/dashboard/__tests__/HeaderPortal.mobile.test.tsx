// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import HeaderPortal from '../HeaderPortal';

describe('HeaderPortal 360px mobile action routing (PR-09 / DES-#9)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function mockViewport(isMobile: boolean) {
    let changeHandler: (() => void) | null = null;
    const mql = {
      matches: isMobile,
      media: '(max-width: 639px)',
      onchange: null,
      addEventListener: vi.fn((_event: string, cb: () => void) => {
        changeHandler = cb;
      }),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn(() => mql),
    });
    return {
      setMatches(next: boolean) {
        mql.matches = next;
        changeHandler?.();
      },
    };
  }

  it('portals header-right-actions into #header-mobile-actions below 640px and moves to #header-right-actions at >=640px', () => {
    const viewport = mockViewport(true);

    const { container } = render(
      <div>
        <div id="header-right-actions" />
        <div id="header-mobile-actions" />
        <HeaderPortal targetId="header-right-actions">
          <button type="button">Add student</button>
        </HeaderPortal>
      </div>
    );

    const desktopSlot = container.querySelector('#header-right-actions')!;
    const mobileSlot = container.querySelector('#header-mobile-actions')!;

    expect(mobileSlot.textContent).toContain('Add student');
    expect(desktopSlot.textContent).toBe('');

    act(() => {
      viewport.setMatches(false);
    });

    expect(desktopSlot.textContent).toContain('Add student');
    expect(mobileSlot.textContent).toBe('');
  });
});
