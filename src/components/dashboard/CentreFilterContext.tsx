'use client';

/**
 * CentreFilterContext
 *
 * Persists the user's selected centre across all dashboard sub-pages
 * (Bookings, Registrations, Students, Finance) so navigating between
 * them does not reset the filter. The value is stored in localStorage
 * so it survives page refreshes.
 *
 * Phase 2A – item A1
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface Centre {
  id: string;
  name: string;
}

interface CentreFilterContextValue {
  /** Currently selected centre ID, or 'all' for no filter */
  selectedCentreId: string;
  /** Set the active centre filter */
  setSelectedCentreId: (id: string) => void;
  /** Available centres (populated by the nearest provider) */
  centres: Centre[];
}

const STORAGE_KEY = 'dashboard_centre_filter';

const CentreFilterCtx = createContext<CentreFilterContextValue>({
  selectedCentreId: 'all',
  setSelectedCentreId: () => {},
  centres: [],
});

export function CentreFilterProvider({
  children,
  centres,
}: {
  children: ReactNode;
  centres: Centre[];
}) {
  const [selectedCentreId, setSelectedCentreIdState] = useState<string>('all');

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && (stored === 'all' || centres.some(c => c.id === stored))) {
        setSelectedCentreIdState(stored);
      }
    } catch {
      // SSR or private browsing — ignore
    }
  }, [centres]);

  const setSelectedCentreId = useCallback((id: string) => {
    setSelectedCentreIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  return (
    <CentreFilterCtx.Provider value={{ selectedCentreId, setSelectedCentreId, centres }}>
      {children}
    </CentreFilterCtx.Provider>
  );
}

export function useCentreFilter() {
  return useContext(CentreFilterCtx);
}

/**
 * Reusable centre selector dropdown.
 * Drop this into any page header to get a consistent filtering UX.
 */
export function CentreSelector({ className = '' }: { className?: string }) {
  const { selectedCentreId, setSelectedCentreId, centres } = useCentreFilter();

  if (centres.length <= 1) return null;

  return (
    <select
      value={selectedCentreId}
      onChange={e => setSelectedCentreId(e.target.value)}
      className={`
        !bg-surface-container-low !text-white !border-outline-variant/20
        text-sm font-bold rounded-xl px-4 py-2
        focus:!border-primary focus:ring-1 focus:ring-primary/30
        cursor-pointer appearance-none
        ${className}
      `}
    >
      <option value="all">All Centres</option>
      {centres.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}
