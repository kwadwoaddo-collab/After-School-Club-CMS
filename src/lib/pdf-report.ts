/**
 * CEO Weekly Activity Report — PDF generation.
 *
 * Strategy: Build a fully-styled HTML document and open it in a new
 * browser window, then call window.print() so the user can "Save as PDF"
 * via the browser's native print dialog.
 *
 * This approach:
 *  - Requires zero extra dependencies (no jsPDF bundle)
 *  - Works on all modern browsers and mobile
 *  - Produces clean, print-ready output via @media print CSS
 *  - All PII stays in-browser — no server round-trip
 */

import type { WeeklyReportData } from '@/features/reports/weekly-report.action';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function generateCEOReportPDF(data: WeeklyReportData): Promise<void> {
    const html = buildReportHTML(data);

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
        throw new Error(
            'Pop-up blocked. Please allow pop-ups for this site and try again.'
        );
    }

    win.document.open();
    win.document.write(html);
    win.document.close();

    // Give images / fonts time to load before triggering print
    await new Promise<void>((resolve) => {
        win.onload = () => {
            setTimeout(() => {
                win.print();
                resolve();
            }, 400);
        };
        // Fallback if onload already fired
        if (win.document.readyState === 'complete') {
            setTimeout(() => {
                win.print();
                resolve();
            }, 400);
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function esc(s: string | number | null | undefined): string {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function th(cells: string[]): string {
    return `<tr>${cells.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>`;
}

function td(cells: (string | number | null | undefined)[], flagAmber = false, flagRed = false): string {
    const cls = flagRed ? ' class="flag-red"' : flagAmber ? ' class="flag-amber"' : '';
    return `<tr${cls}>${cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`;
}

function sectionTable(
    headers: string[],
    body: string,
    empty: string
): string {
    if (!body.trim()) return `<p class="empty">${esc(empty)}</p>`;
    return `<table><thead>${th(headers)}</thead><tbody>${body}</tbody></table>`;
}

function stat(label: string, value: string | number, accent = '#1a73e8'): string {
    return `
    <div class="stat">
        <div class="stat-label">${esc(label)}</div>
        <div class="stat-value" style="color:${accent}">${esc(value)}</div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML builder
// ─────────────────────────────────────────────────────────────────────────────

function buildReportHTML(data: WeeklyReportData): string {
    const {
        summary, newRegistrations, newBookings,
        attendanceByCentre, pendingActions,
    } = data;

    // ── Summary stats ──────────────────────────────────────────────────────
    const attendanceDisplay = summary.attendanceRate != null
        ? `${summary.attendanceRate}%`
        : '—';
    const attendanceAccent = summary.attendanceRate == null ? '#888'
        : summary.attendanceRate >= 80 ? '#1e8e3e'
        : summary.attendanceRate >= 50 ? '#e37400'
        : '#c5221f';

    const summaryHTML = `
    <div class="stat-grid">
        ${stat('New Registrations', summary.newRegistrations)}
        ${stat('New Bookings', summary.newBookings)}
        ${stat('Sessions Run', summary.sessionsRun)}
        ${stat('Attendance Rate', attendanceDisplay, attendanceAccent)}
        ${stat('Pending (This Period)', summary.pendingRegistrationsThisPeriod, '#e37400')}
        ${stat('Overdue Follow-ups', summary.overdueFollowUps, summary.overdueFollowUps > 0 ? '#c5221f' : '#1e8e3e')}
    </div>`;

    // ── New Registrations ──────────────────────────────────────────────────
    const regsBody = newRegistrations.map((r) =>
        td(
            [r.childNames, r.parentName, r.parentEmail, r.parentPhone, r.centre, r.startDate, r.status, `${r.daysSinceSubmitted}d`],
            r.daysSinceSubmitted >= 3 && r.daysSinceSubmitted < 7,
            r.daysSinceSubmitted >= 7
        )
    ).join('');

    const regsTable = sectionTable(
        ['Child(ren)', 'Parent', 'Email', 'Phone', 'Centre', 'Start Date', 'Status', 'Days Since Submitted'],
        regsBody,
        'No new registrations this period.'
    );

    // ── New Bookings ───────────────────────────────────────────────────────
    const bookingsBody = newBookings.map((b) =>
        td([b.childNames, b.parentName, b.parentEmail, b.centre, b.sessionDate, b.bookingStatus, b.attendance])
    ).join('');

    const bookingsTable = sectionTable(
        ['Child(ren)', 'Parent', 'Email', 'Centre', 'Session Date', 'Status', 'Attendance'],
        bookingsBody,
        'No new bookings this period.'
    );

    // ── Attendance by Centre ───────────────────────────────────────────────
    const attendanceBody = attendanceByCentre.map((a) => {
        const rateFlagAmber = a.attendanceRate >= 50 && a.attendanceRate < 80;
        const rateFlagRed = a.attendanceRate < 50;
        return td(
            [a.centre, a.sessionsRun, a.studentsExpected, a.studentsAttended, `${a.attendanceRate}%`],
            rateFlagAmber,
            rateFlagRed
        );
    }).join('');

    const attendanceTable = sectionTable(
        ['Centre', 'Sessions Run', 'Students Expected', 'Students Attended', 'Attendance Rate'],
        attendanceBody,
        'No attendance data for this period.'
    );

    // ── Pending Actions ────────────────────────────────────────────────────
    const pendingBody = pendingActions.map((p) =>
        td(
            [
                p.type === 'overdue_registration' ? 'Overdue Registration' : 'Missed Attendance',
                p.name,
                p.description,
                p.date,
                `${p.daysPending}d`,
            ],
            p.type === 'overdue_registration',
            p.type === 'missed_attendance'
        )
    ).join('');

    const pendingTable = sectionTable(
        ['Type', 'Name', 'Description', 'Date', 'Days Pending'],
        pendingBody,
        'No pending actions.'
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>CEO Report — ${esc(data.orgName)} — ${esc(data.periodLabel)}</title>
<style>
  /* ── Base ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 11px;
    color: #1a1a1a;
    background: #fff;
    padding: 32px 40px;
    line-height: 1.5;
  }

  /* ── Header ── */
  .report-header { margin-bottom: 24px; border-bottom: 2px solid #1a73e8; padding-bottom: 16px; }
  .report-header h1 { font-size: 22px; font-weight: 700; color: #1a73e8; }
  .report-header .org { font-size: 14px; font-weight: 600; color: #333; margin-top: 2px; }
  .report-header .meta { font-size: 10px; color: #666; margin-top: 6px; }

  /* ── Summary stats ── */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 28px;
  }
  .stat {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 12px 16px;
    background: #fafafa;
  }
  .stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #666; font-weight: 600; }
  .stat-value { font-size: 26px; font-weight: 700; margin-top: 4px; }

  /* ── Section headings ── */
  .section-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    background: #1a73e8;
    padding: 8px 14px;
    border-radius: 6px;
    margin-bottom: 10px;
    margin-top: 24px;
    page-break-after: avoid;
  }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 4px; }
  th {
    background: #f0f4ff;
    color: #1a1a1a;
    font-weight: 700;
    text-align: left;
    padding: 7px 10px;
    border: 1px solid #d0d7e8;
    white-space: nowrap;
  }
  td {
    padding: 6px 10px;
    border: 1px solid #e8e8e8;
    vertical-align: top;
    color: #333;
  }
  tr:nth-child(even) td { background: #f9f9f9; }
  tr.flag-amber td { background: #fff8e1 !important; border-left: 3px solid #e37400; }
  tr.flag-red td { background: #fce8e6 !important; border-left: 3px solid #c5221f; }

  /* ── Empty states ── */
  .empty { font-style: italic; color: #999; padding: 8px 2px; font-size: 10px; }

  /* ── Footer ── */
  .report-footer {
    margin-top: 32px;
    border-top: 1px solid #e0e0e0;
    padding-top: 10px;
    font-size: 9px;
    color: #999;
    display: flex;
    justify-content: space-between;
  }

  /* ── Print ── */
  @media print {
    body { padding: 16px 20px; }
    .section-heading { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .stat { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr.flag-amber td, tr.flag-red td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div class="report-header">
  <h1>CEO Weekly Activity Report</h1>
  <div class="org">${esc(data.orgName)}</div>
  <div class="meta">
    Period: <strong>${esc(data.periodLabel)}</strong>
    &nbsp;&nbsp;|&nbsp;&nbsp;
    Generated: ${esc(data.generatedAt)}
    &nbsp;&nbsp;|&nbsp;&nbsp;
    By: ${esc(data.generatedBy)}
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <em>Confidential — Management use only</em>
  </div>
</div>

<div class="section-heading">📊 Summary</div>
${summaryHTML}

<div class="section-heading">📋 New Registrations This Period</div>
${regsTable}

<div class="section-heading">📅 New Bookings This Period</div>
${bookingsTable}

<div class="section-heading">✅ Attendance by Centre</div>
${attendanceTable}

<div class="section-heading">⚠️ Pending Actions — Staff Accountability</div>
${pendingTable}

<div class="report-footer">
  <span>${esc(data.orgName)} — CEO Weekly Report — ${esc(data.periodLabel)}</span>
  <span>Confidential</span>
</div>

</body>
</html>`;
}
