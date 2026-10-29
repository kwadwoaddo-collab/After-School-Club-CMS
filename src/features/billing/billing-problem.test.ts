import { describe, expect, it, vi } from 'vitest';
import { billingProblem, captureBillingResult } from './billing-problem';

describe('safe billing feedback', () => {
    it('explains the enrolment block with a next step rather than an internal error', () => {
        const problem = billingProblem(new Error('One or more children are invalid or do not belong to this family/centre'));
        expect(problem.code).toBe('ENROLMENT_REVIEW');
        expect(problem.message).toContain('confirmed as enrolled');
        expect(problem.message).toContain('active on the billing start date');
        expect(problem.reviewEnrolment).toBe(true);
    });
    it('maps permission and duplicate-plan validation without disclosing records', () => {
        expect(billingProblem(new Error('Unauthorized: No access to this centre')).message).toContain('Owner or Manager');
        expect(billingProblem(new Error('A billing config already exists for this family at this centre. Use update instead.')).message).toContain('Do not create another plan');
    });
    it('returns safe expected failures without throwing across the server-action boundary', async () => {
        const report = vi.fn();
        const result = await captureBillingResult(async () => { throw new Error('Enter the agreed family fee before billing review'); }, report);
        expect(result).toMatchObject({ok:false,problem:{code:'FEE'}});
        expect(report).not.toHaveBeenCalled();
    });
    it('hides arbitrary framework/database details and records a support reference', async () => {
        const failure = new Error('password=secret SQL constraint /srv/internal/React #441');
        const report = vi.fn(() => 'BILL-reference');
        const result = await captureBillingResult(async () => { throw failure; }, report);
        expect(result).toMatchObject({ok:false,problem:{code:'UNKNOWN',reference:'BILL-reference'}});
        expect(JSON.stringify(result)).not.toMatch(/secret|SQL|\/srv|#441/);
        expect(report).toHaveBeenCalledWith(failure);
        expect(JSON.stringify(result)).toContain('may already have been saved');
    });
    it('does not mask authentication redirects or repeat a mutation', async () => {
        const redirect = Object.assign(new Error('redirect'), {digest:'NEXT_REDIRECT;replace;/login;307;'});
        await expect(captureBillingResult(async()=>{throw redirect;},()=> 'unused')).rejects.toBe(redirect);
        const save = vi.fn().mockResolvedValue({success:true,configId:'config'});
        expect(await captureBillingResult(save,()=> 'unused')).toEqual({ok:true,data:{success:true,configId:'config'}});
        expect(save).toHaveBeenCalledTimes(1);
    });
    it('maps inline enrolment confirmation date, reason and permission validation safely', () => {
        expect(billingProblem(new Error('Enter a valid agreed enrolment start date'))).toMatchObject({ code: 'ENROLMENT_REVIEW', title: 'Enter a valid enrolment start date' });
        expect(billingProblem(new Error('Enrolment start date cannot be after the billing start date'))).toMatchObject({ code: 'ENROLMENT_REVIEW', title: 'Check the enrolment start date' });
        expect(billingProblem(new Error('Enter a confirmation reason between 5 and 1000 characters'))).toMatchObject({ code: 'ENROLMENT_REVIEW', title: 'Enter a reason for enrolment confirmation' });
        expect(billingProblem(new Error('Only an Owner or Manager can confirm student enrolment'))).toMatchObject({ code: 'PERMISSION' });
    });
});
