import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.stubGlobal('React', React);
import JoiningJourneyGuide from './JoiningJourneyGuide';
describe('joining guidance', () => {
    it('distinguishes intent, received form and explicit joining confirmation', () => {
        const html = renderToStaticMarkup(<JoiningJourneyGuide />);
        expect(html).toContain('Joining requested'); expect(html).toContain('this is not confirmation');
        expect(html).toContain('Form received — awaiting confirmation'); expect(html).toContain('Joining confirmed');
        expect(html).toContain('changes no status automatically');
        expect(html).toContain('/dashboard/registrations?status=awaiting_confirmation');
    });
});
