import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { organisations, children, parents, bookings, bookingAttendees, studentNotes, centres } from '@/db/schema';
import { eq, desc, asc, sql, inArray, and, or, ilike, isNull } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, Users, GraduationCap, Sparkles, AlertTriangle, TrendingDown, Upload } from 'lucide-react';
import { getUserAccessibleCentreIds, getUserAccessibleCentres } from '@/lib/permissions';
import StudentsTable from '@/features/students/components/StudentsTable';
import type { StudentRow } from '@/features/students/components/StudentsTable';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import StudentsFilters from '@/features/students/components/StudentsFilters';
import HeaderPortal from '@/components/dashboard/HeaderPortal';
import Pagination from '@/components/ui/Pagination';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { logger } from '@/lib/logger';

type StudentsStats = {
    totalCount: number;
    registeredCount: number;
    leadCount: number;
    medicalAlertCount: number;
    lowAttendanceCount: number;
};

export default async function StudentsPage(props: {
    searchParams: Promise<{
        centre?: string;
        search?: string;
        year?: string;
        status?: string;
        page?: string;
    }>
}) {
    const searchParams = await props.searchParams;
    // Student data — TUTOR cannot access (see architecture-decisions.md,
    // "Dashboard authorisation enforcement pattern", and security-p6.test.ts)
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });

    let hasError = false;
    let org: InferSelectModel<typeof organisations> | null = null;
    let accessibleCentreIds: string[] = [];
    let accessibleCentres: Awaited<ReturnType<typeof getUserAccessibleCentres>> = [];
    let stats: StudentsStats | null = null;
    let filteredCount = 0;
    let totalPages = 0;
    let page = 1;
    let enrichedStudents: StudentRow[] = [];
    let showLowAttendance = false;
    let hasActiveFilters = false;

    try {
        const [fetchedOrg] = await db
            .select()
            .from(organisations)
            .where(eq(organisations.id, session.user.organisationId))
            .limit(1);

        org = fetchedOrg;
        if (!org) throw new Error("NO_ORG");

        accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);

        if (accessibleCentreIds.length === 0) {
            return (
                <div className="space-y-6">
                    <HeaderPortal targetId="header-left">
                        <h1 className="text-page-title text-text">Students</h1>
                    </HeaderPortal>
                    <HeaderPortal targetId="header-right-actions">
                        <Button asChild>
                            <Link href="/dashboard/students/add">
                                <Plus className="w-4 h-4" /> Add student
                            </Link>
                        </Button>
                    </HeaderPortal>
                    <StudentsTable students={[]} />
                </div>
            );
        }

        const activeCentreId = await resolveActiveCentreId(searchParams.centre, accessibleCentreIds);
        accessibleCentres = await getUserAccessibleCentres(session.user.id);

        hasActiveFilters = !!(
            searchParams.search ||
            (searchParams.year && searchParams.year !== 'all') ||
            (searchParams.status && searchParams.status !== 'all') ||
            activeCentreId !== 'all'
        );

        const conditions = [
            eq(children.organisationId, org.id),
            isNull(children.deletedAt),
            isNull(parents.deletedAt)
        ];

        if (activeCentreId !== 'all') {
            conditions.push(eq(children.centreId, activeCentreId));
        } else {
            conditions.push(
                or(
                    inArray(children.centreId, accessibleCentreIds),
                    sql`${children.centreId} IS NULL`
                )!
            );
        }

        if (searchParams.search) {
            const searchPattern = `%${searchParams.search}%`;
            const searchCondition = or(
                ilike(children.firstName, searchPattern),
                ilike(children.lastName, searchPattern),
                ilike(parents.firstName, searchPattern),
                ilike(parents.lastName, searchPattern),
                ilike(parents.email, searchPattern),
                ilike(parents.phone, searchPattern)
            );
            if (searchCondition) {
                conditions.push(searchCondition);
            }
        }

        // Since we are changing filters to MultiSelect, year might be a comma-separated list
        // Wait, the spec says "Multi-Select Dropdown". "Year Groups (All)" or "Year Groups (2 Selected)".
        // So year param can be a comma-separated string, or multiple 'year' params. Let's assume comma-separated.
        if (searchParams.year && searchParams.year !== 'all') {
            const years = searchParams.year.split(',');
            if (years.length > 0) {
                conditions.push(inArray(children.schoolYear, years));
            }
        }

        showLowAttendance = searchParams.status === 'low-attendance';
        if (searchParams.status && searchParams.status !== 'all' && !showLowAttendance) {
            conditions.push(eq(children.isRegistered, searchParams.status === 'registered'));
        }

        // Base subqueries for counts
        const centreFilterSql = activeCentreId !== 'all' 
            ? sql`AND b.centre_id = ${activeCentreId}` 
            : sql`AND b.centre_id IN ${sql`(${sql.join(accessibleCentreIds.map(id => sql`${id}`), sql`, `)})`}`;

        // Instead of raw text list of accessibleCentreIds, we might need a better way if it's dynamic.
        // Drizzle `inArray` can be used via sql. Or we just simplify since we are passing activeCentreId or we just check if it's 'all'
        // Let's build a simpler subquery logic.
        // Actually, joining all these inside CTE is easier.

        // Let's do it using Drizzle sql``
        const pastCountQuery = sql<number>`(
            SELECT count(*)::int FROM ${bookingAttendees} ba
            INNER JOIN ${bookings} b ON ba.booking_id = b.id
            WHERE ba.child_id = ${children.id} AND b.start_at <= now()
            ${activeCentreId !== 'all' ? sql`AND b.centre_id = ${activeCentreId}` : sql``}
        )`;

        const presentCountQuery = sql<number>`(
            SELECT count(*)::int FROM ${bookingAttendees} ba
            INNER JOIN ${bookings} b ON ba.booking_id = b.id
            WHERE ba.child_id = ${children.id} AND b.start_at <= now()
            AND COALESCE(ba.attendance_status::text, CASE WHEN b.status = 'completed' THEN 'present' ELSE NULL END) = 'present'
            ${activeCentreId !== 'all' ? sql`AND b.centre_id = ${activeCentreId}` : sql``}
        )`;

        const totalCountQuery = sql<number>`(
            SELECT count(*)::int FROM ${bookingAttendees} ba
            INNER JOIN ${bookings} b ON ba.booking_id = b.id
            WHERE ba.child_id = ${children.id}
            ${activeCentreId !== 'all' ? sql`AND b.centre_id = ${activeCentreId}` : sql``}
        )`;

        const nextAssessmentQuery = sql<Date | null>`(
            SELECT min(b.start_at) FROM ${bookingAttendees} ba
            INNER JOIN ${bookings} b ON ba.booking_id = b.id
            WHERE ba.child_id = ${children.id} AND b.start_at > now()
            ${activeCentreId !== 'all' ? sql`AND b.centre_id = ${activeCentreId}` : sql``}
        )`;

        const hasMedicalNotesQuery = sql<boolean>`(
            EXISTS (
                SELECT 1 FROM ${studentNotes} sn 
                WHERE sn.child_id = ${children.id} AND sn.category = 'Medical'
            )
        )`;
        const hasSafeguardingNotesQuery = sql<boolean>`(
            EXISTS (
                SELECT 1 FROM ${studentNotes} sn 
                WHERE sn.child_id = ${children.id} AND sn.category = 'Safeguarding'
            )
        )`;

        // Aggregate stats query
        const statsQuery = db
            .select({
                totalCount: sql<number>`count(*)::int`,
                registeredCount: sql<number>`count(*) filter (where ${children.isRegistered} = true)::int`,
                leadCount: sql<number>`count(*) filter (where ${children.isRegistered} = false)::int`,
                medicalAlertCount: sql<number>`count(*) filter (where ${hasMedicalNotesQuery} = true OR ${hasSafeguardingNotesQuery} = true)::int`,
                lowAttendanceCount: sql<number>`count(*) filter (where ${pastCountQuery} >= 3 AND (${presentCountQuery}::float / ${pastCountQuery}::float) < 0.75)::int`,
            })
            .from(children)
            .innerJoin(parents, eq(children.parentId, parents.id))
            .where(and(...conditions));

        if (showLowAttendance) {
            conditions.push(sql`${pastCountQuery} >= 3 AND (${presentCountQuery}::float / ${pastCountQuery}::float) < 0.75`);
        }

        const [fetchedStats] = await statsQuery;
        stats = fetchedStats;

        const PAGE_SIZE = 20;
        page = Math.max(1, parseInt(searchParams.page || '1', 10));
        const offset = (page - 1) * PAGE_SIZE;

        // We also need the filtered total count for pagination
        const [{ filteredCount: fc }] = await db
            .select({ filteredCount: sql<number>`count(*)::int` })
            .from(children)
            .innerJoin(parents, eq(children.parentId, parents.id))
            .where(and(...conditions));
        filteredCount = fc;

        totalPages = Math.ceil(filteredCount / PAGE_SIZE);

        const studentsList = await db
            .select({
                id: children.id,
                firstName: children.firstName,
                lastName: children.lastName,
                dateOfBirth: children.dateOfBirth,
                schoolYear: children.schoolYear,
                isRegistered: children.isRegistered,
                source: children.source,
                parentFirstName: parents.firstName,
                parentLastName: parents.lastName,
                parentEmail: parents.email,
                parentPhone: parents.phone,
                parentId: parents.id,
                bookingCount: totalCountQuery,
                pastCount: pastCountQuery,
                presentCount: presentCountQuery,
                nextAssessment: nextAssessmentQuery,
                hasMedicalNotes: hasMedicalNotesQuery,
                hasSafeguardingNotes: hasSafeguardingNotesQuery,
            })
            .from(children)
            .innerJoin(parents, eq(children.parentId, parents.id))
            .where(and(...conditions))
            .orderBy(asc(children.lastName), asc(children.firstName))
            .limit(PAGE_SIZE)
            .offset(offset);

        const LOW_ATTENDANCE_THRESHOLD = 75;
        const MIN_SESSIONS_FOR_ALERT = 3;

        enrichedStudents = studentsList.map((student) => {
            const pastCount = Number(student.pastCount || 0);
            const presentCount = Number(student.presentCount || 0);
            const bookingCount = Number(student.bookingCount || 0);
            const attendanceRate = pastCount > 0 ? (presentCount / pastCount) * 100 : 0;

            return {
                id: student.id,
                firstName: student.firstName,
                lastName: student.lastName,
                dateOfBirth: student.dateOfBirth ? student.dateOfBirth.toISOString() : null,
                schoolYear: student.schoolYear ?? null,
                isRegistered: !!student.isRegistered,
                source: student.source,
                parentId: student.parentId,
                parentFirstName: student.parentFirstName,
                parentLastName: student.parentLastName,
                parentEmail: student.parentEmail,
                parentPhone: student.parentPhone,
                bookingCount,
                completedCount: presentCount,
                attendanceRate,
                lowAttendance: pastCount >= MIN_SESSIONS_FOR_ALERT && attendanceRate < LOW_ATTENDANCE_THRESHOLD,
                nextAssessment: student.nextAssessment ?? null,
                medicalNotes: student.hasMedicalNotes ? ['Medical Note'] : [],
                safeguardingNotes: student.hasSafeguardingNotes ? ['Safeguarding Note'] : [],
            };
        });

    } catch (e) {
        if (e instanceof Error && e.message === "NO_ORG") return redirect("/onboarding");
        logger.error("Error fetching students", e);
        hasError = true;
    }

    return (
        <div className="space-y-6">
            {/* Header Portals */}
            <HeaderPortal targetId="header-left">
                <div className="flex items-center gap-2">
                    <h1 className="text-page-title text-text">Students</h1>
                    <span className="px-2 py-0.5 rounded-sm bg-page border border-border-subtle text-text-muted text-xs font-medium">
                        {stats?.totalCount || 0}
                    </span>
                </div>
            </HeaderPortal>

            <HeaderPortal targetId="header-right-actions">
                <Button variant="secondary" asChild>
                    <Link href="/dashboard/students/import">
                        <Upload className="w-3.5 h-3.5" />
                        Import CSV
                    </Link>
                </Button>
                <Button asChild>
                    <Link href="/dashboard/students/add">
                        <Plus className="w-3.5 h-3.5" />
                        Add student
                    </Link>
                </Button>
            </HeaderPortal>

            {/* KPI stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                    <div className="p-4 flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                            <Users className="w-4 h-4" />
                        </span>
                        <div>
                            <p className="text-financial-total text-text">{stats?.totalCount || 0}</p>
                            <p className="text-metadata">Total students</p>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="p-4 flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-success-soft text-success">
                            <GraduationCap className="w-4 h-4" />
                        </span>
                        <div>
                            <p className="text-financial-total text-text">{stats?.registeredCount || 0}</p>
                            <p className="text-metadata">Registered</p>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="p-4 flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-page border border-border text-text-secondary">
                            <Sparkles className="w-4 h-4" />
                        </span>
                        <div>
                            <p className="text-financial-total text-text">{stats?.leadCount || 0}</p>
                            <p className="text-metadata">Leads</p>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="p-4 flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-danger-soft text-danger">
                            <AlertTriangle className="w-4 h-4" />
                        </span>
                        <div>
                            <p className="text-financial-total text-text">{stats?.medicalAlertCount || 0}</p>
                            <p className="text-metadata">Medical alerts</p>
                        </div>
                    </div>
                </Card>

                <Link href={showLowAttendance ? '/dashboard/students' : '/dashboard/students?status=low-attendance'} className="block">
                    <Card className={showLowAttendance ? 'ring-1 ring-warning/40 border-warning/40' : 'hover:border-warning/30 transition-colors'}>
                        <div className="p-4 flex items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-warning-soft text-warning">
                                <TrendingDown className="w-4 h-4" />
                            </span>
                            <div>
                                <p className={`text-financial-total ${(stats?.lowAttendanceCount || 0) > 0 ? 'text-warning' : 'text-text'}`}>{stats?.lowAttendanceCount || 0}</p>
                                <p className="text-metadata">Low attendance</p>
                            </div>
                        </div>
                    </Card>
                </Link>
            </div>

            {/* Toolbar — sticky */}
            <div className="sticky top-16 sm:top-20 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-page/90 backdrop-blur-sm border-b border-border-subtle">
                <StudentsFilters
                    centres={accessibleCentres}
                    resultsCount={filteredCount}
                />
            </div>

            <div>
                <StudentsTable students={enrichedStudents} error={hasError} hasActiveFilters={hasActiveFilters} />

                {totalPages > 1 && (
                    <div className="mt-4">
                        <Pagination currentPage={page} totalPages={totalPages} />
                    </div>
                )}
            </div>
        </div>
    );
}
