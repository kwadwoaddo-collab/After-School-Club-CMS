'use client';
 
import { useActionState } from "react";
import { createCentre } from "./actions";
import Link from 'next/link';
import { useFormStatus } from "react-dom";
 
function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-lg shadow-primary/30 text-lg font-bold text-white bg-primary hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50 disabled:bg-[#2a2d35] disabled:shadow-none disabled:cursor-not-allowed glow-btn transition-all"
        >
            {pending ? "Creating..." : "Create Centre"}
        </button>
    );
}
 
const initialState = {
    message: '',
};
 
export default function AddCentreForm() {
    const [state, formAction] = useActionState(createCentre, initialState);
 
    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="max-w-2xl mx-auto w-full space-y-8 glassmorphic-card p-10 rounded-2xl">
                <div>
                    <h2 className="mt-6 text-2xl sm:text-4xl font-extrabold text-white tracking-tight headline-lg">
                        Add a New Centre
                    </h2>
                    <p className="mt-2 text-on-surface-variant body-md">
                        or{' '}
                        <Link href="/dashboard/centres" className="font-bold text-primary hover:text-blue-400 transition-colors">
                            cancel and return to centres
                        </Link>
                    </p>
                </div>
                <form className="mt-8 space-y-6" action={formAction}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div className="mb-6">
                            <label htmlFor="name" className="block text-sm font-bold text-slate-300 mb-2">
                                Centre Name
                            </label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                required
                                className="appearance-none rounded-2xl relative block w-full px-4 py-3 bg-[#13151a] border border-[#2a2d35] placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all sm:text-sm"
                                placeholder="e.g. Dagenham branch"
                            />
                        </div>
                        <div className="mb-6">
                            <label htmlFor="address" className="block text-sm font-bold text-slate-300 mb-2">
                                Address (Optional)
                            </label>
                            <textarea
                                id="address"
                                name="address"
                                className="appearance-none rounded-2xl relative block w-full px-4 py-3 bg-[#13151a] border border-[#2a2d35] placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all sm:text-sm"
                                placeholder="Full address of the centre"
                                rows={3}
                            />
                        </div>
                    </div>
 
                    {state?.message && (
                        <div className="text-error bg-error-container/10 border border-error/20 p-3 rounded-lg text-sm text-center font-bold">
                            {state.message}
                        </div>
                    )}
 
                    <div className="pt-4">
                        <SubmitButton />
                    </div>
                </form>
            </div>
        </div>
    );
}
