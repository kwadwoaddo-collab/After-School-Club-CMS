'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyableLinkProps {
    link: string;
}

export function CopyableLink({ link }: CopyableLinkProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const el = document.createElement('textarea');
            el.value = link;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary border border-border">
            <p className="text-xs text-foreground font-mono truncate flex-1 select-all">{link}</p>
            <button
                onClick={handleCopy}
                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-label={copied ? 'Copied!' : 'Copy registration link'}
                title={copied ? 'Copied!' : 'Copy link'}
            >
                {copied
                    ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                    : <Copy className="w-3.5 h-3.5" />
                }
            </button>
        </div>
    );
}
