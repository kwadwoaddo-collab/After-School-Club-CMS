'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { submitSignature, type SubmitState } from './actions';

const IDLE: SubmitState = { status: 'idle' };
const FIELD = 'mt-1 block w-full min-h-11 rounded-lg border border-border bg-surface p-3 text-base text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent';

export function SignForm({ token, todayLabel }: { token: string; todayLabel: string }) {
    const [state, action, pending] = useActionState(submitSignature.bind(null, token), IDLE);
    const [mode, setMode] = useState<'drawn' | 'typed'>('drawn');
    const [drawn, setDrawn] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#111827';
    }, [mode]);

    const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return { x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width, y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height };
    };
    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const ctx = e.currentTarget.getContext('2d'); if (!ctx) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true; const p = point(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
    };
    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return; const ctx = e.currentTarget.getContext('2d'); if (!ctx) return;
        const p = point(e); ctx.lineTo(p.x, p.y); ctx.stroke();
    };
    const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return; drawing.current = false;
        setDrawn(e.currentTarget.toDataURL('image/png'));
    };
    const clear = () => {
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        setDrawn('');
    };

    if (state.status === 'done') {
        return (
            <div role="status" className="rounded-2xl border border-success/30 bg-success-soft p-6 text-text">
                <h2 className="text-lg font-bold text-success">Thank you — your agreement is signed</h2>
                <p className="mt-2 text-text-secondary">{state.emailed ? 'We have emailed you a signed copy.' : 'Your centre will send you a signed copy.'} You can close this page.</p>
            </div>
        );
    }

    return (
        <form id="sign-form" action={action} className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-sm text-text" aria-label="Sign this agreement">
            <h2 className="text-lg font-bold text-text">Sign this agreement</h2>
            <div>
                <label htmlFor="signerName" className="font-semibold text-text">Your full name</label>
                <input id="signerName" name="signerName" type="text" autoComplete="name" required minLength={2} maxLength={200} className={FIELD} />
            </div>
            <fieldset>
                <legend className="font-semibold text-text">Your signature</legend>
                <div className="mt-2 flex flex-wrap gap-4">
                    <label className="inline-flex min-h-11 items-center gap-2 cursor-pointer text-text"><input type="radio" name="signatureKind" value="drawn" checked={mode === 'drawn'} onChange={() => setMode('drawn')} className="h-5 w-5 accent-accent" /> Draw it</label>
                    <label className="inline-flex min-h-11 items-center gap-2 cursor-pointer text-text"><input type="radio" name="signatureKind" value="typed" checked={mode === 'typed'} onChange={() => setMode('typed')} className="h-5 w-5 accent-accent" /> Type it</label>
                </div>
                {mode === 'drawn' ? (
                    <div className="mt-2">
                        {/* CRITICAL BLIND SPOT: canvas MUST remain bg-white in both light and dark modes because stroke ink is #111827 */}
                        <canvas ref={canvasRef} width={600} height={180} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
                            role="img" aria-label="Signature drawing area. If you cannot draw, choose Type it instead." className="w-full touch-none rounded-lg border-2 border-dashed border-border bg-white" />
                        <input type="hidden" name="drawnSignature" value={drawn} />
                        <button type="button" onClick={clear} className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-border bg-surface px-4 font-semibold text-text hover:bg-page focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-colors">Clear signature</button>
                    </div>
                ) : (
                    <div className="mt-2">
                        <label htmlFor="typedSignature" className="text-sm text-text-muted">Type your name as your signature</label>
                        <input id="typedSignature" name="typedSignature" type="text" maxLength={120} className={`${FIELD} font-serif text-xl italic`} />
                    </div>
                )}
            </fieldset>
            <p className="text-text">Date: <strong className="text-text">{todayLabel}</strong> (added automatically)</p>
            <label className="flex items-start gap-3 cursor-pointer text-text">
                <input type="checkbox" name="agree" required className="mt-1 h-6 w-6 shrink-0 accent-accent" />
                <span>I have read and agree to this Childcare Service Agreement.</span>
            </label>
            <div aria-live="polite">{state.status === 'error' && <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-danger">{state.message}</p>}</div>
            <button type="submit" disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-6 py-3 text-base font-bold text-on-accent hover:bg-accent-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-colors">
                {pending ? 'Signing…' : 'Sign agreement'}
            </button>
        </form>
    );
}
