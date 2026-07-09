# Architectural Learnings & Insights

## 1. Next.js Linting and React Children Props
When working with data models that conceptually include "children" (e.g., parents and their registered children), avoid using the prop name `children` in React components (such as `RegistrationTemplate`). The Next.js ESLint rules strictly enforce `react/no-children-prop`, leading to linting errors. It is safer to use unambiguous prop names like `registeredChildren` to prevent clashes with React's inherent `children` prop.

## 2. API Validation in Tests (Zod)
The application relies on Zod for strict request body validation (e.g., `z.string().uuid()`). When writing security or validation tests, mock payloads must satisfy these structural requirements even for negative tests. For instance, using a non-UUID string like `"centre-from-org-b"` for a UUID field will fail at the Zod parsing layer, returning a generic 400 "Validation failed" rather than hitting the database logic that tests business rules (e.g., returning 400 "Invalid centre" for cross-tenant attacks).

## 3. Dynamic Component Creation
Next.js ESLint configuration (`react-hooks/static-components`) prevents creating components dynamically during the render cycle (e.g., assigning a component reference to a capitalized variable inside a component). Helper functions that return icons or elements should be structured to return JSX directly (`return <Icon />`) rather than component references, or be moved outside the component scope to avoid unnecessary re-renders and linting errors.

## 4. Effect Dependencies
Next.js strictly enforces exhaustive dependencies in `useEffect`. When tracking array lengths, use `array.length` explicitly in the dependency array rather than the array itself to prevent unnecessary executions while satisfying linting rules without resorting to `eslint-disable`.

## 5. Security & Ownership Verification
When performing operations on resources associated with a specific centre (like updating availability rules), always verify that the user has the correct authorization to act on that centre. This can be done via the `canUserAccessCentre` helper from `@/lib/permissions`. Never assume ownership based solely on session validity, especially in APIs or Server Actions that modify settings.

## 6. Email Service Integration
The platform uses an `EmailService` wrapper around Resend for transactional emails (e.g., `sendMagicLink` for portal login). This centralized service is located in `src/lib/services/email.ts` and ensures emails are handled consistently across the application with proper error handling and templating.

## 7. React Compiler Strictness (Impure Functions and Try/Catch)
The Next.js/React setup includes aggressive compiler linting. 
- Avoid invoking impure functions like `Date.now()` directly within the render phase or even in initialization of state without lazy callbacks, as it violates idempotency and causes React Compiler warnings. Use `useState(() => Date.now())` or execute them in event handlers safely.
- Do not construct and return JSX from inside a `try/catch` block. The compiler considers this an anti-pattern as errors thrown during render are not caught by the `try/catch`. Instead, handle data fetching inside the `try/catch` and return the JSX outside of it.

## 8. TypeScript and Regex Flags
When using regular expressions in TypeScript, avoid the `/s` (dotAll) flag if targeting older environments (e.g., `<es2018`). A safer, backwards-compatible equivalent is `[\s\S]*?` instead of `(.*?)` with the `/s` flag, ensuring the codebase complies universally.

## 9. React Hook Form Strictness with React Compiler
When using `react-hook-form` in environments with React Compiler (React 19), avoid destructing and calling `watch()` within the render function. The compiler flags this as an incompatible library usage that breaks memoization. Instead, use the `useWatch` hook explicitly provided by `react-hook-form` to selectively subscribe to form state changes without violating compiler constraints.

## 10. Database Indexing
When defining Drizzle ORM schemas in PostgreSQL, foreign keys do not automatically create indexes. To optimize queries and enforce performant joins, explicitly define indexes on frequently queried relational columns (like `organisationId`, `centreId`, `parentId`) using the `index()` function in the Drizzle table configuration block.

## 11. React Compiler Purity Requirements
React Compiler enforces strict purity rules. Direct calls to impure functions like `Date.now()` or `new Date()` within the render lifecycle (or inside raw prop definitions of JSX nodes) can cause compilation/linting failures. Instead:
- Initialize them via lazy `useState` initializers: `const [today] = useState(() => new Date())`.
- Compute values inside callback hooks, `useMemo` with empty dependency arrays, or standard event handlers where appropriate.

## 12. Multi-Centre Sibling Invoice Validation
In parent-billing platforms with multiple centres, combined sibling invoicing requires checking for mismatched centre contexts. If sibling students attend different centres:
- Automatically notify or prompt the administrator to choose which centre's invoice template, bank details, and Ofsted registration should apply to the final combined invoice PDF, rather than arbitrarily picking a default centre context.
- Implement inline warnings below the centre selection elements when multi-centre sibling contexts are detected.

## 13. DB Transaction Wrapping for Multi-Write API Routes
When creating composite database models (such as inserting a `Parent` and then inserting a `Child` linked to that parent) inside an API route or server action, wrap the sequence in a database transaction block (`db.transaction`). This prevents orphaned records (e.g. creating a parent record but failing to create the child record due to a subsequent validation error or database failure), guaranteeing referential and transactional integrity.

## 14. React Compiler Purity with Impure Date Computations
To avoid compilation errors or warnings under the React Compiler (React 19), do not compute dates or construct date instances directly inside the render lifecycle of Client Components. For example:
- Wrap date calculations in `useMemo` blocks: `const dates = useMemo(() => getSelectableDates(), [])`
- Initialize states lazily using initializer functions: `const [clock, setClock] = useState(() => new Date())`

## 15. Base64 Attachment Stripping for Resend Emails
When sending attachments stored as base64-encoded strings (often prepended with Data URL prefixes like `data:image/png;base64,...`) via the Resend API, strip the prefix before converting the string to a Node `Buffer`. Resend expects raw binary buffers or clean base64 strings; passing raw Data URL strings causes mail delivery failures. Extract the raw base64 string using `.split(';base64,')` and convert using `Buffer.from(base64Data, 'base64')`.

## 16. Consolidation of Duplicated Server Actions
Keep server actions and data logic consolidated in specialized modules (e.g. `notes.actions.ts`) rather than duplicating them in generic `actions.ts`. Ensure components import from single sources of truth to avoid redundant database queries, conflicting cache revalidation paths, and diverging permission checks.

## 17. Declaring Physical DB Indexes in ORM Schemas
Always declare database indexes (such as foreign keys and frequently queried filter/sorting combinations) directly in the Drizzle Schema ORM definition (`schema.ts`), matching any raw SQL migrations (like `add-indexes.sql`). This ensures schema synchronization tools (like `drizzle-kit`) remain in sync and that database tables created in development, testing, and production environments are identically optimized.


