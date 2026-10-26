// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WeeklyReportTab from '@/app/dashboard/reports/WeeklyReportTab';
const mocks = vi.hoisted(()=>({getWeeklyReport:vi.fn(),generateCEOReportPDF:vi.fn()}));
vi.mock('@/features/reports/weekly-report.action',()=>({getWeeklyReport:mocks.getWeeklyReport}));
vi.mock('@/lib/pdf-report',()=>({generateCEOReportPDF:mocks.generateCEOReportPDF}));
vi.mock('next/link',()=>({default:({children,...props}:React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>)=><a {...props}>{children}</a>}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('selects report centre, shows separate financial meanings and preserves scope in PDF data and pending links',async()=>{
    mocks.getWeeklyReport.mockImplementation(async(_start:string,_end:string,centreId:string)=>({
        scope:{centreId,label:centreId==='all'?'All accessible centres':'Centre A',centres:[{id:'centre-a',name:'Centre A'}]},
        startDate:'2026-10-01',endDate:'2026-10-07',periodLabel:'Fixture period',orgName:'Fixture org',generatedBy:'Fixture manager',generatedAt:'Fixture time',
        summary:{newRegistrations:0,newBookings:0,sessionsRun:0,attendanceRate:null,pendingRegistrationsThisPeriod:1,overdueFollowUps:1},
        newRegistrations:[],newBookings:[],attendanceByCentre:[],
        pendingActions:[{type:'overdue_registration',href:'/dashboard/registrations/fixture-id',name:'Fixture student',description:'Review registration',date:'1 Oct',daysPending:4}],
        finance:{cashCollected:'25.00',invoiced:'100.00',draftsPrepared:'150.00'},
    }));
    render(<WeeklyReportTab/>);
    await screen.findByText('Cash collected');
    expect(screen.getByText('£25.00')).toBeTruthy();expect(screen.getByText('£100.00')).toBeTruthy();expect(screen.getByText('£150.00')).toBeTruthy();
    expect(screen.getByRole('link',{name:'Fixture student'}).getAttribute('href')).toBe('/dashboard/registrations/fixture-id');
    fireEvent.change(screen.getByRole('combobox',{name:'Report centre'}),{target:{value:'centre-a'}});
    await waitFor(()=>expect(mocks.getWeeklyReport.mock.calls.at(-1)?.[2]).toBe('centre-a'));
    await screen.findByText('Financial activity · Centre A');
    expect(screen.getByRole('link',{name:'Review outstanding invoices and due dates'}).getAttribute('href')).toContain('centre=centre-a');
    fireEvent.click(screen.getByRole('button',{name:'Download PDF'}));
    await waitFor(()=>expect(mocks.generateCEOReportPDF).toHaveBeenCalledWith(expect.objectContaining({scope:expect.objectContaining({centreId:'centre-a'})})));
});
it('does not render raw server errors or stale financial data after report failure',async()=>{
    mocks.getWeeklyReport.mockRejectedValueOnce(new Error('private query diagnostic'));
    render(<WeeklyReportTab/>);
    await screen.findByText(/We couldn’t load this report/);
    expect(document.body.textContent).not.toContain('private query diagnostic');
    expect(screen.queryByText('Cash collected')).toBeNull();
});
