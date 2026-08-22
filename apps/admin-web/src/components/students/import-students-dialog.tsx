"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, AlertCircle, CheckCircle2, ChevronRight, FileSpreadsheet, Loader2 } from "lucide-react";
import { read, utils } from "xlsx";
import { toast } from "sonner";
import { bulkImportStudents } from "@/lib/actions/student-import";

// Header normalization rules from the user
const HEADER_MAPPING: Record<string, string> = {
  "first name": "firstName",
  "first_name": "firstName",
  "last name": "lastName",
  "last_name": "lastName",
  "student name": "name",
  "name": "name",
  "class": "class",
  "class name": "class",
  "section": "section",
  "roll number": "rollNumber",
  "roll no": "rollNumber",
  "roll_number": "rollNumber",
  "admission number": "admissionNumber",
  "admission no": "admissionNumber",
  "admission_number": "admissionNumber",
  "dob": "dateOfBirth",
  "date of birth": "dateOfBirth",
  "date_of_birth": "dateOfBirth",
  "parent name": "parentName",
  "parent": "parentName",
  "father name": "fatherName",
  "father_name": "fatherName",
  "mother name": "motherName",
  "mother_name": "motherName",
  "guardian name": "guardianName",
  "guardian_name": "guardianName",
  "parent phone": "parentPhone",
  "phone": "parentPhone",
  "parent_phone": "parentPhone",
  "student phone": "studentPhone",
  "student_phone": "studentPhone",
  "parent email": "parentEmail",
  "parent_email": "parentEmail",
  "student email": "studentEmail",
  "student_email": "studentEmail",
  "gender": "gender",
  "address": "address",
  "city": "city",
  "state": "state",
  "pincode": "pincode"
};

function normalizeHeaders(data: any[]) {
  return data.map(row => {
    const newRow: any = {};
    for (const key in row) {
      const normalizedKey = key.trim().toLowerCase();
      const mappedKey = HEADER_MAPPING[normalizedKey] || normalizedKey;
      newRow[mappedKey] = row[key];
    }
    // If name is missing but firstName is present, map it to name
    if (!newRow.name && newRow.firstName) {
      newRow.name = newRow.firstName + (newRow.lastName ? ` ${newRow.lastName}` : "");
    }

    // Construct parentName if missing
    if (!newRow.parentName) {
      newRow.parentName = newRow.fatherName || newRow.motherName || newRow.guardianName || "";
    }

    // Construct parentPhone if missing
    if (!newRow.parentPhone) {
      newRow.parentPhone = newRow.studentPhone || "";
    }

    // Construct parentEmail if missing
    if (!newRow.parentEmail) {
      newRow.parentEmail = newRow.studentEmail || "";
    }

    // Construct full address
    if (newRow.address || newRow.city || newRow.state || newRow.pincode) {
      const addressParts = [
        newRow.address, 
        newRow.city, 
        newRow.state, 
        newRow.pincode
      ].filter(Boolean);
      newRow.address = addressParts.join(", ");
    }

    return newRow;
  });
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: { id: string; name: string; sections: { id: string; name: string }[] }[];
}

