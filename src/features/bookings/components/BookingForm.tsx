'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
    bookingSchema,
    parentSchema,
    childSchema,
    appointmentSchema,
    type BookingInput,
    type ChildInput
} from '@/lib/validations/booking';
import { z } from 'zod';
interface BookingFormProps {
    centreId: string;
    centreName: string;
    operatingHours?: string | null;
    brandColor?: string;
    backToCentresUrl?: string;
    rescheduleData?: any;
}

interface TimeSlot {
    startAt: string;
    endAt: string;
    available: boolean;
}

function formatAmPm(time: string) {
    if (!time) return '';
    const [hStr, mStr] = time.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'pm' : 'am';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m} ${ampm}`;
}

// Loading Spinner Component
function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
    return (
        <svg className={`animate-spin ${sizes[size]} text-current`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}

// Error Alert Component
function ErrorAlert({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <div className="flex-1">
                <p className="text-sm text-red-800">{message}</p>
            </div>
            <button onClick={onDismiss} className="text-red-600 hover:text-red-800">
                Dismiss
            </button>
        </div>
    );
}

const SUBJECTS = ['Maths', 'English', 'Science', 'Other'] as const;
const DEFAULT_DURATION = 60;
const SCHOOL_YEARS = ['Reception', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10', 'Y11', 'Y12', 'Y13'];

export default function BookingForm({ centreId, centreName, operatingHours, brandColor = '#4F46E5', backToCentresUrl, rescheduleData }: BookingFormProps) {
    // ... state ...
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [confirmationCode, setConfirmationCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [daySchedule, setDaySchedule] = useState<{ start: string; end: string; open: boolean } | null>(null);

    // Calculate day schedule when date changes
    useEffect(() => {
        if (!selectedDate) {
            setDaySchedule(null);
            return;
        }
        try {
            const parsedHours = operatingHours ? JSON.parse(operatingHours) : {
                monday: { open: true, start: '09:00', end: '17:00' },
                tuesday: { open: true, start: '09:00', end: '17:00' },
                wednesday: { open: true, start: '09:00', end: '17:00' },
                thursday: { open: true, start: '09:00', end: '17:00' },
                friday: { open: true, start: '09:00', end: '17:00' },
                saturday: { open: false, start: '09:00', end: '13:00' },
                sunday: { open: false, start: '09:00', end: '13:00' }
            };
            const dateObj = new Date(selectedDate);
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayOfWeek = days[dateObj.getDay()];
            setDaySchedule(parsedHours[dayOfWeek] || null);
        } catch (e) {
            console.error('Failed to parse operating hours', e);
            setDaySchedule(null);
        }
    }, [selectedDate, operatingHours]);

    // ... useForm hook ...
    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        getValues,
        setError: setFormError,
        clearErrors,
        reset,
        formState: { errors },
    } = useForm<BookingInput>({
        resolver: zodResolver(bookingSchema),
        defaultValues: {
            parent: {
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                preferredContact: 'email',
            },
            appointment: {
                centreId,
                modality: 'in_person',
                duration: DEFAULT_DURATION,
                startAt: '',
            },
            children: [{
                firstName: '',
                lastName: '',
                subjects: [],
                schoolYear: 'Y1',
                dateOfBirth: '',
                notes: '',
            }],
            consent: {
                communications: false as any,
            },
            rescheduleId: rescheduleData?.id,
        },
    });

    // ... hooks ...
    const { fields, append, remove } = useFieldArray({
        control,
        name: 'children',
    });

    // Populate data if rescheduling
    useEffect(() => {
        if (rescheduleData) {
            console.log('[BOOKING] Rescheduling mode detected', rescheduleData);

            // Prefill Parent
            if (rescheduleData.parent) {
                setValue('parent.firstName', rescheduleData.parent.firstName);
                setValue('parent.lastName', rescheduleData.parent.lastName);
                setValue('parent.email', rescheduleData.parent.email || '');
                setValue('parent.phone', rescheduleData.parent.phone || '');
                setValue('parent.preferredContact', rescheduleData.parent.preferredContact);
            }

            // Prefill Children
            if (rescheduleData.attendees && rescheduleData.attendees.length > 0) {
                const prefilledChildren = rescheduleData.attendees.map((a: any) => ({
                    firstName: a.child.firstName,
                    lastName: a.child.lastName,
                    schoolYear: a.child.schoolYear,
                    dateOfBirth: a.child.dateOfBirth ? new Date(a.child.dateOfBirth).toISOString().split('T')[0] : '',
                    subjects: a.child.subjects.map((s: any) => s.subject),
                    notes: a.child.notes || '',
                }));
                setValue('children', prefilledChildren);
            }

            // Prefill modality
            setValue('appointment.modality', rescheduleData.modality);

            // Auto-consent for rescheduling
            setValue('consent.communications', true as any);

            // Skip to Step 3 (Appointment selection)
            setStep(3);
        }
    }, [rescheduleData, setValue]);

    const modality = watch('appointment.modality');
    const watchedChildren = watch('children');

    // ... useEffect for fetchSlots ...
    useEffect(() => {
        if (!selectedDate) return;

        const fetchSlots = async () => {
            setLoadingSlots(true);
            setTimeSlots([]);
            try {
                const res = await fetch(`/api/availability?centreId=${centreId}&date=${selectedDate}&duration=${DEFAULT_DURATION}&modality=${modality}`);
                if (res.ok) {
                    const data = await res.json();
                    setTimeSlots(data.slots || []);
                }
            } catch {
                console.error('Failed to fetch slots');
            } finally {
                setLoadingSlots(false);
            }
        };

        fetchSlots();
    }, [selectedDate, modality, centreId]);

    // ... validateStep ...
    const validateStep = async () => {
        setError(null);
        clearErrors();

        const data = getValues();
        let result: any;

        console.log('[BOOKING] Validating Step:', step);

        if (step === 1) {
            result = parentSchema.safeParse(data.parent);
        } else if (step === 2) {
            result = z.array(childSchema).min(1).safeParse(data.children);
        } else if (step === 3) {
            result = appointmentSchema.safeParse(data.appointment);
        }

        if (result && !result.success) {
            console.log('[BOOKING] Validation Failed:', result.error.issues);

            // Map Zod errors back to React Hook Form
            result.error.issues.forEach((issue: any) => {
                const stepPath = step === 1 ? 'parent' : step === 2 ? 'children' : 'appointment';
                const fieldPath = issue.path.join('.');
                const fullPath = `${stepPath}.${fieldPath}` as any;

                setFormError(fullPath, {
                    type: 'manual',
                    message: issue.message
                });
            });

            setError('Please correct the red fields below to continue.');
            toast.error('Please correct the highlighted fields.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        // Additional custom validation for step 3 time between min and max limits
        if (step === 3 && daySchedule && daySchedule.open) {
            const timeVal = data.appointment.startAt;
            const currentMinTime = daySchedule.start;
            const currentMaxTime = daySchedule.end;
            
            if (timeVal < currentMinTime || timeVal > currentMaxTime) {
                const errorMsg = `Time must be between ${formatAmPm(currentMinTime)} and ${formatAmPm(currentMaxTime)}`;
                setFormError('appointment.startAt', {
                    type: 'manual',
                    message: errorMsg
                });
                setError(errorMsg);
                toast.error(errorMsg);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
        }

        // If we reach here, validation for the current step passed
        console.log('[BOOKING] Step', step, 'Validation OK');
        setStep(prev => prev + 1);
    };

    // ... onSubmit ...
    const onSubmit = async (data: BookingInput) => {
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Booking failed');
            }

            const result = await response.json();
            toast.success('Booking Confirmed!');
            setConfirmationCode(result.confirmationCode);
            setSuccess(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Booking failed. Please try again.';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const today = new Date().toISOString().split('T')[0];
    const maxDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Dynamic brand styles
    const brandStyles = (
        <style jsx global>{`
            .brand-text { color: ${brandColor}; }
            .brand-bg { background-color: ${brandColor}; }
            .brand-border { border-color: ${brandColor}; }
            .brand-ring:focus { --tw-ring-color: ${brandColor}; ring-color: ${brandColor}; }
            
            .brand-btn {
                background-color: ${brandColor};
                color: white;
            }
            .brand-btn:hover {
                filter: brightness(0.9);
            }
            .brand-btn-outline {
                border-color: ${brandColor};
                color: ${brandColor};
            }
            .brand-btn-outline:hover {
                background-color: ${brandColor}10; /* 10% opacity */
            }
            
            .brand-checkbox:checked {
                background-color: ${brandColor};
                border-color: ${brandColor};
            }
        `}</style>
    );

    if (success) {
        return (
            <div className="text-center py-12">
                {brandStyles}
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6 animate-bounce">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    {rescheduleData ? 'Reschedule Confirmed!' : 'Booking Confirmed!'}
                </h2>
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 max-w-md mx-auto mb-8 text-left space-y-5 animate-fadeIn">
                    <div className="border-b border-gray-100 pb-4">
                        <p className="text-sm font-medium text-gray-500 mb-1">Child(ren)</p>
                        <p className="text-lg font-semibold text-gray-900">
                            {watchedChildren.map(c => `${c.firstName} ${c.lastName}`).filter(n => n.trim() !== '').join(', ') || 'Not specified'}
                        </p>
                    </div>
                    <div className="border-b border-gray-100 pb-4">
                        <p className="text-sm font-medium text-gray-500 mb-1">Date & Time</p>
                        <p className="text-lg font-semibold text-gray-900">
                            {watch('appointment.startAt') ? new Date(watch('appointment.startAt').includes('T') ? watch('appointment.startAt') : `${selectedDate}T${watch('appointment.startAt')}:00`).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'Not selected'}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Centre</p>
                        <p className="text-lg font-semibold text-gray-900">{centreName}</p>
                    </div>
                </div>

                <div className="bg-blue-50/80 rounded-lg p-4 max-w-md mx-auto flex items-start gap-3 text-left">
                    <span className="text-blue-500 text-xl mt-0.5">📧</span>
                    <p className="text-sm text-blue-900 leading-relaxed">
                        You&apos;ll receive a {rescheduleData ? 'updated ' : ''}confirmation email shortly with all the details.
                    </p>
                </div>

                <div className="mt-10">
                    <Link
                        href={backToCentresUrl || '#'}
                        onClick={(e) => {
                            if (!backToCentresUrl) {
                                e.preventDefault();
                                window.location.reload();
                            }
                        }}
                        className="brand-btn inline-block py-3 px-12 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                        Done
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div>
            {brandStyles}

            {/* Top Navigation Link */}
            <div className="mb-4">
                {step === 1 ? (
                    backToCentresUrl && (
                        <Link href={backToCentresUrl} className="inline-flex items-center text-gray-500 hover:text-gray-800 text-sm transition-colors group">
                            <svg className="w-4 h-4 mr-1 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Centres
                        </Link>
                    )
                ) : (
                    <button
                        type="button"
                        onClick={() => setStep(step - 1)}
                        className="inline-flex items-center text-gray-500 hover:text-gray-800 text-sm transition-colors group"
                    >
                        <svg className="w-4 h-4 mr-1 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                )}
            </div>

            {/* Progress Steps */}
            <div className="flex justify-center mb-8">
                {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex items-center">
                        <button
                            type="button"
                            onClick={() => { if (s < step) setStep(s); }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all
                  ${step >= s ? 'brand-bg text-white' : 'bg-gray-200 text-gray-500'}
                  ${s < step ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                        >
                            {step > s ? '✓' : s}
                        </button>
                        {s < 4 && (
                            <div className={`w-8 md:w-16 h-1 mx-1 md:mx-2 rounded ${step > s ? 'brand-bg' : 'bg-gray-200'}`} />
                        )}
                    </div>
                ))}
            </div>

            <div className="hidden md:flex justify-between text-xs text-gray-500 mb-8 px-4">
                <span className={step >= 1 ? 'brand-text font-medium' : ''}>Parent</span>
                <span className={step >= 2 ? 'brand-text font-medium' : ''}>Children</span>
                <span className={step >= 3 ? 'brand-text font-medium' : ''}>Appointment</span>
                <span className={step >= 4 ? 'brand-text font-medium' : ''}>Confirm</span>
            </div>

            {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                {/* Step 1: Parent Details */}
                {step === 1 && (
                    <div className="bg-gray-50 p-6 rounded-lg space-y-6 animate-fadeIn">
                        <h2 className="text-xl font-semibold text-gray-900">Parent Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-800 mb-1">First Name *</label>
                                <input {...register('parent.firstName')} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-gray-900" placeholder="Enter first name" />
                                {errors.parent?.firstName && <p className="text-red-600 text-sm mt-1">{errors.parent.firstName.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-800 mb-1">Last Name *</label>
                                <input {...register('parent.lastName')} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-gray-900" placeholder="Enter last name" />
                                {errors.parent?.lastName && <p className="text-red-600 text-sm mt-1">{errors.parent.lastName.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-800 mb-1">Email <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="email" {...register('parent.email')} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-gray-900" placeholder="email@example.com" />
                                {errors.parent?.email && <p className="text-red-600 text-sm mt-1">{errors.parent.email.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-800 mb-1">Phone *</label>
                                <input type="tel" {...register('parent.phone')} placeholder="07xxx xxxxxx" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-gray-900" />
                                {errors.parent?.phone && <p className="text-red-600 text-sm mt-1">{errors.parent.phone.message}</p>}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-800 mb-2">Preferred Contact Method</label>
                                <div className="flex gap-4">
                                    {['email', 'phone'].map((method) => {
                                        const isSelected = watch('parent.preferredContact') === method;
                                        return (
                                            <label key={method} className={`flex-1 flex items-center justify-center gap-2 cursor-pointer py-3 rounded-lg border-2 transition-all ${isSelected ? 'border-gray-800 bg-gray-50 text-gray-900 font-semibold shadow-sm' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}>
                                                <input type="radio" {...register('parent.preferredContact')} value={method} className="sr-only" />
                                                <span className="capitalize">{method}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {errors.parent?.preferredContact && <p className="text-red-600 text-sm mt-2">{errors.parent.preferredContact.message}</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Children Details */}
                {step === 2 && (
                    <div className="space-y-6 animate-fadeIn">
                        {fields.map((field, index) => (
                            <div key={field.id} className="bg-gray-50 p-6 rounded-lg space-y-6 relative border border-gray-200 shadow-sm">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-lg font-semibold text-gray-800">Child {index + 1}</h3>
                                    {fields.length > 1 && (
                                        <button type="button" onClick={() => remove(index)} className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center">Remove</button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-800 mb-1">First Name *</label>
                                        <input {...register(`children.${index}.firstName`)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-gray-900" placeholder="Child's first name" />
                                        {errors.children?.[index]?.firstName && <p className="text-red-600 text-sm mt-1">{errors.children[index]?.firstName?.message}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-800 mb-1">Last Name *</label>
                                        <input {...register(`children.${index}.lastName`)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-gray-900" placeholder="Child's last name" />
                                        {errors.children?.[index]?.lastName && <p className="text-red-600 text-sm mt-1">{errors.children[index]?.lastName?.message}</p>}
                                    </div>
                                    <div className="hidden">
                                        <label className="block text-sm font-medium text-slate-800 mb-1">Date of Birth</label>
                                        <input type="date" {...register(`children.${index}.dateOfBirth`)} max={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-gray-900" />
                                        {errors.children?.[index]?.dateOfBirth && <p className="text-red-600 text-sm mt-1">{errors.children[index]?.dateOfBirth?.message}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-800 mb-1">School Year *</label>
                                        <select {...register(`children.${index}.schoolYear`)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-gray-900">
                                            <option value="">Select year...</option>
                                            {SCHOOL_YEARS.map(year => <option key={year} value={year}>{year}</option>)}
                                        </select>
                                        {errors.children?.[index]?.schoolYear && <p className="text-red-600 text-sm mt-1">{errors.children[index]?.schoolYear?.message}</p>}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-800 mb-2">Subjects for Assessment *</label>
                                        <Controller
                                            name={`children.${index}.subjects`}
                                            control={control}
                                            render={({ field }) => (
                                                <div className="flex flex-wrap gap-3">
                                                    {SUBJECTS.map((subject) => {
                                                        const isSelected = field.value?.includes(subject);
                                                        return (
                                                            <button
                                                                key={subject}
                                                                type="button"
                                                                onClick={() => {
                                                                    const newValue = isSelected ? field.value?.filter((s) => s !== subject) : [...(field.value || []), subject];
                                                                    field.onChange(newValue);
                                                                }}
                                                                className={`px-4 py-2 rounded-full border-2 font-medium transition-all ${isSelected ? 'brand-bg brand-border text-white' : 'bg-white border-gray-300 text-slate-800 hover:border-gray-400'}`}
                                                            >
                                                                {isSelected && '✓ '}{subject}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        />
                                        {watchedChildren[index]?.subjects?.includes('Other') && (
                                            <div className="mt-2 animate-fadeIn">
                                                <input
                                                    {...register(`children.${index}.customSubject`)}
                                                    placeholder="Please specify subject..."
                                                    className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-sm bg-blue-50/50 text-gray-900"
                                                />
                                            </div>
                                        )}
                                        {errors.children?.[index]?.subjects && <p className="text-red-600 text-sm mt-2">{errors.children[index]?.subjects?.message}</p>}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-800 mb-1">Additional Notes (Optional)</label>
                                        <textarea {...register(`children.${index}.notes`)} rows={2} placeholder="Any additional information..." className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-gray-900" />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => append({ firstName: '', lastName: '', subjects: [], schoolYear: 'Y1', dateOfBirth: '' })}
                            className="w-full py-3 border-2 border-dashed rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 brand-btn-outline"
                        >
                            + Add Another Child
                        </button>
                    </div>
                )
                }

                {/* Step 3: Appointment */}
                {
                    step === 3 && (
                        <div className="bg-gray-50 p-6 rounded-lg space-y-6 animate-fadeIn">
                            <h2 className="text-xl font-semibold text-gray-900">Choose Appointment</h2>
                            <div>
                                <label className="block text-sm font-medium text-slate-800 mb-2">Session Type</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { value: 'in_person', label: '🏫 In-Person', desc: `At ${centreName}`, disabled: false },
                                        // Task 3: Online is disabled — greyed out and not selectable
                                        { value: 'online', label: '💻 Online', desc: 'Coming Soon', disabled: true },
                                    ].map((opt) => (
                                        <label
                                            key={opt.value}
                                            className={`p-4 border-2 rounded-lg text-center transition-all ${
                                                opt.disabled
                                                    ? 'border-gray-200 bg-gray-50 opacity-50 pointer-events-none cursor-not-allowed'
                                                    : modality === opt.value
                                                        ? 'brand-border bg-white shadow-md cursor-pointer'
                                                        : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                                            }`}
                                        >
                                            <input type="radio" {...register('appointment.modality')} value={opt.value} disabled={opt.disabled} className="sr-only" />
                                            <div className={`text-lg font-medium ${opt.disabled ? 'text-gray-400' : modality === opt.value ? 'brand-text' : 'text-gray-900'}`}>{opt.label}</div>
                                            <div className="text-sm text-gray-500">{opt.desc}</div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                {/* Task 4: Date is now mandatory — label updated and helptext added */}
                                <label className="block text-sm font-medium text-slate-800 mb-2">Select Date *</label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => {
                                        setSelectedDate(e.target.value);
                                        setValue('appointment.date', e.target.value);
                                        // Reset time slot when date changes
                                        setValue('appointment.startAt', '');
                                    }}
                                    min={today}
                                    max={maxDate}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-gray-900"
                                /></div>

                            {selectedDate && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-800 mb-2">Available Times</label>
                                    {daySchedule && !daySchedule.open ? (
                                        <div className="text-center py-8 text-gray-500 bg-gray-100 rounded-lg"><p>The centre is closed on this day.</p></div>
                                    ) : (
                                        <div className="mt-2">
                                            <input
                                                type="time"
                                                {...register('appointment.startAt')}
                                                min={daySchedule?.start || '00:00'}
                                                max={daySchedule?.end || '23:59'}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 brand-ring focus:border-transparent outline-none text-gray-900"
                                            />
                                            <p className="mt-2 text-sm text-gray-500 font-medium">
                                                Centre hours: <span className="text-gray-900 font-semibold">{formatAmPm(daySchedule?.start || '00:00')} - {formatAmPm(daySchedule?.end || '23:59')}</span>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                }

                {/* Step 4: Confirm */}
                {
                    step === 4 && (
                        <div className="bg-gray-50 p-6 rounded-lg space-y-6 animate-fadeIn">
                            <h2 className="text-xl font-semibold text-gray-900">Confirm Booking</h2>
                            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                                <div className="px-4 py-3 flex justify-between"><span className="text-gray-500">Centre</span><span className="font-medium text-gray-900">{centreName}</span></div>
                                <div className="px-4 py-3 flex justify-between"><span className="text-gray-500">Session Type</span><span className="font-medium text-gray-900">{modality === 'in_person' ? '🏫 In-Person' : '💻 Online'}</span></div>
                                <div className="px-4 py-3 flex justify-between"><span className="text-gray-500">Date & Time</span><span className="font-medium text-gray-900">{watch('appointment.startAt') ? new Date(watch('appointment.startAt').includes('T') ? watch('appointment.startAt') : `${selectedDate}T${watch('appointment.startAt')}:00`).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not selected'}</span></div>

                                {watchedChildren.map((child, i) => (
                                    <div key={i} className="px-4 py-3">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-gray-500">Child {i + 1}</span>
                                            <span className="font-medium text-gray-900">{child.firstName} {child.lastName}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Subjects</span>
                                            <span className="font-medium text-gray-900">{child.subjects?.join(', ') || 'No subjects'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" {...register('consent.communications')} className="mt-1 h-5 w-5 brand-checkbox rounded focus:ring-0" style={{ accentColor: brandColor }} />
                                    <span className="text-sm text-amber-800">I consent to {centreName} processing my data. *</span>
                                </label>
                                {errors.consent?.communications && <p className="text-red-600 text-sm mt-2">{errors.consent.communications.message}</p>}
                            </div>
                        </div>
                    )
                }

                {/* Buttons */}
                <div className="flex gap-4">
                    {step > 1 && (
                        <button type="button" onClick={() => setStep(step - 1)} className="flex-1 py-3 px-6 border border-gray-300 text-slate-800 rounded-lg font-semibold hover:bg-gray-50 transition-colors">← Back</button>
                    )}
                    {step < 4 ? (
                        // Task 4: on step 3, require both a date AND a valid time slot before enabling Continue
                        <button
                            type="button"
                            onClick={validateStep}
                            disabled={step === 3 && (!selectedDate || !watch('appointment.startAt') || (() => {
                                const timeVal = watch('appointment.startAt');
                                if (!timeVal || !daySchedule || !daySchedule.open) return true;
                                const currentMinTime = daySchedule.start;
                                const currentMaxTime = daySchedule.end;
                                return timeVal < currentMinTime || timeVal > currentMaxTime;
                            })())}
                            className="flex-1 brand-btn py-3 px-6 rounded-lg font-semibold transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Continue →
                        </button>
                    ) : (
                        <button type="submit" disabled={isSubmitting} className="flex-1 brand-btn py-3 px-6 rounded-lg font-semibold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            {isSubmitting ? <><Spinner size="sm" /><span>Booking...</span></> : 'Confirm Booking ✓'}
                        </button>
                    )}
                </div>
            </form >
        </div >
    );
}
