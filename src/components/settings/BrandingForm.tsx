'use client';

import { useState } from 'react';
import { Upload, Palette, Save, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

interface BrandingFormProps {
    initialColor: string;
    logoUrl?: string | null;
}

export default function BrandingForm({ initialColor, logoUrl }: BrandingFormProps) {
    const router = useRouter();
    const [primaryColor, setPrimaryColor] = useState(initialColor);
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
            toast.success('Branding settings saved successfully!');
 
            // Refresh the page to show updated branding
            router.refresh();
 
            // Hide success message after 3 seconds
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Save error:', error);
            const errMsg = 'Failed to save branding settings. Please try again.';
            setSaveError(errMsg);
            toast.error(errMsg);
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
            {/* Page Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/settings"
                    className="p-2 hover:bg-secondary rounded-2xl transition-all text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">
                        Branding & Customisation
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">
                        Customise your organisation's logo and brand colours
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-foreground hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="glass-card rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <p className="text-sm font-semibold text-emerald-600">
                            Brand color saved successfully!
                        </p>
                    </div>
                </div>
            )}

            {saveError && (
                <div className="glass-card rounded-2xl p-4 bg-red-500/10 border border-red-500/20">
                    <p className="text-sm font-semibold text-red-600">{saveError}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Logo Upload Section */}
                <div className="bg-card border border-border rounded-[32px] p-8 flex flex-col gap-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-accent-cyan/10 rounded-2xl flex items-center justify-center">
                            <Upload className="w-5 h-5 text-accent-cyan" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground">Organisation Logo</h2>
                    </div>

                    <div className="space-y-4">
                        {/* Logo Preview */}
                        <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center bg-secondary/60/30">
                            {logoPreview ? (
                                <div className="space-y-4">
                                    <img
                                        src={logoPreview}
                                        alt="Logo preview"
                                        className="max-w-xs mx-auto max-h-32 object-contain"
                                    />
                                    <p className="text-sm text-muted-foreground">Preview</p>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Upload className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-sm text-muted-foreground font-medium">
                                        No logo uploaded yet
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Upload Button - Disabled */}
                        <div className="w-full px-6 py-3 bg-secondary/60 text-muted-foreground/80 border border-border/40 rounded-2xl text-sm font-bold text-center cursor-not-allowed">
                            Coming Soon
                        </div>

                        <p className="text-xs text-muted-foreground/70 text-center">
                            Logo upload feature launching soon
                        </p>
                    </div>
                </div>

                {/* Brand Colours Section */}
                <div className="bg-card border border-border rounded-[32px] p-8 flex flex-col gap-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-accent-amber/10 rounded-2xl flex items-center justify-center">
                            <Palette className="w-5 h-5 text-accent-amber" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground">Brand Colours</h2>
                    </div>

                    <div className="space-y-6">
                        {/* Current Color */}
                        <div>
                            <label className="block text-sm font-semibold text-foreground mb-3">
                                Primary Colour
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="color"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="w-16 h-16 rounded-2xl cursor-pointer border-2 border-border bg-secondary/60"
                                />
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="w-full px-4 py-3 bg-secondary/60 border border-border rounded-2xl font-mono text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Preset Colours */}
                        <div>
                            <label className="block text-sm font-semibold text-foreground mb-3">
                                Preset Colours
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {presetColors.map((color) => (
                                    <button
                                        key={color.value}
                                        onClick={() => setPrimaryColor(color.value)}
                                        className={`p-4 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${primaryColor === color.value
                                            ? 'border-[#adc6ff] bg-secondary/60 shadow-lg shadow-black/40'
                                            : 'border-border hover:border-border bg-secondary/60/30 text-muted-foreground'
                                            }`}
                                    >
                                        <div
                                            className="w-full h-8 rounded-lg mb-2"
                                            style={{ backgroundColor: color.value }}
                                        />
                                        <p className="text-xs font-semibold text-muted-foreground">
                                            {color.name}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="mt-8 p-6 rounded-2xl bg-secondary/60 border border-border">
                            <p className="text-sm font-semibold text-foreground mb-4">Preview</p>
                            <div className="space-y-3">
                                <button
                                    className="w-full px-6 py-3 rounded-2xl text-sm font-bold text-foreground transition-all hover:scale-[1.01] active:scale-[0.99]"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    Primary Button
                                </button>
                                <div
                                    className="p-4 rounded-xl"
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
