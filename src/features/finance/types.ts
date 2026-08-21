import { InferSelectModel } from 'drizzle-orm';
import { invoices, centres, parents, children } from '@/db/schema';

export type Invoice = InferSelectModel<typeof invoices>;
export type Centre = InferSelectModel<typeof centres>;
export type Parent = InferSelectModel<typeof parents>;
export type Child = InferSelectModel<typeof children>;

/**
 * Shape returned by `db.query.invoices.findMany({ with: { centre, child,
 * parent } })` (see src/app/dashboard/finance/invoices/page.tsx). `child`
 * is nullable because `invoices.childId` is nullable (multi-child family
 * invoices); `parent` is typed nullable too to match how call sites
 * already defensively use optional chaining (`invoice.parent?.firstName`)
 * rather than assuming Drizzle's relational query builder always narrows a
 * required FK's `one()` relation to non-null.
 */
export interface InvoiceWithRelations extends Invoice {
    centre: Centre | null;
    parent: Parent | null;
    child: Child | null;
}
