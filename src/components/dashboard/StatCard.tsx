import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: string;
    trendType?: 'up' | 'down';
    color: 'violet' | 'cyan' | 'amber' | 'primary';
}

export default function StatCard({ title, value, icon: Icon, trend, trendType, color }: StatCardProps) {
    const colorClasses = {
        violet: 'bg-accent-violet/10 text-accent-violet border-accent-violet/20 shadow-accent-violet/5',
        cyan: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20 shadow-accent-cyan/5',
        amber: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20 shadow-accent-amber/5',
        primary: 'bg-primary/10 text-primary border-primary/20 shadow-primary/5',
    };

    const glowClasses = {
        violet: 'shadow-[0_0_20px_-5px_rgba(139,92,246,0.3)]',
        cyan: 'shadow-[0_0_20px_-5px_rgba(6,182,212,0.3)]',
        amber: 'shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]',
        primary: 'shadow-[0_0_20px_-5px_rgba(19,109,236,0.3)]',
    };

    return (
        <div className={`glass-card p-6 rounded-3xl ${glowClasses[color]} group`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-semibold text-slate-500 mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{value}</h3>

                    {trend && (
                        <div className="flex items-center gap-1 mt-3">
                            <span className={`text-xs font-bold ${trendType === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {trendType === 'up' ? '↑' : '↓'} {trend}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">vs last month</span>
                        </div>
                    )}
                </div>

                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${colorClasses[color]} border`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </div>
    );
}
