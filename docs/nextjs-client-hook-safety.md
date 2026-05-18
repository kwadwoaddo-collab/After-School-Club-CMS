# Next.js Client Hook Safety

This document outlines safety requirements and best practices for using client-side navigation hooks in Next.js applications, specifically to avoid production runtime exceptions like the `MissingSuspenseWithCSRBailout` error (Digest: 1487924155).

## 1. `useSearchParams` Must Be Wrapped in Suspense

In Next.js, any Client Component that calls the `useSearchParams` hook **must** be wrapped in a React `<Suspense>` boundary. 

If it is not wrapped, Next.js will encounter a `DynamicServerError` during the initial server-side render. While this may silently fall back to client-side rendering during development or static generation, it will **crash dynamically rendered routes** (e.g., routes protected by authentication) with a 500 error in production.

**Incorrect:**
```tsx
// page.tsx
import { Filters } from './Filters';

export default function Page() {
  return <Filters />;
}
```

**Correct:**
```tsx
// page.tsx
import { Suspense } from 'react';
import { Filters } from './Filters';

export default function Page() {
  return (
    <Suspense fallback={<FiltersSkeleton />}>
      <Filters />
    </Suspense>
  );
}
```

## 2. Treat Navigation Hooks Carefully in Server-Rendered Pages

Hooks such as `useRouter`, `usePathname`, and `useSearchParams` rely on client-side context. When using these hooks:
- Always ensure they are strictly inside `'use client'` files.
- Be aware that fetching URL state on the client can trigger hydration mismatch warnings if not handled safely or if the server render differs from the initial client render.
- Defer heavy logic relying on URL parameters until after the component has mounted.

## 3. New Filter Components Require Suspense Boundaries

Any newly created filter, pagination, or search component that manipulates or reads the URL via `useSearchParams` must be provisioned with a `<Suspense>` boundary where it is consumed (typically in the parent `page.tsx` or layout).

## 4. Code Review Checklist Addition

Please ensure the following check is performed during PR reviews for any UI component:
- [ ] **Next.js Hook Safety**: Does the component use `useSearchParams`? If yes, is it wrapped in a `<Suspense>` boundary in its parent server component?
