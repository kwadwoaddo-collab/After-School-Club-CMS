'use client';

import { useState } from 'react';
import { Pencil, Check, X, AlertCircle, Phone, Mail, MapPin, Link2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ConfirmModal from '../ui/ConfirmModal';

interface OrganisationInfoFormProps {
    org: {
        name: string;
        slug: string;
        contactEmail?: string | null;
        contactPhone?: string | null;
        address?: string | null;
    };
    baseUrl: string;
}

export default function OrganisationInfoForm({ org, baseUrl }: OrganisationInfoFormProps) {
    const router = useRouter();

    // Name
    const [isEditingName, setIsEditingName] = useState(false);
    const [name, setName] = useState(org.name);

    // Slug
    const [isEditingSlug, setIsEditingSlug] = useState(false);
    const [slug, setSlug] = useState(org.slug);
    const [showConfirmSlug, setShowConfirmSlug] = useState(false);
    const [pendingSlug, setPendingSlug] = useState('');

    // Contact details
    const [isEditingContact, setIsEditingContact] = useState(false);
    const [contactEmail, setContactEmail] = useState(org.contactEmail || '');
    const [contactPhone, setContactPhone] = useState(org.contactPhone || '');
    const [address, setAddress] = useState(org.address || '');

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Helpers ────────────────────────────────────────────────────────────────
    const patchOrg = async (payload: Record<string, string>) => {
        const response = await fetch('/api/settings/organisation', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to update');
        }
        return response.json();
    };

    // ── Name ──────────────────────────────────────────────────────────────────
    const handleSaveName = async () => {
        if (!name.trim()) { setError('Organisation name cannot be empty'); return; }
        if (name === org.name) { setIsEditingName(false); return; }
        setSaving(true); setError(null);
        try {
            await patchOrg({ name: name.trim() });
            setIsEditingName(false);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally { setSaving(false); }
    };

    // ── Slug ──────────────────────────────────────────────────────────────────
    const handleSaveSlug = async () => {
        const sanitized = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        if (!sanitized) { setError('Slug cannot be empty'); return; }
        if (sanitized === org.slug) { setIsEditingSlug(false); return; }
        setPendingSlug(sanitized);
        setShowConfirmSlug(true);
    };

    const confirmSaveSlug = async () => {
        setSaving(true); setError(null);
        try {
            await patchOrg({ slug: pendingSlug });
            setIsEditingSlug(false);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally { setSaving(false); setShowConfirmSlug(false); }
    };

    // ── Contact details ───────────────────────────────────────────────────────
    const handleSaveContact = async () => {
        setSaving(true); setError(null);
        try {
            await patchOrg({
                contactEmail: contactEmail.trim(),
                contactPhone: contactPhone.trim(),
                address: address.trim(),
            });
            setIsEditingContact(false);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally { setSaving(false); }
    };

    const cancelContact = () => {
        setContactEmail(org.contactEmail || '');
        setContactPhone(org.contactPhone || '');
        setAddress(org.address || '');
        setIsEditingContact(false);
        setError(null);
    };

    const inputClass = "w-full px-4 py-2.5 bg-[#14161b] border border-[#2a2a2a] rounded-2xl text-sm text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";

    return (
        <>
        <div className="glass-card rounded-3xl p-6 !bg-[#1a1c23]/80 !border-[#2a2d35] space-y-8">
            <h3 className="text-lg font-bold text-white">Organisation Information</h3>

            {error && (
                <div className="p-3 bg-red-900/20 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            {/* ── Row 1: Name + Slug ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name */}
                <div>
                    <label className="text-sm font-medium text-slate-400 mb-1 block">Organisation Name</label>
                    {isEditingName ? (
                        <div className="flex items-center gap-2">
                            <input type="text" value={name} onChange={e => setName(e.target.value)}
                                className={inputClass} placeholder="Organisation name" autoFocus disabled={saving} />
                            <button onClick={handleSaveName} disabled={saving}
                                className="p-2.5 text-white bg-primary hover:bg-blue-600 rounded-2xl transition-all disabled:opacity-50">
                                <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setIsEditingName(false); setName(org.name); setError(null); }} disabled={saving}
                                className="p-2.5 text-slate-400 hover:text-white hover:bg-[#2a2a2a] rounded-2xl transition-all disabled:opacity-50">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between group">
                            <p className="text-base font-bold text-white">{org.name}</p>
                            <button onClick={() => setIsEditingName(true)}
                                className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-all focus:opacity-100">
                                <Pencil className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Slug */}
                <div>
                    <label className="text-sm font-medium text-slate-400 mb-1 flex items-center gap-2">
                        Custom Slug
                        <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20">Short Link ID</span>
                    </label>
                    {isEditingSlug ? (
                        <div className="flex items-center gap-2">
                            <input type="text" value={slug}
                                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                className={`${inputClass} font-mono`} placeholder="e.g. sydenham" autoFocus disabled={saving} />
                            <button onClick={handleSaveSlug} disabled={saving}
                                className="p-2.5 text-white bg-primary hover:bg-blue-600 rounded-2xl transition-all disabled:opacity-50">
                                <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setIsEditingSlug(false); setSlug(org.slug); setError(null); }} disabled={saving}
                                className="p-2.5 text-slate-400 hover:text-white hover:bg-[#2a2a2a] rounded-2xl transition-all disabled:opacity-50">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between group">
                            <p className="text-base font-mono text-white font-bold">{org.slug}</p>
                            <button onClick={() => setIsEditingSlug(true)}
                                className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-all focus:opacity-100">
                                <Pencil className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    <p className="text-[10px] text-slate-500 mt-1">Determines your sharing URLs. Keep it short!</p>
                </div>
            </div>

            {/* ── Divider ──────────────────────────────────────────────────────── */}
            <div className="border-t border-outline-variant/10" />

            {/* ── Row 2: Contact Details ───────────────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Mail className="w-4 h-4 text-primary" /> Contact Details
                    </h4>
                    {!isEditingContact && (
                        <button onClick={() => setIsEditingContact(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                            <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                    )}
                </div>

                {isEditingContact ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Contact Email</label>
                                <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                                    className={inputClass} placeholder="info@yourclub.co.uk" disabled={saving} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Contact Phone</label>
                                <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                                    className={inputClass} placeholder="+44 7700 900000" disabled={saving} />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Address</label>
                            <textarea value={address} onChange={e => setAddress(e.target.value)}
                                className={`${inputClass} resize-none`} rows={2}
                                placeholder="123 High Street, London, SE26 5RX" disabled={saving} />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button onClick={cancelContact} disabled={saving}
                                className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                                Cancel
                            </button>
                            <button onClick={handleSaveContact} disabled={saving}
                                className="px-5 py-2 text-sm font-bold bg-primary text-white rounded-xl hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center gap-2">
                                {saving ? 'Saving…' : 'Save Contact Details'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { icon: Mail, label: 'Email', value: org.contactEmail, placeholder: 'Not set' },
                            { icon: Phone, label: 'Phone', value: org.contactPhone, placeholder: 'Not set' },
                            { icon: MapPin, label: 'Address', value: org.address, placeholder: 'Not set' },
                        ].map(({ icon: Icon, label, value, placeholder }) => (
                            <div key={label} className="bg-white/5 rounded-2xl px-4 py-3">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                                    <Icon className="w-3 h-3" /> {label}
                                </p>
                                <p className={`text-sm font-bold ${value ? 'text-white' : 'text-slate-600 italic'}`}>
                                    {value || placeholder}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Divider ──────────────────────────────────────────────────────── */}
            <div className="border-t border-outline-variant/10" />

            {/* ── Row 3: Links ────────────────────────────────────────────────── */}
            <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                    <Link2 className="w-4 h-4 text-primary" /> Your Sharing Links
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { label: 'Booking Link', path: `/b/${org.slug}` },
                        { label: 'Registration Link', path: `/r/${org.slug}` },
                    ].map(({ label, path }) => (
                        <div key={label} className="bg-white/5 rounded-2xl px-4 py-3">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
                            <a href={`${baseUrl}${path}`} target="_blank" rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline font-bold break-all">
                                {baseUrl.replace(/^https?:\/\//, '')}{path}
                            </a>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <ConfirmModal
            isOpen={showConfirmSlug}
            onClose={() => setShowConfirmSlug(false)}
            onConfirm={confirmSaveSlug}
            title="Change Slug?"
            description="Changing your slug will break any existing links you have shared with parents. Are you sure?"
            confirmText="Change"
            cancelText="Cancel"
            variant="warning"
        />
        </>
    );
}
