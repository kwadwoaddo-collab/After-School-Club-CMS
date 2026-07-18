'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Centre {
    id: string;
    name: string;
}

interface StudentFormProps {
    accessibleCentres: Centre[];
}

export default function StudentForm({ accessibleCentres }: StudentFormProps) {
    const router = useRouter();

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        schoolYear: '',
        parentFirstName: '',
        parentLastName: '',
        parentEmail: '',
        parentPhone: '',
        centreId: accessibleCentres.length === 1 ? accessibleCentres[0].id : '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [createdStudentId, setCreatedStudentId] = useState<string | null>(null);

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
        if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
        if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
        if (!formData.schoolYear.trim()) newErrors.schoolYear = 'School year is required';
        if (!formData.parentFirstName.trim()) newErrors.parentFirstName = 'Parent first name is required';
        if (!formData.parentLastName.trim()) newErrors.parentLastName = 'Parent last name is required';
        if (!formData.centreId) newErrors.centreId = 'Please assign the student to a centre';

        if (!formData.parentEmail.trim()) {
            newErrors.parentEmail = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.parentEmail)) {
            newErrors.parentEmail = 'Invalid email address';
        }

        if (!formData.parentPhone.trim()) {
            newErrors.parentPhone = 'Phone number is required';
        } else if (formData.parentPhone.length < 10) {
            newErrors.parentPhone = 'Invalid phone number (min 10 digits)';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (errors[name]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setServerError(null);

        if (!validate()) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to add student');
            }

            const data = await res.json();
            if (data.id) {
                setCreatedStudentId(data.id);
            } else {
                router.push('/dashboard/students');
                router.refresh();
            }
        } catch (err) {
            setServerError(err instanceof Error ? err.message : 'Something went wrong');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClass = (field: string) =>
        `w-full px-4 py-3 bg-[#13151a] border rounded-2xl text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
            errors[field]
                ? 'border-rose-500/50 bg-rose-500/5 ring-2 ring-error/20 focus:border-rose-500'
                : 'border-[#2a2d35] focus:border-primary'
        }`;

    if (createdStudentId) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-400/20 rounded-3xl flex items-center justify-center">
                    <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Student Added!</h3>
                    <p className="text-on-surface-variant font-medium">The student has been successfully registered to your centre.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href={`/dashboard/students/${createdStudentId}`}
                        className="px-6 py-3 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 glow-btn"
                    >
                        View Student Profile →
                    </Link>
                    <button
                        onClick={() => {
                            setCreatedStudentId(null);
                            setFormData({
                                firstName: '',
                                lastName: '',
                                dateOfBirth: '',
                                schoolYear: '',
                                parentFirstName: '',
                                parentLastName: '',
                                parentEmail: '',
                                parentPhone: '',
                                centreId: accessibleCentres.length === 1 ? accessibleCentres[0].id : '',
                            });
                        }}
                        className="px-6 py-3 bg-card border border-outline-variant/10 text-white font-bold rounded-2xl hover:bg-card transition-all"
                    >
                        Add Another
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Global Error Summary */}
            {serverError && (
                <div className="p-4 bg-error-container/10 text-rose-500 rounded-xl text-sm border border-rose-500/20 font-bold">
                    ⚠️ {serverError}
                </div>
            )}

            {Object.keys(errors).length > 0 && (
                <div id="error-summary" className="p-4 bg-amber-500/10 text-amber-400 rounded-xl text-sm border border-amber-500/20 animate-pulse">
                    <div className="flex items-center gap-2 font-bold mb-1">
                        <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Missing Required Fields
                    </div>
                    <p className="font-semibold text-sm text-amber-300">Please check the {Object.keys(errors).length} fields marked in red below.</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Centre Assignment */}
                <div className="md:col-span-2">
                    <h3 className="text-lg font-bold text-white mb-4">Centre Assignment</h3>
                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-1">
                            Assign to Centre <span className="text-rose-500">*</span>
                        </label>
                        {accessibleCentres.length === 0 ? (
                            <p className="text-on-surface-variant text-sm p-3 bg-card-low rounded-xl border border-outline-variant/10">
                                You have no accessible centres. Contact your organisation owner.
                            </p>
                        ) : (
                            <select
                                name="centreId"
                                id="centreId"
                                value={formData.centreId}
                                onChange={handleChange}
                                className={inputClass('centreId')}
                            >
                                {accessibleCentres.length > 1 && (
                                    <option value="">— Select a centre —</option>
                                )}
                                {accessibleCentres.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        )}
                        {errors.centreId && <p className="text-rose-500 text-[10px] font-bold mt-1.5 uppercase tracking-wider">{errors.centreId}</p>}
                    </div>
                </div>

                {/* Student Details */}
                <div className="md:col-span-2 border-t border-outline-variant/10 pt-6">
                    <h3 className="text-lg font-bold text-white mb-4">Student Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-1">First Name</label>
                            <input name="firstName" id="firstName" value={formData.firstName} onChange={handleChange} className={inputClass('firstName')} />
                            {errors.firstName && <p className="text-rose-500 text-[10px] font-bold mt-1.5 uppercase tracking-wider">{errors.firstName}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-1">Last Name</label>
                            <input name="lastName" id="lastName" value={formData.lastName} onChange={handleChange} className={inputClass('lastName')} />
                            {errors.lastName && <p className="text-rose-500 text-[10px] font-bold mt-1.5 uppercase tracking-wider">{errors.lastName}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-1">Date of Birth</label>
                            <input type="date" name="dateOfBirth" id="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} className={inputClass('dateOfBirth')} />
                            {errors.dateOfBirth && <p className="text-rose-500 text-[10px] font-bold mt-1.5 uppercase tracking-wider">{errors.dateOfBirth}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-1">School Year</label>
                            <input name="schoolYear" id="schoolYear" value={formData.schoolYear} onChange={handleChange} className={inputClass('schoolYear')} placeholder="e.g. Year 5" />
                            {errors.schoolYear && <p className="text-rose-500 text-[10px] font-bold mt-1.5 uppercase tracking-wider">{errors.schoolYear}</p>}
                        </div>
                    </div>
                </div>

                {/* Parent Details */}
                <div className="md:col-span-2 border-t border-outline-variant/10 pt-6">
                    <h3 className="text-lg font-bold text-white mb-4">Parent / Guardian Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-1">First Name</label>
                            <input name="parentFirstName" id="parentFirstName" value={formData.parentFirstName} onChange={handleChange} className={inputClass('parentFirstName')} />
                            {errors.parentFirstName && <p className="text-rose-500 text-[10px] font-bold mt-1.5 uppercase tracking-wider">{errors.parentFirstName}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-1">Last Name</label>
                            <input name="parentLastName" id="parentLastName" value={formData.parentLastName} onChange={handleChange} className={inputClass('parentLastName')} />
                            {errors.parentLastName && <p className="text-rose-500 text-[10px] font-bold mt-1.5 uppercase tracking-wider">{errors.parentLastName}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-1">Email</label>
                            <input type="email" name="parentEmail" id="parentEmail" value={formData.parentEmail} onChange={handleChange} className={inputClass('parentEmail')} />
                            {errors.parentEmail && <p className="text-rose-500 text-[10px] font-bold mt-1.5 uppercase tracking-wider">{errors.parentEmail}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-1">Phone</label>
                            <input type="tel" name="parentPhone" id="parentPhone" value={formData.parentPhone} onChange={handleChange} className={inputClass('parentPhone')} />
                            {errors.parentPhone && <p className="text-rose-500 text-[10px] font-bold mt-1.5 uppercase tracking-wider">{errors.parentPhone}</p>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-6">
                <button
                    type="submit"
                    disabled={isSubmitting || accessibleCentres.length === 0}
                    className="px-10 py-4 bg-primary text-white font-bold text-lg rounded-2xl hover:bg-primary/90 shadow-xl shadow-primary/30 glow-btn active:scale-95 transition-all disabled:opacity-50 disabled:bg-[#2a2d35] disabled:shadow-none disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Saving...' : 'Add Student'}
                </button>
            </div>
        </form>
    );
}
