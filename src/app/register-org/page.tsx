import OrgRegistrationForm from "@/features/auth/components/OrgRegistrationForm";

export default function RegisterOrgPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full max-w-md">
                <div className="text-center mb-6">
                    <span className="text-4xl">🚀</span>
                </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <OrgRegistrationForm />
            </div>
        </div>
    );
}
