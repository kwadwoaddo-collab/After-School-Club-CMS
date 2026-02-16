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
        violet: 'bg-purple-50 text-purple-600 border-purple-200',
        cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200',
        amber: 'bg-amber-50 text-amber-600 border-amber-200',
        primary: 'bg-blue-50 text-blue-600 border-blue-200',
    };

    const glowClasses = {
        violet: 'border-purple-100 hover:shadow-purple-200/50',
        cyan: 'border-cyan-100 hover:shadow-cyan-200/50',
        amber: 'border-amber-100 hover:shadow-amber-200/50',
        primary: 'border-blue-100 hover:shadow-blue-200/50',
    };

    return (
        <div className={`glass-card p-6 rounded-3xl ${glowClasses[color]} border group hover:scale-[1.02] transition-all`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-semibold text-slate-500 mb-1 uppercase tracking-wider">{title}</p>
                    <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{value}</h3>

                    {trend && (
                        <div className="flex items-center gap-1 mt-3">
                            <span className={`text-xs font-bold ${trendType === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {trendType === 'up' ? '↑' : '↓'} {trend}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">vs last month</span>
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
