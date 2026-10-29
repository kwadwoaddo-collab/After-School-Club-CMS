// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {ParentBillingSection,type ParentBillingGroup} from './ParentBillingSection';
const mocks=vi.hoisted(()=>({card:vi.fn(),generate:vi.fn(),refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:mocks.refresh})}));
vi.mock('next/link',()=>({default:({children,...props}:React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>)=><a {...props}>{children}</a>}));
vi.mock('./BillingSettingsCard',()=>({default:(props:unknown)=>{mocks.card(props);return <div>Billing settings form</div>;}}));
vi.mock('@/features/billing/actions',()=>({generateInvoiceFromConfig:mocks.generate}));
const child={id:'child-a',firstName:'Ada',lastName:'Example'};
const group=(centreId='centre-a',configured=false):ParentBillingGroup=>({centreId,centreName:centreId==='centre-a'?'Sydenham':'Dagenham',siblings:[child,{id:'child-b',firstName:'Ben',lastName:'Example'}],config:configured?{id:`config-${centreId}`,parentId:'parent-a',centreId,agreedMonthlyPence:120000,billingAnchorDate:'2026-10-20',billingEndDate:null,invoiceLeadDays:7,leadTimeUnit:'DAYS',leadTimeValue:7,status:'active',notes:null,coveredChildren:[{childId:'child-a',childName:'Ada Example'},{childId:'child-b',childName:'Ben Example'}]}:null});
const props={parentId:'parent-a',orgId:'org-a',familyName:'Example family',parentEmail:'family@example.test'};
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));});
afterEach(()=>{cleanup();vi.clearAllMocks();vi.useRealTimers();});
describe('direct family billing entry',()=>{
 it('opens the single-centre setup with both siblings and one family scope without generating an invoice',()=>{
  render(<ParentBillingSection {...props} groups={[group()]} openSetup/>);
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(mocks.card).toHaveBeenLastCalledWith(expect.objectContaining({parentId:'parent-a',orgId:'org-a',centreId:'centre-a',siblings:group().siblings,existingConfig:null,startEditing:true,familySurface:true}));
  expect(screen.getByRole('link',{name:'Ada Example'}).getAttribute('href')).toBe('/dashboard/students/child-a');
  expect(screen.queryByRole('button',{name:/draft invoice/i})).toBeNull();
  expect(mocks.generate).not.toHaveBeenCalled();
 });
 it('requires a centre choice and passes only that centre’s sibling list',()=>{
  const other={...group('centre-b'),siblings:[{id:'child-c',firstName:'Cal',lastName:'Example'}]};
  render(<ParentBillingSection {...props} groups={[group(),other]} openSetup/>);
  expect(mocks.card).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'centre-b'}});
  expect(mocks.card).toHaveBeenLastCalledWith(expect.objectContaining({centreId:'centre-b',siblings:other.siblings,startEditing:true}));
  expect(screen.queryByRole('link',{name:'Ada Example'})).toBeNull();
  expect(screen.getByRole('link',{name:'Cal Example'})).toBeTruthy();
  expect(mocks.generate).not.toHaveBeenCalled();
 });
 it.each(['active','paused','cancelled'] as const)('preserves an existing %s plan with zero current siblings',status=>{
  const existing=group('centre-a',true);existing.siblings=[];existing.config!.status=status;
  render(<ParentBillingSection {...props} groups={[existing]} openSetup/>);
  expect(mocks.card).toHaveBeenLastCalledWith(expect.objectContaining({childId:'',siblings:[],existingConfig:existing.config,startEditing:false}));
  expect(mocks.generate).not.toHaveBeenCalled();
 });
 it('renders an actionable explanation rather than an empty setup form when no centres are eligible',()=>{
  render(<ParentBillingSection {...props} groups={[]} openSetup/>);
  expect(screen.getByText(/No students with an assigned, accessible centre/)).toBeTruthy();
  expect(mocks.card).not.toHaveBeenCalled();expect(mocks.generate).not.toHaveBeenCalled();
 });
 it('opens the existing draft review modal only on request and creates no draft merely by opening it',()=>{
  render(<ParentBillingSection {...props} groups={[group('centre-a',true)]}/>);
  expect(screen.queryByText('Generate Draft Invoice')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Review first draft invoice'}));
  expect(screen.getByText('Generate Draft Invoice')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Generate Draft'})).toBeTruthy();
  expect(mocks.generate).not.toHaveBeenCalled();
 });
 it.each(['paused','cancelled'] as const)('does not offer invoice preparation for a %s plan',status=>{
  const existing=group('centre-a',true);existing.config!.status=status;
  render(<ParentBillingSection {...props} groups={[existing]}/>);
  expect(screen.queryByRole('button',{name:/draft invoice/i})).toBeNull();
  expect(mocks.generate).not.toHaveBeenCalled();
 });
});
