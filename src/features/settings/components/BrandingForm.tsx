'use client';
import { logger } from '@/lib/logger';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { Upload, Palette, Save, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BrandingFormProps {
    initialColor: string;
    logoUrl?: string | null;
}

export default function BrandingForm({ initialColor, logoUrl }: BrandingFormProps) {
    const router = useRouter();
    const [primaryColor, setPrimaryColor] = useState(initialColor);
    const { toast } = useToast();
    const [logoPreview, setLogoPreview] = useState<string | null>(logoUrl || null);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState('');

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveSuccess(false);
        setSaveError('');
 
        try {
            const response = await fetch('/api/branding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ primaryColor }),
            });
 
            if (!response.ok) {
                throw new Error('Failed to save branding');
            }
 
            setSaveSuccess(true);
            toast({ title: 'Success', message: 'Branding settings saved successfully!', variant: 'success' });
 
            // Refresh the page to show updated branding
            router.refresh();
 
            // Hide success message after 3 seconds
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            logger.error('Save error:', error);
            const errMsg = 'Failed to save branding settings. Please try again.';
            setSaveError(errMsg);
            toast({ title: 'Error', message: errMsg, variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const presetColors = [
        { name: 'Primary Blue', value: '#136dec' },
        { name: 'Purple', value: '#8b5cf6' },
        { name: 'Cyan', value: '#06b6d4' },
        { name: 'Emerald', value: '#10b981' },
        { name: 'Rose', value: '#f43f5e' },
        { name: 'Amber', value: '#f59e0b' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Tab Header — Milestone 3J Defect 6: removed ArrowLeft/Link back button.
                BrandingForm is an embedded tab within /dashboard/settings, not a
                standalone page. The back button navigated to the page the user was
                already on, creating a confusing UX loop. */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-text tracking-tight">
                        Branding &amp; Customisation
                    </h2>
                    <p className="text-text-muted text-sm font-medium mt-1">
                        Customise your organisation’s logo and brand colours
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 min-h-11 sm:min-h-10 bg-accent rounded-md text-sm font-semibold text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saveSuccess ? (
                        <>
                            <CheckCircle2 className="w-4 h-4" />
                            Saved!
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </>
                    )}
                </button>
            </div>

            {saveSuccess && (
                <div className="rounded-xl p-4 bg-success/10 border border-success/20">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-success" />
                        <p className="text-sm font-semibold text-success">
                            Theme preferences saved
                        </p>
                    </div>
                </div>
            )}

            {saveError && (
                <div className="rounded-xl p-4 bg-red-500/10 border border-red-500/20">
                    <p className="text-sm font-semibold text-red-600">{saveError}</p>
                </div>
            )}

            <div className="grid grid-cols-1 max-w-2xl gap-8">
                {/* Brand Colours Section */}
                <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 flex flex-col gap-6 shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-accent-amber/10 rounded-lg flex items-center justify-center">
                            <Palette className="w-5 h-5 text-accent-amber" />
                        </div>
                        <h2 className="text-xl font-bold text-text">Brand Colours</h2>
                    </div>

                    <div className="space-y-6">
                        {/* Current Color */}
                        <div>
                            <label htmlFor="brand-color-picker" className="block text-sm font-semibold text-text mb-3">
                                Primary colour
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    id="brand-color-picker"
                                    type="color"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="w-14 h-14 rounded-lg cursor-pointer border-2 border-border bg-page"
                                />
                                <div className="flex-1">
                                    <label htmlFor="brand-color-hex" className="sr-only">Brand colour hex code</label>
                                    <input
                                        id="brand-color-hex"
                                        type="text"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="w-full px-4 py-2.5 min-h-11 sm:min-h-10 bg-page border border-border rounded-md font-mono text-sm text-text outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Preset Colours */}
                        <div>
                            <label className="block text-sm font-semibold text-text mb-3">
                                Preset colours
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {presetColors.map((color) => (
                                    <button
                                        key={color.value}
                                        type="button"
                                        onClick={() => setPrimaryColor(color.value)}
                                        className={`p-3 min-h-11 rounded-lg border-2 transition-all ${primaryColor === color.value
                                            ? 'border-accent bg-accent-soft shadow-xs'
                                            : 'border-border hover:border-border-subtle bg-page text-text-muted'
                                            }`}
                                    >
                                        <div
                                            className="w-full h-6 rounded-md mb-2"
                                            style={{ backgroundColor: color.value }}
                                        />
                                        <p className="text-xs font-medium text-text-secondary truncate">
                                            {color.name}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="mt-6 p-5 rounded-xl bg-page border border-border">
                            <p className="text-sm font-semibold text-text mb-3">Preview</p>
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    className="w-full px-5 py-2.5 min-h-11 sm:min-h-10 rounded-md text-sm font-semibold text-white transition-colors"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    Primary button
                                </button>
                                <div
                                    className="p-3.5 rounded-md"
                                    style={{ backgroundColor: `${primaryColor}15` }}
                                >
                                    <p className="text-sm font-medium" style={{ color: primaryColor }}>
                                        Accent highlight
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
