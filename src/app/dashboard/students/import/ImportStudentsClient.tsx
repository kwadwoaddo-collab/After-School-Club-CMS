'use client';

import { useState } from 'react';
import { Upload, ArrowRight, Download, CheckCircle2, AlertCircle, RefreshCw, ChevronLeft, Calendar } from 'lucide-react';
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
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentField.trim());
      if (row.length > 0 && row.some(field => field !== '')) {
        lines.push(row);
      }
      row = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  if (currentField || row.length > 0) {
    row.push(currentField.trim());
    if (row.some(field => field !== '')) {
      lines.push(row);
    }
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

export default function ImportStudentsClient({ centres }: { centres: Centre[] }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [centreId, setCentreId] = useState<string>('');
  
  // Mapping state: maps REQUIRED/OPTIONAL field keys to CSV header indices
  const [mappings, setMappings] = useState<Record<string, string>>({});
  
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Download simple sample CSV
  const handleDownloadTemplate = () => {
    const headerRow = [
      'Student First Name', 'Student Last Name', 'Student Date of Birth (DD/MM/YYYY)', 'Student School Year', 'Student Notes',
      'Parent First Name', 'Parent Last Name', 'Parent Email', 'Parent Phone'
    ];
    const sampleRows = [
      ['John', 'Doe', '12/04/2016', 'Year 3', 'Peanut allergy', 'Jane', 'Doe', 'jane.doe@example.com', '07700900077'],
      ['Alice', 'Smith', '05/09/2018', 'Year 1', 'Needs visual aids', 'Bob', 'Smith', 'bob.smith@example.com', '07700900088']
    ];
    
    const csvString = [
      headerRow.join(','),
      ...sampleRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'student_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle file select and parse headers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        setHeaders(parsed[0]);
        setCsvRows(parsed.slice(1));
        
        // Auto match headers based on string similarity
        const autoMappings: Record<string, string> = {};
        const allFieldKeys = [...Object.keys(REQUIRED_FIELDS), ...Object.keys(OPTIONAL_FIELDS)];
        
        allFieldKeys.forEach(fieldKey => {
          const fieldLabel = (REQUIRED_FIELDS as any)[fieldKey] || (OPTIONAL_FIELDS as any)[fieldKey];
          const matchedIndex = parsed[0].findIndex(h => {
            const cleanHeader = h.toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanLabel = fieldLabel.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanHeader.includes(cleanLabel) || cleanLabel.includes(cleanHeader) ||
                   (fieldKey.toLowerCase().includes('dob') && cleanHeader.includes('dob')) ||
                   (fieldKey.toLowerCase().includes('phone') && cleanHeader.includes('phone')) ||
                   (fieldKey.toLowerCase().includes('notes') && cleanHeader.includes('notes'));
          });
          if (matchedIndex !== -1) {
            autoMappings[fieldKey] = matchedIndex.toString();
          }
        });
        setMappings(autoMappings);
        setStep(2);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleMappingChange = (fieldKey: string, value: string) => {
    setMappings(prev => ({ ...prev, [fieldKey]: value }));
  };

  const isMappingValid = () => {
    return Object.keys(REQUIRED_FIELDS).every(key => mappings[key] !== undefined && mappings[key] !== '');
  };

  const handleStartImport = async () => {
    if (!isMappingValid()) return;
    setIsImporting(true);
    setStep(3);

    // Convert CSV rows into StudentImportRow objects based on mappings
    const importRows: StudentImportRow[] = csvRows.map(row => {
      const getVal = (key: string) => {
        const indexStr = mappings[key];
        if (indexStr === undefined || indexStr === '') return undefined;
        const index = parseInt(indexStr, 10);
        return row[index] || undefined;
      };

      return {
        studentFirstName: getVal('studentFirstName') || '',
        studentLastName: getVal('studentLastName') || '',
        studentDoB: getVal('studentDoB'),
        studentSchoolYear: getVal('studentSchoolYear') || '1',
        studentNotes: getVal('studentNotes'),
        parentFirstName: getVal('parentFirstName') || '',
        parentLastName: getVal('parentLastName') || '',
        parentEmail: getVal('parentEmail') || '',
        parentPhone: getVal('parentPhone'),
      };
    });

    try {
      const actionResult = await importStudentsAction(importRows, centreId || null);
      setResult(actionResult);
    } catch (err: any) {
      setResult({
        success: false,
        stats: { totalRows: csvRows.length, createdParents: 0, matchedParents: 0, createdStudents: 0, skippedStudents: 0 },
        errors: [{ row: 0, message: err.message || 'An unexpected error occurred during import.' }],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetImporter = () => {
    setStep(1);
    setFile(null);
    setCsvRows([]);
    setHeaders([]);
    setMappings({});
    setResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Steps Indicator */}
      <div className="flex items-center gap-2 px-1">
        <span className={`text-xs font-bold uppercase tracking-wider ${step >= 1 ? 'text-primary' : 'text-slate-500'}`}>1. Upload</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
        <span className={`text-xs font-bold uppercase tracking-wider ${step >= 2 ? 'text-primary' : 'text-slate-500'}`}>2. Map Fields</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
        <span className={`text-xs font-bold uppercase tracking-wider ${step >= 3 ? 'text-primary' : 'text-slate-500'}`}>3. Review</span>
      </div>

      {/* Step 1: Upload File & Pick Centre */}
      {step === 1 && (
        <div className="glassmorphic-card rounded-3xl p-8 border border-white/5 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
            <div>
              <h3 className="font-bold text-white text-base">Download Template</h3>
              <p className="text-xs text-[#8c909f] mt-0.5">Use our premade structure to align your columns automatically.</p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all active:scale-95 duration-100 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download template.csv
            </button>
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8c909f]">
              Default Centre Assignment
            </label>
            <select
              value={centreId}
              onChange={(e) => setCentreId(e.target.value)}
              className="w-full bg-[#14161b] text-white border border-[#424754]/20 rounded-xl px-4 py-3 text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-colors"
            >
              <option value="">No Centre Assignment (Assign later)</option>
              {centres.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-[#8c909f] mt-1">
              Select which centre all imported students should belong to by default. You can change this on individual student records later.
            </p>
          </div>

          <div className="border-2 border-dashed border-white/10 hover:border-primary/40 rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-all bg-white/[0.01]">
            <Upload className="w-10 h-10 text-[#8c909f] mb-4" />
            <h4 className="font-bold text-white mb-1">Upload your CSV spreadsheet</h4>
            <p className="text-xs text-[#8c909f] max-w-sm mb-6 leading-relaxed">
              Drag and drop your spreadsheet file here, or click to browse. Max size 5MB.
            </p>
            <label className="px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-blue-600 cursor-pointer transition-colors active:scale-95 duration-100">
              Browse Files
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* Step 2: Map Columns */}
      {step === 2 && (
        <div className="glassmorphic-card rounded-3xl p-8 border border-white/5 shadow-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-lg">Map Spreadsheet Fields</h3>
              <p className="text-xs text-[#8c909f] mt-0.5">Map each required field in the app to a column in your CSV.</p>
            </div>
            <button
              onClick={resetImporter}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 active:scale-95 duration-100"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#8c909f] border-b border-white/5 pb-2">Required Fields</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(REQUIRED_FIELDS).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-semibold text-white flex items-center gap-1">
                    {label} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={mappings[key] || ''}
                    onChange={(e) => handleMappingChange(key, e.target.value)}
                    className="w-full bg-[#14161b] text-white border border-[#424754]/25 rounded-xl px-3 py-2 text-xs focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h, idx) => (
                      <option key={idx} value={idx.toString()}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#8c909f] border-b border-white/5 pb-2">Optional Fields</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(OPTIONAL_FIELDS).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#c4c7d0]">
                    {label}
                  </label>
                  <select
                    value={mappings[key] || ''}
                    onChange={(e) => handleMappingChange(key, e.target.value)}
                    className="w-full bg-[#14161b] text-white border border-[#424754]/25 rounded-xl px-3 py-2 text-xs focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none"
                  >
                    <option value="">-- Ignore / Skip --</option>
                    {headers.map((h, idx) => (
                      <option key={idx} value={idx.toString()}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Row mapping preview */}
          {csvRows.length > 0 && (
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
              <h5 className="text-[10px] font-black uppercase tracking-wider text-[#8c909f]">Mapped Row 1 Preview</h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                {Object.entries({ ...REQUIRED_FIELDS, ...OPTIONAL_FIELDS }).map(([key, label]) => {
                  const headerIdxStr = mappings[key];
                  const value = headerIdxStr !== undefined && headerIdxStr !== ''
                    ? csvRows[0][parseInt(headerIdxStr, 10)]
                    : <span className="text-[#8c909f]/40 italic">Not mapped</span>;
                  return (
                    <div key={key} className="min-w-0">
                      <span className="text-[10px] text-[#8c909f] block truncate">{label}</span>
                      <span className="text-white font-bold block truncate mt-0.5">{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-4">
            <span className="text-[10px] text-[#8c909f] font-semibold">
              Ready to import {csvRows.length} rows of student data.
            </span>
            <button
              onClick={handleStartImport}
              disabled={!isMappingValid()}
              className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-all disabled:opacity-50 active:scale-95 duration-100 cursor-pointer shadow-lg shadow-primary/20 glow-btn"
            >
              Confirm and Start Import
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Importing / Results */}
      {step === 3 && (
        <div className="glassmorphic-card rounded-3xl p-8 border border-white/5 shadow-2xl space-y-6">
          {isImporting ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <RefreshCw className="w-10 h-10 text-primary animate-spin" />
              <h3 className="text-lg font-bold text-white">Importing Students...</h3>
              <p className="text-xs text-[#8c909f] max-w-sm">
                Parsing rows, deduplicating parent records, and building attendance structures. Please don't refresh the page.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-lg">Import Results</h3>
                  <p className="text-xs text-[#8c909f] mt-0.5">Summary of your student roster migration</p>
                </div>
                <button
                  onClick={resetImporter}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold active:scale-95 duration-100 cursor-pointer"
                >
                  Import Another File
                </button>
              </div>

              {/* Status Banner */}
              {result?.success ? (
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <div className="text-xs font-semibold">
                    Roster migration completed successfully! All records were imported without errors.
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold block mb-0.5">Import completed with warnings / errors</span>
                    Some student records could not be created because of formatting issues. See the error log below.
                  </div>
                </div>
              )}

              {/* Stats Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-2xl font-black text-white">{result?.stats.totalRows || 0}</p>
                  <p className="text-[9px] font-bold text-[#8c909f] uppercase tracking-wider mt-0.5">Rows Processed</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-2xl font-black text-emerald-400">{result?.stats.createdStudents || 0}</p>
                  <p className="text-[9px] font-bold text-[#8c909f] uppercase tracking-wider mt-0.5">Students Created</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-2xl font-black text-[#adc6ff]">{result?.stats.createdParents || 0}</p>
                  <p className="text-[9px] font-bold text-[#8c909f] uppercase tracking-wider mt-0.5">Parents Created</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-2xl font-black text-amber-400">{result?.stats.matchedParents || 0}</p>
                  <p className="text-[9px] font-bold text-[#8c909f] uppercase tracking-wider mt-0.5">Parents Matched</p>
                </div>
              </div>

              {/* Duplicate/Skipped stats */}
              {result?.stats.skippedStudents && result?.stats.skippedStudents > 0 ? (
                <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-[#8c909f] flex items-center justify-between">
                  <span>Matched existing students (skipped duplicates):</span>
                  <span className="font-bold text-white">{result.stats.skippedStudents}</span>
                </div>
              ) : null}

              {/* Error Log */}
              {result?.errors && result.errors.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-red-400">Error Log ({result.errors.length})</h4>
                  <div className="max-h-60 overflow-y-auto rounded-2xl border border-red-500/10 divide-y divide-red-500/10 bg-red-950/5">
                    {result.errors.map((err, idx) => (
                      <div key={idx} className="p-3.5 text-xs flex justify-between items-start gap-4">
                        <div>
                          <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold">
                            Row {err.row}
                          </span>
                          {err.name && (
                            <span className="text-white font-bold ml-2">
                              {err.name}
                            </span>
                          )}
                          <p className="text-[#8c909f] mt-1">{err.message}</p>
                        </div>
                        {err.email && <span className="text-[10px] text-[#8c909f] font-mono">{err.email}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Done button */}
              <div className="pt-4 border-t border-white/5 flex justify-end">
                <Link
                  href="/dashboard/students"
                  className="px-6 py-3 bg-[#adc6ff] hover:bg-[#c8d9ff] text-[#1a1d23] rounded-xl text-xs font-bold active:scale-95 duration-100"
                >
                  Done, View Students
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
