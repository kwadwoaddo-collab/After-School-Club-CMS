'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Code, Eye, Laptop, Smartphone, HelpCircle, ArrowRight, Share2, ClipboardList, Calendar } from 'lucide-react';

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

    // Formulate links based on the active tab
    const getShareLink = () => {
        const prefix = activeTab === 'booking' ? 'b' : 'r';
        return selectedCentre
            ? `${baseUrl}/${prefix}/${organisation.slug}/${selectedCentre}`
            : `${baseUrl}/${prefix}/${organisation.slug}`;
    };

    const shareLink = getShareLink();

    // Default Iframe Heights
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

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight">Share Portals & Embed Codes</h1>
                <p className="text-sm text-[#8c909f] mt-1">
                    Get custom links or embeddable code to easily connect parent forms to your website.
                </p>
            </div>

            {/* Portal Tab Switcher */}
            <div className="flex bg-[#13151a] p-1.5 rounded-2xl border border-white/5 max-w-md">
                <button
                    onClick={() => { setActiveTab('booking'); setSelectedCentre(centres?.length === 1 ? centres[0].slug : ''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                        activeTab === 'booking'
                            ? 'bg-[#adc6ff] text-slate-950 shadow-md font-extrabold'
                            : 'text-[#8c909f] hover:text-white hover:bg-white/5'
                    }`}
                >
                    <Calendar className="w-4 h-4" />
                    Booking Portal
                </button>
                <button
                    onClick={() => { setActiveTab('registration'); setSelectedCentre(centres?.length === 1 ? centres[0].slug : ''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                        activeTab === 'registration'
                            ? 'bg-[#adc6ff] text-slate-950 shadow-md font-extrabold'
                            : 'text-[#8c909f] hover:text-white hover:bg-white/5'
                    }`}
                >
                    <ClipboardList className="w-4 h-4" />
                    Registration Form
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Setup Card */}
                    <div className="bg-[#1a1c23] border border-[#424754]/15 rounded-3xl p-6 space-y-6 shadow-xl">
                        <div className="flex items-center gap-2 pb-4 border-b border-white/5">
                            <Share2 className="w-5 h-5 text-[#adc6ff]" />
                            <h2 className="text-lg font-bold text-white">
                                {activeTab === 'booking' ? 'Booking Portal Setup' : 'Registration Form Setup'}
                            </h2>
                        </div>

                        {/* Centre selection filter */}
                        {centres.length > 1 && (
                            <div>
                                <label className="block text-xs font-bold text-[#8c909f] uppercase tracking-wider mb-2">
                                    Target Centre Link
                                </label>
                                <select
                                    value={selectedCentre}
                                    onChange={(e) => setSelectedCentre(e.target.value)}
                                    className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#adc6ff]/40 transition-colors"
                                >
                                    <option value="">All Centres (Shows selector to parents)</option>
                                    {centres.map(c => (
                                        <option key={c.id} value={c.slug}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Direct Link Section */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-[#8c909f] uppercase tracking-wider">
                                Direct Link Url
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={shareLink}
                                    readOnly
                                    className="flex-1 h-11 px-4 rounded-xl bg-[#14161b] border border-white/10 text-[#adc6ff] font-mono text-xs focus:outline-none"
                                />
                                <button
                                    onClick={handleCopyLink}
                                    className="h-11 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all flex items-center justify-center gap-1.5 text-xs font-bold"
                                >
                                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                    {copiedLink ? 'Copied' : 'Copy'}
                                </button>
                                <a
                                    href={shareLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="h-11 w-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all flex items-center justify-center"
                                    title="Open portal in new tab"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>

                        {/* Embed Options Section */}
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold text-[#8c909f] uppercase tracking-wider">
                                    Embed Code (iFrame)
                                </label>
                                <div className="flex items-center gap-1">
                                    {(['small', 'medium', 'large', 'custom'] as const).map(size => (
                                        <button
                                            key={size}
                                            onClick={() => setEmbedSize(size)}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                                embedSize === size
                                                    ? 'bg-[#adc6ff]/10 border border-[#adc6ff]/20 text-[#adc6ff]'
                                                    : 'bg-white/5 text-[#8c909f] border border-transparent hover:text-white'
                                            }`}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {embedSize === 'custom' && (
                                <div className="flex items-center gap-3 p-3 bg-[#14161b] rounded-2xl border border-white/5 animate-in fade-in duration-200">
                                    <span className="text-xs text-[#8c909f] font-semibold">Iframe Height (pixels):</span>
                                    <input
                                        type="number"
                                        value={customHeight}
                                        onChange={(e) => setCustomHeight(e.target.value)}
                                        className="w-24 h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-bold text-center"
                                        min="200"
                                        max="3000"
                                    />
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <textarea
                                    value={embedCode}
                                    readOnly
                                    rows={2}
                                    className="flex-1 p-3 rounded-xl bg-[#14161b] border border-white/10 text-white/60 font-mono text-[10px] focus:outline-none resize-none"
                                />
                                <button
                                    onClick={handleCopyEmbed}
                                    className="h-11 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all flex items-center justify-center gap-1.5 text-xs font-bold self-end"
                                >
                                    {copiedEmbed ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                    {copiedEmbed ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                        </div>

                        {/* Embed Preview Toggle */}
                        <div className="pt-2">
                            <button
                                onClick={() => setShowPreview(!showPreview)}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all"
                            >
                                <Eye className="w-4 h-4" />
                                {showPreview ? 'Hide Embed Preview' : 'Show Embed Preview'}
                            </button>
                        </div>
                    </div>

                    {/* Embed Preview Box */}
                    {showPreview && (
                        <div className="bg-[#14161b] rounded-3xl border border-white/5 overflow-hidden shadow-2xl animate-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center justify-between px-6 py-4 bg-[#1a1c23] border-b border-white/5">
                                <div className="flex items-center gap-2 text-white/50">
                                    <Laptop className="w-4 h-4" />
                                    <Smartphone className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Embed Preview Frame</span>
                                </div>
                                <span className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded-md font-mono">{iframeHeight}px</span>
                            </div>
                            <div className="p-4 bg-slate-900 flex justify-center">
                                <iframe
                                    src={shareLink}
                                    width="100%"
                                    height={iframeHeight}
                                    className="border-0 bg-white rounded-2xl w-full max-w-3xl shadow-lg"
                                    title="Live embed preview"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Instruction / Integration Guides Sidebar */}
                <div className="space-y-6">
                    {/* Flow Steps Card */}
                    <div className="bg-[#1a1c23] border border-[#424754]/15 rounded-3xl p-6 shadow-xl space-y-4">
                        <h3 className="font-bold text-white text-sm uppercase tracking-wider border-b border-white/5 pb-2">
                            How it works
                        </h3>
                        <ol className="space-y-3">
                            {steps.map((step, i) => (
                                <li key={i} className="flex gap-3 text-xs leading-relaxed text-[#c2c6d6]">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#adc6ff]/10 text-[#adc6ff] flex items-center justify-center font-bold text-[10px]">
                                        {i + 1}
                                    </span>
                                    <span>{step}</span>
                                </li>
                            ))}
                        </ol>
                    </div>

                    {/* Website Embed Guides Accordion */}
                    <div className="bg-[#1a1c23] border border-[#424754]/15 rounded-3xl p-6 shadow-xl space-y-4">
                        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                            <Code className="w-4 h-4 text-[#adc6ff]" />
                            <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                                Platform Embed Guides
                            </h3>
                        </div>

                        <div className="space-y-2">
                            {[
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
                                        'Select "Embed Code" -> "Embed HTML / IFrame".',
                                        'Paste the embed code into the block properties.',
                                        'Adjust boundaries as needed and publish.'
                                    ]
                                },
                                {
                                    platform: 'Shopify',
                                    icon: '🛍️',
                                    steps: [
                                        'Navigate to Online Store -> Pages.',
                                        'Edit or create a new page.',
                                        'Click the "<>" (Show HTML) toggle button.',
                                        'Paste the embed code where appropriate.',
                                        'Save the page and view live.'
                                    ]
                                }
                            ].map(p => (
                                <details key={p.platform} className="group border border-[#424754]/15 rounded-xl overflow-hidden transition-all duration-200">
                                    <summary className="px-4 py-3 cursor-pointer hover:bg-white/5 font-semibold text-xs text-white/70 hover:text-white flex items-center justify-between outline-none">
                                        <span>{p.icon} {p.platform}</span>
                                        <span className="text-white/30 group-open:rotate-180 transition-transform text-[10px]">▼</span>
                                    </summary>
                                    <div className="px-4 py-3 bg-[#14161b] border-t border-[#424754]/15 text-[11px] leading-relaxed text-[#8c909f] space-y-1.5">
                                        {p.steps.map((s, idx) => (
                                            <div key={idx} className="flex gap-1.5">
                                                <span className="font-bold text-white/30">{idx + 1}.</span>
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
