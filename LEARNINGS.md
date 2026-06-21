# Architectural Learnings & Insights

## 1. Next.js Linting and React Children Props
When working with data models that conceptually include "children" (e.g., parents and their registered children), avoid using the prop name `children` in React components (such as `RegistrationTemplate`). The Next.js ESLint rules strictly enforce `react/no-children-prop`, leading to linting errors. It is safer to use unambiguous prop names like `registeredChildren` to prevent clashes with React's inherent `children` prop.

## 2. API Validation in Tests (Zod)
The application relies on Zod for strict request body validation (e.g., `z.string().uuid()`). When writing security or validation tests, mock payloads must satisfy these structural requirements even for negative tests. For instance, using a non-UUID string like `"centre-from-org-b"` for a UUID field will fail at the Zod parsing layer, returning a generic 400 "Validation failed" rather than hitting the database logic that tests business rules (e.g., returning 400 "Invalid centre" for cross-tenant attacks).

## 3. Dynamic Component Creation
Next.js ESLint configuration (`react-hooks/static-components`) prevents creating components dynamically during the render cycle (e.g., assigning a component reference to a capitalized variable inside a component). Helper functions that return icons or elements should be structured to return JSX directly (`return <Icon />`) rather than component references, or be moved outside the component scope to avoid unnecessary re-renders and linting errors.

## 4. Effect Dependencies
Next.js strictly enforces exhaustive dependencies in `useEffect`. When tracking array lengths, use `array.length` explicitly in the dependency array rather than the array itself to prevent unnecessary executions while satisfying linting rules without resorting to `eslint-disable`.
