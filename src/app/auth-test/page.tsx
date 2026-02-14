
import { signIn } from "@/lib/auth";

export default function AuthTestPage() {
    const googleId = process.env.AUTH_GOOGLE_ID;
    const googleSecret = process.env.AUTH_GOOGLE_SECRET;
    const authSecret = process.env.AUTH_SECRET;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 font-mono text-sm">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-2xl w-full">
                <h1 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100">
                    Auth Server Diagnosis
                </h1>

                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                    <h2 className="font-bold mb-2 text-lg">Server Environment Check</h2>
                    <ul className="space-y-2">
                        <li className="flex justify-between">
                            <span>AUTH_GOOGLE_ID:</span>
                            <span className={googleId ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                                {googleId ? `✅ Present (${googleId.substring(0, 10)}...)` : "❌ MISSING"}
                            </span>
                        </li>
                        <li className="flex justify-between">
                            <span>AUTH_GOOGLE_SECRET:</span>
                            <span className={googleSecret ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                                {googleSecret ? `✅ Present (${googleSecret.substring(0, 3)}...)` : "❌ MISSING"}
                            </span>
                        </li>
                        <li className="flex justify-between">
                            <span>AUTH_SECRET:</span>
                            <span className={authSecret ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                                {authSecret ? "✅ Present" : "❌ MISSING"}
                            </span>
                        </li>
                    </ul>
                </div>

                <form
                    action={async () => {
                        "use server"
                        try {
                            console.log("Attempting server-side sign-in...");
                            await signIn("google", { redirectTo: "/dashboard" });
                        } catch (error: any) {
                            if (error.message === 'NEXT_REDIRECT' || error.digest?.startsWith('NEXT_REDIRECT')) {
                                console.log("Redirecting...");
                                throw error;
                            }
                            console.error("Sign in failed:", error);
                            // In production we'd return state, but for debug we throw to see red screen
                            throw error;
                        }
                    }}
                    className="flex flex-col gap-4"
                >
                    <button
                        type="submit"
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        Test Google Sign-In (Server)
                    </button>
                </form>
            </div>
        </div>
    );
}
