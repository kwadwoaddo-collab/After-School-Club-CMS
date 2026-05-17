/**
 * Unit tests for the DataTable component.
 *
 * These tests validate the component's prop logic and output structure
 * without needing a DOM – we use React's renderToStaticMarkup as a
 * lightweight assertion helper so we stay within the existing vitest
 * (node environment) test infrastructure.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// We import the types, not the default export, since the component
// uses 'use client' — but renderToStaticMarkup works for SSR output.
import DataTable, { DataTableColumn, DataTableProps } from './DataTable';

/* ------------------------------------------------------------------ */
/*  Test data                                                          */
/* ------------------------------------------------------------------ */

interface TestRow {
  id: string;
  name: string;
  age: number;
}

const sampleData: TestRow[] = [
  { id: '1', name: 'Alice', age: 10 },
  { id: '2', name: 'Bob', age: 12 },
  { id: '3', name: 'Charlie', age: 8 },
];

const columns: DataTableColumn<TestRow>[] = [
  { key: 'name', header: 'Name', render: (r) => r.name },
  { key: 'age', header: 'Age', render: (r) => String(r.age), headerAlign: 'right' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderHTML(props: Partial<DataTableProps<TestRow>> = {}) {
  const merged: DataTableProps<TestRow> = {
    columns,
    data: sampleData,
    rowKey: (r) => r.id,
    ...props,
  };

  return renderToStaticMarkup(React.createElement(DataTable, merged as any));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('DataTable', () => {
  describe('rendering rows', () => {
    it('renders all rows when data is provided', () => {
      const html = renderHTML();
      expect(html).toContain('Alice');
      expect(html).toContain('Bob');
      expect(html).toContain('Charlie');
    });

    it('renders column headers', () => {
      const html = renderHTML();
      expect(html).toContain('Name');
      expect(html).toContain('Age');
    });

    it('renders correct number of <tr> body rows', () => {
      const html = renderHTML();
      // tbody should contain 3 <tr> (one per row)
      const bodyMatch = html.match(/<tbody[^>]*>(.*?)<\/tbody>/s);
      expect(bodyMatch).toBeTruthy();
      const rowMatches = bodyMatch![1].match(/<tr/g);
      expect(rowMatches?.length).toBe(3);
    });
  });

  describe('empty state', () => {
    it('renders default empty state when data is empty', () => {
      const html = renderHTML({ data: [] });
      expect(html).toContain('No data found');
    });

    it('renders custom empty state when provided', () => {
      const html = renderHTML({
        data: [],
        emptyState: React.createElement('div', null, 'Custom empty'),
      });
      expect(html).toContain('Custom empty');
      expect(html).not.toContain('No data found');
    });
  });

  describe('loading state', () => {
    it('renders skeleton rows when isLoading is true', () => {
      const html = renderHTML({ isLoading: true });
      // Should render loadingRows (default 5) skeleton rows
      const bodyMatch = html.match(/<tbody[^>]*>(.*?)<\/tbody>/s);
      expect(bodyMatch).toBeTruthy();
      const skeletonRows = bodyMatch![1].match(/<tr/g);
      expect(skeletonRows?.length).toBe(5);
    });

    it('respects custom loadingRows count', () => {
      const html = renderHTML({ isLoading: true, loadingRows: 3 });
      const bodyMatch = html.match(/<tbody[^>]*>(.*?)<\/tbody>/s);
      const skeletonRows = bodyMatch![1].match(/<tr/g);
      expect(skeletonRows?.length).toBe(3);
    });

    it('loading state takes precedence over data', () => {
      const html = renderHTML({ isLoading: true, data: sampleData });
      // Should NOT render actual data names
      expect(html).not.toContain('Alice');
      expect(html).not.toContain('Bob');
    });
  });

  describe('accessibility', () => {
    it('renders caption when provided', () => {
      const html = renderHTML({ caption: 'Student records' });
      expect(html).toContain('Student records');
      expect(html).toContain('sr-only');
    });

    it('omits caption element when not provided', () => {
      const html = renderHTML();
      expect(html).not.toContain('<caption');
    });
  });

  describe('column alignment', () => {
    it('applies text-right class for right-aligned headers', () => {
      const html = renderHTML();
      // The Age column has headerAlign: 'right'
      expect(html).toContain('text-right');
    });

    it('applies text-left class for left-aligned (default) headers', () => {
      const html = renderHTML();
      expect(html).toContain('text-left');
    });
  });

  describe('cursor and row interaction', () => {
    it('adds cursor-pointer class when onRowClick is provided', () => {
      const html = renderHTML({ onRowClick: () => {} });
      expect(html).toContain('cursor-pointer');
    });

    it('omits cursor-pointer class when onRowClick is not provided', () => {
      const html = renderHTML();
      expect(html).not.toContain('cursor-pointer');
    });
  });

  describe('custom classNames', () => {
    it('passes className to the wrapper', () => {
      const html = renderHTML({ className: 'custom-wrapper' });
      expect(html).toContain('custom-wrapper');
    });

    it('passes tableClassName to the table element', () => {
      const html = renderHTML({ tableClassName: 'custom-table' });
      expect(html).toContain('custom-table');
    });
  });
});
