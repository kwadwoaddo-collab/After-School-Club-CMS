export function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ');
}

export function getAvatarGradient(name?: string) {
    if (!name) return 'from-primary to-accent-violet';
    const gradients = [
        'from-blue-500 to-indigo-600',
        'from-violet-500 to-purple-600',
        'from-emerald-500 to-teal-600',
        'from-amber-500 to-orange-600',
        'from-rose-500 to-pink-600',
        'from-cyan-500 to-sky-600',
    ];
    const idx = name.charCodeAt(0) % gradients.length;
    return gradients[idx];
}
