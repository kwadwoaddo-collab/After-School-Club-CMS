'use client';

import { Download, FileSpreadsheet, Users, CalendarCheck, UserCheck } from 'lucide-react';
import { useState } from 'react';

interface ExportItem {
  label: string;
  description: string;
  endpoint: string;
  icon: React.ElementType;
  color: string;
  iconBg: string;
}

const EXPORTS: ExportItem[] = [
  {
    label: 'Export Students CSV',
    description: 'All student & parent contact data',
    endpoint: '/api/reports/students',
    icon: Users,
    color: 'text-primary',
    iconBg: 'bg-primary/10',
  },
  {
    label: 'Export Bookings CSV',
    description: 'All assessment bookings & records',
    endpoint: '/api/reports/bookings',
    icon: CalendarCheck,
    color: 'text-secondary',
    iconBg: 'bg-secondary/10',
  },
  {
    label: 'Export Attendance CSV',
    description: 'Per-session attendance records',
    endpoint: '/api/reports/attendance',
    icon: UserCheck,
    color: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
  },
];

export function DataExportSection() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (item: ExportItem) => {
    setLoading(item.endpoint);
    setError(null);
    try {
      const res = await fetch(item.endpoint);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Export failed');
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition') ?? '';
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? `export.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Download failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-[#1a1d23] rounded-[32px] p-8 flex flex-col gap-6 border border-[#424754]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#2a2a2a] rounded-xl flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5 text-[#adc6ff]" />
        </div>
        <div>
          <h2 className="font-bold text-[#e5e2e1] text-lg leading-tight">Quick Data Export</h2>
          <p className="text-sm text-[#8c909f] mt-0.5">Download complete datasets as CSV</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {EXPORTS.map(item => (
          <button
            key={item.endpoint}
            onClick={() => handleDownload(item)}
            disabled={loading !== null}
            className="w-full flex items-center justify-between px-5 py-4 bg-[#2a2a2a] hover:bg-[#353535] rounded-2xl text-sm font-bold text-[#e5e2e1] transition-all border border-[#424754]/15 shadow-sm group disabled:opacity-50"
          >
            <span className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.iconBg}`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <div className="text-left">
                <p className="font-bold">{item.label}</p>
                <p className="text-[11px] text-[#8c909f] font-normal mt-0.5">{item.description}</p>
              </div>
            </span>
            {loading === item.endpoint ? (
              <div className="w-4 h-4 border-2 border-[#adc6ff]/30 border-t-[#adc6ff] rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-[#8c909f] group-hover:text-[#adc6ff] transition-colors" />
            )}
          </button>
        ))}

        {error && (
          <p className="text-xs font-bold px-4 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
