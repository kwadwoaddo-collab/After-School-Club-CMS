import React from 'react';
import Link from 'next/link';
import {
  Info,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Video,
  ExternalLink,
} from 'lucide-react';

export interface TOCItem {
  id: string;
  title: string;
  level: 2 | 3;
}

/**
 * Generate a deterministic, URL-safe slug for heading anchor IDs.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Strips the redundant document title preamble from markdown:
 * - Leading blank lines
 * - Line 1: # SprintScale CMS ... (document title)
 * - Line 2: ## Subtitle ... (document subtitle, if non-numbered)
 * - Trailing blank lines & separator ---
 * Preserves all substantive section headings (e.g. ## 1. ...) and article introductions.
 */
export function stripDocumentPreamble(markdown: string): string {
  const lines = markdown.split('\n');
  let startIdx = 0;

  // Skip leading blank lines
  while (startIdx < lines.length && !lines[startIdx].trim()) {
    startIdx++;
  }

  // If first non-blank line starts with # , strip it
  if (startIdx < lines.length && lines[startIdx].trim().startsWith('# ')) {
    startIdx++;

    // Skip blank lines
    while (startIdx < lines.length && !lines[startIdx].trim()) {
      startIdx++;
    }

    // If next line starts with ## and is document subtitle (no section number)
    if (startIdx < lines.length && lines[startIdx].trim().startsWith('## ')) {
      const nextLine = lines[startIdx].trim();
      if (!/^##\s+\d+\./.test(nextLine)) {
        startIdx++;
      }
    }

    // Skip blank lines
    while (startIdx < lines.length && !lines[startIdx].trim()) {
      startIdx++;
    }

    // If next line is a horizontal rule ---, skip it
    if (startIdx < lines.length && /^---{1,}$/.test(lines[startIdx].trim())) {
      startIdx++;
    }
  }

  return lines.slice(startIdx).join('\n');
}

/**
 * Extract Table of Contents items (H2 and H3) from raw Markdown.
 * Handles duplicate headings deterministically by suffixing -2, -3, etc.
 */
export function extractTOC(markdown: string): TOCItem[] {
  const cleanContent = stripDocumentPreamble(markdown);
  const lines = cleanContent.split('\n');
  const items: TOCItem[] = [];
  const slugCounts = new Map<string, number>();

  let inCodeBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);

    if (h2Match || h3Match) {
      const rawTitle = (h2Match ? h2Match[1] : h3Match![1]).trim();
      // Strip markdown bold/code from heading text for clean TOC title
      const cleanTitle = rawTitle.replace(/\*\*(.*?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
      const baseSlug = slugify(cleanTitle) || 'section';
      
      const count = slugCounts.get(baseSlug) || 0;
      slugCounts.set(baseSlug, count + 1);
      const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;

      items.push({
        id,
        title: cleanTitle,
        level: h2Match ? 2 : 3,
      });
    }
  }

  return items;
}

