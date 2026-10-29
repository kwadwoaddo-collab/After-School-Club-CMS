// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
const m=vi.hoisted(()=>({generate:vi.fn(),success:vi.fn()}));
vi.mock('@/features/billing/actions',()=>({generateFamilyDraftInvoice:m.generate}));
vi.mock('next/link',()=>({default:({children,...props}:React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>)=><a {...props}>{children}</a>}));
import GenerateInvoiceModal from './GenerateInvoiceModal';
const props={configId:'config',familyName:'Example family',parentEmail:'example@example.test',coveredChildren:[{childId:'held',childName:'Held Example'},{childId:'eligible',childName:'Ready Example'}],amountPence:180000,periodLabel:'Current period',invoiceDateStr:'2026-10-29',dueDateStr:'2026-10-22',periodStartStr:'2026-10-22',periodEndStr:'2026-11-21',onClose:vi.fn(),onSuccess:m.success};
afterEach(()=>{cleanup();vi.clearAllMocks();vi.useRealTimers();});
function setup(){vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));return render(<GenerateInvoiceModal {...props}/>);}
describe('draft generation recovery',()=>{
 it('keeps the fee and notes and links directly to the blocked student without claiming success',async()=>{m.generate.mockResolvedValue({ok:false,problem:{title:'Review enrolment before creating this draft',message:'Review pause/restart history and fee dates.',reviewEnrolment:true,childIds:['held']}});setup();fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1700'}});fireEvent.change(screen.getByPlaceholderText(/Reduced for bank holiday/),{target:{value:'Keep this note'}});fireEvent.click(screen.getByRole('button',{name:'Generate Draft'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Review enrolment'));expect(screen.getByRole('link',{name:'Review Held Example'}).getAttribute('href')).toContain('/students/held#enrolment-follow-up');expect(screen.queryByRole('link',{name:'Review Ready Example'})).toBeNull();expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('1700');expect((screen.getByPlaceholderText(/Reduced for bank holiday/) as HTMLTextAreaElement).value).toBe('Keep this note');expect(m.success).not.toHaveBeenCalled();});
 it('replaces redacted transport failures with a safe uncertain-result message',async()=>{m.generate.mockRejectedValue(Error('Minified React error #441 private details'));setup();fireEvent.click(screen.getByRole('button',{name:'Generate Draft'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Draft creation not confirmed'));expect(screen.getByRole('alert').textContent).not.toMatch(/React|441|private/);expect(m.success).not.toHaveBeenCalled();});
 it('calls success only for an acknowledged successful draft',async()=>{m.generate.mockResolvedValue({ok:true,data:{invoiceId:'invoice',alreadyGenerated:false}});setup();fireEvent.click(screen.getByRole('button',{name:'Generate Draft'}));await waitFor(()=>expect(m.success).toHaveBeenCalledOnce());});
});
