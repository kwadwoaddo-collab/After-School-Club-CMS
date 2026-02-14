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
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
            {pending ? "Creating..." : "Create Centre"}
        </button>
    );
}

const initialState = {
    message: '',
};

export default function AddCentrePage() {
    const [state, formAction] = useActionState(createCentre, initialState);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Add a New Centre
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        or{' '}
                        <Link href="/dashboard" className="font-medium text-indigo-600 hover:text-indigo-500">
                            cancel and return to dashboard
                        </Link>
                    </p>
                </div>
                <form className="mt-8 space-y-6" action={formAction}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div className="mb-4">
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                Centre Name
                            </label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                required
                                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                placeholder="e.g. Dagenham branch"
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                                Address (Optional)
                            </label>
                            <textarea
                                id="address"
                                name="address"
                                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                placeholder="Full address of the centre"
                                rows={3}
                            />
                        </div>
                    </div>

                    {state?.message && (
                        <div className="text-red-500 text-sm text-center">
                            {state.message}
                        </div>
                    )}

                    <div>
                        <SubmitButton />
                    </div>
                </form>
            </div>
        </div>
    );
}
