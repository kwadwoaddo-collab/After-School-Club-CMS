'use client';

import { cn } from '@/components/ui/utils';

interface AttendanceRadialProps {
    percentage: number;
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
    className?: string;
}

export function AttendanceRadial({ percentage, size = 'md', children, className }: AttendanceRadialProps) {
    // Standard sizes for the radial chip
    const strokeWidth = size === 'lg' ? 6 : 3;
    const radius = 50; // We'll use a viewBox of 120x120, so 50 is a good radius
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

    const dimensions = {
        sm: 'w-10 h-10',
        md: 'w-12 h-12',
        lg: 'w-32 h-32',
    }[size];

    // SprintScale Color logic
    const getColorClass = (p: number) => {
        if (p >= 80) return 'text-tertiary shadow-[0_0_12px_rgba(184,255,187,0.4)]';
        if (p >= 50) return 'text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)]';
        return 'text-rose-500 shadow-[0_0_12px_rgba(255,113,108,0.4)]';
    };

    const getStrokeColor = (p: number) => {
        if (p >= 80) return 'stroke-tertiary';
        if (p >= 50) return 'stroke-amber-400';
        return 'stroke-error';
    };

    return (
        <div className={cn("relative flex items-center justify-center shrink-0 group", dimensions, className)}>
            {/* The SVG Ring */}
            <svg 
                className="absolute inset-0 w-full h-full -rotate-90 transform z-0" 
                viewBox="0 0 120 120"
            >
                {/* Background Ring (Track) */}
                <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    className="text-outline-variant/10"
                />
                {/* Progress Ring */}
                <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    style={{ 
                        strokeDashoffset: offset,
                        filter: percentage > 0 ? `drop-shadow(0 0 3px currentColor)` : 'none'
                    }}
                    strokeLinecap="round"
                    className={cn(
                        "transition-all duration-1000 ease-out", 
                        getStrokeColor(percentage)
                    )}
                />
            </svg>

            {/* Inner Content (Initials or Profile Pic) */}
            <div className={cn(
                "relative z-10 rounded-2xl flex items-center justify-center overflow-hidden transition-all duration-300",
                size === 'lg' ? "w-[104px] h-[104px] rounded-[32px]" : "w-[calc(100%-8px)] h-[calc(100%-8px)]",
                "bg-secondary/40 group-hover:scale-95"
            )}>
                {children}
            </div>

            {/* Percentage Badge (Only for large version) */}
            {size === 'lg' && (
                <div className={cn(
                    "absolute -bottom-2 right-0 px-2 py-1 rounded-lg text-[10px] font-black italic border shadow-lg z-20",
                    percentage >= 80 ? "bg-tertiary/10 text-tertiary border-tertiary/20" :
                    percentage >= 50 ? "bg-amber-400/10 text-amber-400 border-amber-400/20" :
                    "bg-rose-500/10 text-rose-500 border-rose-500/20"
                )}>
                    {Math.round(percentage)}%
                </div>
            )}
        </div>
    );
}
