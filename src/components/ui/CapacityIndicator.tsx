'use client';

import { cn } from '@/components/ui/utils';

interface CapacityIndicatorProps {
    current: number;
    max?: number;
    size?: 'sm' | 'md';
    className?: string;
    showLabel?: boolean;
}

export function CapacityIndicator({ current, max = 10, size = 'sm', className, showLabel = false }: CapacityIndicatorProps) {
    const percentage = Math.min(100, Math.max(0, (current / max) * 100));
    
    // Segmented dots for "Specialist SaaS" feel (5 segments)
    const segments = [1, 2, 3, 4, 5];
    const activeSegments = Math.ceil((percentage / 100) * 5);

    const getSegmentColor = (index: number) => {
        if (index > activeSegments) return 'bg-outline-variant/20';
        
        // Dynamic color based on total percentage
        if (percentage >= 90) return 'bg-error shadow-[0_0_8px_rgba(255,113,108,0.4)]';
        if (percentage >= 70) return 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]';
        return 'bg-primary shadow-[0_0_8px_rgba(142,171,255,0.4)]';
    };

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            {showLabel && (
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    <span>Capacity</span>
                    <span className={cn(
                        percentage >= 90 ? "text-error" : 
                        percentage >= 70 ? "text-amber-400" : 
                        "text-primary"
                    )}>
                        {current}/{max}
                    </span>
                </div>
            )}
            
            <div className="flex items-center gap-1">
                {segments.map((s) => (
                    <div 
                        key={s}
                        className={cn(
                            "rounded-full transition-all duration-500",
                            size === 'sm' ? "w-1.5 h-1.5" : "w-2.5 h-2.5",
                            getSegmentColor(s)
                        )}
                    />
                ))}
                
                {!showLabel && (
                    <span className={cn(
                        "ml-2 text-[10px] font-black tabular-nums",
                        percentage >= 90 ? "text-error" : 
                        percentage >= 70 ? "text-amber-400" : 
                        "text-on-surface-variant"
                    )}>
                        {Math.round(percentage)}%
                    </span>
                )}
            </div>
        </div>
    );
}
