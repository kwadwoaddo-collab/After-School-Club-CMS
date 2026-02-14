import Link from "next/link";

export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900">
            {/* Decorative elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
            </div>

            {/* Main content */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-16">

                {/* Hero section */}
                <div className="text-center max-w-3xl mb-12">
                    <div className="mb-6 flex justify-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center shadow-lg">
                            <span className="text-3xl">🚀</span>
                        </div>
                    </div>

                    {/* TRUST BADGE */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-full border border-purple-500/20 mb-6 backdrop-blur-sm animate-fade-in-up">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span className="text-purple-200 font-medium text-sm">
                            Access for Tuition Centres
                        </span>
                    </div>

                    <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
                        The One-Stop Shop to
                        <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                            Manage Your Tuition Business
                        </span>
                    </h1>
                    <p className="text-xl text-purple-100/80 max-w-xl mx-auto leading-relaxed mb-8">
                        Streamline bookings, student registrations, invoicing, and staff management—all in one place.
                    </p>

                    <div className="flex justify-center gap-4">
                        <Link href="/signup" className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-full shadow-lg hover:shadow-purple-500/25 transition-all hover:scale-105 backdrop-blur-sm">
                            Get Started for Free
                        </Link>
                    </div>
                </div>

                {/* Features */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl text-center w-full">
                    {[
                        { icon: "📅", label: "Bookings", desc: "Automate assessments & schedule classes" },
                        { icon: "📝", label: "Registration", desc: "Digital enrollment forms & student data" },
                        { icon: "💳", label: "Invoicing", desc: "Automated billing & payment tracking" },
                        { icon: "👥", label: "Staff", desc: "Manage tutors, shifts & payroll" },
                    ].map((feature, i) => (
                        <div key={i} className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                            <span className="text-3xl mb-3">{feature.icon}</span>
                            <span className="font-semibold text-white text-lg mb-1">{feature.label}</span>
                            <span className="text-sm text-purple-200/60">{feature.desc}</span>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="absolute bottom-6 text-center text-purple-200/40 text-sm">
                    <p>Powered by SPRINTSCALE IT</p>
                </div>
            </div>
        </div>
    );
}
