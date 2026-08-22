'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Mail, Phone, Users, Plus, TrendingDown, AlertTriangle, Search } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import StudentsGrid from '@/features/students/components/StudentsGrid';
import StudentActions from '@/features/students/components/StudentActions';

/* ------------------------------------------------------------------ */
/*  Row shape – pre-enriched by the server component                   */
/* ------------------------------------------------------------------ */

export interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  schoolYear: string | null;
  isRegistered: boolean;
  source: string | null;
  parentId: string;
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string | null;
  parentPhone: string | null;
  bookingCount: number;
  completedCount: number;
  attendanceRate: number;
  lowAttendance: boolean;
  nextAssessment: Date | null;
  medicalNotes: string[];
  safeguardingNotes: string[];
}

/* ------------------------------------------------------------------ */
/*  Empty states — distinguish "none exist" from "no filter matches"   */
/* ------------------------------------------------------------------ */

function NoStudentsEmptyState() {
  return (
    <EmptyState
      icon={<Users className="w-8 h-8" />}
      title="No students yet"
      description="Students will appear here once they register or book sessions, or you can add one manually."
      action={
        <Button asChild>
          <Link href="/dashboard/students/add">
            <Plus className="w-4 h-4" /> Add student
          </Link>
        </Button>
      }
    />
  );
}

function NoFilterMatchesEmptyState() {
  return (
    <EmptyState
      icon={<Search className="w-8 h-8" />}
      title="No students match these filters"
      description="Try a different search, year group, or status — or clear filters to see everyone."
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface StudentsTableProps {
  students: StudentRow[];
  error?: boolean;
  /** True when a search/filter is active — used to pick the right empty state. */
  hasActiveFilters?: boolean;
}

export default function StudentsTable({ students, error, hasActiveFilters }: StudentsTableProps) {
  const router = useRouter();

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger-soft p-6 text-center">
        <AlertTriangle className="w-6 h-6 text-danger mx-auto mb-2" />
        <p className="text-card-heading text-text">Unable to load students</p>
        <p className="text-small-body text-text-secondary">Please refresh the page</p>
      </div>
    );
  }

  if (students.length === 0) {
    return hasActiveFilters ? <NoFilterMatchesEmptyState /> : <NoStudentsEmptyState />;
  }

  return (
    <>
      {/* Desktop / tablet — table. Collapses to stacked cards below `md`,
          per InvoiceFlow's documented mobile table pattern (not a
          horizontally-scrolled desktop table). */}
      <div className="hidden md:block rounded-lg border border-border bg-surface overflow-hidden">
        <Table caption="Students list">
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>DOB</TableHead>
              <TableHead>Year group</TableHead>
              <TableHead>Parent contact</TableHead>
              <TableHead align="center">Bookings</TableHead>
              <TableHead>Next booking</TableHead>
              <TableHead>Alerts</TableHead>
              <TableHead align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => {
              const hasMedicalNote = student.medicalNotes.length > 0;
              const hasSafeguardingNote = student.safeguardingNotes.length > 0;
              const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase();

              return (
                <TableRow
                  key={student.id}
                  clickable
                  onClick={() => router.push(`/dashboard/students/${student.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-table-value font-medium text-text truncate">
                            {student.firstName} {student.lastName}
                          </span>
                          {student.isRegistered && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0"
                              title={student.source === 'registration' ? 'Signed up via registration form' : 'Registered'}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-text-secondary">
                    {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    {student.schoolYear ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-border-subtle bg-page text-text-secondary text-xs font-medium">
                        {student.schoolYear}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/dashboard/parents/${student.parentId}`}
                        className="text-accent hover:underline text-small-body font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {student.parentFirstName} {student.parentLastName}
                      </Link>
                      <div className="flex items-center gap-1 -ml-1">
                        {student.parentEmail && (
                          <a
                            href={`mailto:${student.parentEmail}`}
                            className="p-1 hover:bg-page rounded-sm text-text-muted hover:text-text transition-colors inline-flex items-center justify-center"
                            title={student.parentEmail}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {student.parentPhone && (
                          <a
                            href={`tel:${student.parentPhone}`}
                            className="p-1 hover:bg-page rounded-sm text-text-muted hover:text-text transition-colors inline-flex items-center justify-center"
                            title={student.parentPhone}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell align="center" className="text-text-secondary">
                    {student.bookingCount}
                  </TableCell>
                  <TableCell>
                    {student.nextAssessment ? (
                      <span className="text-text-secondary">
                        {new Date(student.nextAssessment).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    ) : (
                      <span className="text-text-muted italic">None upcoming</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      {(hasMedicalNote || hasSafeguardingNote) && (
                        <Badge variant="error">
                          <ShieldAlert className="w-3 h-3" />
                          Medical / safeguarding
                        </Badge>
                      )}
                      {student.lowAttendance && (
                        <Badge variant="warning">
                          <TrendingDown className="w-3 h-3" />
                          Low attendance
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell align="right">
                    <StudentActions
                      studentId={student.id}
                      studentName={`${student.firstName} ${student.lastName}`}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile — stacked record cards, not a horizontally-scrolled table. */}
      <div className="md:hidden">
        <StudentsGrid students={students} />
      </div>
    </>
  );
}
