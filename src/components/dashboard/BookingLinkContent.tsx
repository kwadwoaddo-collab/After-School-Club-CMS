'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Code, Eye } from 'lucide-react';

interface Organisation {
    id: string;
    name: string;
    slug: string;
    brandColor?: string;
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

export default function BookingLinkContent({ organisation, centres }: Props) {
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedEmbed, setCopiedEmbed] = useState(false);
    const [selectedCentre, setSelectedCentre] = useState<string>(
        centres.length === 1 ? centres[0].slug : ''
    );
    const [embedSize, setEmbedSize] = useState<EmbedSize>('medium');
    const [customHeight, setCustomHeight] = useState('800');
    const [showPreview, setShowPreview] = useState(false);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://after-school-club-live.vercel.app';

    // Generate booking link
    const bookingLink = selectedCentre
        ? `${baseUrl}/b/${organisation.slug}/${selectedCentre}`
        : `${baseUrl}/b/${organisation.slug}`;

    // Get iframe height based on size
    const getIframeHeight = () => {
        switch (embedSize) {
            case 'small':
                return '600';
            case 'medium':
                return '800';
            case 'large':
                return '1000';
            case 'custom':
                return customHeight;
            default:
                return '800';
        }
    };

    // Generate embed code
    const embedCode = `<iframe 
  src="${bookingLink}"
  width="100%"
  height="${getIframeHeight()}px"
  frameborder="0"
  style="border: none; border-radius: 8px;"
  allow="payment"
  loading="lazy"
></iframe>`;

