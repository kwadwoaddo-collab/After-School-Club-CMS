'use client';

import { useState } from 'react';
import { Upload, ArrowRight, Download, CheckCircle2, AlertCircle, RefreshCw, ChevronLeft, FileSpreadsheet, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { importStudentsAction, StudentImportRow, ImportResult } from '@/features/students/import-actions';

interface Centre {
  id: string;
  name: string;
}

// Simple client-side CSV parser
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentField = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(currentField.trim());
      if (row.length > 0 && row.some(field => field !== '')) lines.push(row);
      row = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || row.length > 0) {
    row.push(currentField.trim());
    if (row.some(field => field !== '')) lines.push(row);
  }

  return lines;
}

const REQUIRED_FIELDS = {
  studentFirstName: 'Student First Name',
  studentLastName: 'Student Last Name',
  studentSchoolYear: 'School Year (e.g. Year 3 or 3)',
  parentFirstName: 'Parent First Name',
  parentLastName: 'Parent Last Name',
  parentEmail: 'Parent Email',
};

const OPTIONAL_FIELDS = {
  studentDoB: 'Student Date of Birth (DD/MM/YYYY)',
  studentNotes: 'Student Notes / Allergies',
  parentPhone: 'Parent Phone Number',
};

// ─── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  const steps = ['Upload', 'Map Fields', 'Review'];
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => {
        const num = i + 1;
        const active = num === current;
        const done = num < current;
        return (
          <div key={label} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              active ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' :
              done   ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                       'text-muted-foreground'
            }`}>
              {done
                ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${active ? 'bg-card/20' : 'bg-secondary text-muted-foreground'}`}>{num}</span>
              }
              {label}
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className={`w-3.5 h-3.5 mx-1 ${done ? 'text-emerald-400' : 'text-gray-300'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ImportStudentsClient({ centres }: { centres: Centre[] }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [centreId, setCentreId] = useState<string>('');
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDownloadTemplate = () => {
    const headerRow = [
      'Student First Name', 'Student Last Name', 'Student Date of Birth (DD/MM/YYYY)',
      'Student School Year', 'Student Notes',
      'Parent First Name', 'Parent Last Name', 'Parent Email', 'Parent Phone',
    ];
    const sampleRows = [
      ['John', 'Doe', '12/04/2016', 'Year 3', 'Peanut allergy', 'Jane', 'Doe', 'jane.doe@example.com', '07700900077'],
      ['Alice', 'Smith', '05/09/2018', 'Year 1', 'Needs visual aids', 'Bob', 'Smith', 'bob.smith@example.com', '07700900088'],
    ];
    const csv = [headerRow, ...sampleRows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'student_import_template.csv';
    a.click();
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        setHeaders(parsed[0]);
        setCsvRows(parsed.slice(1));
        const auto: Record<string, string> = {};
        Object.entries({ ...REQUIRED_FIELDS, ...OPTIONAL_FIELDS }).forEach(([key, label]) => {
          const idx = parsed[0].findIndex(h => {
            const ch = h.toLowerCase().replace(/[^a-z0-9]/g, '');
            const cl = label.toLowerCase().replace(/[^a-z0-9]/g, '');
            return ch.includes(cl) || cl.includes(ch) ||
              (key.toLowerCase().includes('dob') && ch.includes('dob')) ||
              (key.toLowerCase().includes('phone') && ch.includes('phone')) ||
              (key.toLowerCase().includes('notes') && ch.includes('notes'));
          });
          if (idx !== -1) auto[key] = idx.toString();
        });
        setMappings(auto);
        setStep(2);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.endsWith('.csv')) processFile(f);
  };

  const isMappingValid = () => Object.keys(REQUIRED_FIELDS).every(k => mappings[k] !== undefined && mappings[k] !== '');

  const handleStartImport = async () => {
    if (!isMappingValid()) return;
    setIsImporting(true);
    setStep(3);
    const getVal = (row: string[], key: string) => {
      const i = mappings[key];
      return i !== undefined && i !== '' ? row[parseInt(i, 10)] || undefined : undefined;
    };
    const importRows: StudentImportRow[] = csvRows.map(row => ({
      studentFirstName: getVal(row, 'studentFirstName') || '',
      studentLastName: getVal(row, 'studentLastName') || '',
      studentDoB: getVal(row, 'studentDoB'),
      studentSchoolYear: getVal(row, 'studentSchoolYear') || '1',
      studentNotes: getVal(row, 'studentNotes'),
      parentFirstName: getVal(row, 'parentFirstName') || '',
      parentLastName: getVal(row, 'parentLastName') || '',
      parentEmail: getVal(row, 'parentEmail') || '',
      parentPhone: getVal(row, 'parentPhone'),
    }));
    try {
      const res = await importStudentsAction(importRows, centreId || null);
      setResult(res);
    } catch (err: any) {
      setResult({
        success: false,
        stats: { totalRows: csvRows.length, createdParents: 0, matchedParents: 0, createdStudents: 0, skippedStudents: 0 },
        errors: [{ row: 0, message: err.message || 'An unexpected error occurred.' }],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => { setStep(1); setFile(null); setCsvRows([]); setHeaders([]); setMappings({}); setResult(null); };

  // ── Shared card shell ────────────────────────────────────────────────────────
  const card = 'bg-card border border-border rounded-3xl shadow-sm';
  const label = 'block text-xs font-semibold text-foreground mb-1.5';
  const input = 'w-full bg-card text-foreground border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all';

  return (
    <div className="max-w-3xl space-y-5">
      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* ── Step 1: Upload ───────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className={`${card} p-8 space-y-6`}>
          {/* Download template */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-blue-50 border border-blue-100">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileSpreadsheet className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">Download Template</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Use our premade structure to align your columns automatically.</p>
              </div>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-blue-200 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-50 transition-all shadow-sm flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Download template.csv
            </button>
          </div>

          {/* Centre assignment */}
          <div>
            <label className={label}>Default Centre Assignment</label>
            <select value={centreId} onChange={e => setCentreId(e.target.value)} className={input}>
              <option value="">No Centre Assignment (Assign later)</option>
              {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="text-xs text-muted-foreground mt-2">
              Select which centre all imported students should belong to by default. You can change this on individual records later.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center transition-all ${
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-border hover:border-blue-300 hover:bg-secondary/40'
            }`}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${dragOver ? 'bg-blue-100' : 'bg-secondary/60'}`}>
              <Upload className={`w-6 h-6 ${dragOver ? 'text-blue-600' : 'text-muted-foreground'}`} />
            </div>
            <h4 className="font-bold text-foreground text-base mb-1">Upload your CSV spreadsheet</h4>
            <p className="text-sm text-muted-foreground max-w-xs mb-6 leading-relaxed">
              Drag and drop your spreadsheet here, or click to browse. Max size 5MB.
            </p>
            <label className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl cursor-pointer transition-all active:scale-95 shadow-sm shadow-blue-200">
              <Upload className="w-4 h-4" />
              Browse Files
              <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {/* ── Step 2: Map Fields ───────────────────────────────────────────────── */}
      {step === 2 && (
        <div className={`${card} p-8 space-y-7`}>
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-foreground text-lg">Map Spreadsheet Fields</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Match each app field to a column in your CSV. We've pre-matched what we could.
              </p>
            </div>
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-secondary/60 hover:bg-secondary text-foreground rounded-xl text-xs font-semibold transition-all flex-shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
          </div>

          {/* File info banner */}
          {file && (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-emerald-800">{file.name}</span>
              <span className="text-xs text-emerald-600 ml-auto">{csvRows.length} data rows detected</span>
            </div>
          )}

          {/* Required fields */}
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">Required Fields</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(REQUIRED_FIELDS).map(([key, lbl]) => (
                <div key={key}>
                  <label className={label}>
                    {lbl} <span className="text-red-500 font-black">*</span>
                  </label>
                  <select
                    value={mappings[key] || ''}
                    onChange={e => setMappings(p => ({ ...p, [key]: e.target.value }))}
                    className={`${input} ${mappings[key] ? 'border-emerald-300 bg-emerald-50' : ''}`}
                  >
                    <option value="">— Select Column —</option>
                    {headers.map((h, i) => <option key={i} value={i.toString()}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Optional fields */}
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">Optional Fields</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(OPTIONAL_FIELDS).map(([key, lbl]) => (
                <div key={key}>
                  <label className={label}>{lbl}</label>
                  <select
                    value={mappings[key] || ''}
                    onChange={e => setMappings(p => ({ ...p, [key]: e.target.value }))}
                    className={`${input} ${mappings[key] ? 'border-blue-200 bg-blue-50' : ''}`}
                  >
                    <option value="">— Ignore / Skip —</option>
                    {headers.map((h, i) => <option key={i} value={i.toString()}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Row 1 preview */}
          {csvRows.length > 0 && (
            <div className="p-5 bg-secondary/40 rounded-2xl border border-border">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Row 1 Preview
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {Object.entries({ ...REQUIRED_FIELDS, ...OPTIONAL_FIELDS }).map(([key, lbl]) => {
                  const i = mappings[key];
                  const val = i !== undefined && i !== '' ? csvRows[0][parseInt(i, 10)] : null;
                  return (
                    <div key={key} className="min-w-0">
                      <span className="text-muted-foreground text-[10px] block truncate">{lbl}</span>
                      <span className={`font-semibold block truncate mt-0.5 ${val ? 'text-foreground' : 'text-gray-300 italic'}`}>
                        {val || 'Not mapped'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 border-t border-border flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground font-medium">
              Ready to import <strong className="text-foreground">{csvRows.length} rows</strong> of student data
            </span>
            <button
              onClick={handleStartImport}
              disabled={!isMappingValid()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-sm shadow-blue-200"
            >
              Confirm and Start Import
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Results ──────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className={`${card} p-8 space-y-6`}>
          {isImporting ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                <RefreshCw className="w-7 h-7 text-blue-600 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Importing Students…</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                  Parsing rows, deduplicating parent records, and building attendance structures. Please don't refresh.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-foreground text-lg">Import Results</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Summary of your student roster migration</p>
                </div>
                <button
                  onClick={reset}
                  className="px-4 py-2 bg-secondary/60 hover:bg-secondary text-foreground rounded-xl text-xs font-bold transition-all flex-shrink-0"
                >
                  Import Another File
                </button>
              </div>

              {/* Status banner */}
              {result?.success ? (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <p className="text-sm font-semibold text-emerald-800">
                    Roster migration completed successfully! All records imported without errors.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-800">Import completed with warnings</p>
                    <p className="text-xs text-red-600 mt-0.5">Some records could not be created. See the error log below.</p>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { value: result?.stats.totalRows || 0,      label: 'Rows Processed',  color: 'text-foreground' },
                  { value: result?.stats.createdStudents || 0, label: 'Students Created', color: 'text-emerald-600' },
                  { value: result?.stats.createdParents || 0,  label: 'Parents Created',  color: 'text-blue-600' },
                  { value: result?.stats.matchedParents || 0,  label: 'Parents Matched',  color: 'text-amber-600' },
                ].map(({ value, label: lbl, color }) => (
                  <div key={lbl} className="bg-secondary/40 border border-border rounded-2xl p-4 text-center">
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">{lbl}</p>
                  </div>
                ))}
              </div>

              {/* Skipped */}
              {(result?.stats.skippedStudents ?? 0) > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                  <span className="text-amber-800 font-medium">Skipped duplicates (already exist)</span>
                  <span className="font-bold text-amber-900">{result!.stats.skippedStudents}</span>
                </div>
              )}

              {/* Errors */}
              {result?.errors && result.errors.length > 0 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-red-500 mb-2">Error Log ({result.errors.length})</p>
                  <div className="max-h-60 overflow-y-auto rounded-2xl border border-red-100 divide-y divide-red-100 bg-red-50/50">
                    {result.errors.map((err, i) => (
                      <div key={i} className="p-3.5 text-xs flex justify-between items-start gap-4">
                        <div>
                          <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold">Row {err.row}</span>
                          {err.name && <span className="text-foreground font-bold ml-2">{err.name}</span>}
                          <p className="text-muted-foreground mt-1">{err.message}</p>
                        </div>
                        {err.email && <span className="text-[10px] text-muted-foreground font-mono">{err.email}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Done */}
              <div className="pt-2 border-t border-border flex justify-end">
                <Link
                  href="/dashboard/students"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-sm shadow-blue-200"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Done — View Students
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
