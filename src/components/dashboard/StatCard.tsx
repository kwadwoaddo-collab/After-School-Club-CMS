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
        violet: 'bg-accent-violet/10 text-accent-violet border-border',
        cyan: 'bg-accent-cyan/10 text-accent-cyan border-border',
        amber: 'bg-accent-amber/10 text-accent-amber border-border',
        primary: 'bg-primary/10 text-primary border-border',
    };

    const glowClasses = {
        violet: 'border-border hover:border-accent-violet/30 hover:shadow-md hover:shadow-accent-violet/10',
        cyan: 'border-border hover:border-accent-cyan/30 hover:shadow-md hover:shadow-accent-cyan/10',
        amber: 'border-border hover:border-accent-amber/30 hover:shadow-md hover:shadow-accent-amber/10',
        primary: 'border-border hover:border-primary/30 hover:shadow-md hover:shadow-primary/10',
    };

    return (
        <div className={`glass-card p-6 rounded-3xl ${glowClasses[color]} border group hover:scale-[1.02] transition-all`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-semibold text-foreground mb-1 uppercase tracking-wider">{title}</p>
                    <h3 className="text-3xl font-bold text-foreground tracking-tight">{value}</h3>

                    {trend && (
                        <div className="flex items-center gap-1 mt-3">
                            <span className={`text-xs font-bold ${trendType === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {trendType === 'up' ? '↑' : '↓'} {trend}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">vs last month</span>
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