    // Generate responsive embed code
    const responsiveEmbedCode = `<!-- Responsive Booking Embed -->
<div style="position: relative; padding-bottom: 75%; height: 0; overflow: hidden; max-width: 100%;">
  <iframe 
    src="${bookingLink}"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 8px;"
    allow="payment"
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
                <h1 className="text-3xl font-bold text-slate-900">Booking Link & Embed Code</h1>
                <p className="text-slate-600 mt-2">
                    Add your booking system to your website with a simple link or embed code
                </p>
            </div>

            {/* Centre Selection */}
            {centres.length > 1 && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Select Centre</h2>
                    <div className="space-y-2">
                        <label className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <input
                                type="radio"
                                name="centre"
                                value=""
                                checked={selectedCentre === ''}
                                onChange={(e) => setSelectedCentre(e.target.value)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-slate-700">All Centres (Show centre selector)</span>
                        </label>
                        {centres.map((centre) => (
                            <label
                                key={centre.id}
                                className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                            >
                                <input
                                    type="radio"
                                    name="centre"
                                    value={centre.slug}
                                    checked={selectedCentre === centre.slug}
                                    onChange={(e) => setSelectedCentre(e.target.value)}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-slate-700">{centre.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Direct Link */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Direct Link</h2>
                        <p className="text-sm text-slate-600 mt-1">
                            Use this link on buttons, emails, or social media
                        </p>
                    </div>
                    <a
                        href={bookingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-2"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Preview
                    </a>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={bookingLink}
                        readOnly
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={() => copyToClipboard(bookingLink, 'link')}
                        className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${copiedLink
                            ? 'bg-green-500 text-white'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        {copiedLink ? (
                            <>
                                <Check className="w-4 h-4" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4" />
                                Copy
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Embed Code */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Embed Code</h2>
                        <p className="text-sm text-slate-600 mt-1">
                            Paste this code into your website to embed the booking form
                        </p>
                    </div>
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-2"
                    >
                        <Eye className="w-4 h-4" />
                        {showPreview ? 'Hide' : 'Show'} Preview
                    </button>
                </div>

                {/* Size Options */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Embed Size
                    </label>
                    <div className="flex gap-2">
                        {(['small', 'medium', 'large', 'custom'] as EmbedSize[]).map((size) => (
                            <button
                                key={size}
                                onClick={() => setEmbedSize(size)}
                                className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${embedSize === size
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>

                    {embedSize === 'custom' && (
                        <div className="mt-3">
                            <label className="block text-sm text-slate-600 mb-1">
                                Custom Height (pixels)
                            </label>
                            <input
                                type="number"
                                value={customHeight}
                                onChange={(e) => setCustomHeight(e.target.value)}
                                min="400"
                                max="2000"
                                className="px-4 py-2 border border-slate-200 rounded-lg w-32"
                            />
                        </div>
                    )}
                </div>

                {/* Embed Code Display */}
                <div className="space-y-4">
                    {/* Standard Embed */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-slate-700">Standard Embed</label>
                            <button
                                onClick={() => copyToClipboard(embedCode, 'embed')}
                                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            >
                                <Copy className="w-3 h-3" />
                                Copy Code
                            </button>
                        </div>
                        <pre className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                            {embedCode}
                        </pre>
                    </div>

                    {/* Responsive Embed */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-slate-700">
                                Responsive Embed (Recommended)
                            </label>
                            <button
                                onClick={() => copyToClipboard(responsiveEmbedCode, 'embed')}
                                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
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
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                        <Check className="w-4 h-4" />
                        Embed code copied to clipboard!
                    </div>
                )}
            </div>

            {/* Preview */}
            {showPreview && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Preview</h2>
                    <div className="border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
                        <iframe
                            src={bookingLink}
                            width="100%"
                            height={getIframeHeight()}
                            style={{ border: 'none' }}
                            title="Booking Form Preview"
                        />
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                        This is how your booking form will appear when embedded on your website
                    </p>
                </div>
            )}

            {/* Platform-Specific Guides */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                    Platform-Specific Integration Guides
                </h2>
                <p className="text-sm text-slate-600 mb-4">
                    Click on your website platform below for step-by-step instructions:
                </p>

                <div className="space-y-3">
                    {/* WordPress */}
                    <details className="group border border-slate-200 rounded-lg">
                        <summary className="px-4 py-3 cursor-pointer hover:bg-slate-50 font-medium text-slate-900 flex items-center justify-between">
                            <span>📝 WordPress</span>
                            <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm space-y-2">
                            <p className="font-semibold text-slate-800">Steps:</p>
                            <ol className="list-decimal list-inside space-y-1 text-slate-700">
                                <li>Edit the page where you want the booking form</li>
                                <li>Click the <strong>+</strong> button to add a new block</li>
                                <li>Search for "Custom HTML" or "HTML" block</li>
                                <li>Paste your embed code</li>
                                <li>Click "Preview" to see it working</li>
                                <li>Publish your page</li>
                            </ol>
                        </div>
                    </details>

                    {/* Squarespace */}
                    <details className="group border border-slate-200 rounded-lg">
                        <summary className="px-4 py-3 cursor-pointer hover:bg-slate-50 font-medium text-slate-900 flex items-center justify-between">
                            <span>⬛ Squarespace</span>
                            <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm space-y-2">
                            <p className="font-semibold text-slate-800">Steps:</p>
                            <ol className="list-decimal list-inside space-y-1 text-slate-700">
                                <li>Edit your page in Squarespace</li>
                                <li>Click where you want to add the form</li>
                                <li>Click <strong>+</strong> → <strong>Code</strong></li>
                                <li>Paste your embed code in the code box</li>
                                <li>Click "Apply"</li>
                                <li>Save and publish your page</li>
                            </ol>
                        </div>
                    </details>

                    {/* Wix */}
                    <details className="group border border-slate-200 rounded-lg">
                        <summary className="px-4 py-3 cursor-pointer hover:bg-slate-50 font-medium text-slate-900 flex items-center justify-between">
                            <span>🔷 Wix</span>
                            <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm space-y-2">
                            <p className="font-semibold text-slate-800">Steps:</p>
                            <ol className="list-decimal list-inside space-y-1 text-slate-700">
                                <li>Click <strong>+</strong> button on the left sidebar</li>
                                <li>Select <strong>Embed</strong> → <strong>HTML iframe</strong></li>
                                <li>Paste your embed code into the code box</li>
                                <li>Adjust size if needed</li>
                                <li>Click "Update"</li>
                                <li>Publish your site</li>
                            </ol>
                        </div>
                    </details>

                    {/* Shopify */}
                    <details className="group border border-slate-200 rounded-lg">
                        <summary className="px-4 py-3 cursor-pointer hover:bg-slate-50 font-medium text-slate-900 flex items-center justify-between">
                            <span>🛍️ Shopify</span>
                            <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm space-y-2">
                            <p className="font-semibold text-slate-800">Steps:</p>
                            <ol className="list-decimal list-inside space-y-1 text-slate-700">
                                <li>Go to <strong>Online Store</strong> → <strong>Pages</strong></li>
                                <li>Create a new page or edit an existing one</li>
                                <li>Click <strong>Show HTML</strong> (bottom left)</li>
                                <li>Paste your embed code where you want it</li>
                                <li>Click "Show HTML" again to return to editor</li>
                                <li>Save the page</li>
                            </ol>
                        </div>
                    </details>

                    {/* Custom HTML */}
                    <details className="group border border-slate-200 rounded-lg">
                        <summary className="px-4 py-3 cursor-pointer hover:bg-slate-50 font-medium text-slate-900 flex items-center justify-between">
                            <span>💻 Custom HTML Website</span>
                            <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm space-y-2">
                            <p className="font-semibold text-slate-800">Simply paste the embed code in your HTML file:</p>
                            <pre className="bg-slate-900 text-green-400 p-3 rounded text-xs overflow-x-auto mt-2">
                                {`<div class="booking-container">
  <!-- PASTE YOUR EMBED CODE HERE -->
</div>`}
                            </pre>
                        </div>
                    </details>
                </div>

                {/* Download Guide Button */}
                <div className="mt-6 pt-6 border-t border-slate-200">
                    <p className="text-sm text-slate-600 mb-3">
                        Need more detailed instructions?
                    </p>
                    <a
                        href="/ORGANIZATION_GUIDE.md"
                        download
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                        📥 Download Complete Guide
                    </a>
                </div>
            </div>

            {/* Usage Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Quick Start
                </h3>
                <ol className="space-y-2 text-sm text-blue-800">
                    <li className="flex gap-2">
                        <span className="font-semibold">1.</span>
                        <span>Copy either the direct link or embed code above</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="font-semibold">2.</span>
                        <span>
                            For <strong>direct link</strong>: Add it to any button or link on your website
                        </span>
                    </li>
                    <li className="flex gap-2">
                        <span className="font-semibold">3.</span>
                        <span>
                            For <strong>embed code</strong>: Paste the HTML code into your website where you want
                            the booking form to appear
                        </span>
                    </li>
                    <li className="flex gap-2">
                        <span className="font-semibold">4.</span>
                        <span>Test the booking form to ensure it works correctly</span>
                    </li>
                </ol>
            </div>
        </div>
    );
}
