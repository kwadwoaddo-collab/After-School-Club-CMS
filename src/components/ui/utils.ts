export { cn } from '@/lib/utils';

export function getAvatarGradient(name?: string) {
    if (!name) return 'from-teal-700 to-teal-800';
    const gradients = [
        'from-teal-700 to-teal-800',
        'from-slate-600 to-slate-700',
        'from-emerald-700 to-emerald-800',
        'from-stone-600 to-stone-700',
        'from-zinc-700 to-zinc-800',
        'from-teal-800 to-slate-800',
    ];
    const idx = name.charCodeAt(0) % gradients.length;
    return gradients[idx];
}
