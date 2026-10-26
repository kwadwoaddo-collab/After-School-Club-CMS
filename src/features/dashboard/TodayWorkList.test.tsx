import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TodayWorkList from './TodayWorkList';
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => <a {...props}>{children}</a> }));
describe('daily work presentation', () => {
    it('prioritises missed calls, retains exact scoped destinations and collapses zero counts', () => {
        const html = renderToStaticMarkup(<TodayWorkList items={[
            {key:'outcomes',title:'Outcomes',description:'Past appointments',count:3,href:'/dashboard/bookings?centre=a&outcome=required'},
            {key:'confirmations',title:'Confirmations',description:'Forms',count:0,href:'/dashboard/registrations?centre=a'},
            {key:'finance',title:'Finance',description:'Check exceptions',count:null,href:'/dashboard/finance?centre=a&task=attention'},
            {key:'overdue',title:'Overdue calls',description:'Missed calls',count:2,href:'/dashboard/students?centre=a&followUp=overdue'},
        ]}/>);
        expect(html.indexOf('Overdue calls')).toBeLessThan(html.indexOf('Outcomes'));
        expect(html).toContain('centre=a&amp;outcome=required');
        expect(html).toContain('1 check with no outstanding items');
        expect(html).toContain('<details'); expect(html).not.toContain('open=""');
        expect(html).toContain('Review');
        expect(html.indexOf('Confirmations')).toBeGreaterThan(html.indexOf('<details'));
    });
    it('does not claim the whole club has nothing outstanding when recorded checks are clear', () => {
        const html = renderToStaticMarkup(<TodayWorkList items={[{key:'today',title:'Calls today',description:'',count:0,href:'/dashboard/students'}]}/>);
        expect(html).toContain('No outstanding items in the checks below.');
        expect(html).not.toContain('all clear');
    });
});
