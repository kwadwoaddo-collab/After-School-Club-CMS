'use client';

import React, { useState } from 'react';
import { ListTree, ChevronDown, ChevronUp } from 'lucide-react';
import { TOCItem } from '@/lib/help/markdown-renderer';

export default function MobileTOC({ items }: { items: TOCItem[] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <aside
      aria-label="Table of contents"
      className="lg:hidden rounded-xl border border-border bg-surface p-4 shadow-2xs"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text">
          <ListTree className="size-4 text-accent" aria-hidden="true" />
          <span>In this guide</span>
          <span className="font-normal text-text-muted lowercase">({items.length} sections)</span>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent/80 transition-colors py-1 px-2.5 rounded-md hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span>{isOpen ? 'Hide sections' : 'Show sections'}</span>
          {isOpen ? (
            <ChevronUp className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {isOpen && (
        <ul className="mt-3 pt-3 border-t border-border-subtle space-y-1.5 text-xs animate-in fade-in duration-150">
          {items.map(item => (
            <li
              key={item.id}
              className={item.level === 3 ? 'pl-3' : 'font-medium'}
            >
              <a
                href={`#${item.id}`}
                onClick={() => setIsOpen(false)}
                className="text-text-secondary hover:text-accent transition-colors block py-0.5"
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
