import React from 'react';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {FamilyActivityHistory} from './FamilyActivityHistory';
describe('family history presentation',()=>{
 it('starts collapsed, links each child and explains incomplete data',()=>{const html=renderToStaticMarkup(<FamilyActivityHistory unavailable events={[{id:'x',at:'2026-10-01T10:00:00Z',title:'Payment reversed',detail:'Original payment preserved',href:'/dashboard/finance/invoices/inv',children:[{id:'child',name:'Demo Student'}]}]}/>);expect(html).toContain('<details');expect(html).not.toContain('open=""');expect(html).toContain('/dashboard/students/child');expect(html).toContain('Some assessment, registration or follow-up');expect(html).toContain('does not change invoices');});
});
