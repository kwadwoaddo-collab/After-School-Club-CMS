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

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode, startTransition } from 'react';
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
    startTransition(() => {
      if (searchParams.get('centre')) {
        const params = new URLSearchParams(searchParams.toString());
        if (id === 'all') {
          params.delete('centre');
        } else {
          params.set('centre', id);
        }
        const search = params.toString();
        router.push(`${pathname}${search ? `?${search}` : ''}`);
      } else {
        router.refresh();
      }
    });
  }, [router, searchParams, pathname]);

  // Sync from URL search parameter ?centre=XYZ and clean it up
  useEffect(() => {
    const urlCentre = searchParams.get('centre');
    if (urlCentre) {
      const isValid = urlCentre === 'all' || centres.some(c => c.id === urlCentre);
      if (isValid && urlCentre !== selectedCentreId) {
        setSelectedCentreIdState(urlCentre);
        setCentreCookie(urlCentre);
        try {
          localStorage.setItem(STORAGE_KEY, urlCentre);
        } catch {
          // ignore
        }
      }

      // Clean up URL parameter
      const params = new URLSearchParams(searchParams.toString());
      params.delete('centre');
      const search = params.toString();
      const newUrl = `${pathname}${search ? `?${search}` : ''}`;
      router.replace(newUrl);
    }
  }, [searchParams, pathname, router, centres, selectedCentreId]);

  return (
    <CentreFilterCtx.Provider value={{ selectedCentreId, setSelectedCentreId, centres }}>
      {children}
    </CentreFilterCtx.Provider>
  );
}

export function useCentreFilter() {
  return useContext(CentreFilterCtx);
}
