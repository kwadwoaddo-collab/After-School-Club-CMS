'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentForm() {
    const router = useRouter();

    // 1. Manual State for everything
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        schoolYear: '',
        parentFirstName: '',
        parentLastName: '',
        parentEmail: '',
        parentPhone: '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    // 2. Clearer validation logic
    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
        if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
        if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
        if (!formData.schoolYear.trim()) newErrors.schoolYear = 'School year is required';
        if (!formData.parentFirstName.trim()) newErrors.parentFirstName = 'Parent first name is required';
        if (!formData.parentLastName.trim()) newErrors.parentLastName = 'Parent last name is required';

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Remove error message as user types
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

        // Run validation
        if (!validate()) {
            console.log("Validation Failed in Production:", errors);
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

            router.push('/dashboard');
            router.refresh();
        } catch (err) {
            setServerError(err instanceof Error ? err.message : 'Something went wrong');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Global Error Summary */}
            {serverError && (
                <div className="p-4 bg-red-100 text-red-800 rounded-lg text-sm border-2 border-red-300 shadow-sm font-bold">
                    ⚠️ {serverError}
                </div>
            )}

            {Object.keys(errors).length > 0 && (
                <div id="error-summary" className="p-4 bg-amber-50 text-amber-900 rounded-lg text-sm border-2 border-amber-400 shadow-sm animate-pulse">
                    <div className="flex items-center gap-2 font-bold mb-1">
                        <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Missing Required Statistics
                    </div>
                    <p className="font-semibold text-lg">Please check the {Object.keys(errors).length} fields marked in red below.</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Student Details */}
                <div className="md:col-span-2">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Student Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                            <input
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 border rounded-lg transition-all ${errors.firstName ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-gray-300'}`}
                            />
                            {errors.firstName && <p className="text-red-600 text-xs font-bold mt-1 uppercase">{errors.firstName}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                            <input
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 border rounded-lg transition-all ${errors.lastName ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-gray-300'}`}
                            />
                            {errors.lastName && <p className="text-red-600 text-xs font-bold mt-1 uppercase">{errors.lastName}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                            <input
                                type="date"
                                name="dateOfBirth"
                                value={formData.dateOfBirth}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 border rounded-lg transition-all ${errors.dateOfBirth ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-gray-300'}`}
                            />
                            {errors.dateOfBirth && <p className="text-red-600 text-xs font-bold mt-1 uppercase">{errors.dateOfBirth}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">School Year</label>
                            <input
                                name="schoolYear"
                                value={formData.schoolYear}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 border rounded-lg transition-all ${errors.schoolYear ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-gray-300'}`}
                                placeholder="e.g. Year 5"
                            />
                            {errors.schoolYear && <p className="text-red-600 text-xs font-bold mt-1 uppercase">{errors.schoolYear}</p>}
                        </div>
                    </div>
                </div>

                {/* Parent Details */}
                <div className="md:col-span-2 border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Parent / Guardian Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                            <input
                                name="parentFirstName"
                                value={formData.parentFirstName}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 border rounded-lg transition-all ${errors.parentFirstName ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-gray-300'}`}
                            />
                            {errors.parentFirstName && <p className="text-red-600 text-xs font-bold mt-1 uppercase">{errors.parentFirstName}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                            <input
                                name="parentLastName"
                                value={formData.parentLastName}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 border rounded-lg transition-all ${errors.parentLastName ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-gray-300'}`}
                            />
                            {errors.parentLastName && <p className="text-red-600 text-xs font-bold mt-1 uppercase">{errors.parentLastName}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                name="parentEmail"
                                value={formData.parentEmail}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 border rounded-lg transition-all ${errors.parentEmail ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-gray-300'}`}
                            />
                            {errors.parentEmail && <p className="text-red-600 text-xs font-bold mt-1 uppercase">{errors.parentEmail}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                            <input
                                type="tel"
                                name="parentPhone"
                                value={formData.parentPhone}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 border rounded-lg transition-all ${errors.parentPhone ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-gray-300'}`}
                            />
                            {errors.parentPhone && <p className="text-red-600 text-xs font-bold mt-1 uppercase">{errors.parentPhone}</p>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-6">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-10 py-4 bg-purple-600 text-white font-black text-lg rounded-xl hover:bg-purple-700 shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Saving...' : 'ADD STUDENT'}
                </button>
            </div>
        </form>
    );
}
