import {describe,it,expect} from 'vitest';
import {formatInvoiceDate,formatInvoicePeriod,invoiceBalanceLabel} from './invoice-display';
describe('invoice list read-only clarity',()=>{
 it('shows covered period rather than creation date with an unambiguous year',()=>{
  expect(formatInvoicePeriod('2026-11-06','2026-12-05')).toBe('6 Nov – 5 Dec 2026');
  expect(formatInvoicePeriod('2026-12-06','2027-01-05')).toBe('6 Dec 2026 – 5 Jan 2027');
 });
 it('never substitutes created dates for missing coverage',()=>{
  expect(formatInvoicePeriod(null,'2026-12-05')).toBe('Period missing');
  expect(formatInvoicePeriod('2026-12-05','2026-11-06')).toBe('Check period');
  expect(formatInvoiceDate('invalid')).toBe('Not recorded');
 });
 it('keeps due dates in UTC',()=>expect(formatInvoiceDate('2026-11-06T00:00:00Z')).toBe('6 Nov 2026'));
 it('shows exact remaining balance from verified payments only, excluding reversed and pending',()=>{
  expect(invoiceBalanceLabel({amount:'1900.00',status:'sent',payments:[{amount:'1900.00',status:'reversed'},{amount:'100.10',status:'verified'},{amount:'0.20',status:'verified'},{amount:'50.00',status:'pending'}]})).toBe('Remaining £1,799.70');
 });
 it('distinguishes unissued and void records from debt',()=>{
  expect(invoiceBalanceLabel({amount:'1900.00',status:'draft'})).toBe('Not issued');
  expect(invoiceBalanceLabel({amount:'1900.00',status:'void'})).toBe('Void — not due');
 });
 it('shows zero only when verified allocations settle the invoice',()=>{
  expect(invoiceBalanceLabel({amount:'1900.00',status:'paid',payments:[{amount:'1900.00',status:'verified'}]})).toBe('Remaining £0.00');
  expect(invoiceBalanceLabel({amount:'1900.00',status:'paid',payments:[]})).toBe('Check payments');
 });
 it('does not claim a balance where payment data or amounts are unreliable',()=>{
  expect(invoiceBalanceLabel({amount:'100',status:'sent'})).toBe('Check payments');
  expect(invoiceBalanceLabel({amount:'100',status:'sent',payments:[{amount:'25'}]})).toBe('Check payments');
  expect(invoiceBalanceLabel({amount:'100',status:'sent',payments:[{amount:'101',status:'verified'}]})).toBe('Check payments');
  expect(invoiceBalanceLabel({amount:'bad',status:'sent',payments:[]})).toBe('Check amounts');
 });
});
