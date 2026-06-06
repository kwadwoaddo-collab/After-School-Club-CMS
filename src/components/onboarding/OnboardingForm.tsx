'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const onboardingSchema = z.object({
    organisationName: z.string().min(2, 'Organisation name must be at least 2 characters'),
    centreName: z.string().min(2, 'Centre name must be at least 2 characters'),
    brandColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color'),
    logoUrl: z.string().optional(),
});

type OnboardingInput = z.infer<typeof onboardingSchema>;

export default function OnboardingForm() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<OnboardingInput>({
        resolver: zodResolver(onboardingSchema),
        defaultValues: {
            organisationName: '',
            centreName: '',
            brandColor: '#4F46E5', // Indigo-600 default
            logoUrl: '',
        },
    });

    const watchedColor = watch('brandColor');
    const watchedLogo = watch('logoUrl');

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/upload/logo', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');

            const data = await res.json();
            if (data.success) {
                setValue('logoUrl', data.url);
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Logo upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const onSubmit = async (data: OnboardingInput) => {
        setIsSubmitting(true);
        setError(null);

        try {
            const res = await fetch('/api/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Setup failed');
            }

            // Force a full page reload so the JWT session is re-fetched with the
            // new organisationId. Using router.push() alone leaves the stale JWT
            // in place and can bounce the user back to /onboarding.
            window.location.href = '/dashboard';
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-lg mx-auto bg-surface-container-high rounded-2xl shadow-xl border border-outline-variant/10 overflow-hidden">
            <div className="bg-surface-container-low px-8 py-6 border-b border-outline-variant/10">
                <h2 className="text-2xl font-bold text-white">Let&apos;s get you set up</h2>
                <p className="text-on-surface-variant mt-1">Create your organisation and first centre.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
                {error && (
                    <div
                        role="alert"
                        aria-live="polite"
                        className="p-4 bg-red-500/15 text-red-300 rounded-lg text-sm border border-red-500/30"
                    >
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Organisation Logo</label>
                        <div className="flex items-center gap-4">
                            {watchedLogo && (
                                <img
                                    src={watchedLogo}
                                    alt="Logo preview"
                                    className="w-12 h-12 rounded-lg object-contain bg-surface-container-lowest border border-outline-variant/10"
                                />
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                disabled={isUploading}
                                className="block w-full text-sm text-gray-500
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-full file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-primary/10 file:text-primary
                                    hover:file:bg-primary/20
                                    disabled:opacity-50"
                            />
                        </div>
                        {isUploading && <p className="text-xs text-primary mt-1">Uploading...</p>}
                        <p className="text-xs text-on-surface-variant mt-1">You can add this later.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Organisation Name</label>
                        <input
                            {...register('organisationName')}
                            className="w-full px-4 py-3 bg-surface-container-lowest text-white border border-outline-variant/20 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-on-surface-variant/50"
                            placeholder="e.g. Bright Stars Academy"
                        />
                        {errors.organisationName && <p className="text-red-400 text-sm mt-1" role="alert">{errors.organisationName.message}</p>}

                    </div>

                    <div>
                        <label className="block text-sm font-medium text-on-surface-variant mb-1">First Centre Name</label>
                        <input
                            {...register('centreName')}
                            className="w-full px-4 py-3 bg-surface-container-lowest text-white border border-outline-variant/20 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-on-surface-variant/50"
                            placeholder="e.g. London Campus"
                        />
                        <p className="text-xs text-on-surface-variant mt-1">You can add more centres later.</p>
                        {errors.centreName && <p className="text-red-400 text-sm mt-1">{errors.centreName.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-on-surface-variant mb-2">Brand Color</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="color"
                                {...register('brandColor')}
                                className="w-12 h-12 rounded-lg cursor-pointer border border-outline-variant/20 p-1 bg-surface-container-lowest shadow-sm"
                            />
                            <div className="flex-1">
                                <div
                                    className="h-10 rounded-lg flex items-center justify-center text-white font-medium text-sm transition-colors"
                                    style={{ backgroundColor: watchedColor }}
                                >
                                    Preview Button
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-on-surface-variant mt-2">This color will be used for buttons and highlights on your booking page.</p>
                        {errors.brandColor && <p className="text-red-400 text-sm mt-1">{errors.brandColor.message}</p>}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || isUploading}
                    className="w-full py-3 px-4 rounded-lg text-white font-semibold transition-all hover:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    style={{ backgroundColor: watchedColor }}
                >
                    {isSubmitting ? 'Setting up...' : 'Complete Setup →'}
                </button>
            </form>
        </div>
    );
}
