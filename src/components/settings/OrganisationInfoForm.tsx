'use client';
 
import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
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
 
    const [isEditingName, setIsEditingName] = useState(false);
    const { toast } = useToast();
    const [name, setName] = useState(org.name);
 
    const [isEditingSlug, setIsEditingSlug] = useState(false);
    const [slug, setSlug] = useState(org.slug);
    const [showConfirmSlug, setShowConfirmSlug] = useState(false);
    const [pendingSlug, setPendingSlug] = useState('');
 
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
        catch (e: any) { 
            setError(e.message); 
            toast({ title: 'Error', message: e.message || 'Failed to update organisation name', variant: 'error' });
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
        catch (e: any) { 
            setError(e.message); 
            toast({ title: 'Error', message: e.message || 'Failed to update slug', variant: 'error' });
        }
        finally { setSaving(false); setShowConfirmSlug(false); }
    };
 
    const handleSaveContact = async () => {
        setSaving(true); setError(null);
        try {
            await patchOrg({ contactEmail: contactEmail.trim(), contactPhone: contactPhone.trim(), address: address.trim() });
            setIsEditingContact(false); 
            toast({ title: 'Success', message: 'Contact details updated successfully!', variant: 'success' });
            router.refresh();
        } catch (e: any) { 
            setError(e.message); 
            toast({ title: 'Error', message: e.message || 'Failed to update contact details', variant: 'error' });
        }
        finally { setSaving(false); }
    };

    const inp = "w-full px-3 py-2 bg-secondary/60 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all";

    const Field = ({ label, editing, value, display, onEdit }: {
        label: string; editing: boolean; value: string; display?: string; onEdit: () => void;
    }) => null; // Just a type helper placeholder — we inline below

    return (
        <>
        <div className="bg-card border border-border shadow-sm rounded-2xl p-5 space-y-5">
            <h3 className="text-sm font-bold text-foreground">Organisation Information</h3>

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
                    <label htmlFor="org-name" className="text-xs font-medium text-muted-foreground mb-1.5 block">Organisation Name</label>
                    {isEditingName ? (
                        <div className="flex gap-2">
                            <input id="org-name" type="text" value={name} onChange={e => setName(e.target.value)}
                                className={inp} autoFocus disabled={saving} />
                            <button onClick={handleSaveName} disabled={saving}
                                className="p-2 text-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all disabled:opacity-50">
                                <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setIsEditingName(false); setName(org.name); setError(null); }}
                                className="p-2 text-muted-foreground hover:bg-secondary/60 rounded-xl transition-all">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between group">
                            <span className="text-sm font-bold text-foreground">{org.name}</span>
                            <button onClick={() => setIsEditingName(true)}
                                className="p-1.5 text-muted-foreground/60 hover:text-primary opacity-0 group-hover:opacity-100 transition-all rounded-lg">
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Slug */}
                <div>
                    <label htmlFor="org-slug" className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        Slug
                        <span className="text-[10px] bg-warning/10 text-warning px-1 py-0.5 rounded border border-warning/20">URL ID</span>
                    </label>
                    {isEditingSlug ? (
                        <div className="flex gap-2">
                            <input id="org-slug" type="text" value={slug}
                                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                className={`${inp} font-mono`} autoFocus disabled={saving} />
                            <button onClick={handleSaveSlug} disabled={saving}
                                className="p-2 text-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all disabled:opacity-50">
                                <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setIsEditingSlug(false); setSlug(org.slug); setError(null); }}
                                className="p-2 text-muted-foreground hover:bg-secondary/60 rounded-xl transition-all">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between group">
                            <span className="text-sm font-mono font-bold text-foreground">{org.slug}</span>
                            <button onClick={() => setIsEditingSlug(true)}
                                className="p-1.5 text-muted-foreground/60 hover:text-primary opacity-0 group-hover:opacity-100 transition-all rounded-lg">
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Used in your sharing links</p>
                </div>
            </div>

            <div className="border-t border-border" />

            {/* Contact Details */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" /> Contact Details
                    </h4>
                    {!isEditingContact && (
                        <button onClick={() => setIsEditingContact(true)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg transition-all">
                            <Pencil className="w-3 h-3" /> Edit
                        </button>
                    )}
                </div>

                {isEditingContact ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="contact-email" className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><Mail className="w-3 h-3" /> Email</label>
                                <input id="contact-email" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                                    className={inp} placeholder="info@yourclub.co.uk" disabled={saving} />
                            </div>
                            <div>
                                <label htmlFor="contact-phone" className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</label>
                                <input id="contact-phone" type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                                    className={inp} placeholder="+44 7700 900000" disabled={saving} />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="contact-address" className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> Address</label>
                            <textarea id="contact-address" value={address} onChange={e => setAddress(e.target.value)}
                                className={`${inp} resize-none`} rows={2}
                                placeholder="123 High Street, London, SE26 5RX" disabled={saving} />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => { setContactEmail(org.contactEmail || ''); setContactPhone(org.contactPhone || ''); setAddress(org.address || ''); setIsEditingContact(false); setError(null); }}
                                className="px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg transition-all">
                                Cancel
                            </button>
                            <button onClick={handleSaveContact} disabled={saving}
                                className="px-4 py-1.5 text-xs font-bold bg-primary text-foreground rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50">
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
                                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                    <Icon className="w-3 h-3" /> {label}
                                </p>
                                <p className={`text-xs font-bold ${value ? 'text-foreground' : 'text-muted-foreground/60 italic'}`}>
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
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" /> Sharing Links
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                        { label: 'Booking Link', path: `/b/${org.slug}` },
                        { label: 'Registration Link', path: `/r/${org.slug}` },
                    ].map(({ label, path }) => (
                        <div key={label} className="bg-secondary/60 rounded-xl px-3 py-2.5">
                            <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider mb-0.5">{label}</p>
                            <a href={`${baseUrl}${path}`} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline font-bold break-all">
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
