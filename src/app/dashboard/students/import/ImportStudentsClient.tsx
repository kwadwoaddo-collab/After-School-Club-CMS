'use client';

import { useState } from 'react';
import { Upload, ArrowRight, Download, CheckCircle2, AlertCircle, RefreshCw, ChevronLeft, FileSpreadsheet, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/components/ui/utils';
import { Button } from '@/components/ui/Button';
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
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors',
              active ? 'bg-accent text-white' :
              done   ? 'bg-success-soft text-emerald-700 dark:text-emerald-400' :
                       'text-text-muted'
            )}>
              {done
                ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <span className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-semibold', active ? 'bg-white/20' : 'bg-page text-text-muted')}>{num}</span>
              }
              {label}
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className={cn('w-3.5 h-3.5 mx-1', done ? 'text-emerald-500' : 'text-text-muted/40')} />
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
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      setResult({
        success: false,
        stats: { totalRows: csvRows.length, createdParents: 0, matchedParents: 0, createdStudents: 0, skippedStudents: 0 },
        errors: [{ row: 0, message: message || 'An unexpected error occurred.' }],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => { setStep(1); setFile(null); setCsvRows([]); setHeaders([]); setMappings({}); setResult(null); };

  // ── Shared card shell ────────────────────────────────────────────────────────
  const card = 'bg-surface border border-border-subtle rounded-md';
  const label = 'text-label text-text-muted block mb-1.5';
  const input = 'w-full bg-surface text-text border border-border rounded-sm px-3 py-2 text-small-body focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors';

  return (
    <div className="max-w-3xl space-y-5">
      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* ── Step 1: Upload ───────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className={cn(card, 'p-6 space-y-6')}>
          {/* Download template */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-md bg-accent-soft">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-sm bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileSpreadsheet className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-card-heading text-text">Download Template</h3>
                <p className="text-metadata mt-0.5">Use our premade structure to align your columns automatically.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="flex-shrink-0">
              <Download className="w-3.5 h-3.5" />
              Download template.csv
            </Button>
          </div>

          {/* Centre assignment */}
          <div>
            <label className={label}>Default Centre Assignment</label>
            <select value={centreId} onChange={e => setCentreId(e.target.value)} className={input}>
              <option value="">No Centre Assignment (Assign later)</option>
              {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="text-metadata mt-2">
              Select which centre all imported students should belong to by default. You can change this on individual records later.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-md p-10 flex flex-col items-center justify-center text-center transition-colors',
              dragOver ? 'border-accent bg-accent-soft' : 'border-border-subtle hover:border-accent/30 hover:bg-page'
            )}
          >
            <div className={cn('w-12 h-12 rounded-md flex items-center justify-center mb-4 transition-colors', dragOver ? 'bg-accent-soft' : 'bg-page')}>
              <Upload className={cn('w-5 h-5', dragOver ? 'text-accent' : 'text-text-muted')} />
            </div>
            <h4 className="text-card-heading text-text mb-1">Upload your CSV spreadsheet</h4>
            <p className="text-small-body text-text-muted max-w-xs mb-6 leading-relaxed">
              Drag and drop your spreadsheet here, or click to browse. Max size 5MB.
            </p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-small-body font-medium rounded-sm cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              Browse Files
              <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {/* ── Step 2: Map Fields ───────────────────────────────────────────────── */}
      {step === 2 && (
        <div className={cn(card, 'p-6 space-y-6')}>
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-section-title text-text">Map Spreadsheet Fields</h3>
              <p className="text-small-body text-text-muted mt-0.5">
                Match each app field to a column in your CSV. We've pre-matched what we could.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={reset} className="flex-shrink-0">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </Button>
          </div>

          {/* File info banner */}
          {file && (
            <div className="flex items-center gap-3 px-3.5 py-2.5 bg-success-soft rounded-md">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 flex-shrink-0" />
              <span className="text-small-body font-medium text-emerald-700 dark:text-emerald-400">{file.name}</span>
              <span className="text-metadata ml-auto">{csvRows.length} data rows detected</span>
            </div>
          )}

          {/* Required fields */}
          <div>
            <p className="text-label text-text-muted mb-3">Required Fields</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(REQUIRED_FIELDS).map(([key, lbl]) => (
                <div key={key}>
                  <label className={label}>
                    {lbl} <span className="text-danger font-semibold">*</span>
                  </label>
                  <select
                    value={mappings[key] || ''}
                    onChange={e => setMappings(p => ({ ...p, [key]: e.target.value }))}
                    className={cn(input, mappings[key] && 'border-emerald-400/50 bg-success-soft')}
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
            <p className="text-label text-text-muted mb-3">Optional Fields</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(OPTIONAL_FIELDS).map(([key, lbl]) => (
                <div key={key}>
                  <label className={label}>{lbl}</label>
                  <select
                    value={mappings[key] || ''}
                    onChange={e => setMappings(p => ({ ...p, [key]: e.target.value }))}
                    className={cn(input, mappings[key] && 'border-info-soft bg-info-soft')}
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
            <div className="p-4 bg-page rounded-md border border-border-subtle">
              <p className="text-label text-text-muted mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Row 1 Preview
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {Object.entries({ ...REQUIRED_FIELDS, ...OPTIONAL_FIELDS }).map(([key, lbl]) => {
                  const i = mappings[key];
                  const val = i !== undefined && i !== '' ? csvRows[0][parseInt(i, 10)] : null;
                  return (
                    <div key={key} className="min-w-0">
                      <span className="text-text-muted text-[10px] block truncate">{lbl}</span>
                      <span className={cn('font-medium block truncate mt-0.5', val ? 'text-text' : 'text-text-muted italic')}>
                        {val || 'Not mapped'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 border-t border-border-subtle flex items-center justify-between gap-4">
            <span className="text-metadata">
              Ready to import <strong className="text-text font-semibold">{csvRows.length} rows</strong> of student data
            </span>
            <Button onClick={handleStartImport} disabled={!isMappingValid()}>
              Confirm and Start Import
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Results ──────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className={cn(card, 'p-6 space-y-6')}>
          {isImporting ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-accent-soft flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-accent animate-spin" />
              </div>
              <div>
                <h3 className="text-section-title text-text">Importing Students…</h3>
                <p className="text-small-body text-text-muted max-w-sm mt-1">
                  Parsing rows, deduplicating parent records, and building attendance structures. Please don't refresh.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-section-title text-text">Import Results</h3>
                  <p className="text-small-body text-text-muted mt-0.5">Summary of your student roster migration</p>
                </div>
                <Button variant="secondary" size="sm" onClick={reset} className="flex-shrink-0">
                  Import Another File
                </Button>
              </div>

              {/* Status banner */}
              {result?.success ? (
                <div className="flex items-center gap-3 p-3.5 bg-success-soft rounded-md">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 flex-shrink-0" />
                  <p className="text-small-body font-medium text-emerald-700 dark:text-emerald-400">
                    Roster migration completed successfully! All records imported without errors.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-3.5 bg-danger-soft rounded-md">
                  <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-small-body font-semibold text-danger">Import completed with warnings</p>
                    <p className="text-metadata mt-0.5">Some records could not be created. See the error log below.</p>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { value: result?.stats.totalRows || 0,      label: 'Rows Processed',  color: 'text-text' },
                  { value: result?.stats.createdStudents || 0, label: 'Students Created', color: 'text-emerald-700 dark:text-emerald-400' },
                  { value: result?.stats.createdParents || 0,  label: 'Parents Created',  color: 'text-accent' },
                  { value: result?.stats.matchedParents || 0,  label: 'Parents Matched',  color: 'text-amber-700 dark:text-amber-400' },
                ].map(({ value, label: lbl, color }) => (
                  <div key={lbl} className="bg-page border border-border-subtle rounded-md p-3.5 text-center">
                    <p className={cn('text-financial-total', color)}>{value}</p>
                    <p className="text-label text-text-muted mt-1">{lbl}</p>
                  </div>
                ))}
              </div>

              {/* Skipped */}
              {(result?.stats.skippedStudents ?? 0) > 0 && (
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-warning-soft rounded-sm text-small-body">
                  <span className="text-amber-700 dark:text-amber-400 font-medium">Skipped duplicates (already exist)</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">{result!.stats.skippedStudents}</span>
                </div>
              )}

              {/* Errors */}
              {result?.errors && result.errors.length > 0 && (
                <div>
                  <p className="text-label text-danger mb-2">Error Log ({result.errors.length})</p>
                  <div className="max-h-60 overflow-y-auto rounded-md border border-danger/20 divide-y divide-danger/10 bg-danger-soft">
                    {result.errors.map((err, i) => (
                      <div key={i} className="p-3 text-xs flex justify-between items-start gap-4">
                        <div>
                          <span className="px-1.5 py-0.5 rounded-sm bg-danger/10 text-danger text-[10px] font-semibold">Row {err.row}</span>
                          {err.name && <span className="text-text font-semibold ml-2">{err.name}</span>}
                          <p className="text-text-secondary mt-1">{err.message}</p>
                        </div>
                        {err.email && <span className="text-[10px] text-text-muted font-mono">{err.email}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Done */}
              <div className="pt-2 border-t border-border-subtle flex justify-end">
                <Button asChild>
                  <Link href="/dashboard/students">
                    <CheckCircle2 className="w-4 h-4" />
                    Done — View Students
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
