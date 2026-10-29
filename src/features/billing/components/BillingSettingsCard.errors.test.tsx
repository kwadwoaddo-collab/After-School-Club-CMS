// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks=vi.hoisted(()=>({save:vi.fn(),status:vi.fn(),confirm:vi.fn(),refresh:vi.fn()}));
vi.mock('@/features/billing/actions',()=>({saveFamilyBillingSettings:mocks.save,changeFamilyBillingStatus:mocks.status,confirmFamilyStudentsEnrolment:mocks.confirm}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:mocks.refresh})}));
import Card from './BillingSettingsCard';
import { billingProblem } from '../billing-problem';
const props={childId:'child',parentId:'parent',centreId:'centre',orgId:'org',siblings:[{id:'child',firstName:'Sample',lastName:'Student'}],existingConfig:null};
afterEach(()=>{cleanup();vi.clearAllMocks();});
function fill(container:HTMLElement){
 fireEvent.click(screen.getByRole('button',{name:'Set Up Family Billing'}));
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'200'}});
 fireEvent.change(container.querySelector('input[type="date"]')!,{target:{value:'2026-10-15'}});
}
describe('billing form recovery',()=>{
 it('shows actionable enrolment feedback and retains fee and dates',async()=>{
  mocks.save.mockResolvedValue({ok:false,problem:billingProblem(new Error('One or more children are invalid or do not belong to this family/centre'))});
  const {container}=render(<Card {...props}/>);fill(container);
  fireEvent.click(screen.getByRole('button',{name:'Set Up Billing'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('confirmed as enrolled'));
  expect(screen.getByRole('link',{name:'Review enrolment at top of profile'}).getAttribute('href')).toBe('#main-content');
  expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('200');
  expect((container.querySelector('input[type="date"]') as HTMLInputElement).value).toBe('2026-10-15');
  expect(mocks.refresh).not.toHaveBeenCalled();
 });
 it('does not show redacted React errors or claim nothing was saved after a lost response',async()=>{
  mocks.save.mockRejectedValue(new Error('Minified React error #441; internal details'));
  const {container}=render(<Card {...props}/>);fill(container);
  fireEvent.click(screen.getByRole('button',{name:'Set Up Billing'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Billing change not confirmed'));
  expect(screen.getByRole('alert').textContent).toContain('may already have been saved');
  expect(screen.getByRole('alert').textContent).not.toContain('React');
 });
 it('only refreshes the profile after an acknowledged successful save',async()=>{
  mocks.save.mockResolvedValue({ok:true,data:{success:true,configId:'config'}});
  const {container}=render(<Card {...props}/>);fill(container);
  fireEvent.click(screen.getByRole('button',{name:'Set Up Billing'}));
  await waitFor(()=>expect(mocks.refresh).toHaveBeenCalledTimes(1));
  expect(mocks.save.mock.calls[0][0]).toMatchObject({data:{parentId:'parent',centreId:'centre',agreedMonthlyPence:20000,childIds:['child']}});
 });
 it('allows confirming unconfirmed student enrolment inline on the billing page',async()=>{
  mocks.confirm.mockResolvedValue({ok:true,data:{confirmedChildIds:['child']}});
  const {container}=render(<Card {...props} familySurface startEditing siblings={[{id:'child',firstName:'Sample',lastName:'Student',confirmedEnrolment:false}]}/>);
  expect(screen.getByText('Needs confirmation')).toBeTruthy();
  fireEvent.change(container.querySelector('input[type="date"]')!,{target:{value:'2026-10-15'}});
  const confirmCheckbox = screen.getByRole('checkbox', { name: /Confirm selected student as enrolled/i });
  fireEvent.click(confirmCheckbox);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm enrolment now' }));
  await waitFor(()=>expect(mocks.confirm).toHaveBeenCalledTimes(1));
  expect(mocks.confirm.mock.calls[0][0]).toMatchObject({parentId:'parent',centreId:'centre',childIds:['child'],startDate:'2026-10-15',reason:'Confirmed during family billing setup'});
  expect(screen.getByText('Confirmed')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('Student enrolment confirmed');
 });
 it('allows one-click confirm enrolment & save billing cycle directly from the alert banner',async()=>{
  mocks.save
   .mockResolvedValueOnce({ok:false,problem:billingProblem(new Error('One or more children are invalid or do not belong to this family/centre'))})
   .mockResolvedValueOnce({ok:true,data:{success:true,configId:'config'}});
  const {container}=render(<Card {...props} familySurface/>);
  fireEvent.click(screen.getByRole('button',{name:'Set up billing cycle'}));
  fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'150'}});
  fireEvent.change(container.querySelector('input[type="date"]')!,{target:{value:'2026-10-15'}});
  fireEvent.click(screen.getByRole('button',{name:'Save billing cycle'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Confirm enrolment & save billing cycle'})).toBeTruthy());
  fireEvent.click(screen.getByRole('button',{name:'Confirm enrolment & save billing cycle'}));
  await waitFor(()=>expect(mocks.refresh).toHaveBeenCalledTimes(1));
  expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({
   data:expect.objectContaining({
    parentId:'parent',
    centreId:'centre',
    agreedMonthlyPence:15000,
    billingAnchorDate:'2026-10-15',
    childIds:['child'],
    confirmEnrolment:{confirmed:true,startDate:'2026-10-15',reason:'Confirmed during family billing setup'},
   }),
  }));
 });
});
