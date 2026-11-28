'use client';
 
import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import {
    Tag,
    Plus,
    Trash2,
    ToggleLeft,
    ToggleRight,
    ChevronLeft,
    Save,
    Loader2,
    Percent,
    PoundSterling,
    Users,
    GraduationCap,
} from 'lucide-react';
 
export type DiscountRule = {
    id: string;
    type: 'sibling' | 'pupil_premium' | 'percentage' | 'fixed';
    label: string;
    value: number;
    valueType: 'percent' | 'fixed';
    active: boolean;
};
 
const RULE_TYPE_META: Record<
    DiscountRule['type'],
    { label: string; description: string; icon: React.ElementType; color: string }
> = {
    sibling: {
        label: 'Sibling Discount',
        description: 'Applied when 2+ children on one invoice',
        icon: Users,
        color: 'text-violet-400',
    },
    pupil_premium: {
        label: 'Pupil Premium',
        description: 'For pupils eligible for pupil premium',
        icon: GraduationCap,
        color: 'text-success',
    },
    percentage: {
        label: 'Custom Percentage',
        description: 'Percentage off any invoice',
        icon: Percent,
        color: 'text-cyan-400',
    },
    fixed: {
        label: 'Fixed Amount',
        description: 'Fixed £ amount off any invoice',
        icon: PoundSterling,
        color: 'text-warning',
    },
};
 
