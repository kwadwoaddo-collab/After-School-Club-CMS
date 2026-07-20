'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Mail, Phone, Users, Plus, TrendingDown } from 'lucide-react';
import DataTable, { DataTableColumn } from '@/components/ui/DataTable';
import { AttendanceRadial } from '@/components/ui/AttendanceRadial';
import StudentActions from '@/components/students/StudentActions';

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
/*  Column definitions                                                 */
/* ------------------------------------------------------------------ */

const columns: DataTableColumn<StudentRow>[] = [
  {
    key: 'student',
    header: 'Student',
    render: (student) => {
      return (
        <div className="flex items-center gap-3">
          <AttendanceRadial percentage={student.attendanceRate} size="sm">
            <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {student.firstName[0]}{student.lastName[0]}
            </div>
          </AttendanceRadial>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">
                {student.firstName} {student.lastName}
              </span>
              {student.isRegistered && (
                <span className="px-2 py-0.5 rounded-full bg-success/10 border border-success/40 text-[10px] font-bold text-success uppercase tracking-wider ml-1 whitespace-nowrap" title={student.source === 'registration' ? 'Signed up via Registration Form' : 'Registered'}>
                  Registered
                </span>
              )}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    key: 'dob',
    header: 'DOB',
    render: (student) => (
      <span className="text-sm font-medium text-foreground">
        {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : 'N/A'}
      </span>
    ),
  },
  {
    key: 'schoolYear',
    header: 'Year Group',
    render: (student) => {
      const yr = student.schoolYear;
      let colour = 'bg-secondary border-border text-foreground';
      if (yr === 'Reception' || yr === 'Y1' || yr === 'Y2') colour = 'bg-primary/10 border-primary/30 text-primary';       // KS1
      else if (['Y3','Y4','Y5','Y6'].includes(yr ?? ''))   colour = 'bg-success/10 border-success/30 text-success'; // KS2
      else if (['Y7','Y8','Y9'].includes(yr ?? ''))         colour = 'bg-warning/10 border-warning/30 text-warning';   // KS3
      else if (['Y10','Y11'].includes(yr ?? ''))            colour = 'bg-destructive/10 border-destructive/30 text-destructive'; // KS4
      else if (['Y12','Y13'].includes(yr ?? ''))            colour = 'bg-destructive/10 border-destructive/30 text-destructive';      // Sixth form
      return (
        <span className={`px-3 py-1 border text-xs font-bold rounded-full shadow-sm ${colour}`}>
          {yr ?? '—'}
        </span>
      );
    },
  },
  {
    key: 'parentContact',
    header: 'Parent Contact',
    render: (student) => (
      <div className="space-y-1">
        <span className="font-semibold text-sm text-foreground">
          {student.parentFirstName} {student.parentLastName}
        </span>
        {student.parentEmail && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Mail className="w-3 h-3 text-muted-foreground/60" />
            {student.parentEmail}
          </p>
        )}
        {student.parentPhone && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Phone className="w-3 h-3 text-muted-foreground/60" />
            {student.parentPhone}
          </p>
        )}
      </div>
    ),
  },
  {
    key: 'bookings',
    header: 'Bookings',
    render: (student) => (
      <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex flex-col items-center justify-center">
        <span className="font-bold text-foreground text-xs leading-none">
          {student.bookingCount}
        </span>
      </div>
    ),
  },
  {
    key: 'nextBooking',
    header: 'Next Booking',
    render: (student) => (
      <div>
        {student.nextAssessment ? (
          <span className="text-sm font-medium text-foreground block">
            {new Date(student.nextAssessment).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground italic">No upcoming</span>
        )}
      </div>
    ),
  },
  {
    key: 'alerts',
    header: 'Alerts',
    render: (student) => {
      const hasMedicalNote = student.medicalNotes.length > 0;
      const hasSafeguardingNote = student.safeguardingNotes.length > 0;
      return (
        <div className="flex flex-col gap-1.5 items-start">
          {(hasMedicalNote || hasSafeguardingNote) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-bold">
              <ShieldAlert className="w-3.5 h-3.5" />
              Safeguarding / Medical
            </span>
          )}
          {student.lowAttendance && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-warning/10 text-warning text-xs font-bold">
              <TrendingDown className="w-3.5 h-3.5" />
              Low Attendance
            </span>
          )}
        </div>
      );
    },
  },
  {
    key: 'actions',
    header: 'Actions',
    headerAlign: 'right',
    render: (student) => (
      <StudentActions
        studentId={student.id}
        studentName={`${student.firstName} ${student.lastName}`}
      />
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Empty State                                                        */
/* ------------------------------------------------------------------ */

function StudentsEmptyState() {
  return (
    <div className="p-16 text-center">
      <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 ring-1 ring-primary/20">
        <Users className="w-10 h-10 text-primary" />
      </div>
      <h3 className="text-2xl font-bold text-foreground mb-3">No students yet</h3>
      <p className="text-muted-foreground mb-8 max-w-xs mx-auto">
        Students will appear here once they register or book sessions, or you can add one manually.
      </p>
      <Link
        href="/dashboard/students/add"
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 glow-btn"
      >
        <Plus className="w-4 h-4" /> Add New Student
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface StudentsTableProps {
  students: StudentRow[];
}

export default function StudentsTable({ students }: StudentsTableProps) {
  const router = useRouter();

  return (
    <DataTable<StudentRow>
      columns={columns}
      data={students}
      rowKey={(s) => s.id}
      emptyState={<StudentsEmptyState />}
      caption="Students list"
      onRowClick={(student) => router.push(`/dashboard/students/${student.id}`)}
    />
  );
}
