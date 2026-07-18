'use client';

/**
 * CentreFilterContext
 *
 * Persists the user's selected centre across all dashboard sub-pages
 * (Bookings, Registrations, Students, Finance) so navigating between
 * them does not reset the filter. The value is stored in a cookie
 * and localStorage so it survives page refreshes and is accessible
 * to Server Components.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export interface Centre {
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
const COOKIE_KEY = 'selected_centre_id';

const CentreFilterCtx = createContext<CentreFilterContextValue>({
  selectedCentreId: 'all',
  setSelectedCentreId: () => {},
  centres: [],
});

const setCentreCookie = (id: string) => {
  if (typeof document !== 'undefined') {
    document.cookie = `${COOKIE_KEY}=${id}; path=/; max-age=31536000; SameSite=Lax`;
  }
};

export function CentreFilterProvider({
  children,
  centres,
  defaultCentreId,
}: {
  children: ReactNode;
  centres: Centre[];
  defaultCentreId: string;
}) {
  const [selectedCentreId, setSelectedCentreIdState] = useState<string>(defaultCentreId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // If defaultCentreId changes (e.g. server updates cookie), sync client state
  useEffect(() => {
    setSelectedCentreIdState(defaultCentreId);
  }, [defaultCentreId]);

  const setSelectedCentreId = useCallback((id: string) => {
    setSelectedCentreIdState(id);
    setCentreCookie(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
    router.refresh();
  }, [router]);

  // Sync from URL search parameter ?centre=XYZ and clean it up
  useEffect(() => {
    const urlCentre = searchParams.get('centre');
    if (urlCentre) {
      const isValid = urlCentre === 'all' || centres.some(c => c.id === urlCentre);
      if (isValid) {
        setSelectedCentreId(urlCentre);
      }
      
      // Clean up URL parameter
      const params = new URLSearchParams(searchParams.toString());
      params.delete('centre');
      const search = params.toString();
      const newUrl = `${pathname}${search ? `?${search}` : ''}`;
      router.replace(newUrl);
    }
  }, [searchParams, pathname, router, centres, setSelectedCentreId]);

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
        !bg-card-low !text-white !border-outline-variant/20
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
