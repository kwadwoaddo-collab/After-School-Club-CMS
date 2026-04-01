'use client';

import { cn } from '@/components/ui/utils';

interface GrowthSparklineProps {
    data: number[];
    width?: number;
    height?: number;
    className?: string;
    strokeColor?: string;
}

export function GrowthSparkline({ 
    data, 
    width = 80, 
    height = 30, 
    className,
    strokeColor = "stroke-primary" 
}: GrowthSparklineProps) {
    if (!data.length) return null;

    const max = Math.max(...data, 1);
    const min = Math.min(...data);
    const range = max - min || 1;

    // Calculate points for the sparkline path
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg 
            width={width} 
            height={height} 
            viewBox={`0 0 ${width} ${height}`} 
            className={cn("overflow-visible drop-shadow-[0_0_8px_rgba(142,171,255,0.4)]", className)}
        >
            <defs>
                <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path
                d={`M 0,${height} L ${points} L ${width},${height} Z`}
                className={cn("fill-primary/5 text-primary")}
            />
            <polyline
                fill="none"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
                className={cn(strokeColor)}
            />
        </svg>
    );
}
