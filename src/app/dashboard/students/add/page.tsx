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
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-2xl mx-auto">
                <header className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Add New Student</h1>
                        <p className="text-gray-500 text-sm mt-1">Register a new student to your centre</p>
                    </div>
                    <Link
                        href="/dashboard"
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors mt-2"
                    >
                        ← Back to Dashboard
                    </Link>
                </header>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <StudentForm />
                </div>
            </div>
        </div>
    );
}
