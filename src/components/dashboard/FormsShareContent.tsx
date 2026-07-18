'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Code, Eye, Laptop, Smartphone, ArrowRight, Share2, ClipboardList, Calendar, Link2, ChevronDown } from 'lucide-react';

interface Organisation {
    id: string;
    name: string;
    slug: string;
    brandColor?: string | null;
}

interface Centre {
    id: string;
    name: string;
    slug: string;
}

interface Props {
    organisation: Organisation;
    centres: Centre[];
}

type EmbedSize = 'small' | 'medium' | 'large' | 'custom';
type PortalType = 'booking' | 'registration';

export default function FormsShareContent({ organisation, centres }: Props) {
    const [activeTab, setActiveTab] = useState<PortalType>('booking');
    const [selectedCentre, setSelectedCentre] = useState<string>(
        centres?.length === 1 ? centres[0].slug : ''
    );
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedEmbed, setCopiedEmbed] = useState(false);
    const [embedSize, setEmbedSize] = useState<EmbedSize>('large');
    const [customHeight, setCustomHeight] = useState('800');
    const [showPreview, setShowPreview] = useState(false);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://after-school-club-live.vercel.app';

    const getShareLink = () => {
        const prefix = activeTab === 'booking' ? 'b' : 'r';
        return selectedCentre
            ? `${baseUrl}/${prefix}/${organisation.slug}/${selectedCentre}`
            : `${baseUrl}/${prefix}/${organisation.slug}`;
    };

    const shareLink = getShareLink();

    const getIframeHeight = () => {
        if (embedSize === 'custom') return customHeight;
        if (activeTab === 'booking') {
            switch (embedSize) {
                case 'small': return '600';
                case 'medium': return '800';
                case 'large': return '1000';
            }
        } else {
            switch (embedSize) {
                case 'small': return '700';
                case 'medium': return '900';
                case 'large': return '1100';
            }
        }
        return '800';
    };

    const iframeHeight = getIframeHeight();
    const embedCode = `<iframe src="${shareLink}" width="100%" height="${iframeHeight}" frameborder="0" style="border:0; width:100%; min-height:${iframeHeight}px; border-radius:16px; overflow:hidden;" allow="clipboard-write"></iframe>`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareLink);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const handleCopyEmbed = () => {
        navigator.clipboard.writeText(embedCode);
        setCopiedEmbed(true);
        setTimeout(() => setCopiedEmbed(false), 2000);
    };

    const steps = activeTab === 'booking'
        ? [
            'Add the link to any "Book a Session" button on your main website.',
            'Insert it in newsletter updates or emails sent to parents.',
            'Parents click the link, choose their centre, and book sessions instantly.',
            'Confirmed bookings automatically display on your Bookings board.'
        ]
        : [
            'Add the link to a "Register Student" button on your website.',
            'Send it directly to new parents when they request to sign up.',
            'Parents complete the form, filling out student profiles, contacts, and consenting to T&Cs.',
            'New submissions land inside Registrations as "Pending Approval" for you to audit.'
        ];

    const platforms = [
        {
            platform: 'WordPress',
            icon: '📝',
            steps: [
                'Edit your target page in WordPress.',
                'Click the "+" button to add a new block.',
                'Search for and select "Custom HTML".',
                'Paste the iframe embed code inside the block.',
                'Publish or Update your page.'
            ]
        },
        {
            platform: 'Squarespace',
            icon: '⬛',
            steps: [
                'Edit the page where the form should appear.',
                'Click "+" or an insertion point to add a block.',
                'Choose the "Code" block.',
                'Paste the iframe embed code inside.',
                'Save and publish.'
            ]
        },
        {
            platform: 'Wix',
            icon: '🔷',
            steps: [
                'Click the Add (+) button in the editor.',
                'Select "Embed Code" → "Embed HTML / IFrame".',
                'Paste the embed code into the block properties.',
                'Adjust boundaries as needed and publish.'
            ]
        },
        {
            platform: 'Shopify',
            icon: '🛍️',
            steps: [
                'Navigate to Online Store → Pages.',
                'Edit or create a new page.',
                'Click the "<>" (Show HTML) toggle button.',
                'Paste the embed code where appropriate.',
                'Save the page and view live.'
            ]
        }
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">

            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">Share Portals</h1>
                    <p className="text-muted-foreground mt-1">
                        Copy direct links or grab embeddable iFrame codes to put parent forms on any website.
                    </p>
                </div>
            </div>

            {/* ── Portal Type Switcher ─────────────────────────────────── */}
            <div className="inline-flex bg-secondary/60 p-1 rounded-2xl gap-1">
                <button
                    onClick={() => { setActiveTab('booking'); setSelectedCentre(centres?.length === 1 ? centres[0].slug : ''); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        activeTab === 'booking'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Calendar className="w-4 h-4" />
                    Booking Portal
                </button>
                <button
                    onClick={() => { setActiveTab('registration'); setSelectedCentre(centres?.length === 1 ? centres[0].slug : ''); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        activeTab === 'registration'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <ClipboardList className="w-4 h-4" />
                    Registration Form
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* ── Left: Configuration Panel ────────────────────────── */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Setup Card */}
                    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-6">

                        {/* Card title */}
                        <div className="flex items-center gap-2.5 pb-5 border-b border-border">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                                <Share2 className="w-4 h-4 text-blue-600" />
                            </div>
                            <h2 className="text-base font-bold text-foreground">
                                {activeTab === 'booking' ? 'Booking Portal Setup' : 'Registration Form Setup'}
                            </h2>
                        </div>

                        {/* Centre selector */}
                        {centres.length > 1 && (
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Target Centre
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedCentre}
                                        onChange={(e) => setSelectedCentre(e.target.value)}
                                        className="w-full h-11 pl-4 pr-10 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all appearance-none"
                                    >
                                        <option value="">All Centres (Shows selector to parents)</option>
                                        {centres.map(c => (
                                            <option key={c.id} value={c.slug}>{c.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                </div>
                            </div>
                        )}

                        {/* Direct Link URL */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Direct Link URL
                            </label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center gap-2 h-11 pl-3 pr-2 rounded-xl bg-secondary/40 border border-border">
                                    <Link2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                    <input
                                        type="text"
                                        value={shareLink}
                                        readOnly
                                        className="flex-1 bg-transparent text-blue-600 font-mono text-xs focus:outline-none min-w-0"
                                    />
                                </div>
                                <button
                                    onClick={handleCopyLink}
                                    className={`h-11 px-4 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 flex-shrink-0 ${
                                        copiedLink
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                            : 'bg-card border-border text-foreground hover:bg-secondary/40 hover:border-border'
                                    }`}
                                >
                                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiedLink ? 'Copied!' : 'Copy'}
                                </button>
                                <a
                                    href={shareLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="h-11 w-11 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-border transition-all flex items-center justify-center flex-shrink-0"
                                    title="Open portal in new tab"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>

                        {/* Embed Code */}
                        <div className="space-y-3 pt-5 border-t border-border">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Embed Code (iFrame)
                                </label>
                                {/* Size pills */}
                                <div className="flex items-center gap-1">
                                    {(['small', 'medium', 'large', 'custom'] as const).map(size => (
                                        <button
                                            key={size}
                                            onClick={() => setEmbedSize(size)}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
                                                embedSize === size
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                                            }`}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {embedSize === 'custom' && (
                                <div className="flex items-center gap-3 p-3 bg-secondary/40 rounded-xl border border-border animate-in fade-in duration-200">
                                    <span className="text-xs text-muted-foreground font-medium">Iframe Height (px):</span>
                                    <input
                                        type="number"
                                        value={customHeight}
                                        onChange={(e) => setCustomHeight(e.target.value)}
                                        className="w-24 h-8 px-3 rounded-lg bg-card border border-border text-foreground text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                                        min="200"
                                        max="3000"
                                    />
                                </div>
                            )}

                            <div className="flex items-end gap-2">
                                <textarea
                                    value={embedCode}
                                    readOnly
                                    rows={3}
                                    className="flex-1 p-3 rounded-xl bg-secondary/40 border border-border text-muted-foreground font-mono text-[10px] focus:outline-none resize-none leading-relaxed"
                                />
                                <button
                                    onClick={handleCopyEmbed}
                                    className={`h-11 px-4 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 flex-shrink-0 ${
                                        copiedEmbed
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                            : 'bg-card border-border text-foreground hover:bg-secondary/40 hover:border-border'
                                    }`}
                                >
                                    {copiedEmbed ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiedEmbed ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        </div>

                        {/* Preview Toggle */}
                        <div>
                            <button
                                onClick={() => setShowPreview(!showPreview)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/60 border border-border text-foreground text-xs font-semibold transition-all"
                            >
                                <Eye className="w-4 h-4" />
                                {showPreview ? 'Hide Embed Preview' : 'Show Embed Preview'}
                            </button>
                        </div>
                    </div>

                    {/* Embed Preview Box */}
                    {showPreview && (
                        <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden animate-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/40">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Laptop className="w-4 h-4" />
                                    <Smartphone className="w-4 h-4" />
                                    <span className="text-xs font-semibold uppercase tracking-wider">Embed Preview</span>
                                </div>
                                <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-md font-mono">{iframeHeight}px</span>
                            </div>
                            <div className="p-4 bg-secondary/40 flex justify-center">
                                <iframe
                                    src={shareLink}
                                    width="100%"
                                    height={iframeHeight}
                                    className="border-0 bg-card rounded-2xl w-full max-w-3xl shadow-sm"
                                    title="Live embed preview"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Right Sidebar ────────────────────────────────────── */}
                <div className="space-y-5">

                    {/* How It Works Card */}
                    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-foreground tracking-tight border-b border-border pb-3">
                            How It Works
                        </h3>
                        <ol className="space-y-4">
                            {steps.map((step, i) => (
                                <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[11px]">
                                        {i + 1}
                                    </span>
                                    <span>{step}</span>
                                </li>
                            ))}
                        </ol>
                    </div>

                    {/* Platform Embed Guides Card */}
                    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 border-b border-border pb-3">
                            <Code className="w-4 h-4 text-blue-600" />
                            <h3 className="text-sm font-bold text-foreground tracking-tight">
                                Platform Embed Guides
                            </h3>
                        </div>

                        <div className="space-y-2">
                            {platforms.map(p => (
                                <details key={p.platform} className="group rounded-xl overflow-hidden border border-border hover:border-border transition-colors">
                                    <summary className="px-4 py-3 cursor-pointer font-semibold text-sm text-foreground flex items-center justify-between outline-none hover:bg-secondary/40 select-none">
                                        <span className="flex items-center gap-2">
                                            <span>{p.icon}</span>
                                            <span>{p.platform}</span>
                                        </span>
                                        <ChevronDown className="w-4 h-4 text-muted-foreground group-open:rotate-180 transition-transform duration-200" />
                                    </summary>
                                    <div className="px-4 pb-4 pt-2 bg-secondary/40 border-t border-border space-y-2">
                                        {p.steps.map((s, idx) => (
                                            <div key={idx} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                                                <span className="flex-shrink-0 font-bold text-blue-600">{idx + 1}.</span>
                                                <span>{s}</span>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