export function ImportStudentsDialog({ open, onOpenChange, classes }: Readonly<Props>) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalClassId, setGlobalClassId] = useState("");
  const [globalSectionId, setGlobalSectionId] = useState("");
  
  const [report, setReport] = useState<{
    imported: number;
    skipped: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const workbook = read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = utils.sheet_to_json(worksheet, { defval: "" });
        
        const normalized = normalizeHeaders(rawData);
        // Filter out completely empty rows
        const cleaned = normalized.filter(row => Object.values(row).some(v => v !== ""));
        
        setParsedData(cleaned);
        setStep(2);
      } catch (err) {
        toast.error("Failed to parse file. Please check the format.");
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    setLoading(true);
    // Apply global class/section if rows are missing it
    const finalData = parsedData.map(row => {
      let classId = globalClassId;
      if (row.class) {
        const rowClassLower = String(row.class).toLowerCase().trim();
        let matched = classes.find(c => c.name.toLowerCase() === rowClassLower);
        if (!matched) matched = classes.find(c => c.name.toLowerCase() === `class ${rowClassLower}`);
        if (!matched) matched = classes.find(c => c.name.toLowerCase() === `grade ${rowClassLower}`);
        classId = matched ? matched.id : String(row.class).trim();
      }
      
      let sectionId = globalSectionId;
      const classObj = classes.find(c => c.id === classId);
      if (row.section) {
        const rowSecLower = String(row.section).toLowerCase().trim();
        const matched = classObj?.sections.find(s => s.name.toLowerCase() === rowSecLower);
        sectionId = matched ? matched.id : String(row.section).trim();
      }
      
      return {
        ...row,
        classId: classId ? String(classId).trim() : undefined,
        sectionId: sectionId ? String(sectionId).trim() : undefined,
        name: row.name ? String(row.name).trim() : undefined,
        parentName: row.parentName ? String(row.parentName).trim() : undefined,
        parentPhone: row.parentPhone ? String(row.parentPhone).trim() : undefined,
        admissionNumber: row.admissionNumber ? String(row.admissionNumber).trim() : undefined,
        rollNumber: row.rollNumber ? String(row.rollNumber).trim() : undefined,
        dateOfBirth: row.dateOfBirth ? String(row.dateOfBirth).trim() : undefined,
        gender: row.gender ? String(row.gender).toUpperCase().trim() : undefined,
      };
    });

    try {
      const res = await bulkImportStudents(finalData);
      setReport({
        imported: res.imported,
        skipped: res.skipped,
        failed: res.failed,
        errors: res.errors || [],
      });
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const hasMissingClassData = parsedData.some(row => !row.class || !row.section);
  const selectedClassObj = classes.find(c => c.id === globalClassId);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl max-h-[90vh] bg-card border rounded-2xl shadow-xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold">Bulk Import Students</h2>
            <p className="text-sm text-muted-foreground">Upload CSV or Excel file to add students</p>
          </div>
          <button onClick={() => onOpenChange(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <div 
                  className="w-full max-w-lg p-12 border-2 border-dashed rounded-xl flex flex-col items-center text-center cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 bg-violet-100 dark:bg-violet-900/30 text-violet-600 rounded-full flex items-center justify-center mb-4">
                    {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : <FileSpreadsheet className="w-8 h-8" />}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Select a file to upload</h3>
                  <p className="text-sm text-muted-foreground mb-6">Support for .csv, .xls, .xlsx</p>
                  <button className="h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700">
                    Browse Files
                  </button>
                  <input 
                    type="file" 
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload}
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {hasMissingClassData && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400">Missing Class or Section Information</h4>
                      <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 mb-3">
                        Some rows in your file don't specify a class or section. Please select a fallback class to apply to those rows.
                      </p>
                      <div className="flex gap-3">
                        <select 
                          className="h-9 px-3 rounded-lg border bg-background text-sm"
                          value={globalClassId}
                          onChange={(e) => { setGlobalClassId(e.target.value); setGlobalSectionId(""); }}
                        >
                          <option value="">Select fallback class...</option>
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <select 
                          className="h-9 px-3 rounded-lg border bg-background text-sm"
                          value={globalSectionId}
                          onChange={(e) => setGlobalSectionId(e.target.value)}
                          disabled={!globalClassId}
                        >
                          <option value="">Select section...</option>
                          {selectedClassObj?.sections.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-2">Preview Data ({parsedData.length} records)</h3>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground uppercase">Admission No</th>
                          <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground uppercase">Name</th>
                          <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground uppercase">Class</th>
                          <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground uppercase">Section</th>
                          <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground uppercase">Parent Name</th>
                          <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground uppercase">Parent Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.slice(0, 50).map((row, i) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-2">{row.admissionNumber || <span className="text-muted-foreground italic">Auto</span>}</td>
                            <td className="px-4 py-2 font-medium">{row.name}</td>
                            <td className="px-4 py-2">{row.class || <span className="text-amber-600 font-semibold">{classes.find(c => c.id === globalClassId)?.name || 'Missing'}</span>}</td>
                            <td className="px-4 py-2">{row.section || <span className="text-amber-600 font-semibold">{selectedClassObj?.sections.find(s => s.id === globalSectionId)?.name || 'Missing'}</span>}</td>
                            <td className="px-4 py-2">{row.parentName}</td>
                            <td className="px-4 py-2">{row.parentPhone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedData.length > 50 && (
                    <p className="text-xs text-center text-muted-foreground mt-2">Showing first 50 rows</p>
                  )}
                </div>
              </motion.div>
            )}

            {step === 3 && report && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col items-center py-8"
              >
                <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Import Complete</h3>
                <p className="text-muted-foreground mb-8">Your student data has been processed.</p>
                
                <div className="grid grid-cols-3 gap-4 w-full max-w-lg mb-8">
                  <div className="border rounded-xl p-4 text-center bg-green-50 dark:bg-green-950/20 border-green-200">
                    <p className="text-3xl font-bold text-green-700">{report.imported}</p>
                    <p className="text-xs text-green-600 font-medium uppercase mt-1">Imported</p>
                  </div>
                  <div className="border rounded-xl p-4 text-center bg-amber-50 dark:bg-amber-950/20 border-amber-200">
                    <p className="text-3xl font-bold text-amber-700">{report.skipped}</p>
                    <p className="text-xs text-amber-600 font-medium uppercase mt-1">Skipped (Dupes)</p>
                  </div>
                  <div className="border rounded-xl p-4 text-center bg-red-50 dark:bg-red-950/20 border-red-200">
                    <p className="text-3xl font-bold text-red-700">{report.failed}</p>
                    <p className="text-xs text-red-600 font-medium uppercase mt-1">Failed</p>
                  </div>
                </div>

                {report.errors.length > 0 && (
                  <div className="w-full max-w-lg bg-red-50/50 dark:bg-red-950/10 border border-red-100 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-red-800 mb-2">Error Details</h4>
                    <ul className="text-xs text-red-700 list-disc pl-4 space-y-1 max-h-32 overflow-y-auto">
                      {report.errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-6 py-4 border-t bg-muted/30 flex justify-between items-center">
          <div>
            {step === 2 && (
              <button 
                onClick={() => setStep(1)} 
                className="text-sm text-muted-foreground hover:text-foreground"
                disabled={loading}
              >
                Back to Upload
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {step < 3 && (
              <button 
                onClick={() => onOpenChange(false)} 
                className="h-9 px-4 border rounded-lg text-sm hover:bg-muted"
                disabled={loading}
              >
                Cancel
              </button>
            )}
            {step === 2 && (
              <button 
                onClick={handleImport} 
                disabled={loading || (hasMissingClassData && (!globalClassId || !globalSectionId))}
                className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start Import"}
              </button>
            )}
            {step === 3 && (
              <button 
                onClick={() => { onOpenChange(false); window.location.reload(); }} 
                className="h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
