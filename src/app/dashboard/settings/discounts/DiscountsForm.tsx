'use client';
 
import { useState, useEffect } from 'react';
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
import { toast } from 'react-hot-toast';
 
type DiscountRule = {
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
        color: 'text-emerald-400',
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
        color: 'text-amber-400',
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
            className={`bg-surface-container-high border rounded-2xl p-4 transition-all ${
                rule.active
                    ? 'border-outline-variant/20'
                    : 'border-outline-variant/5 opacity-60'
            }`}
        >
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
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
                            className="bg-transparent text-sm font-semibold text-white border-b border-outline-variant/30 focus:border-primary outline-none pb-0.5 w-48 transition-colors"
                        />
                        <span className="text-xs text-on-surface-variant bg-white/5 border border-white/10 rounded-lg px-2 py-0.5">
                            {meta.label}
                        </span>
                    </div>
 
                    {/* Value + valueType */}
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            {rule.valueType === 'fixed' && (
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
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
                                className={`bg-white/5 border border-outline-variant/20 rounded-xl text-sm text-white outline-none focus:border-primary transition-colors w-24 py-1.5 ${
                                    rule.valueType === 'fixed' ? 'pl-6 pr-3' : 'px-3'
                                }`}
                            />
                            {rule.valueType === 'percent' && (
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                                    %
                                </span>
                            )}
                        </div>
 
                        {/* Toggle percent/fixed */}
                        <div className="flex rounded-xl border border-outline-variant/20 overflow-hidden text-xs">
                            <button
                                type="button"
                                onClick={() => onChange({ ...rule, valueType: 'percent' })}
                                className={`px-3 py-1.5 transition-colors ${
                                    rule.valueType === 'percent'
                                        ? 'bg-primary text-white font-bold'
                                        : 'text-on-surface-variant hover:text-white'
                                }`}
                            >
                                %
                            </button>
                            <button
                                type="button"
                                onClick={() => onChange({ ...rule, valueType: 'fixed' })}
                                className={`px-3 py-1.5 transition-colors ${
                                    rule.valueType === 'fixed'
                                        ? 'bg-primary text-white font-bold'
                                        : 'text-on-surface-variant hover:text-white'
                                }`}
                            >
                                £
                            </button>
                        </div>
 
                        <p className="text-xs text-on-surface-variant hidden sm:block">
                            {meta.description}
                        </p>
                    </div>
                </div>
 
                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => onChange({ ...rule, active: !rule.active })}
                        className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                        title={rule.active ? 'Deactivate' : 'Activate'}
                    >
                        {rule.active ? (
                            <ToggleRight className="w-5 h-5 text-primary" />
                        ) : (
                            <ToggleLeft className="w-5 h-5 text-on-surface-variant" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors group"
                        title="Delete rule"
                    >
                        <Trash2 className="w-4 h-4 text-on-surface-variant group-hover:text-red-400 transition-colors" />
                    </button>
                </div>
            </div>
        </div>
    );
}
 
export default function DiscountsForm() {
    const router = useRouter();
    const [rules, setRules] = useState<DiscountRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
 
    useEffect(() => {
        fetch('/api/settings/discounts')
            .then((r) => r.json())
            .then((data) => {
                setRules(data.discountRules ?? []);
                setLoading(false);
            })
            .catch(() => {
                setError('Failed to load discount rules');
                setLoading(false);
            });
    }, []);
 
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
            toast.success('Discount rules saved successfully!');
            setTimeout(() => setSuccess(false), 3000);
        } catch (e: any) {
            const errMsg = e.message || 'Failed to save discount rules';
            setError(errMsg);
            toast.error(errMsg);
        } finally {
            setSaving(false);
        }
    }
 
    return (
        <div className="max-w-2xl space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="w-8 h-8 rounded-xl bg-surface-container-high border border-outline-variant/10 flex items-center justify-center hover:border-outline-variant/30 transition-all"
                >
                    <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Discount Rules</h1>
                    <p className="text-sm text-on-surface-variant mt-0.5">
                        Configure discounts applied when generating invoices
                    </p>
                </div>
            </div>
 
            {/* Error / Success banners */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-400">
                    Discount rules saved successfully.
                </div>
            )}
 
            {/* Rules list */}
            {loading ? (
                <div className="flex items-center gap-2 text-on-surface-variant py-8 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading rules…</span>
                </div>
            ) : (
                <div className="space-y-3">
                    {rules.length === 0 && (
                        <div className="bg-surface-container-high border border-outline-variant/10 rounded-2xl p-8 text-center">
                            <Tag className="w-8 h-8 text-on-surface-variant mx-auto mb-2 opacity-50" />
                            <p className="text-sm text-on-surface-variant">No discount rules yet.</p>
                            <p className="text-xs text-on-surface-variant mt-1 opacity-70">
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
            )}
 
            {/* Add rule buttons */}
            <div>
                <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
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
                                className="bg-surface-container-high border border-outline-variant/10 rounded-xl p-3 flex items-center gap-2.5 hover:border-outline-variant/30 transition-all group text-left"
                            >
                                <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-white leading-tight truncate">
                                        {meta.label}
                                    </p>
                                    <p className="text-xs text-on-surface-variant truncate">
                                        {meta.description}
                                    </p>
                                </div>
                                <Plus className="w-3.5 h-3.5 text-on-surface-variant ml-auto flex-shrink-0 group-hover:text-primary transition-colors" />
                            </button>
                        );
                    })}
                </div>
            </div>
 
            {/* Save button */}
            <div className="flex justify-end pb-6">
                <button
                    onClick={handleSave}
                    disabled={saving || loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-all"
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
