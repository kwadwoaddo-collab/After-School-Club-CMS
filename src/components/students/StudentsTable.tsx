'use client';

import Link from 'next/link';
import { AlertTriangle, Shield, Mail, Phone, Users, Plus, TrendingDown } from 'lucide-react';
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
      const hasMedicalNote = student.medicalNotes.length > 0;
      const medicalNotesContent = student.medicalNotes.join('\n\n');
      const hasSafeguardingNote = student.safeguardingNotes.length > 0;
      const safeguardingNotesContent = student.safeguardingNotes.join('\n\n');

      return (
        <div className="flex items-center gap-3">
          <AttendanceRadial percentage={student.attendanceRate} size="sm">
            <div className="w-full h-full bg-secondary/10 flex items-center justify-center text-secondary font-bold">
              {student.firstName[0]}{student.lastName[0]}
            </div>
          </AttendanceRadial>
          <div>
            <div className="flex items-center gap-2">
              <Link 
                href={`/dashboard/students/${student.id}`}
                className="font-bold text-foreground hover:text-primary transition-colors hover:underline decoration-primary/30"
              >
                {student.firstName} {student.lastName}
              </Link>
              {student.isRegistered && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-[10px] font-bold text-emerald-600 uppercase tracking-wider ml-1 whitespace-nowrap" title={student.source === 'registration' ? 'Signed up via Registration Form' : 'Registered'}>
                  Registered
                </span>
              )}
              {hasMedicalNote && (
                <div className="relative group/tooltip flex items-center outline-none">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-error/10 border border-error/20 cursor-help shadow-[0_0_8px_rgba(255,113,108,0.2)]">
                    <AlertTriangle className="w-3.5 h-3.5 text-error" />
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2.5 bg-popover border border-border text-foreground text-xs rounded-xl shadow-xl z-[60] whitespace-pre-wrap leading-relaxed font-medium">
                    <div className="font-bold text-error mb-1 border-b border-error/20 pb-1 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3"/>Medical / Allergy Alert</div>
                    {medicalNotesContent}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border"></div>
                  </div>
                </div>
              )}
              {hasSafeguardingNote && (
                <div className="relative group/tooltip flex items-center outline-none">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 border border-primary/20 cursor-help shadow-[0_0_8px_rgba(142,171,255,0.2)]">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2.5 bg-popover border border-border text-foreground text-xs rounded-xl shadow-xl z-[60] whitespace-pre-wrap leading-relaxed font-medium">
                    <div className="font-bold text-primary mb-1 border-b border-primary/20 pb-1 flex items-center gap-1.5"><Shield className="w-3 h-3"/>Safeguarding Alert</div>
                    {safeguardingNotesContent}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border"></div>
                  </div>
                </div>
              )}
              {student.lowAttendance && (
                <div className="relative group/tooltip flex items-center outline-none">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/30 cursor-help shadow-[0_0_8px_rgba(251,191,36,0.2)]">
                    <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-48 p-2.5 bg-popover border border-border text-foreground text-xs rounded-xl shadow-xl z-[60] leading-relaxed font-medium">
                    <div className="font-bold text-amber-500 mb-1 border-b border-amber-500/20 pb-1 flex items-center gap-1.5"><TrendingDown className="w-3 h-3"/>Low Attendance</div>
                    {Math.round(student.attendanceRate)}% attendance rate — below 75% threshold
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border"></div>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              DOB: {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    key: 'schoolYear',
    header: 'Year Group',
    render: (student) => {
      const yr = student.schoolYear;
      let colour = 'bg-secondary border-border text-foreground';
      if (yr === 'Reception' || yr === 'Y1' || yr === 'Y2') colour = 'bg-blue-500/10 border-blue-500/30 text-blue-600';       // KS1
      else if (['Y3','Y4','Y5','Y6'].includes(yr ?? ''))   colour = 'bg-violet-500/10 border-violet-500/30 text-violet-600'; // KS2
      else if (['Y7','Y8','Y9'].includes(yr ?? ''))         colour = 'bg-amber-500/10 border-amber-500/30 text-amber-600';   // KS3
      else if (['Y10','Y11'].includes(yr ?? ''))            colour = 'bg-orange-500/10 border-orange-500/30 text-orange-600'; // KS4
      else if (['Y12','Y13'].includes(yr ?? ''))            colour = 'bg-rose-500/10 border-rose-500/30 text-rose-600';      // Sixth form
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
        <Link
          href={`/dashboard/parents/${student.parentId}`}
          className="font-semibold text-sm text-foreground hover:text-primary transition-colors hover:underline underline-offset-4 decoration-primary/30"
        >
          {student.parentFirstName} {student.parentLastName}
        </Link>
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
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex flex-col items-center justify-center">
          <span className="font-bold text-foreground text-xs leading-none">
            {student.bookingCount}
          </span>
        </div>
        <div>
          {student.nextAssessment ? (
            <>
              <span className="font-semibold text-foreground text-xs block">Next Booking</span>
              <span className="text-xs text-muted-foreground block">
                {new Date(student.nextAssessment).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground italic">No upcoming</span>
          )}
        </div>
      </div>
    ),
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
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 glow-btn"
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
  return (
    <DataTable<StudentRow>
      columns={columns}
      data={students}
      rowKey={(s) => s.id}
      emptyState={<StudentsEmptyState />}
      caption="Students list"
    />
  );
}
