'use client';

import { useActionState } from 'react';
import { createCentre } from './actions';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { MapPin } from 'lucide-react';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-lg shadow-primary/30 text-lg font-bold text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed glow-btn transition-all"
        >
            {pending ? 'Creating…' : 'Create Centre'}
        </button>
    );
}

const initialState = { message: '' };

const inputCls = 'appearance-none rounded-2xl block w-full px-4 py-3 bg-secondary border border-border placeholder:text-muted-foreground text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm';
const labelCls = 'block text-sm font-bold text-foreground mb-2';

export default function AddCentreForm() {
    const [state, formAction] = useActionState(createCentre, initialState);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="max-w-2xl mx-auto w-full space-y-8 glassmorphic-card p-10 rounded-[32px]">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                            Add a New Centre
                        </h2>
                        <p className="mt-1 text-muted-foreground text-sm">
                            or{' '}
                            <Link href="/dashboard/centres" className="font-bold text-primary hover:text-primary/80 transition-colors">
                                cancel and return to centres
                            </Link>
                        </p>
                    </div>
                </div>

                <form className="space-y-6" action={formAction}>
                    <div className="space-y-5">
                        <div>
                            <label htmlFor="name" className={labelCls}>Centre Name *</label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                required
                                className={inputCls}
                                placeholder="e.g. Dagenham Branch"
                            />
                        </div>
                        <div>
                            <label htmlFor="address" className={labelCls}>Address <span className="text-muted-foreground font-normal">(optional)</span></label>
                            <textarea
                                id="address"
                                name="address"
                                className={inputCls}
                                placeholder="Full address of the centre"
                                rows={3}
                            />
                        </div>
                    </div>

                    {state?.message && (
                        <div className="text-rose-500 bg-rose-500/5 border border-rose-500/20 p-3 rounded-xl text-sm text-center font-bold">
                            {state.message}
                        </div>
                    )}

                    <div className="pt-2">
                        <SubmitButton />
                    </div>
                </form>
            </div>
        </div>
    );
}
