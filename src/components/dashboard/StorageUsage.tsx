import { Database } from 'lucide-react';

export default function StorageUsage() {
    const used = 6.5;
    const total = 10;
    const percentage = (used / total) * 100;

    return (
        <div className="glass-card p-6 rounded-[32px] bg-white border border-slate-100">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
                    <Database className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-900">Storage Usage</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Premium Plan</p>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-end justify-between">
                    <span className="text-xs font-bold text-slate-700">{used} GB <span className="text-slate-400">of {total} GB used</span></span>
                    <span className="text-xs font-black text-primary">{percentage}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-1000"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>

            <p className="mt-4 text-[10px] text-slate-500 font-medium leading-relaxed">
                You're currently using {used}GB of your total {total}GB cloud storage.
                <button className="ml-1 text-primary font-bold hover:underline">Upgrade Storage</button>
            </p>
        </div>
    );
}
