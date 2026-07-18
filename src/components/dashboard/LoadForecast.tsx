'use client';

import { cn } from '@/components/ui/utils';
import { format, addDays, isSameDay } from 'date-fns';

interface LoadForecastProps {
    data: Array<{ day: Date; count: number }>;
    max?: number;
    className?: string;
}

export function LoadForecast({ data, max = 20, className }: LoadForecastProps) {
    // Generate next 7 days for consistent display
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
    
    // Logic to match forecast data with generated days
    const next7Days = days.map(d => {
        const match = data.find(item => {
            if (!item.day) return false;
            const itemDate = new Date(item.day);
            return isSameDay(itemDate, d);
        });
        
        return {
            date: d,
            count: Number(match?.count || 0)
        };
    });

    const getBarColor = (count: number) => {
        const perc = (count / max) * 100;
        if (perc >= 90) return 'bg-error shadow-[0_0_12px_rgba(255,113,108,0.4)]';
        if (perc >= 70) return 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)]';
        return 'bg-primary shadow-[0_0_12px_rgba(142,171,255,0.4)]';
    };

    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-end justify-between gap-1.5 h-16">
                {next7Days.map((day, i) => {
                    const heightP = Math.min(100, Math.max(10, (day.count / max) * 100));
                    return (
                        <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
                            {/* Bar */}
                            <div className="w-full relative bg-secondary/40 rounded-t-lg overflow-hidden h-full">
                                <div 
                                    className={cn(
                                        "absolute bottom-0 left-0 right-0 rounded-t-lg transition-all duration-1000 ease-out",
                                        getBarColor(day.count)
                                    )}
                                    style={{ height: `${heightP}%` }}
                                />
                                {/* Tooltip on hover */}
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center bg-black/20 text-white text-[10px] font-black pointer-events-none">
                                    {day.count}
                                </div>
                            </div>
                            
                            {/* Label */}
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">
                                    {format(day.date, 'eee')}
                                </span>
                                <span className={cn(
                                    "text-[10px] font-black",
                                    isSameDay(day.date, today) ? "text-primary" : "text-outline"
                                )}>
                                    {format(day.date, 'dd')}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
