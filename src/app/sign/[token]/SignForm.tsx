'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { submitSignature, type SubmitState } from './actions';

const IDLE: SubmitState = { status: 'idle' };
const FIELD = 'mt-1 block w-full min-h-11 rounded-lg border border-gray-400 bg-white p-3 text-base text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

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
            <div role="status" className="rounded-lg border border-green-700 bg-green-50 p-5">
                <h2 className="text-lg font-bold text-green-900">Thank you — your agreement is signed</h2>
                <p className="mt-2 text-green-900">{state.emailed ? 'We have emailed you a signed copy.' : 'Your centre will send you a signed copy.'} You can close this page.</p>
            </div>
        );
    }

    return (
        <form action={action} className="space-y-5 rounded-lg border border-gray-300 bg-white p-5" aria-label="Sign this agreement">
            <h2 className="text-lg font-bold">Sign this agreement</h2>
            <div>
                <label htmlFor="signerName" className="font-semibold">Your full name</label>
                <input id="signerName" name="signerName" type="text" autoComplete="name" required minLength={2} maxLength={200} className={FIELD} />
            </div>
            <fieldset>
                <legend className="font-semibold">Your signature</legend>
                <div className="mt-2 flex flex-wrap gap-4">
                    <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name="signatureKind" value="drawn" checked={mode === 'drawn'} onChange={() => setMode('drawn')} className="h-5 w-5" /> Draw it</label>
                    <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name="signatureKind" value="typed" checked={mode === 'typed'} onChange={() => setMode('typed')} className="h-5 w-5" /> Type it</label>
                </div>
                {mode === 'drawn' ? (
                    <div className="mt-2">
                        <canvas ref={canvasRef} width={600} height={180} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
                            role="img" aria-label="Signature drawing area. If you cannot draw, choose Type it instead." className="w-full touch-none rounded-lg border-2 border-dashed border-gray-500 bg-white" />
                        <input type="hidden" name="drawnSignature" value={drawn} />
                        <button type="button" onClick={clear} className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-gray-400 px-4 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">Clear signature</button>
                    </div>
                ) : (
                    <div className="mt-2">
                        <label htmlFor="typedSignature" className="text-sm">Type your name as your signature</label>
                        <input id="typedSignature" name="typedSignature" type="text" maxLength={120} className={`${FIELD} font-serif text-xl italic`} />
                    </div>
                )}
            </fieldset>
            <p>Date: <strong>{todayLabel}</strong> (added automatically)</p>
            <label className="flex items-start gap-3">
                <input type="checkbox" name="agree" required className="mt-1 h-6 w-6 shrink-0" />
                <span>I have read and agree to this Childcare Service Agreement.</span>
            </label>
            <div aria-live="polite">{state.status === 'error' && <p role="alert" className="rounded-lg border border-red-700 bg-red-50 p-3 text-red-900">{state.message}</p>}</div>
            <button type="submit" disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-blue-800 px-6 py-3 text-base font-bold text-white disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900">
                {pending ? 'Signing…' : 'Sign agreement'}
            </button>
        </form>
    );
}
