import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, centres, parents, children, bookings, bookingAttendees } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import Link from 'next/link';
import BookingLinkCard from '@/components/dashboard/BookingLinkCard';
import RecentStudentsTable from '@/components/dashboard/RecentStudentsTable';
// Force rebuild

import Pagination from '@/components/ui/Pagination';
import { sql } from 'drizzle-orm';

export default async function DashboardPage(props: { searchParams: Promise<{ page?: string }> }) {
    console.log("[DASHBOARD] Start render");
    const searchParams = await props.searchParams;
    const session = await auth();

    if (!session?.user) {
        return redirect('/login');
    }

    if (!session.user.organisationId) {
        return redirect('/onboarding');
    }

    console.log("[DASHBOARD] Fetching org info for:", session.user.organisationId);
    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.user.organisationId))
        .limit(1);

    if (!org) {
        return redirect('/onboarding');
    }

    const bookingLink = `http://localhost:3000/book/${org.slug}`;

    // Pagination
    const page = searchParams.page ? parseInt(searchParams.page) : 1;
    const limit = 5;
    const offset = Math.max(0, (page - 1) * limit);

    console.log("[DASHBOARD] Fetching booking counts");
    const countResult = await db
        .select({ count: sql<number>`count(${bookings.id})` })
        .from(bookings)
        .innerJoin(centres, eq(bookings.centreId, centres.id))
        .where(eq(centres.organisationId, org.id));

    const totalBookings = Number(countResult[0]?.count || 0);
    const totalPages = Math.max(1, Math.ceil(totalBookings / limit));

    console.log("[DASHBOARD] Fetching recent student data");
    const recentBookingsData = await db
        .select({
            bookingId: bookings.id,
            startAt: bookings.startAt,
            childId: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            grade: children.schoolYear,
            dob: children.dateOfBirth,
            parentFirstName: parents.firstName,
            parentLastName: parents.lastName,
            parentPhone: parents.phone,
            parentEmail: parents.email,
            centreName: centres.name,
            status: bookings.status,
        })
        .from(bookings)
        .innerJoin(bookingAttendees, eq(bookings.id, bookingAttendees.bookingId))
        .innerJoin(children, eq(bookingAttendees.childId, children.id))
        .innerJoin(parents, eq(children.parentId, parents.id))
        .innerJoin(centres, eq(bookings.centreId, centres.id))
        .where(eq(centres.organisationId, org.id))
        .orderBy(desc(bookings.startAt))
        .limit(limit)
        .offset(offset);

    const recentStudents = recentBookingsData.map((row) => ({
        id: row.childId,
        firstName: row.firstName,
        lastName: row.lastName,
        grade: row.grade,
        dob: row.dob,
        parentFirstName: row.parentFirstName,
        parentLastName: row.parentLastName,
        parentPhone: row.parentPhone,
        parentEmail: row.parentEmail,
        nextAppointment: row.startAt,
        centreName: row.centreName,
        bookingId: row.bookingId,
        status: row.status,
    }));

    console.log("[DASHBOARD] Fetching centres list");
    const centresList = await db
        .select()
        .from(centres)
        .where(eq(centres.organisationId, org.id));

    console.log("[DASHBOARD] Render data ready");

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-2xl">
                            📊
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900">{org.name} Dashboard</h1>
                    </div>
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                        <h2 className="text-xl font-semibold mb-2 text-green-700 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            Account Active
                        </h2>
                        <p className="text-gray-600">
                            Welcome to your new dashboard. Your organisation is set up and ready to accept bookings.
                        </p>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Quick Actions */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900">Quick Actions</h3>
                        <div className="space-y-3">
                            <Link
                                href="/dashboard/bookings"
                                className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between group"
                            >
                                <span className="font-medium text-gray-700">View Bookings</span>
                                <span className="text-gray-400 group-hover:text-indigo-600">→</span>
                            </Link>
                            <Link
                                href="/dashboard/availability"
                                className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between group"
                            >
                                <span className="font-medium text-gray-700">Manage Availability</span>
                                <span className="text-gray-400 group-hover:text-indigo-600">→</span>
                            </Link>
                            <Link
                                href="/dashboard/students/add"
                                className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between group"
                            >
                                <span className="font-medium text-gray-700">Add New Student</span>
                                <span className="text-gray-400 group-hover:text-indigo-600">+</span>
                            </Link>
                        </div>
                    </div>

                    {/* Booking Link */}
                    <BookingLinkCard bookingLink={bookingLink} />

                    {/* Centres List */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Your Centres</h3>
                            <Link href="/dashboard/centres/add" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                                Add New +
                            </Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-100">
                                        <th className="pb-3 font-medium text-gray-500">Name</th>
                                        <th className="pb-3 font-medium text-gray-500">Slug</th>
                                        <th className="pb-3 font-medium text-gray-500">Created</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {centresList.map((centre) => (
                                        <tr key={centre.id} className="group hover:bg-gray-50 transition-colors">
                                            <td className="py-3 font-medium text-gray-900">{centre.name}</td>
                                            <td className="py-3 text-gray-500">{centre.slug}</td>
                                            <td className="py-3 text-gray-400 text-sm">
                                                {new Date(centre.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Students List */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:col-span-2 overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Recent Students</h3>
                            <Link href="/dashboard/students/add" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                                Add New +
                            </Link>
                        </div>
                        <RecentStudentsTable students={recentStudents} />
                    </div>
                </div>

                <Pagination totalPages={totalPages} currentPage={page} />
            </div>
        </div>
    );
}
