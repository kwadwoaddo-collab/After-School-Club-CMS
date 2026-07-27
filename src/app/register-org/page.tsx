import OrgRegistrationForm from "@/features/auth/components/OrgRegistrationForm";

export default function RegisterOrgPage() {
    return (
        <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden" style={{ backgroundColor: '#05070A' }}>
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/6 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
                </div>
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
