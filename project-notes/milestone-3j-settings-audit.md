# Milestone 3J — Settings Module Audit

## Stage A: Confirmed Decisions

| Question | Decision |
|---|---|
| Q1 sessionSlots | **Option B** — Operating Hours writes `operatingHours` only. `centres.sessionSlots` is owned exclusively by frozen Centres Settings (structured `SessionSlot[]`). No dual-use. No schema migration in 3J. |
| Q2 Wonde credentials | **Option b** — Keep Wonde settings surface, mark credential editing as "Coming Soon". Remove hardcoded test key. No DB persistence, no env secrets exposed. |

## Architectural Gap — centres.sessionSlots Legacy Consumers

**Documented for future milestones. No migration in 3J. No replacement persistence model approved.**

The registration form and booking portal (Shape A consumers) expect `centres.sessionSlots` to be a `string[]` of display labels. The frozen Centres Settings (Shape B producer) writes `SessionSlot[]` structured objects to that same column. There is no separate persistence path for display-label session slot strings at the centre level.

**Current state after 3J:** Settings no longer writes to `centres.sessionSlots`. The column is exclusively managed by Centres Settings (Shape B). Legacy consumers that expected Shape A strings will receive Shape B objects when `sessionSlots` has been set via Centres Settings — each wraps this in a try/catch and falls back to defaults.

**Future milestone action:** Legacy consumers of the former string-based sessionSlots representation remain to be audited/migrated to an authoritative source if required. No replacement persistence model has yet been approved.

## Defects Fixed in 3J

| # | Defect | File | Fix |
|---|---|---|---|
| 1 | `/api/branding` missing ORG_OWNER check | `src/app/api/branding/route.ts` | Added role guard; returns 403 for non-ORG_OWNER |
| 2 | `CentreHoursForm` called 404 endpoint | `src/features/settings/components/CentreHoursForm.tsx` | URL corrected to `/api/centres/${id}`; only `operatingHours` sent (Option B) |
| 3 | sessionSlots shape collision (conditional) | n/a | Resolved by Option B — Settings no longer writes `sessionSlots` |
| 4 | `contactEmail` no server-side validation | `src/app/api/settings/organisation/route.ts` | Email regex added; returns 400 for invalid format |
| 5 | Wonde token UI dead + hardcoded key | `src/app/dashboard/settings/wonde/WondeSettingsClient.tsx` | `apiKey` state removed; input disabled; "Coming Soon" badge; no-op button disabled |
| 6 | BrandingForm back button loops to self | `src/features/settings/components/BrandingForm.tsx` | ArrowLeft + Link removed; h1 → h2 tab heading |
| 7 | `CentreHoursForm` double-serialised operatingHours | `src/features/settings/components/CentreHoursForm.tsx` | Removed `JSON.stringify(data.hours)`; route handles serialisation; found during closure verification |

## Other Changes

- `CentreHoursTab.tsx`: Removed `sessionSlots` from Centre interface; replaced slot count summary with a "Manage in Centre Settings" link
- `OrganisationInfoForm.tsx`: Removed dead `Field` no-op const (returned null, never called)
- UI modernisation: BrandingForm header layout, CentreHoursTab responsive summary, Wonde Coming Soon indicator, FinancePricingForm sensitive field indicators
- Tests: `src/app/api/settings/security-3j.test.ts` — Defect 1 + Defect 4 regression coverage

## Intentional Non-Changes

- The Finance & Pricing tab intentionally duplicates Centres module fields (convenience entry point using the same API)
- The logo upload frontend code (BrandingForm) is left as-is — no upload endpoint exists; silent non-persistence is the pre-existing behaviour
- `discount_rules` raw SQL workaround not changed — out of 3J scope
- Wonde sync action (`triggerWondeSync`) is not modified — functional and unrelated to credential management
