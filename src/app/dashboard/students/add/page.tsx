import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import StudentForm from '@/components/students/StudentForm';
import Link from 'next/link';

export default async function AddStudentPage() {
    const session = await auth();

    if (!session?.user?.organisationId) {
        redirect('/login');
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="max-w-2xl mx-auto">
                <header className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight headline-lg">Add New Student</h1>
                        <p className="text-on-surface-variant body-md mt-2">Register a new student to your centre</p>
                    </div>
                </header>
                <div className="bg-surface-container-high rounded-2xl shadow-xl border border-outline-variant/10 p-6">
                    <StudentForm />
                </div>
            </div>
        </div>
    );
}
