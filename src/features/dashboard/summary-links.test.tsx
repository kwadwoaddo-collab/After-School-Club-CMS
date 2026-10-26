import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {PgDialect} from 'drizzle-orm/pg-core';
import {children,bookings,registrations} from '@/db/schema';
import {parseSummaryRange,summaryRangeSql,summaryLinks} from './summary-links';
import SummaryRangeNotice from './SummaryRangeNotice';
import {KpiGrid} from '@/components/dashboard/KpiGrid';
vi.mock('next/link',()=>({default:({children,...props}:React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>)=><a {...props}>{children}</a>}));
const from=new Date('2026-10-04T23:00:00.000Z'),to=new Date('2026-10-11T22:59:59.999Z');
describe('dashboard record drilldowns',()=>{
 it('preserves exact instants and selected centre, with all-date joining confirmations',()=>{
  const links=summaryLinks('centre-a',from,to);
  for(const href of [links.students,links.bookings,links.registrations]){const url=new URL(href,'https://example.test');expect(url.searchParams.get('centre')).toBe('centre-a');expect(url.searchParams.get('summaryFrom')).toBe(from.toISOString());expect(url.searchParams.get('summaryTo')).toBe(to.toISOString());}
  expect(links.pending).toBe('/dashboard/registrations?centre=centre-a&status=awaiting_confirmation');
 });
 it.each([['bad','bad'],['2026-10-01','2026-10-02'],[to.toISOString(),from.toISOString()],[['2026-10-01'],to.toISOString()]])('rejects malformed or reversed ranges', (a,b)=>{expect(parseSummaryRange(a,b)).toBeNull();});
 it('uses identical inclusive bounds against the correct date column',()=>{
  const range=parseSummaryRange(from.toISOString(),to.toISOString());expect(range).toEqual({from,to});
  for(const column of [children.createdAt,registrations.createdAt,bookings.startAt]){const query=new PgDialect().sqlToQuery(summaryRangeSql(column,range)!);expect(query.params).toEqual([from.toISOString(),to.toISOString()]);expect(query.sql).toContain('>=');expect(query.sql).toContain('<=');}
  expect(summaryRangeSql(children.createdAt,null)).toBeUndefined();
 });
 it('renders scoped links, honest labels and a removable UK date explanation',()=>{
  const links=summaryLinks('all',from,to),trend={diff:0,text:'0%',type:'neutral' as const};
  const html=renderToStaticMarkup(<KpiGrid studentsActive={3} studentsTotal={8} bookingsActive={2} bookingsTotal={7} registrationsActive={1} registrationsTotal={4} pendingRegistrations={2} studentsTrend={trend} bookingsTrend={trend} registrationsTrend={trend} growthStats={[]} links={links}/>);
  expect(html).toContain('New student records');expect(html).not.toContain('total enrolled');expect(html).toContain('Selected dashboard period');expect(html).toContain('summaryFrom=');expect(html).toContain('Joining confirmations');
  const notice=renderToStaticMarkup(<SummaryRangeNotice range={{from,to}} basis="Bookings scheduled" clearHref="/dashboard/bookings?centre=all"/>);expect(notice).toContain('5 Oct 2026');expect(notice).toContain('11 Oct 2026');expect(notice).toContain('Show all dates');
 });
 it('does not offer people links to a role that cannot access those pages',()=>{
  const trend={diff:0,text:'0%',type:'neutral' as const};const html=renderToStaticMarkup(<KpiGrid canOpenPeople={false} studentsActive={3} studentsTotal={8} bookingsActive={2} bookingsTotal={7} registrationsActive={1} registrationsTotal={4} pendingRegistrations={2} studentsTrend={trend} bookingsTrend={trend} registrationsTrend={trend} growthStats={[]}/>);
  expect(html).toContain('/dashboard/bookings');expect(html).not.toContain('/dashboard/students');expect(html).not.toContain('/dashboard/registrations');
 });
});
