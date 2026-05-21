'use client';

import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import SignaturePad from 'react-signature-canvas';
import type SignaturePadType from 'react-signature-canvas';

export interface SignaturePadHandle {
    isEmpty: () => boolean;
    getDataURL: () => string;
    clear: () => void;
}

interface SignaturePadWidgetProps {
    onChange?: (dataUrl: string | null) => void;
    className?: string;
    invalid?: boolean;
}

const SignaturePadWidget = forwardRef<SignaturePadHandle, SignaturePadWidgetProps>(
    ({ onChange, className, invalid }, ref) => {
        const padRef = useRef<SignaturePadType>(null);
        const containerRef = useRef<HTMLDivElement>(null);
        const [isEmpty, setIsEmpty] = useState(true);
        const [dimensions, setDimensions] = useState({ width: 0, height: 120 });

        // Size the canvas to the container width
        useEffect(() => {
            const resize = () => {
                if (containerRef.current) {
                    setDimensions({
                        width: containerRef.current.offsetWidth,
                        height: 130,
                    });
                }
            };
            resize();
            const observer = new ResizeObserver(resize);
            if (containerRef.current) observer.observe(containerRef.current);
            return () => observer.disconnect();
        }, []);

        const handleEnd = useCallback(() => {
            if (padRef.current) {
                const empty = padRef.current.isEmpty();
                setIsEmpty(empty);
                onChange?.(empty ? null : padRef.current.toDataURL('image/png'));
            }
        }, [onChange]);

        const handleClear = useCallback(() => {
            padRef.current?.clear();
            setIsEmpty(true);
            onChange?.(null);
        }, [onChange]);

        useImperativeHandle(ref, () => ({
            isEmpty: () => padRef.current?.isEmpty() ?? true,
            getDataURL: () => padRef.current?.toDataURL('image/png') ?? '',
            clear: handleClear,
        }));

        return (
            <div className={className}>
                <div
                    ref={containerRef}
                    className={`relative rounded-xl overflow-hidden border-2 transition-colors ${invalid ? 'border-red-400' : 'border-slate-200'} bg-white`}
                    style={{ height: 140 }}
                >
                    {dimensions.width > 0 && (
                        <SignaturePad
                            ref={padRef}
                            canvasProps={{
                                width: dimensions.width,
                                height: 140,
                                className: 'touch-none',
                            }}
                            penColor="#1e293b"
                            backgroundColor="rgba(255,255,255,0)"
                            onEnd={handleEnd}
                        />
                    )}
                    {isEmpty && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <p className="text-slate-400 text-sm select-none">Sign here</p>
                        </div>
                    )}
                    {/* Bottom rule */}
                    <div className="absolute bottom-8 left-6 right-6 border-b border-dashed border-slate-300 pointer-events-none" />
                </div>
                <div className="flex items-center justify-between mt-2">
                    <p className="text-white/40 text-xs">Draw your signature above using your mouse or finger</p>
                    {!isEmpty && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>
        );
    }
);

SignaturePadWidget.displayName = 'SignaturePadWidget';
export default SignaturePadWidget;
