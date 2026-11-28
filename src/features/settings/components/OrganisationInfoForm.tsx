'use client';
 
import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { Pencil, Check, X, AlertCircle, Phone, Mail, MapPin, Link2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ConfirmModal from '@/components/ui/ConfirmModal';
 
interface OrganisationInfoFormProps {
    org: {
        name: string;
        slug: string;
        subdomain?: string | null;
        contactEmail?: string | null;
        contactPhone?: string | null;
        address?: string | null;
    };
    baseUrl: string;
    isOwner?: boolean;
}
 
export default function OrganisationInfoForm({ org, baseUrl, isOwner = true }: OrganisationInfoFormProps) {
    const router = useRouter();
 
    const [isEditingName, setIsEditingName] = useState(false);
    const { toast } = useToast();
    const [name, setName] = useState(org.name);
 
    const [isEditingSlug, setIsEditingSlug] = useState(false);
    const [slug, setSlug] = useState(org.slug);
    const [showConfirmSlug, setShowConfirmSlug] = useState(false);
    const [pendingSlug, setPendingSlug] = useState('');

    const [isEditingSubdomain, setIsEditingSubdomain] = useState(false);
    const [subdomain, setSubdomain] = useState(org.subdomain || '');
    const [subdomainSaving, setSubdomainSaving] = useState(false);
    const [subdomainError, setSubdomainError] = useState<string | null>(null);
 
    const [isEditingContact, setIsEditingContact] = useState(false);
    const [contactEmail, setContactEmail] = useState(org.contactEmail || '');
    const [contactPhone, setContactPhone] = useState(org.contactPhone || '');
    const [address, setAddress] = useState(org.address || '');
 
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
 
    const patchOrg = async (payload: Record<string, string>) => {
        const res = await fetch('/api/settings/organisation', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const d = await res.json();
            throw new Error(d.error || 'Failed to update');
        }
        return res.json();
    };
 
    const handleSaveName = async () => {
        if (!name.trim()) { setError('Name cannot be empty'); return; }
        if (name === org.name) { setIsEditingName(false); return; }
        setSaving(true); setError(null);
        try { 
            await patchOrg({ name: name.trim() }); 
            setIsEditingName(false); 
            toast({ title: 'Success', message: 'Organisation name updated successfully!', variant: 'success' });
            router.refresh(); 
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setError(message);
            toast({ title: 'Error', message: message || 'Failed to update organisation name', variant: 'error' });
        }
        finally { setSaving(false); }
    };
 
    const handleSaveSlug = () => {
        const s = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        if (!s) { setError('Slug cannot be empty'); return; }
        if (s === org.slug) { setIsEditingSlug(false); return; }
        setPendingSlug(s); setShowConfirmSlug(true);
    };
 
    const confirmSaveSlug = async () => {
        setSaving(true); setError(null);
        try { 
            await patchOrg({ slug: pendingSlug }); 
            setIsEditingSlug(false); 
            toast({ title: 'Success', message: 'Slug updated successfully!', variant: 'success' });
            router.refresh(); 
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setError(message);
            toast({ title: 'Error', message: message || 'Failed to update slug', variant: 'error' });
        }
        finally { setSaving(false); setShowConfirmSlug(false); }
    };

    const handleSaveSubdomain = async () => {
        setSubdomainSaving(true); setSubdomainError(null);
        try {
            await patchOrg({ subdomain: subdomain.trim() || '' });
            setIsEditingSubdomain(false);
            toast({ title: 'Success', message: 'Subdomain updated!', variant: 'success' });
            router.refresh();
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setSubdomainError(message);
            toast({ title: 'Error', message: message || 'Failed to update subdomain', variant: 'error' });
        } finally { setSubdomainSaving(false); }
    };
 
    const handleSaveContact = async () => {
        setSaving(true); setError(null);
        try {
            await patchOrg({ contactEmail: contactEmail.trim(), contactPhone: contactPhone.trim(), address: address.trim() });
            setIsEditingContact(false); 
            toast({ title: 'Success', message: 'Contact details updated successfully!', variant: 'success' });
            router.refresh();
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setError(message);
            toast({ title: 'Error', message: message || 'Failed to update contact details', variant: 'error' });
        }
        finally { setSaving(false); }
    };

    const inp = "w-full px-3 py-2 min-h-11 sm:min-h-9 bg-secondary/60 border border-border rounded-md text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all";

    // Milestone 3J: Removed dead `Field` no-op const (returned null, never called).

    return (
        <>
        <div className="bg-surface border border-border shadow-xs rounded-xl p-5 sm:p-6 space-y-5">
            <h3 className="text-sm font-bold text-text">Organisation Information</h3>

            {!isOwner && (
                <div className="p-3 bg-secondary/40 border border-border rounded-xl text-xs text-text-muted flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-text-muted shrink-0" />
                    <span>Organisation identity settings are managed exclusively by Organisation Owners.</span>
                </div>
            )}

            {error && (
                <div className="p-2.5 bg-red-900/20 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-600 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            {/* Name + Slug */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                    <label htmlFor="org-name" className="text-xs font-medium text-text-muted mb-1.5 block">Organisation Name <span className="text-destructive ml-0.5">*</span></label>
                    {isEditingName ? (
                        <div className="flex gap-2">
                            <input id="org-name" type="text" value={name} onChange={e => setName(e.target.value)}
                                className={inp} autoFocus disabled={saving} />
                            <button type="button" aria-label="Save organisation name" onClick={handleSaveName} disabled={saving}
                                className="p-2 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 flex items-center justify-center text-on-accent bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50">
                                <Check className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" aria-label="Cancel organisation name edit" onClick={() => { setIsEditingName(false); setName(org.name); setError(null); }}
                                className="p-2 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 flex items-center justify-center text-text-muted hover:bg-secondary/60 rounded-md transition-colors">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between group">
                            <span className="text-sm font-bold text-text">{org.name}</span>
                            {isOwner && (
                                <button type="button" aria-label="Edit organisation name" onClick={() => setIsEditingName(true)}
                                    className="p-2.5 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 flex items-center justify-center text-text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-accent transition-colors rounded-md">
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Slug */}
                <div>
                    <label htmlFor="org-slug" className="text-xs font-medium text-text-muted mb-1.5 flex items-center gap-1.5">
                        Slug
                        <span className="text-[10px] bg-warning/10 text-warning px-1 py-0.5 rounded border border-warning/20">URL ID</span>
                    </label>
                    {isEditingSlug ? (
                        <div className="flex gap-2">
                            <input id="org-slug" type="text" value={slug}
                                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                className={`${inp} font-mono`} autoFocus disabled={saving} />
                            <button type="button" aria-label="Save organisation slug" onClick={handleSaveSlug} disabled={saving}
                                className="p-2 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 flex items-center justify-center text-on-accent bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50">
                                <Check className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" aria-label="Cancel organisation slug edit" onClick={() => { setIsEditingSlug(false); setSlug(org.slug); setError(null); }}
                                className="p-2 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 flex items-center justify-center text-text-muted hover:bg-secondary/60 rounded-md transition-colors">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between group">
                            <span className="text-sm font-mono font-bold text-text">{org.slug}</span>
                            {isOwner && (
                                <button type="button" aria-label="Edit organisation slug" onClick={() => setIsEditingSlug(true)}
                                    className="p-2.5 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 flex items-center justify-center text-text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-accent transition-colors rounded-md">
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                    <p className="text-[10px] text-text-muted/60 mt-1">Used in your sharing links</p>
                </div>
            </div>

            <div className="border-t border-border" />

            {/* Subdomain */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-text-muted flex items-center gap-1.5">
                        Your Subdomain
                        <span className="text-[10px] bg-accent-soft text-accent px-1.5 py-0.5 rounded border border-accent/20">Routing</span>
                    </label>
                    {!isEditingSubdomain && isOwner && (
                        <button type="button" aria-label="Edit subdomain" onClick={() => setIsEditingSubdomain(true)}
                            className="p-2.5 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 flex items-center justify-center text-text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-accent transition-colors rounded-md">
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                {subdomainError && (
                    <p className="text-xs text-red-500 mb-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {subdomainError}
                    </p>
                )}
                {isEditingSubdomain ? (
                    <div className="flex gap-2 items-center">
                        <div className="flex-1 flex items-center bg-secondary/60 border border-border rounded-xl overflow-hidden">
                            <input
                                type="text"
                                value={subdomain}
                                onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                placeholder="yourclub"
                                aria-label="Organisation subdomain"
                                className="flex-1 px-3 py-2 bg-transparent text-sm text-text font-mono focus:outline-none"
                                autoFocus disabled={subdomainSaving}
                            />
                            <span className="text-xs text-text-muted pr-3 font-mono">.sprintscaleit.co.uk</span>
                        </div>
                        <button type="button" aria-label="Save subdomain" onClick={handleSaveSubdomain} disabled={subdomainSaving}
                            className="p-2 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 flex items-center justify-center bg-accent text-on-accent rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50">
                            <Check className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" aria-label="Cancel subdomain edit" onClick={() => { setIsEditingSubdomain(false); setSubdomain(org.subdomain || ''); setSubdomainError(null); }}
                            className="p-2 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 flex items-center justify-center text-text-muted hover:bg-secondary/60 rounded-md transition-colors">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ) : (
                    <div className="bg-secondary/60 rounded-xl px-3 py-2.5">
                        {org.subdomain ? (
                            <a href={`https://${org.subdomain}.sprintscaleit.co.uk`} target="_blank" rel="noopener noreferrer"
                                className="text-sm font-mono font-bold text-accent hover:underline">
                                {org.subdomain}.sprintscaleit.co.uk
                            </a>
                        ) : (
                            <span className="text-xs text-text-muted/60 italic">Not set</span>
                        )}
                    </div>
                )}
                <p className="text-[10px] text-text-muted/60 mt-1">Staff can bookmark this URL instead of sprintscaleit.co.uk</p>
            </div>

            <div className="border-t border-border" />

            {/* Contact Details */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" /> Contact Details
                    </h4>
                    {!isEditingContact && isOwner && (
                        <button type="button" onClick={() => setIsEditingContact(true)}
                            className="flex items-center gap-1 px-2.5 py-1 min-h-11 sm:min-h-9 text-xs font-bold text-text-muted hover:text-text hover:bg-secondary/60 rounded-md transition-colors">
                            <Pencil className="w-3 h-3" /> Edit
                        </button>
                    )}
                </div>

                {isEditingContact ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="contact-email" className="text-xs text-text-muted mb-1.5 flex items-center gap-1"><Mail className="w-3 h-3" /> Email <span className="text-destructive ml-0.5">*</span></label>
                                <input id="contact-email" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                                    className={inp} placeholder="info@yourclub.co.uk" disabled={saving} />
                            </div>
                            <div>
                                <label htmlFor="contact-phone" className="text-xs text-text-muted mb-1.5 flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</label>
                                <input id="contact-phone" type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                                    className={inp} placeholder="+44 7700 900000" disabled={saving} />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="contact-address" className="text-xs text-text-muted mb-1.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> Address</label>
                            <textarea id="contact-address" value={address} onChange={e => setAddress(e.target.value)}
                                className={`${inp} resize-none`} rows={2}
                                placeholder="123 High Street, London, SE26 5RX" disabled={saving} />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => { setContactEmail(org.contactEmail || ''); setContactPhone(org.contactPhone || ''); setAddress(org.address || ''); setIsEditingContact(false); setError(null); }}
                                className="px-3.5 py-2 min-h-11 sm:min-h-9 text-xs font-bold text-text-muted hover:text-text hover:bg-secondary/60 rounded-md transition-colors">
                                Cancel
                            </button>
                            <button type="button" onClick={handleSaveContact} disabled={saving}
                                className="px-4 py-2 min-h-11 sm:min-h-9 text-xs font-bold bg-accent text-on-accent rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50">
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            { icon: Mail, label: 'Email', value: org.contactEmail },
                            { icon: Phone, label: 'Phone', value: org.contactPhone },
                            { icon: MapPin, label: 'Address', value: org.address },
                        ].map(({ icon: Icon, label, value }) => (
                            <div key={label} className="bg-secondary/60 rounded-xl px-3 py-2.5">
                                <p className="text-[10px] font-bold text-text-muted/80 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                    <Icon className="w-3 h-3" /> {label}
                                </p>
                                <p className={`text-xs font-bold ${value ? 'text-text' : 'text-text-muted/60 italic'}`}>
                                    {value || 'Not set'}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="border-t border-border" />

            {/* Sharing Links */}
            <div>
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" /> Sharing Links
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                        { label: 'Booking Link', path: `/b/${org.slug}` },
                        { label: 'Registration Link', path: `/r/${org.slug}` },
                    ].map(({ label, path }) => (
                        <div key={label} className="bg-secondary/60 rounded-xl px-3 py-2.5">
                            <p className="text-[10px] font-bold text-text-muted/80 uppercase tracking-wider mb-0.5">{label}</p>
                            <a href={`${baseUrl}${path}`} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-accent hover:underline font-bold break-all">
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
            description="Changing your slug will break any existing links shared with parents. Are you sure?"
            confirmText="Change"
            cancelText="Cancel"
            variant="warning"
        />
        </>
    );
}
