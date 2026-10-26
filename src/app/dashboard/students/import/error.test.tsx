import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.stubGlobal('React', React);
import ImportError from './error';
describe('import recovery boundary', () => {
  it('keeps unexpected server details private and links to saved lists', () => {
    const html = renderToStaticMarkup(<ImportError error={new Error('postgres secret_constraint user@example.com')} reset={vi.fn()} />);
    expect(html).not.toContain('secret_constraint');
    expect(html).not.toContain('user@example.com');
    expect(html).toContain('Some records may have been saved');
    expect(html).toContain('href="/dashboard/students"');
    expect(html).toContain('href="/dashboard/parents"');
    expect(html).toContain('Reload import page');
  });
});
