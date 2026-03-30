'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Code, Eye } from 'lucide-react';

interface Organisation {
    id: string;
    name: string;
    slug: string;
    brandColor?: string | null;
}

type EmbedSize = 'small' | 'medium' | 'large' | 'custom';

export default function RegistrationLinkContent({ organisation }: { organisation: Organisation }) {
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedEmbed, setCopiedEmbed] = useState(false);
    const [embedSize, setEmbedSize] = useState<EmbedSize>('large');
    const [customHeight, setCustomHeight] = useState('1100');
    const [showPreview, setShowPreview] = useState(false);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://after-school-club-live.vercel.app';
    const registrationLink = `${baseUrl}/register/${organisation.slug}`;

    const getIframeHeight = () => {
        switch (embedSize) {
            case 'small': return '700';
            case 'medium': return '900';
            case 'large': return '1100';
            case 'custom': return customHeight;
            default: return '1100';
        }
    };

    const embedCode = `<iframe 
  src="${registrationLink}"
  width="100%"
  height="${getIframeHeight()}px"
  frameborder="0"
  style="border: none; border-radius: 8px;"
  loading="lazy"
></iframe>`;

    const responsiveEmbedCode = `<!-- Responsive Registration Form Embed -->
<div style="position: relative; padding-bottom: 120%; height: 0; overflow: hidden; max-width: 100%;">
  <iframe 
    src="${registrationLink}"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 8px;"
    loading="lazy"
  ></iframe>
</div>`;

    const copyToClipboard = async (text: string, type: 'link' | 'embed') => {
        try {
            await navigator.clipboard.writeText(text);
            if (type === 'link') {
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
            } else {
                setCopiedEmbed(true);
                setTimeout(() => setCopiedEmbed(false), 2000);
            }
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Registration Link &amp; Embed Code</h1>
                <p className="text-white mt-2">
                    Add your student registration form to your website with a simple link or embed code
                </p>
            </div>

            {/* Info banner */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex gap-3">
                <span className="text-2xl flex-shrink-0">📋</span>
                <div className="text-sm">
                    <p className="font-semibold text-purple-900 mb-1">How registrations work</p>
                    <p className="text-purple-700">
                        Parents fill in this multi-step form to register their children. Submissions appear in your
                        <strong> Registrations</strong> dashboard as &ldquo;Pending&rdquo; — you can then approve or reject each one.
                        You can customise the terms &amp; conditions in <strong>Settings → Registration</strong>.
                    </p>
                </div>
            </div>

            {/* Direct Link */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Direct Link</h2>
                        <p className="text-sm text-slate-600 mt-1">
                            Use this link on buttons, emails, or social media
                        </p>
                    </div>
                    <a
                        href={registrationLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-2 text-sm font-medium"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Preview
                    </a>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={registrationLink}
                        readOnly
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                        onClick={() => copyToClipboard(registrationLink, 'link')}
                        className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${copiedLink
                            ? 'bg-green-500 text-white'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                            }`}
                    >
                        {copiedLink ? (
                            <><Check className="w-4 h-4" />Copied!</>
                        ) : (
                            <><Copy className="w-4 h-4" />Copy</>
                        )}
                    </button>
                </div>
            </div>

            {/* Embed Code */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Embed Code</h2>
                        <p className="text-sm text-slate-600 mt-1">
                            Paste this code into your website to embed the registration form
                        </p>
                    </div>
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-2 text-sm font-medium"
                    >
                        <Eye className="w-4 h-4" />
                        {showPreview ? 'Hide' : 'Show'} Preview
                    </button>
                </div>

                {/* Size Options */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Embed Size</label>
                    <div className="flex gap-2">
                        {(['small', 'medium', 'large', 'custom'] as EmbedSize[]).map((size) => (
                            <button
                                key={size}
                                onClick={() => setEmbedSize(size)}
                                className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors text-sm ${embedSize === size
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                    {embedSize === 'custom' && (
                        <div className="mt-3">
                            <label className="block text-sm text-slate-600 mb-1">Custom Height (pixels)</label>
                            <input
                                type="number"
                                value={customHeight}
                                onChange={(e) => setCustomHeight(e.target.value)}
                                min="600"
                                max="2500"
                                className="px-4 py-2 border border-slate-200 rounded-lg w-32 text-sm"
                            />
                        </div>
                    )}
                </div>

                {/* Embed Code Display */}
                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-slate-700">Standard Embed</label>
                            <button
                                onClick={() => copyToClipboard(embedCode, 'embed')}
                                className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                            >
                                <Copy className="w-3 h-3" />
                                Copy Code
                            </button>
                        </div>
                        <pre className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                            {embedCode}
                        </pre>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-slate-700">Responsive Embed (Recommended)</label>
                            <button
                                onClick={() => copyToClipboard(responsiveEmbedCode, 'embed')}
                                className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                            >
                                <Copy className="w-3 h-3" />
                                Copy Code
                            </button>
                        </div>
                        <pre className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                            {responsiveEmbedCode}
                        </pre>
                    </div>
                </div>

                {copiedEmbed && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
                        <Check className="w-4 h-4" />
                        Embed code copied to clipboard!
                    </div>
                )}
            </div>

            {/* Preview */}
            {showPreview && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Preview</h2>
                    <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                        <iframe
                            src={registrationLink}
                            width="100%"
                            height={getIframeHeight()}
                            style={{ border: 'none' }}
                            title="Registration Form Preview"
                        />
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                        This is how your registration form will appear when embedded on your website
                    </p>
                </div>
            )}

            {/* Platform Integration Guides */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Platform-Specific Integration Guides</h2>
                <p className="text-sm text-slate-600 mb-4">Click on your website platform below for step-by-step instructions:</p>

                <div className="space-y-3">
                    {[
                        {
                            emoji: '📝', name: 'WordPress',
                            steps: ['Edit the page where you want the registration form', 'Click the + button to add a new block', 'Search for "Custom HTML" or "HTML" block', 'Paste your embed code', 'Click "Preview" to see it working', 'Publish your page']
                        },
                        {
                            emoji: '⬛', name: 'Squarespace',
                            steps: ['Edit your page in Squarespace', 'Click where you want to add the form', 'Click + → Code', 'Paste your embed code in the code box', 'Click "Apply"', 'Save and publish your page']
                        },
                        {
                            emoji: '🔷', name: 'Wix',
                            steps: ['Click + button on the left sidebar', 'Select Embed → HTML iframe', 'Paste your embed code into the code box', 'Adjust size if needed', 'Click "Update"', 'Publish your site']
                        },
                        {
                            emoji: '💻', name: 'Custom HTML Website',
                            steps: ['Open your HTML file', 'Find the location where you want the form', 'Paste the embed code directly into your HTML', 'Save and upload your file']
                        },
                    ].map(({ emoji, name, steps }) => (
                        <details key={name} className="group border border-slate-200 rounded-xl">
                            <summary className="px-4 py-3 cursor-pointer hover:bg-slate-50 font-medium text-slate-900 flex items-center justify-between rounded-xl">
                                <span>{emoji} {name}</span>
                                <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm space-y-2 rounded-b-xl">
                                <p className="font-semibold text-slate-800">Steps:</p>
                                <ol className="list-decimal list-inside space-y-1 text-slate-700">
                                    {steps.map((s, i) => <li key={i}>{s}</li>)}
                                </ol>
                            </div>
                        </details>
                    ))}
                </div>
            </div>

            {/* Quick Start */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-purple-900 mb-3 flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Quick Start
                </h3>
                <ol className="space-y-2 text-sm text-purple-800">
                    <li className="flex gap-2"><span className="font-semibold">1.</span><span>Copy the direct link or embed code above</span></li>
                    <li className="flex gap-2"><span className="font-semibold">2.</span><span>For <strong>direct link</strong>: Add it to any button, email, or social media post</span></li>
                    <li className="flex gap-2"><span className="font-semibold">3.</span><span>For <strong>embed code</strong>: Paste the HTML into your website where you want the form</span></li>
                    <li className="flex gap-2"><span className="font-semibold">4.</span><span>New submissions will appear in <strong>Registrations</strong> as &ldquo;Pending&rdquo; for you to review</span></li>
                    <li className="flex gap-2"><span className="font-semibold">5.</span><span>Set your <strong>Terms &amp; Conditions</strong> in Settings → Registration before going live</span></li>
                </ol>
            </div>
        </div>
    );
}
