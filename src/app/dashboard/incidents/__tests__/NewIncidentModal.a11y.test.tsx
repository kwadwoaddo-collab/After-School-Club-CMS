// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const mockCreateIncident = vi.fn().mockResolvedValue({ id: 'inc-1' });
const mockGetCentreChildren = vi.fn().mockResolvedValue([
  { id: 'child-1', firstName: 'Maya', lastName: 'Kowalski' },
]);

vi.mock('@/features/incidents/actions', () => ({
  createIncident: (...args: unknown[]) => mockCreateIncident(...args),
  getCentreChildren: (...args: unknown[]) => mockGetCentreChildren(...args),
}));

vi.mock('react-signature-canvas', () => ({
  default: React.forwardRef(function MockSignatureCanvas(
    props: { canvasProps?: Record<string, unknown> },
    ref: React.Ref<{ isEmpty: () => boolean; clear: () => void; toDataURL: () => string }>
  ) {
    React.useImperativeHandle(ref, () => ({
      isEmpty: () => true,
      clear: () => {},
      toDataURL: () => 'data:image/png;base64,DRAWN',
    }));
    return <canvas {...props.canvasProps} />;
  }),
}));

import NewIncidentModal from '../NewIncidentModal';

describe('NewIncidentModal WCAG 2.1.1 Keyboard Signature & Focus Management (PR-08 / SEC-F-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCentreChildren.mockResolvedValue([
      { id: 'child-1', firstName: 'Maya', lastName: 'Kowalski' },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it('allows full incident submission via keyboard-accessible "Type full name" attestation with image data-URL', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <NewIncidentModal
        centreId="centre-1"
        userRole="MANAGER"
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    const select = await screen.findByLabelText(/child \*/i);
    fireEvent.change(select, { target: { value: 'child-1' } });

    const accidentBtn = screen.getByRole('button', { name: 'Accident' });
    const incidentBtn = screen.getByRole('button', { name: 'Incident' });
    expect(accidentBtn.getAttribute('aria-pressed')).toBe('true');
    expect(incidentBtn.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(incidentBtn);
    expect(incidentBtn.getAttribute('aria-pressed')).toBe('true');

    fireEvent.change(screen.getByLabelText(/description \/ details \*/i), {
      target: { value: 'Tripped over skipping rope in main hall.' },
    });

    const typeModeBtn = screen.getByRole('button', { name: /type full name/i });
    fireEvent.click(typeModeBtn);
    expect(typeModeBtn.getAttribute('aria-pressed')).toBe('true');

    fireEvent.change(screen.getByLabelText(/staff full name \*/i), {
      target: { value: 'Eleanor Vance' },
    });

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /i confirm this incident record is accurate/i,
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /submit record/i }));

    await waitFor(() => {
      expect(mockCreateIncident).toHaveBeenCalledTimes(1);
    });

    const payload = mockCreateIncident.mock.calls[0][0];
    expect(payload.childId).toBe('child-1');
    expect(payload.type).toBe('incident');
    expect(payload.staffSignature).toMatch(/^data:image\//);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('traps Tab focus inside dialog and closes on Escape while restoring trigger focus', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Log Incident';
    document.body.appendChild(trigger);
    trigger.focus();

    const onClose = vi.fn();
    const { unmount } = render(
      <NewIncidentModal
        centreId="centre-1"
        userRole="FRONT_DESK"
        onClose={onClose}
        onSuccess={vi.fn()}
      />
    );

    // FRONT_DESK must not see Safeguarding record type
    expect(screen.queryByRole('button', { name: 'Safeguarding' })).toBeNull();

    // Initial focus moves to Close button inside the modal
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    expect(document.activeElement).toBe(closeBtn);

    // Shift+Tab from first focusable wraps to Submit Record (last focusable)
    const submitBtn = screen.getByRole('button', { name: /submit record/i });
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(submitBtn);

    // Tab from last focusable wraps back to Close button
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(closeBtn);

    // Escape invokes onClose
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Unmounting restores focus to the trigger button
    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});