function RuleCard({
    rule,
    onChange,
    onDelete,
}: {
    rule: DiscountRule;
    onChange: (r: DiscountRule) => void;
    onDelete: () => void;
}) {
    const meta = RULE_TYPE_META[rule.type];
    const Icon = meta.icon;
 
    return (
        <div
            className={`bg-card border rounded-2xl p-4 transition-all ${
                rule.active
                    ? 'border-border'
                    : 'border-border opacity-60'
            }`}
        >
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-secondary/60 border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className={`w-4 h-4 ${meta.color}`} />
                </div>
 
                <div className="flex-1 min-w-0 space-y-3">
                    {/* Label + type */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <input
                            type="text"
                            value={rule.label}
                            onChange={(e) => onChange({ ...rule, label: e.target.value })}
                            placeholder="Discount label"
                            className="bg-transparent text-sm font-semibold text-text border-b border-border focus:border-accent outline-none pb-0.5 w-48 transition-colors"
                        />
                        <span className="text-xs text-text-muted bg-secondary/60 border border-border rounded-lg px-2 py-0.5">
                            {meta.label}
                        </span>
                    </div>
 
                    {/* Value + valueType */}
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            {rule.valueType === 'fixed' && (
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                                    £
                                </span>
                            )}
                            <input
                                type="number"
                                min={0}
                                step={rule.valueType === 'fixed' ? 0.01 : 1}
                                max={rule.valueType === 'percent' ? 100 : undefined}
                                value={rule.value}
                                onChange={(e) =>
                                    onChange({ ...rule, value: parseFloat(e.target.value) || 0 })
                                }
                                className={`bg-secondary/60 border border-border rounded-md text-sm text-text tabular-nums outline-none focus:border-accent transition-colors w-24 py-1.5 ${
                                    rule.valueType === 'fixed' ? 'pl-6 pr-3' : 'px-3'
                                }`}
                            />
                            {rule.valueType === 'percent' && (
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                                    %
                                </span>
                            )}
                        </div>
 
                        {/* Toggle percent/fixed */}
                        <div className="flex rounded-md border border-border overflow-hidden text-xs">
                            <button
                                type="button"
                                onClick={() => onChange({ ...rule, valueType: 'percent' })}
                                className={`px-3 py-1.5 transition-colors ${
                                    rule.valueType === 'percent'
                                        ? 'bg-accent text-on-accent font-semibold'
                                        : 'text-text-muted hover:text-text'
                                }`}
                            >
                                %
                            </button>
                            <button
                                type="button"
                                onClick={() => onChange({ ...rule, valueType: 'fixed' })}
                                className={`px-3 py-1.5 transition-colors ${
                                    rule.valueType === 'fixed'
                                        ? 'bg-accent text-on-accent font-semibold'
                                        : 'text-text-muted hover:text-text'
                                }`}
                            >
                                £
                            </button>
                        </div>
 
                        <p className="text-xs text-text-muted hidden sm:block">
                            {meta.description}
                        </p>
                    </div>
                </div>
 
                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        type="button"
                        aria-label={`${rule.active ? 'Deactivate' : 'Activate'} discount ${rule.label}`}
                        onClick={() => onChange({ ...rule, active: !rule.active })}
                        className="p-1.5 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 flex items-center justify-center rounded-md hover:bg-secondary/60 transition-colors"
                        title={rule.active ? 'Deactivate' : 'Activate'}
                    >
                        {rule.active ? (
                            <ToggleRight className="w-5 h-5 text-accent" />
                        ) : (
                            <ToggleLeft className="w-5 h-5 text-text-muted" />
                        )}
                    </button>
                    <button
                        type="button"
                        aria-label={`Delete discount ${rule.label}`}
                        onClick={onDelete}
                        className="p-1.5 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 flex items-center justify-center rounded-md hover:bg-red-500/10 transition-colors group"
                        title="Delete rule"
                    >
                        <Trash2 className="w-4 h-4 text-text-muted group-hover:text-red-600 transition-colors" />
                    </button>
                </div>
            </div>
        </div>
    );
}
 
export default function DiscountsForm({ initialRules = [] }: { initialRules?: DiscountRule[] }) {
    const router = useRouter();
    const [rules, setRules] = useState<DiscountRule[]>(initialRules);
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
 
    function addRule(type: DiscountRule['type']) {
        const defaults: Record<DiscountRule['type'], Partial<DiscountRule>> = {
            sibling: { label: 'Sibling Discount', valueType: 'percent', value: 10 },
            pupil_premium: { label: 'Pupil Premium', valueType: 'percent', value: 15 },
            percentage: { label: 'Custom Discount', valueType: 'percent', value: 5 },
            fixed: { label: 'Fixed Discount', valueType: 'fixed', value: 5 },
        };
        const newRule: DiscountRule = {
            id: nanoid(),
            type,
            active: true,
            ...defaults[type],
        } as DiscountRule;
        setRules((prev) => [...prev, newRule]);
    }
 
    async function handleSave() {
        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            const res = await fetch('/api/settings/discounts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discountRules: rules }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save');
            setSuccess(true);
            toast({ title: 'Success', message: 'Discount rules saved successfully!', variant: 'success' });
            setTimeout(() => setSuccess(false), 3000);
        } catch (e) {
            const errMsg = (e instanceof Error ? e.message : undefined) || 'Failed to save discount rules';
            setError(errMsg);
            toast({ title: 'Error', message: errMsg, variant: 'error' });
        } finally {
            setSaving(false);
        }
    }
 
    return (
        <div className="max-w-2xl space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-text tracking-tight">Discount Rules</h1>
                    <p className="text-sm text-text-muted mt-0.5">
                        Configure discounts applied when generating invoices
                    </p>
                </div>
            </div>
 
            {/* Error / Success banners */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-600">
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3 text-sm text-success">
                    Discount rules saved successfully.
                </div>
            )}
 
            {/* Rules list */}
            <div className="space-y-3">
                    {rules.length === 0 && (
                        <div className="bg-surface border border-border rounded-xl p-8 text-center">
                            <Tag className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
                            <p className="text-sm text-text-muted">No discount rules yet.</p>
                            <p className="text-xs text-text-muted mt-1 opacity-70">
                                Add a rule below to get started.
                            </p>
                        </div>
                    )}
                    {rules.map((rule) => (
                        <RuleCard
                            key={rule.id}
                            rule={rule}
                            onChange={(updated) =>
                                setRules((prev) =>
                                    prev.map((r) => (r.id === updated.id ? updated : r))
                                )
                            }
                            onDelete={() =>
                                setRules((prev) => prev.filter((r) => r.id !== rule.id))
                            }
                        />
                    ))}
                </div>
 
            {/* Add rule buttons */}
            <div>
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">
                    Add Rule
                </h2>
                <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(RULE_TYPE_META) as DiscountRule['type'][]).map((type) => {
                        const meta = RULE_TYPE_META[type];
                        const Icon = meta.icon;
                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => addRule(type)}
                                className="bg-surface border border-border rounded-md p-3 min-h-11 sm:min-h-10 flex items-center gap-2.5 hover:border-accent/30 transition-colors group text-left"
                            >
                                <div className="w-7 h-7 rounded-lg bg-secondary/60 border border-border flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-text leading-tight truncate">
                                        {meta.label}
                                    </p>
                                    <p className="text-xs text-text-muted truncate">
                                        {meta.description}
                                    </p>
                                </div>
                                <Plus className="w-3.5 h-3.5 text-text-muted ml-auto flex-shrink-0 group-hover:text-accent transition-colors" />
                            </button>
                        );
                    })}
                </div>
            </div>
 
            {/* Save button */}
            <div className="flex justify-end pb-6">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 min-h-11 sm:min-h-10 bg-accent text-on-accent text-sm font-semibold rounded-md hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Save Changes
                </button>
            </div>
        </div>
    );
}
