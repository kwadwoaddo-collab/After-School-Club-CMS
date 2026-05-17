# Server `searchParams` Safety Audit

This document outlines potential vulnerabilities and runtime bugs related to the parsing and casting of Next.js App Router `searchParams` in server components.

## 1. Registrations Dashboard
- **File path**: `src/app/dashboard/registrations/page.tsx`
- **Risky parameter**: `centre`
- **Current parsing logic**: `searchParams.centre as string`
- **Potential failure mode**: Next.js parses duplicate query parameters (e.g., `?centre=A&centre=B`) as an array (`['A', 'B']`). Casting this to a string using `as string` suppresses TypeScript errors, but passing the raw array to `centreIds.includes()` or Drizzle's `eq()` will cause silent logic failures or SQL runtime crashes.
- **Recommended normalization**: Normalize the parameter to a single string before use (e.g., `const centreStr = Array.isArray(searchParams.centre) ? searchParams.centre[0] : searchParams.centre;`).

## 2. Finance Dashboard
- **File path**: `src/app/dashboard/finance/page.tsx`
- **Risky parameter**: `centre`
- **Current parsing logic**: `typeof searchParams?.centre === 'string' ? searchParams.centre : 'all'`
- **Potential failure mode**: If duplicate query parameters are provided, `searchParams.centre` is an array. `typeof ['A', 'B']` evaluates to `'object'`, so the code silently defaults to `'all'`, ignoring the user's intended filter.
- **Recommended normalization**: Extract the first element if it is an array before performing the string check.

## 3. Main Dashboard Overview
- **File path**: `src/app/dashboard/page.tsx`
- **Risky parameter**: `date` and `view`
- **Current parsing logic**: `const targetDateStr = searchParams.date as string | undefined;`
- **Potential failure mode**: If duplicate parameters are provided, `targetDateStr` is an array. Passing an array to `date-fns` functions like `parseISO` can throw a runtime exception or return an invalid date (Invalid date risk), crashing the page. The `view` parameter will also silently fail the `searchParams.view === 'monthly'` check if it is an array.
- **Recommended normalization**: Normalize both `date` and `view` to single strings first. For `date`, ensure it is a valid date string format before passing to `parseISO`.

## 4. Bookings Dashboard
- **File path**: `src/app/dashboard/bookings/page.tsx`
- **Risky parameter**: `status`
- **Current parsing logic**: `op.eq(b.status, searchParams.status as any)`
- **Potential failure mode**: While this page correctly normalizes arrays to strings, it directly passes the string into a database query using `as any`. If a user manually edits the URL to an invalid status (e.g., `?status=hacked`), PostgreSQL will throw a casting exception because the string does not match the allowed Enum values (SQL casting risk / invalid enum risk), resulting in a 500 error.
- **Recommended normalization**: Validate `searchParams.status` against a predefined array of allowed statuses (e.g., `['confirmed', 'completed', 'cancelled']`) before passing it to Drizzle.

## 5. Public Assessment Booking Page
- **File path**: `src/app/book/[orgSlug]/[centreSlug]/page.tsx`
- **Risky parameter**: `reschedule`
- **Current parsing logic**: `const rId = (await searchParams).reschedule;`
- **Potential failure mode**: If duplicate `reschedule` parameters are provided in the URL, `rId` will be an array. While currently dormant, if `rId` is later passed to a database query without array checking, it will result in an array being passed to a string column, crashing the server.
- **Recommended normalization**: Ensure `rId` is normalized to a single string (e.g. `Array.isArray(val) ? val[0] : val`).
