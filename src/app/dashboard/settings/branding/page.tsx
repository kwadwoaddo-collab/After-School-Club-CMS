'use client';

import { useState } from 'react';
import { Upload, Palette, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function BrandingPage() {
    const [primaryColor, setPrimaryColor] = useState('#136dec');
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

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
        // TODO: Implement API call to save branding settings
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setSaving(false);
        alert('Branding settings saved! (Note: Full implementation requires backend API)');
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
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                        Branding & Customisation
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Customise your organisation's logo and brand colours
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Logo Upload Section */}
                <div className="glass-card rounded-3xl p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-accent-cyan/10 rounded-2xl flex items-center justify-center">
                            <Upload className="w-5 h-5 text-accent-cyan" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">Organisation Logo</h2>
                    </div>

                    <div className="space-y-4">
                        {/* Logo Preview */}
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                            {logoPreview ? (
                                <div className="space-y-4">
                                    <img
                                        src={logoPreview}
                                        alt="Logo preview"
                                        className="max-w-xs mx-auto max-h-32 object-contain"
                                    />
                                    <p className="text-sm text-slate-500">Preview</p>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Upload className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <p className="text-sm text-slate-600 font-medium">
                                        No logo uploaded yet
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Upload Button */}
                        <label className="block">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="hidden"
                            />
                            <div className="w-full px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-sm font-bold text-slate-700 text-center cursor-pointer transition-all">
                                Choose Logo File
                            </div>
                        </label>

                        <p className="text-xs text-slate-500 text-center">
                            Recommended: PNG or SVG, max 2MB, square aspect ratio
                        </p>
                    </div>
                </div>

                {/* Brand Colours Section */}
                <div className="glass-card rounded-3xl p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-accent-amber/10 rounded-2xl flex items-center justify-center">
                            <Palette className="w-5 h-5 text-accent-amber" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">Brand Colours</h2>
                    </div>

                    <div className="space-y-6">
                        {/* Current Color */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-3">
                                Primary Colour
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="color"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="w-16 h-16 rounded-xl cursor-pointer border-2 border-slate-200"
                                />
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Preset Colours */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-3">
                                Preset Colours
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {presetColors.map((color) => (
                                    <button
                                        key={color.value}
                                        onClick={() => setPrimaryColor(color.value)}
                                        className={`p-4 rounded-xl border-2 transition-all ${primaryColor === color.value
                                            ? 'border-slate-900 shadow-lg'
                                            : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        <div
                                            className="w-full h-8 rounded-lg mb-2"
                                            style={{ backgroundColor: color.value }}
                                        />
                                        <p className="text-xs font-semibold text-slate-600">
                                            {color.name}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="mt-8 p-6 rounded-2xl bg-slate-50 border border-slate-200">
                            <p className="text-sm font-semibold text-slate-700 mb-4">Preview</p>
                            <div className="space-y-3">
                                <button
                                    className="w-full px-6 py-3 rounded-2xl text-sm font-bold text-white transition-all"
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
