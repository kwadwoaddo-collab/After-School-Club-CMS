// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

vi.stubGlobal('React', React);

const refreshMock = vi.fn();
const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: refreshMock, push: pushMock }),
}));

vi.mock('next/link', () => ({
    default: ({ children, ...props }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
        <a {...props}>{children}</a>
    ),
}));

vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/offline-sync', () => ({
    queueOfflineAction: vi.fn(),
    getUnsyncedActions: vi.fn().mockResolvedValue([]),
    markActionSynced: vi.fn(),
}));

vi.mock('@/features/bookings/actions', () => ({
    markAttendeeAttendance: vi.fn(),
}));

import KioskRegister, { KioskClock } from '../KioskRegister';

function setDocumentVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => state,
    });
}

describe('KioskRegister performance & visibility gating (PR-18a)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-24T15:30:20.000Z'));
        refreshMock.mockReset();
        pushMock.mockReset();
        setDocumentVisibility('visible');
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('renders KioskClock HH:mm and ticks on minute boundaries instead of every second', () => {
        const expectedInitial = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(new Date('2026-11-24T15:30:20.000Z'));

        const expectedNextMinute = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(new Date('2026-11-24T15:31:00.000Z'));

        render(<KioskClock />);
        expect(screen.getByText(expectedInitial)).toBeTruthy();

        // 39s later (still 15:30:59) -> unchanged
        act(() => {
            vi.advanceTimersByTime(39_000);
        });
        expect(screen.getByText(expectedInitial)).toBeTruthy();

        // Crossing 40s reaches 15:31:00 -> updates cleanly to next minute
        act(() => {
            vi.advanceTimersByTime(1_000);
        });
        expect(screen.getByText(expectedNextMinute)).toBeTruthy();
    });

    it('refreshes every 60s when visible, suppresses polling when hidden, and refreshes on return if stale', () => {
        render(
            <KioskRegister
                slots={[]}
                date="Tuesday 24 Nov"
                dateStr="2026-11-24"
                centreName="Main Hall"
                centres={[{ id: 'c-1', name: 'Main Hall' }]}
                activeCentreId="c-1"
            />
        );

        expect(refreshMock).toHaveBeenCalledTimes(0);

        // Visible after 60s -> refreshes once
        act(() => {
            vi.advanceTimersByTime(60_000);
        });
        expect(refreshMock).toHaveBeenCalledTimes(1);

        // Background tab -> zero refreshes across 3 full minutes
        setDocumentVisibility('hidden');
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
            vi.advanceTimersByTime(180_000);
        });
        expect(refreshMock).toHaveBeenCalledTimes(1);

        // Returning to visible after >=60s hidden -> immediate catch-up refresh
        setDocumentVisibility('visible');
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        expect(refreshMock).toHaveBeenCalledTimes(2);

        // Hiding and returning within <60s (e.g. 20s) -> does NOT trigger extra refresh
        setDocumentVisibility('hidden');
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
            vi.advanceTimersByTime(20_000);
        });
        setDocumentVisibility('visible');
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        expect(refreshMock).toHaveBeenCalledTimes(2);
    });
});
