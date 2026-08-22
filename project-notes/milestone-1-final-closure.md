# Milestone 1 — Final Closure

Closes out Milestone 1 by resolving the one type-safety gap surfaced during the Parents
re-investigation and re-establishing (and recording) the quality baseline before any
Milestone 2 / design-system work begins. Base commit for this task: `28aabfa` on
`rebuild/cms-modernisation`. Scope was intentionally narrow — no other Milestone 1 area was
reopened.

## Careers route type issue

**Root cause.** `src/app/careers/[slug]/page.tsx` typed its `params` prop as a plain
`{ slug: string }` object. Since this codebase's Next.js version (16.2.9, App Router), route
params are delivered to page components as a `Promise` that must be `await`ed — every other
dynamic route in the app already follows this convention (e.g.
`src/app/dashboard/parents/[id]/page.tsx` and `src/app/dashboard/students/[id]/page.tsx`
both type `params: Promise<{ id: string }>` and `await` it). Because `careers/[slug]/page.tsx`
never adopted that shape, Next's generated route-type helper
(`.next/types/app/careers/[slug]/page.ts`) rejected the component: `Props` didn't satisfy
`PageProps` because `params` was missing `Promise`'s `then`/`catch`/`finally` members. This
had been silently masked by `typescript.ignoreBuildErrors: true` and only surfaced once
Milestone 1 removed that suppression (commit `5f18182`) and a full `tsc --noEmit` was run for
the Parents re-investigation.

**Fix.** Changed `params` to `Promise<{ slug: string }>` and added `const { slug } = await
params;` inside the component, matching the existing convention exactly. No other code
changed: the `notFound()` call, the `db.query.centres.findFirst` lookup, and the entire
careers/application-form markup are untouched. No `any`, no `@ts-ignore`/`@ts-expect-error`,
no unsafe casts.

```diff
-interface Props {
-    params: {
-        slug: string;
-    }
-}
+interface Props {
+    params: Promise<{
+        slug: string;
+    }>;
+}

 export default async function TeacherApplicationPage({ params }: Props) {
+    const { slug } = await params;
     const centre = await db.query.centres.findFirst({
-        where: eq(centres.slug, params.slug),
+        where: eq(centres.slug, slug),
     });
```

No targeted test was added for this route: it has no existing test file, no other dynamic
route in the app has a route-level test for this exact pattern, and the change is a
type-only correction with zero runtime behaviour change (verified by inspection — the same
`slug` string reaches the same query either way). Adding a first test file for an unrelated,
untouched-otherwise route would be scope creep for a closure task; the production build
compiling `/careers/[slug]` cleanly is the applicable verification.

## Typecheck baseline

`npx tsc --noEmit -p .` → **0 errors.** No further errors were exposed by fixing Careers, so
Workstream 2's "second genuine error" contingency did not apply.

## Unit-test baseline

`npx vitest run` → **211/213 individual tests passing, 27/30 test files fully passing** — no
change from the pre-existing baseline (only difference from the last recorded run is +7
tests / +1 file, accounted for entirely by `src/middleware.test.ts`, added in `28aabfa`
before this task started). Three failures, all pre-existing and unrelated to this task's
change:

| Failure | Classification | Evidence |
|---|---|---|
| `Header.test.tsx` — theme-toggle `aria-label` assertion | **PRE-EXISTING / DEFERRED** | Asserts a literal `aria-label="Toggle theme (currently system)"` string; the rendered markup now says `"currently dark"` — a stale literal-string assertion against current default-theme markup, not a Parents/Careers-related change. Documented as failing identically in `milestone-1-completion.md`. |
| `Sidebar.test.tsx` — section-label contrast/tracking assertion | **PRE-EXISTING / DEFERRED** | Same pattern: asserts literal classes (`text-muted-foreground/80`, `tracking-[0.12em]`) not present in current markup. Documented as failing identically in `milestone-1-completion.md`. |
| `communications/actions.test.ts` — fails to load | **ENVIRONMENTAL** | `Error: Cannot find module '.../node_modules/next/server' imported from next-auth/lib/env.js` — a module-resolution artefact of this sandbox's `next-auth`/`next` install (`next/server` vs `next/server.js`), not application behaviour. Documented identically in `milestone-0-discovery.md`. |

Neither Careers-page file nor anything it touches (`db`, `centres` schema, `drizzle-orm`) is
imported by any of the three failing files or their transitive test setup — none of these are
a new regression from this task.

## Lint baseline

`npx eslint .` → **69 problems (64 errors, 5 warnings)** — unchanged from the documented
GitHub baseline. The fixed file (`careers/[slug]/page.tsx`) introduces zero lint problems
(no `any`, no console statements, no ts-comments). No lint cleanup was performed.

## Build verification

**Sandbox:** `next build --webpack` completed successfully (`✓ Compiled successfully`, 0
build errors, `/careers/[slug]` listed in the route output) using the same
`NEXT_FONT_GOOGLE_MOCKED_RESPONSES` test-only workaround documented in
`architecture-decisions.md` §12, for the same reason (this sandbox has no outbound network
access to `fonts.googleapis.com`). The workaround was not committed — `next.config.ts` and
`src/app/layout.tsx` are unchanged from `28aabfa`; only the mock file, kept outside the repo
at `/tmp/font-mock.js`, and a build-time environment variable were used, then discarded.

**Vercel Preview:** already confirmed working directly against the real deployment in the
prior Parents re-investigation session — `/dashboard/parents` returned a correct render,
hostname routing fixed by `28aabfa` is live. This task did not re-run that check since
nothing in this change (`careers/[slug]/page.tsx`) touches routing, middleware, or the
Parents feature; it is reported here only as known-good context per the quality gate.

## Files changed

- `src/app/careers/[slug]/page.tsx` — `params` typed as `Promise<{ slug: string }>`, awaited before use.
- `project-notes/milestone-1-final-closure.md` — this document (new).

## Quality gate

| Gate | Result |
|---|---|
| Careers route type issue correctly resolved | ✅ |
| `npm run typecheck` — 0 errors | ✅ |
| No new unit-test regression | ✅ (3 pre-existing/environmental failures, all previously documented) |
| No new lint problem | ✅ (69/64/5, unchanged) |
| Production build succeeds (sandbox) | ✅ |
| Vercel Preview known-good | ✅ (confirmed in prior session) |
| No unrelated scope creep | ✅ (one file changed) |

## Remaining deferred debt (unchanged, not addressed here — out of scope)

- 69 pre-existing ESLint problems (mostly `no-explicit-any`, some `no-console`).
- `Header.test.tsx` / `Sidebar.test.tsx` literal-assertion failures (stale against current markup).
- `communications/actions.test.ts` sandbox module-resolution failure.
- `materialiseBookingPlan` incomplete-by-design scaffolding (`architecture-decisions.md` §6).
- Node 20 vs Node 22 `@types/node` mismatch (`architecture-decisions.md` §11).
- Mobile theme flash, tablet layout, design-system work — all Milestone 2+ candidates, untouched.

## Recommendation

**Milestone 1 is safe to formally close.** All seven quality-gate conditions are met, the
fix is a single narrowly-scoped file with zero behavioural change, and every other check
(typecheck, tests, lint, build) reproduces the exact pre-existing baseline with no new
issues introduced.
