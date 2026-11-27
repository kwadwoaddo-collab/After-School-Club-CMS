export interface CentreWaConfig {
    phoneNumberId: string | null;
    status: string;
    enabled: boolean;
}

export type RouteDecision =
    | { route: 'api'; phoneNumberId: string }
    | { route: 'wa_me'; reason: 'flag_off' | 'no_centre_config' | 'centre_not_enabled' | 'no_phone_number_id' | 'no_credentials' }
    | { route: 'blocked'; reason: 'invalid_phone' | 'no_opt_in' | 'opted_out' };

/**
 * Per-centre routing. Anything short of (flag ON + this centre's enabled+active number + credentials)
 * falls back to the Phase 1 wa.me staff-assisted flow. With the API available, a send additionally needs
 * a valid phone and a recorded opt-in, otherwise it is blocked (never silently sent).
 */
export function decideRoute(input: {
    flagOn: boolean;
    hasCredentials: boolean;
    dryRun: boolean;
    config: CentreWaConfig | null | undefined;
    phoneDigits: string | null;
    consent: 'opted_in' | 'opted_out' | null;
}): RouteDecision {
    if (!input.flagOn) return { route: 'wa_me', reason: 'flag_off' };
    if (!input.config) return { route: 'wa_me', reason: 'no_centre_config' };
    if (!input.config.enabled || input.config.status !== 'active') return { route: 'wa_me', reason: 'centre_not_enabled' };
    if (!input.config.phoneNumberId) return { route: 'wa_me', reason: 'no_phone_number_id' };
    if (!input.hasCredentials && !input.dryRun) return { route: 'wa_me', reason: 'no_credentials' };
    if (!input.phoneDigits) return { route: 'blocked', reason: 'invalid_phone' };
    if (input.consent === 'opted_out') return { route: 'blocked', reason: 'opted_out' };
    if (input.consent !== 'opted_in') return { route: 'blocked', reason: 'no_opt_in' };
    return { route: 'api', phoneNumberId: input.config.phoneNumberId };
}
