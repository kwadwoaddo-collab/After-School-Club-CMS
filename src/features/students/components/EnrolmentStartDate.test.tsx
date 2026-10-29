// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import EnrolmentStartDate from './EnrolmentStartDate';
const m=vi.hoisted(()=>({refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:m.refresh})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
const props={childId:'child',date:'2025-01-01',version:'version',today:'2026-10-29',canEdit:true};
describe('self-service original start date',()=>{
 it('shows a distinct original start date and hides edit for viewers',()=>{render(<EnrolmentStartDate {...props} canEdit={false}/>);expect(screen.getByText(/1 January 2025/)).toBeTruthy();expect(screen.queryByRole('button',{name:'Edit start date'})).toBeNull();});
 it('opens inline without changing records and explains preserved billing/status',()=>{const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);render(<EnrolmentStartDate {...props}/>);fireEvent.click(screen.getByRole('button',{name:'Edit start date'}));expect(screen.getByLabelText('Actual enrolment start date')).toBeTruthy();expect(screen.getByText(/keeps status history/)).toBeTruthy();expect(fetcher).not.toHaveBeenCalled();});
 it('keeps form open with actionable stale error and does not show success',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,json:async()=>({error:'Reload the profile and review it.'})}));render(<EnrolmentStartDate {...props}/>);fireEvent.click(screen.getByRole('button',{name:'Edit start date'}));fireEvent.change(screen.getByLabelText('Actual enrolment start date'),{target:{value:'2024-12-01'}});fireEvent.change(screen.getByLabelText('Reason for correction'),{target:{value:'Correct original date'}});fireEvent.submit(screen.getByRole('button',{name:'Save start date'}).closest('form')!);await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Reload'));expect(m.refresh).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Save start date'})).toBeTruthy();});
});
