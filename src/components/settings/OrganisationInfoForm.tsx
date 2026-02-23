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

    return (
        <div className="glass-card rounded-3xl p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Organisation Information</h3>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-slate-500 mb-1 block">Organisation Name</label>
                    {isEditingName ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                                aria-label="Cancel"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between group">
                            <p className="text-base font-bold text-slate-900">{org.name}</p>
                            <button
                                onClick={() => setIsEditingName(true)}
                                className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                                aria-label="Edit name"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-500 mb-1 block">Slug</label>
                    <p className="text-base font-mono text-slate-900">{org.slug}</p>
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-500 mb-1 block">Booking URL</label>
                    <a
                        href={`${baseUrl}/book/${org.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base text-primary hover:underline font-medium break-all"
                    >
                        {baseUrl}/book/{org.slug}
                    </a>
                </div>
            </div>
        </div>
    );
}
