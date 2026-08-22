'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Centre {
    id: string;
    name: string;
}

interface StudentFormProps {
    accessibleCentres: Centre[];
}

function FormField({
    label, required, error, children,
}: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-label text-text-muted block mb-1.5">
                {label}
                {required && <span className="text-danger ml-0.5">*</span>}
            </label>
            {children}
            {error && <p className="text-metadata text-danger mt-1">{error}</p>}
        </div>
    );
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
        `w-full h-10 px-3 bg-surface border rounded-sm text-small-body text-text outline-none transition-colors focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent ${
            errors[field] ? 'border-danger' : 'border-border'
        }`;

    if (createdStudentId) {
        return (
            <div className="flex flex-col items-center justify-center py-14 text-center space-y-5">
                <div className="w-12 h-12 bg-success-soft rounded-full flex items-center justify-center">
                    <Check className="w-6 h-6 text-success" />
                </div>
                <div>
                    <h3 className="text-section-title text-text mb-1">Student added</h3>
                    <p className="text-small-body text-text-secondary">The student has been successfully registered to your centre.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button asChild>
                        <Link href={`/dashboard/students/${createdStudentId}`}>View student profile →</Link>
                    </Button>
                    <Button
                        variant="secondary"
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
                    >
                        Add another
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Global Error Summary */}
            {serverError && (
                <div className="flex items-start gap-2 p-3 bg-danger-soft text-danger rounded-sm text-small-body font-medium">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {serverError}
                </div>
            )}

            {Object.keys(errors).length > 0 && (
                <div id="error-summary" className="flex items-start gap-2 p-3 bg-warning-soft text-warning rounded-sm text-small-body">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Please check the {Object.keys(errors).length} field{Object.keys(errors).length !== 1 ? 's' : ''} marked below.</span>
                </div>
            )}

            {/* Centre assignment */}
            <div className="space-y-3">
                <h3 className="text-section-title text-text">Centre assignment</h3>
                <FormField label="Assign to centre" required error={errors.centreId}>
                    {accessibleCentres.length === 0 ? (
                        <p className="text-small-body text-text-secondary p-3 bg-page rounded-sm border border-border-subtle">
                            You have no accessible centres. Contact your organisation owner.
                        </p>
                    ) : (
                        <select name="centreId" id="centreId" value={formData.centreId} onChange={handleChange} className={inputClass('centreId')}>
                            {accessibleCentres.length > 1 && <option value="">— Select a centre —</option>}
                            {accessibleCentres.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    )}
                </FormField>
            </div>

            {/* Student details */}
            <div className="space-y-3 pt-5 border-t border-border-subtle">
                <h3 className="text-section-title text-text">Student details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="First name" required error={errors.firstName}>
                        <input type="text" name="firstName" id="firstName" value={formData.firstName} onChange={handleChange} className={inputClass('firstName')} placeholder="e.g. John" />
                    </FormField>
                    <FormField label="Last name" required error={errors.lastName}>
                        <input type="text" name="lastName" id="lastName" value={formData.lastName} onChange={handleChange} className={inputClass('lastName')} placeholder="e.g. Doe" />
                    </FormField>
                    <FormField label="Date of birth" required error={errors.dateOfBirth}>
                        <input
                            type="date" name="dateOfBirth" id="dateOfBirth"
                            max={new Date(new Date().getFullYear() - 4, 11, 31).toISOString().split('T')[0]}
                            min={new Date(new Date().getFullYear() - 16, 0, 1).toISOString().split('T')[0]}
                            value={formData.dateOfBirth} onChange={handleChange} className={inputClass('dateOfBirth')}
                        />
                    </FormField>
                    <FormField label="School year" required error={errors.schoolYear}>
                        <select name="schoolYear" id="schoolYear" value={formData.schoolYear} onChange={handleChange} className={inputClass('schoolYear')}>
                            <option value="">— Select school year —</option>
                            <option value="Reception">Reception</option>
                            <option value="Y1">Year 1</option>
                            <option value="Y2">Year 2</option>
                            <option value="Y3">Year 3</option>
                            <option value="Y4">Year 4</option>
                            <option value="Y5">Year 5</option>
                            <option value="Y6">Year 6</option>
                            <option value="Y7">Year 7</option>
                            <option value="Y8">Year 8</option>
                            <option value="Y9">Year 9</option>
                            <option value="Y10">Year 10</option>
                            <option value="Y11">Year 11</option>
                            <option value="Y12">Year 12</option>
                            <option value="Y13">Year 13</option>
                        </select>
                    </FormField>
                </div>
            </div>

            {/* Parent details */}
            <div className="space-y-3 pt-5 border-t border-border-subtle">
                <h3 className="text-section-title text-text">Parent / guardian details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="First name" required error={errors.parentFirstName}>
                        <input type="text" name="parentFirstName" id="parentFirstName" value={formData.parentFirstName} onChange={handleChange} className={inputClass('parentFirstName')} placeholder="e.g. Jane" />
                    </FormField>
                    <FormField label="Last name" required error={errors.parentLastName}>
                        <input type="text" name="parentLastName" id="parentLastName" value={formData.parentLastName} onChange={handleChange} className={inputClass('parentLastName')} placeholder="e.g. Doe" />
                    </FormField>
                    <FormField label="Email" required error={errors.parentEmail}>
                        <input type="email" name="parentEmail" id="parentEmail" value={formData.parentEmail} onChange={handleChange} className={inputClass('parentEmail')} placeholder="e.g. jane@example.com" />
                    </FormField>
                    <FormField label="Phone" required error={errors.parentPhone}>
                        <input type="tel" name="parentPhone" id="parentPhone" value={formData.parentPhone} onChange={handleChange} className={inputClass('parentPhone')} />
                    </FormField>
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-5 border-t border-border-subtle">
                <Button asChild variant="secondary" type="button">
                    <Link href="/dashboard/students">Cancel</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting || accessibleCentres.length === 0}>
                    {isSubmitting ? 'Saving…' : 'Add student'}
                </Button>
            </div>
        </form>
    );
}
