'use client';

import { useActionState } from 'react';
import { createCentre } from './actions';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { ChevronLeft, MapPin, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
            ) : (
                <>Create centre</>
            )}
        </Button>
    );
}

const initialState = { message: '' };

const inputCls = 'w-full h-9 px-3 rounded-sm text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors border border-border bg-surface';

export default function AddCentreForm() {
    const [state, formAction] = useActionState(createCentre, initialState);

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            <Link
                href="/dashboard/centres"
                className="inline-flex items-center gap-1.5 text-small-body font-medium text-text-secondary hover:text-text transition-colors"
            >
                <ChevronLeft className="w-4 h-4" />
                Back to centres
            </Link>

            <div>
                <h1 className="text-page-title text-text">Add a new centre</h1>
                <p className="text-small-body text-text-secondary mt-1">
                    Create a centre, then configure its sessions and billing details
                </p>
            </div>

            <form action={formAction}>
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2.5">
                            <MapPin className="w-4 h-4 text-text-muted" />
                            <CardTitle>Centre details</CardTitle>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-5">
                        {state?.message && (
                            <div className="p-3 rounded-md bg-danger-soft border border-danger/20 text-small-body text-danger font-medium">
                                {state.message}
                            </div>
                        )}

                        <div>
                            <label htmlFor="name" className="block text-label text-text-muted mb-1.5">
                                Centre name *
                            </label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                required
                                className={inputCls}
                                placeholder="e.g. Dagenham Branch"
                            />
                            <p className="text-metadata mt-1.5">At least 3 characters</p>
                        </div>

                        <div>
                            <label htmlFor="address" className="block text-label text-text-muted mb-1.5">
                                Address <span className="text-text-muted font-normal">(optional)</span>
                            </label>
                            <textarea
                                id="address"
                                name="address"
                                rows={3}
                                className={`${inputCls} h-auto py-2`}
                                placeholder="Full address of the centre"
                            />
                        </div>
                    </CardContent>

                    <CardFooter className="justify-between">
                        <Button variant="ghost" asChild>
                            <Link href="/dashboard/centres">Cancel</Link>
                        </Button>
                        <SubmitButton />
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