/**
 * Inline Markdown Tokenizer & React Element Generator.
 * Supports bold, italic, code spans, links, and text.
 */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // 1. Image ![alt](url)
    const imgMatch = remaining.match(/^!\[(.*?)\]\((.*?)\)/);
    if (imgMatch) {
      const [, alt, src] = imgMatch;
      nodes.push(
        <img
          key={`inline-img-${keyIndex++}`}
          src={src}
          alt={alt}
          className="inline-block max-h-6 align-middle rounded-sm"
          loading="lazy"
        />
      );
      remaining = remaining.slice(imgMatch[0].length);
      continue;
    }

    // 2. Link [text](url)
    const linkMatch = remaining.match(/^\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      const [, linkText, href] = linkMatch;
      const isExternal = href.startsWith('http://') || href.startsWith('https://');
      const isVideo = href.endsWith('.mp4') || href.includes('/videos/');

      if (isVideo) {
        const cleanTitle = linkText.replace(/^Watch:\s*/i, '').trim();
        nodes.push(
          <span
            key={`video-ref-${keyIndex++}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-page border border-border text-text-secondary my-1"
            data-video-target={href}
          >
            <Video className="size-3.5 text-accent shrink-0" aria-hidden="true" />
            <span className="font-semibold text-text">{cleanTitle}</span>
            <span className="text-text-muted text-[11px]">— Available in Training Videos</span>
          </span>
        );
      } else if (isExternal) {
        nodes.push(
          <a
            key={`ext-link-${keyIndex++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent hover:underline font-medium"
          >
            <span>{linkText}</span>
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        );
      } else {
        nodes.push(
          <Link
            key={`int-link-${keyIndex++}`}
            href={href}
            className="text-accent hover:underline font-medium"
          >
            {linkText}
          </Link>
        );
      }
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // 3. Bold **text**
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      nodes.push(
        <strong key={`bold-${keyIndex++}`} className="font-semibold text-text">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 4. Inline code `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      nodes.push(
        <code
          key={`code-${keyIndex++}`}
          className="px-1.5 py-0.5 rounded-md bg-page border border-border text-xs font-mono text-text font-medium"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 5. Italic *text* or _text_
    const italicMatch = remaining.match(/^(\*|_)([^*_]+?)\1/);
    if (italicMatch) {
      nodes.push(
        <em key={`italic-${keyIndex++}`} className="italic text-text-secondary">
          {italicMatch[2]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 6. Plain text segment up to next special character
    const nextSpecial = remaining.search(/[\*`!\[_]/);
    if (nextSpecial === -1) {
      nodes.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      // Just take the single character if no pattern matched
      nodes.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      nodes.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return nodes;
}

/**
 * Server-rendered, safe Markdown article renderer.
 */
export function MarkdownArticle({
  content,
  guideTitle,
}: {
  content: string;
  guideTitle?: string;
}) {
  const cleanContent = stripDocumentPreamble(content);
  const lines = cleanContent.split('\n');
  const elements: React.ReactNode[] = [];
  const slugCounts = new Map<string, number>();

  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Horizontal Rule (---)
    if (/^---{1,}$/.test(trimmed)) {
      elements.push(
        <hr key={`hr-${blockKey++}`} className="my-8 border-border-subtle" />
      );
      i++;
      continue;
    }

    // 2. Fenced Code Block (``` ... ```)
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      elements.push(
        <div key={`codeblock-${blockKey++}`} className="my-5 rounded-xl border border-border bg-page overflow-hidden">
          <pre className="p-4 text-xs font-mono text-text leading-relaxed overflow-x-auto">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 3. Headings (# H1, ## H2, ### H3, #### H4)
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match) {
      // If the guide already has a page-level H1 header, render secondary title or skip if identical
      if (!guideTitle || h1Match[1].trim() !== guideTitle) {
        elements.push(
          <h2
            key={`h1-${blockKey++}`}
            className="text-2xl font-bold tracking-tight text-text mt-8 mb-4 border-b border-border pb-2"
          >
            {renderInline(h1Match[1].trim())}
          </h2>
        );
      }
      i++;
      continue;
    }

    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      const raw = h2Match[1].trim();
      const cleanTitle = raw.replace(/\*\*(.*?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
      const baseSlug = slugify(cleanTitle) || 'section';
      const count = slugCounts.get(baseSlug) || 0;
      slugCounts.set(baseSlug, count + 1);
      const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;

      elements.push(
        <h2
          key={`h2-${blockKey++}`}
          id={id}
          className="text-xl sm:text-2xl font-bold text-text mt-10 mb-4 scroll-mt-24 flex items-center gap-2 group"
        >
          <span>{renderInline(raw)}</span>
        </h2>
      );
      i++;
      continue;
    }

    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      const raw = h3Match[1].trim();
      const cleanTitle = raw.replace(/\*\*(.*?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
      const baseSlug = slugify(cleanTitle) || 'section';
      const count = slugCounts.get(baseSlug) || 0;
      slugCounts.set(baseSlug, count + 1);
      const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;

      elements.push(
        <h3
          key={`h3-${blockKey++}`}
          id={id}
          className="text-base sm:text-lg font-bold text-text mt-7 mb-3 scroll-mt-24"
        >
          {renderInline(raw)}
        </h3>
      );
      i++;
      continue;
    }

    const h4Match = line.match(/^####\s+(.+)$/);
    if (h4Match) {
      elements.push(
        <h4
          key={`h4-${blockKey++}`}
          className="text-sm sm:text-base font-semibold text-text mt-5 mb-2"
        >
          {renderInline(h4Match[1].trim())}
        </h4>
      );
      i++;
      continue;
    }

    // 4. Standalone Image Block (![alt](url))
    const imgBlockMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgBlockMatch) {
      const [, alt, src] = imgBlockMatch;
      // Check if next line is an italic caption like *Figure X — Title*
      let caption: string | null = null;
      if (i + 1 < lines.length && /^\*Figure.*?\*$/.test(lines[i + 1].trim())) {
        caption = lines[i + 1].trim().replace(/^\*|\*$/g, '');
        i++;
      }

      elements.push(
        <figure
          key={`figure-${blockKey++}`}
          className="my-6 rounded-xl border border-border bg-surface p-2.5 shadow-xs overflow-hidden"
        >
          <img
            src={src}
            alt={alt || 'Instructional screenshot'}
            className="w-full h-auto rounded-lg object-contain border border-border-subtle"
            loading="lazy"
          />
          {caption && (
            <figcaption className="text-xs text-text-muted mt-2.5 text-center font-medium">
              {caption}
            </figcaption>
          )}
        </figure>
      );
      i++;
      continue;
    }

    // 5. Blockquote / GitHub Alerts (> [!NOTE], > [!IMPORTANT], > [!WARNING], > [!TIP])
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }

      const firstLine = quoteLines[0] || '';
      const alertMatch = firstLine.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);

      if (alertMatch) {
        const type = alertMatch[1].toUpperCase();
        const contentText = quoteLines.slice(1).join(' ').trim();

        const alertStyles = {
          NOTE: {
            border: 'border-accent/30',
            bg: 'bg-accent-soft/30',
            text: 'text-text',
            icon: <Info className="size-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />,
            label: 'Note',
          },
          TIP: {
            border: 'border-emerald-500/30',
            bg: 'bg-emerald-500/10',
            text: 'text-text',
            icon: <Lightbulb className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />,
            label: 'Tip',
          },
          IMPORTANT: {
            border: 'border-primary/30',
            bg: 'bg-primary/10',
            text: 'text-text',
            icon: <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />,
            label: 'Important',
          },
          WARNING: {
            border: 'border-amber-500/30',
            bg: 'bg-amber-500/10',
            text: 'text-text',
            icon: <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />,
            label: 'Warning',
          },
          CAUTION: {
            border: 'border-rose-500/30',
            bg: 'bg-rose-500/10',
            text: 'text-text',
            icon: <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />,
            label: 'Caution',
          },
        }[type] || {
          border: 'border-border',
          bg: 'bg-page',
          text: 'text-text',
          icon: <Info className="size-4 text-text-muted shrink-0 mt-0.5" aria-hidden="true" />,
          label: 'Notice',
        };

        elements.push(
          <aside
            key={`alert-${blockKey++}`}
            className={`my-5 p-4 rounded-xl border ${alertStyles.border} ${alertStyles.bg} flex items-start gap-3 text-sm leading-relaxed ${alertStyles.text}`}
          >
            {alertStyles.icon}
            <div className="space-y-1">
              <span className="font-semibold text-xs uppercase tracking-wider block">
                {alertStyles.label}
              </span>
              <div>{renderInline(contentText)}</div>
            </div>
          </aside>
        );
      } else {
        elements.push(
          <blockquote
            key={`quote-${blockKey++}`}
            className="my-5 pl-4 border-l-3 border-accent/40 text-text-secondary italic text-sm leading-relaxed"
          >
            {renderInline(quoteLines.join(' '))}
          </blockquote>
        );
      }
      continue;
    }

    // 6. Tables (| Col 1 | Col 2 |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map(cell => cell.trim());
        
        // Skip separator row (tableLines[1])
        const dataRows = tableLines.slice(2).map(row =>
          row
            .split('|')
            .slice(1, -1)
            .map(cell => cell.trim())
        );

        elements.push(
          <div
            key={`table-${blockKey++}`}
            className="my-6 overflow-x-auto rounded-xl border border-border bg-surface shadow-2xs"
          >
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-page/60">
                  {headerRow.map((h, colIdx) => (
                    <th
                      key={`th-${colIdx}`}
                      className="px-4 py-3 font-semibold text-text whitespace-nowrap"
                    >
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {dataRows.map((row, rowIdx) => (
                  <tr
                    key={`tr-${rowIdx}`}
                    className="hover:bg-page/40 transition-colors"
                  >
                    {row.map((cell, cellIdx) => (
                      <td
                        key={`td-${cellIdx}`}
                        className="px-4 py-2.5 text-text-secondary align-top"
                      >
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 7. Unordered Lists and Checklists (- item or * item)
    if (/^[-*]\s+/.test(trimmed)) {
      const listItems: { text: string; isChecklist?: boolean; checked?: boolean }[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        const itemLine = lines[i].trim().replace(/^[-*]\s+/, '');
        const checkMatch = itemLine.match(/^\[([ xX])\]\s+(.*)$/);
        if (checkMatch) {
          listItems.push({
            isChecklist: true,
            checked: checkMatch[1].toLowerCase() === 'x',
            text: checkMatch[2],
          });
        } else {
          listItems.push({ text: itemLine });
        }
        i++;
      }

      elements.push(
        <ul key={`ul-${blockKey++}`} className="my-4 space-y-1.5 pl-5 list-disc text-sm text-text-secondary leading-relaxed marker:text-accent">
          {listItems.map((item, itemIdx) => (
            <li key={`li-${itemIdx}`}>
              {item.isChecklist ? (
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    readOnly
                    className="rounded-xs border-border text-accent focus:ring-accent size-3.5"
                  />
                  <span>{renderInline(item.text)}</span>
                </span>
              ) : (
                renderInline(item.text)
              )}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 8. Ordered Lists (1. item)
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const itemLine = lines[i].trim().replace(/^\d+\.\s+/, '');
        listItems.push(itemLine);
        i++;
      }

      elements.push(
        <ol key={`ol-${blockKey++}`} className="my-4 space-y-2 pl-5 list-decimal text-sm text-text-secondary leading-relaxed marker:font-semibold marker:text-text">
          {listItems.map((item, itemIdx) => (
            <li key={`oli-${itemIdx}`} className="pl-1">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 9. Default: Paragraph
    elements.push(
      <p key={`p-${blockKey++}`} className="text-sm sm:text-base text-text-secondary leading-relaxed my-3">
        {renderInline(trimmed)}
      </p>
    );
    i++;
  }

  return (
    <article className="prose prose-sm sm:prose-base dark:prose-invert max-w-none space-y-2">
      {elements}
    </article>
  );
}
