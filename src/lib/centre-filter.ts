import { cookies } from 'next/headers';

/**
 * Resolves the active centre ID from the URL search parameters or the cookie store,
 * validating it against the user's accessible centres.
 *
 * @param urlCentre - The centre ID passed in the URL query string (if any)
 * @param accessibleCentreIds - The list of centre IDs the user is allowed to access
 * @returns The resolved active centre ID (a specific centre ID or 'all')
 */
export async function resolveActiveCentreId(
    urlCentre: string | string[] | undefined,
    accessibleCentreIds: string[]
): Promise<string> {
    const cookieStore = await cookies();
    const cookieCentreId = cookieStore.get('selected_centre_id')?.value;
    
    // Normalize URL parameter if it's an array
    const normalizedUrlCentre = Array.isArray(urlCentre) ? urlCentre[0] : urlCentre;
    
    const resolvedCentreId = normalizedUrlCentre || cookieCentreId;

    if (!resolvedCentreId || (resolvedCentreId !== 'all' && !accessibleCentreIds.includes(resolvedCentreId))) {
        return accessibleCentreIds[0] || 'all';
    }

    return resolvedCentreId;
}
