'use client';

import { useState } from 'react';
import { Pencil, Check, X, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface OrganisationInfoFormProps {
    org: {
        name: string;
        slug: string;
    };
    baseUrl: string;
}

export default function OrganisationInfoForm({ org, baseUrl }: OrganisationInfoFormProps) {
    const router = useRouter();
    const [isEditingName, setIsEditingName] = useState(false);
    const [name, setName] = useState(org.name);
    const [isEditingSlug, setIsEditingSlug] = useState(false);
    const [slug, setSlug] = useState(org.slug);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSaveName = async () => {
        if (!name.trim()) {
            setError('Organisation name cannot be empty');
            return;
        }

        if (name === org.name) {
            setIsEditingName(false);
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const response = await fetch('/api/settings/organisation', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update organisation name');
            }

            setIsEditingName(false);
            router.refresh();
        } catch (err) {
            console.error('Save error:', err);
            setError(err instanceof Error ? err.message : 'Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSlug = async () => {
        const sanitizedSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        
        if (!sanitizedSlug) {
            setError('Slug cannot be empty');
            return;
        }

        if (sanitizedSlug === org.slug) {
            setIsEditingSlug(false);
            return;
        }

        if (!confirm('Changing your slug will break any existing links you have shared with parents. Are you sure?')) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const response = await fetch('/api/settings/organisation', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: sanitizedSlug }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update organisation slug');
            }

            setIsEditingSlug(false);
            router.refresh();
        } catch (err) {
            console.error('Save error:', err);
            setError(err instanceof Error ? err.message : 'Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="glass-card rounded-3xl p-6 !bg-[#1a1c23]/80 !border-[#2a2d35]">
            <h3 className="text-lg font-bold text-white mb-4">Organisation Information</h3>

            {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-slate-400 mb-1 block">Organisation Name</label>
                        {isEditingName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="flex-1 px-3 py-2 bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                    placeholder="Enter organisation name"
                                    autoFocus
                                    disabled={saving}
                                />
                                <button
                                    onClick={handleSaveName}
                                    disabled={saving}
                                    className="p-2 text-white bg-primary hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
                                    aria-label="Save"
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditingName(false);
                                        setName(org.name);
                                        setError(null);
                                    }}
                                    disabled={saving}
                                    className="p-2 text-slate-400 hover:bg-surface-bright rounded-lg transition-colors disabled:opacity-50"
                                    aria-label="Cancel"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between group">
                                <p className="text-base font-bold text-white">{org.name}</p>
                                <button
                                    onClick={() => setIsEditingName(true)}
                                    className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                                    aria-label="Edit name"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-400 mb-1 block flex items-center gap-2">
                            Custom Slug
                            <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20">Short Link ID</span>
                        </label>
                        {isEditingSlug ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                    className="flex-1 px-3 py-2 bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                    placeholder="e.g. sydenham"
                                    autoFocus
                                    disabled={saving}
                                />
                                <button
                                    onClick={handleSaveSlug}
                                    disabled={saving}
                                    className="p-2 text-white bg-primary hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
                                    aria-label="Save"
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditingSlug(false);
                                        setSlug(org.slug);
                                        setError(null);
                                    }}
                                    disabled={saving}
                                    className="p-2 text-slate-400 hover:bg-surface-bright rounded-lg transition-colors disabled:opacity-50"
                                    aria-label="Cancel"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between group">
                                <p className="text-base font-mono text-white font-bold">{org.slug}</p>
                                <button
                                    onClick={() => setIsEditingSlug(true)}
                                    className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                                    aria-label="Edit slug"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <p className="text-[10px] text-slate-500 mt-1">This determines your sharing URLs. Keep it short!</p>
                    </div>
                </div>

                <div className="space-y-4 pt-1 border-l border-outline-variant/10 pl-6">
                    <div>
                        <label className="text-sm font-medium text-slate-400 mb-1 block">Short Booking Link</label>
                        <div className="flex items-center gap-2">
                            <a
                                href={`${baseUrl}/b/${org.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline font-bold break-all"
                            >
                                {baseUrl.replace(/^https?:\/\//, '')}/b/{org.slug}
                            </a>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold uppercase">Active</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-400 mb-1 block">Short Registration Link</label>
                        <div className="flex items-center gap-2">
                            <a
                                href={`${baseUrl}/r/${org.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline font-bold break-all"
                            >
                                {baseUrl.replace(/^https?:\/\//, '')}/r/{org.slug}
                            </a>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold uppercase">Active</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
