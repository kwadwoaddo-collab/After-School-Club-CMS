'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registrationSchema, type RegistrationInput } from '@/lib/validations/registration';

interface RegistrationFormProps {
    centreId: string;
    centreName: string;
}

// Loading Spinner Component
function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
    return (
        <svg className={`animate-spin ${sizes[size]} text-indigo-600`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}

const SUBJECTS = ['Homework Help', 'Creative Arts', 'Sports & Games', 'Science & Tech', 'Other'];
const SCHOOL_YEARS = ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10', 'Y11', 'Y12', 'Y13'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function RegistrationForm({ centreId, centreName }: RegistrationFormProps) {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        control,
        setValue,
        trigger,
        formState: { errors },
    } = useForm<RegistrationInput>({
        resolver: zodResolver(registrationSchema),
        defaultValues: {
            centreId,
            parent: {
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                relationship: 'Mother',
            },
            child: {
                firstName: '',
                lastName: '',
                dateOfBirth: '',
                schoolYear: 'Y1',
                subjects: [],
                notes: '',
            },
            preferences: {
                preferredDays: [],
                preferredTimes: [],
                lessonType: 'Group',
            },
            consent: {
                terms: false,
                marketing: false,
            },
        },
    });

    const watchSubjects = useWatch({ control, name: 'child.subjects' });
    const watchDays = useWatch({ control, name: 'preferences.preferredDays' });
    const watchLessonType = useWatch({ control, name: 'preferences.lessonType' });

    const watchedParentFirstName = useWatch({ control, name: 'parent.firstName' });
    const watchedParentLastName = useWatch({ control, name: 'parent.lastName' });
    const watchedParentEmail = useWatch({ control, name: 'parent.email' });
    const watchedChildFirstName = useWatch({ control, name: 'child.firstName' });
    const watchedChildSchoolYear = useWatch({ control, name: 'child.schoolYear' });

    const toggleSubject = (subject: string) => {
        const current = watchSubjects || [];
        const updated = current.includes(subject)
            ? current.filter((s) => s !== subject)
            : [...current, subject];
        setValue('child.subjects', updated, { shouldValidate: true });
    };

    const toggleDay = (day: string) => {
        const current = watchDays || [];
        const updated = current.includes(day)
            ? current.filter((d) => d !== day)
            : [...current, day];
        setValue('preferences.preferredDays', updated, { shouldValidate: true });
    };

    const nextStep = async () => {
        let fieldsToValidate: any[] = [];
        if (step === 1) fieldsToValidate = ['parent'];
        if (step === 2) fieldsToValidate = ['child'];
        if (step === 3) fieldsToValidate = ['preferences'];

        const isValid = await trigger(fieldsToValidate);
        if (isValid) {
            setStep((s) => s + 1);
            window.scrollTo(0, 0);
        }
    };

    const onSubmit = async (data: RegistrationInput) => {
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error('Registration failed');
            }

            setSuccess(true);
            window.scrollTo(0, 0);
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="text-center py-12 bg-card rounded-xl shadow-sm border border-border">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-3xl font-bold text-foreground mb-4">Application Received!</h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
                    Thanks for registering with {centreName}. We'll be in touch shortly to confirm your lesson schedule.
                </p>
                <button
                    onClick={() => window.location.href = '/'}
                    className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                >
                    Return Home
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            {/* Progress Bar */}
            <div className="mb-8">
                <div className="flex justify-between mb-2">
                    {['Parent', 'Student', 'Preferences', 'Confirm'].map((label, i) => (
                        <span
                            key={label}
                            className={`text-sm font-medium ${step > i + 1 ? 'text-green-600' : step === i + 1 ? 'text-indigo-600' : 'text-muted-foreground'
                                }`}
                        >
                            {label}
                        </span>
                    ))}
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                        className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                        style={{ width: `${(step / 4) * 100}%` }}
                    />
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
                {/* Step 1: Parent Details */}
                {step === 1 && (
                    <div className="p-8 space-y-6 animate-fadeIn">
                        <div className="border-b pb-4 mb-6">
                            <h2 className="text-2xl font-bold text-foreground">Parent / Guardian Details</h2>
                            <p className="text-muted-foreground">Who should we contact regarding updates?</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">First Name</label>
                                <input
                                    {...register('parent.firstName')}
                                    className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g. John"
                                />
                                {errors.parent?.firstName && (
                                    <p className="mt-1 text-sm text-red-600">{errors.parent.firstName.message}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Last Name</label>
                                <input
                                    {...register('parent.lastName')}
                                    className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g. Smith"
                                />
                                {errors.parent?.lastName && (
                                    <p className="mt-1 text-sm text-red-600">{errors.parent.lastName.message}</p>
                                )}
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-foreground mb-1">Email Address</label>
                                <input
                                    type="email"
                                    {...register('parent.email')}
                                    className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="john@example.com"
                                />
                                {errors.parent?.email && (
                                    <p className="mt-1 text-sm text-red-600">{errors.parent.email.message}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Phone Number</label>
                                <input
                                    type="tel"
                                    {...register('parent.phone')}
                                    className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="07700 900000"
                                />
                                {errors.parent?.phone && (
                                    <p className="mt-1 text-sm text-red-600">{errors.parent.phone.message}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Relationship to Child</label>
                                <select
                                    {...register('parent.relationship')}
                                    className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="Mother">Mother</option>
                                    <option value="Father">Father</option>
                                    <option value="Guardian">Guardian</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Child Details */}
                {step === 2 && (
                    <div className="p-8 space-y-6 animate-fadeIn">
                        <div className="border-b pb-4 mb-6">
                            <h2 className="text-2xl font-bold text-foreground">Student Details</h2>
                            <p className="text-muted-foreground">Tell us about the student</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">First Name</label>
                                <input
                                    {...register('child.firstName')}
                                    className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                {errors.child?.firstName && (
                                    <p className="mt-1 text-sm text-red-600">{errors.child.firstName.message}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Last Name</label>
                                <input
                                    {...register('child.lastName')}
                                    className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                {errors.child?.lastName && (
                                    <p className="mt-1 text-sm text-red-600">{errors.child.lastName.message}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Date of Birth</label>
                                <input
                                    type="date"
                                    {...register('child.dateOfBirth')}
                                    className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                {errors.child?.dateOfBirth && (
                                    <p className="mt-1 text-sm text-red-600">{errors.child.dateOfBirth.message}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">School Year</label>
                                <select
                                    {...register('child.schoolYear')}
                                    className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="">Select Year Group</option>
                                    {SCHOOL_YEARS.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                                {errors.child?.schoolYear && (
                                    <p className="mt-1 text-sm text-red-600">{errors.child.schoolYear.message}</p>
                                )}
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-foreground mb-3">Activities / Interests</label>
                                <div className="flex flex-wrap gap-3">
                                    {SUBJECTS.map((subject) => (
                                        <button
                                            key={subject}
                                            type="button"
                                            onClick={() => toggleSubject(subject)}
                                            className={`px-6 py-3 rounded-lg font-medium transition-all ${watchSubjects?.includes(subject)
                                                    ? 'brand-bg text-white shadow-md transform scale-105'
                                                    : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60'
                                                }`}
                                        >
                                            {watchSubjects?.includes(subject) && '✓ '}
                                            {subject}
                                        </button>
                                    ))}
                                </div>
                                {errors.child?.subjects && (
                                    <p className="mt-1 text-sm text-red-600">{errors.child.subjects.message}</p>
                                )}
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-foreground mb-1">Additional Notes</label>
                                <textarea
                                    {...register('child.notes')}
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Any learning difficulties, allergies, or specific goals?"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Preferences */}
                {step === 3 && (
                    <div className="p-8 space-y-6 animate-fadeIn">
                        <div className="border-b pb-4 mb-6">
                            <h2 className="text-2xl font-bold text-foreground">Session Preferences</h2>
                            <p className="text-muted-foreground">When would you like sessions to take place?</p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-3">Preferred Days</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {DAYS.map((day) => (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => toggleDay(day)}
                                            className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${watchDays?.includes(day)
                                                    ? 'brand-bg text-white shadow-md'
                                                    : 'bg-card border border-border text-muted-foreground hover:bg-secondary/40'
                                                }`}
                                        >
                                            {watchDays?.includes(day) && '✓ '}
                                            {day}
                                        </button>
                                    ))}
                                </div>
                                {errors.preferences?.preferredDays && (
                                    <p className="mt-1 text-sm text-red-600">{errors.preferences.preferredDays.message}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-3">Session Format</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[
                                        { val: 'Group', label: 'Group Session', desc: 'Learn and play with peers (Max 6)' },
                                        { val: '1:1', label: 'One-to-One Session', desc: 'Dedicated attention' },
                                        { val: 'Online', label: 'Online Session', desc: 'Remote activities' },
                                    ].map((type) => (
                                        <label
                                            key={type.val}
                                            className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${watchLessonType === type.val
                                                    ? 'border-indigo-600 bg-indigo-50 scale-[1.02]'
                                                    : 'border-border hover:border-border'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                value={type.val}
                                                {...register('preferences.lessonType')}
                                                className="sr-only"
                                            />
                                            <div className="font-bold text-foreground">{type.label}</div>
                                            <div className="text-sm text-muted-foreground">{type.desc}</div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 4: Confirm */}
                {step === 4 && (
                    <div className="p-8 space-y-8 animate-fadeIn">
                        <div className="border-b pb-4">
                            <h2 className="text-2xl font-bold text-foreground">Review Application</h2>
                            <p className="text-muted-foreground">Please verify your details before submitting.</p>
                        </div>

                        <div className="bg-secondary/40 rounded-xl p-6 space-y-4 text-sm">
                            <div className="flex justify-between border-b border-border pb-2">
                                <span className="text-muted-foreground">Parent</span>
                                <span className="font-medium">{watchedParentFirstName} {watchedParentLastName}</span>
                            </div>
                            <div className="flex justify-between border-b border-border pb-2">
                                <span className="text-muted-foreground">Contact</span>
                                <span className="font-medium">{watchedParentEmail}</span>
                            </div>
                            <div className="flex justify-between border-b border-border pb-2">
                                <span className="text-muted-foreground">Student</span>
                                <span className="font-medium">{watchedChildFirstName} ({watchedChildSchoolYear})</span>
                            </div>
                            <div className="flex justify-between border-b border-border pb-2">
                                <span className="text-muted-foreground">Activities / Interests</span>
                                <span className="font-medium">{watchSubjects?.join(', ')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Preferences</span>
                                <span className="font-medium text-right">
                                    {watchLessonType}<br />
                                    <span className="text-muted-foreground font-normal">{watchDays?.join(', ')}</span>
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="flex items-start gap-3 p-4 bg-secondary/40 rounded-lg cursor-pointer">
                                <input
                                    type="checkbox"
                                    {...register('consent.terms')}
                                    className="mt-1 h-5 w-5 text-indigo-600 rounded border-border focus:ring-indigo-500"
                                />
                                <span className="text-sm text-muted-foreground">
                                    I agree to the <a href="#" className="underline text-indigo-600">Terms & Conditions</a> and consent to the processing of personal data for the purpose of this registration.
                                </span>
                            </label>
                            {errors.consent?.terms && (
                                <p className="text-sm text-red-600 px-4">{errors.consent.terms.message}</p>
                            )}

                            <label className="flex items-start gap-3 p-4 bg-secondary/40 rounded-lg cursor-pointer">
                                <input
                                    type="checkbox"
                                    {...register('consent.marketing')}
                                    className="mt-1 h-5 w-5 text-indigo-600 rounded border-border focus:ring-indigo-500"
                                />
                                <span className="text-sm text-muted-foreground">
                                    I would like to receive updates about holiday clubs and resources (optional).
                                </span>
                            </label>
                        </div>
                    </div>
                )}

                <div className="bg-secondary/40 px-8 py-6 flex justify-between gap-4">
                    {step > 1 ? (
                        <button
                            type="button"
                            onClick={() => setStep(s => s - 1)}
                            className="px-6 py-2.5 rounded-lg border border-border bg-card text-foreground font-medium hover:bg-secondary/40 transition-colors"
                        >
                            Back
                        </button>
                    ) : (
                        <div></div>
                    )}

                    {step < 4 ? (
                        <button
                            type="button"
                            onClick={nextStep}
                            className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            Continue
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-8 py-2.5 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 transition-all shadow-md flex items-center gap-2 transform active:scale-95"
                        >
                            {isSubmitting ? (
                                <>
                                    <Spinner size="sm" />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                'Submit Application'
                            )}
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}
