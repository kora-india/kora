"use client";

import React, { useState } from "react";
import { formatCurrency } from "@schoolos/utils";
import { allocatePayment, waiveFeeChargeItem } from "@/lib/actions/fee-allocator";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Search, Wallet, AlertCircle, CheckCircle2, IndianRupee, ChevronDown, ChevronUp, History, Loader2, Activity, ArrowUpRight } from "lucide-react";
import { FormField, selectCls, inputCls } from "@/components/ui/form-field";

export function CollectionTab({ students, recentCharges, components, canEdit, transactions, onNavigate }: any) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  
  // Payment States
  const [selectedComponents, setSelectedComponents] = useState<Record<string, boolean>>({});
  const [componentPayments, setComponentPayments] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({});

  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waivingItemId, setWaivingItemId] = useState<string | null>(null);

  // Filter students based on search
  const filteredStudents = search.length > 2 
    ? students.filter((s:any) => s.name.toLowerCase().includes(search.toLowerCase()) || s.rollNumber.includes(search))
    : [];

  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student);
    setSearch("");
    setSelectedComponents({});
    setComponentPayments({});
    setShowPreview(false);
  };

  // Keep student data fresh by finding it in the latest props
  const currentStudent = selectedStudent 
    ? students.find((s:any) => s.id === selectedStudent.id) || selectedStudent 
    : null;

  // Calculate student dues
  const studentCharges = currentStudent 
    ? recentCharges.filter((c:any) => c.studentId === currentStudent.id && c.status !== "WAIVED")
    : [];

  const advanceBalance = currentStudent?.advanceLedgers?.reduce((sum:number, l:any) => sum + Number(l.amount), 0) || 0;

  // Group by component
  const componentSummary: Record<string, any> = {};
  let totalOutstanding = 0;

  for (const charge of studentCharges) {
    for (const item of charge.items) {
      const compName = item.component?.name || components.find((c:any) => c.id === item.componentId)?.name || "Unknown";
      const due = item.status === "WAIVED" ? 0 : (Number(item.amount || 0) - Number(item.paidAmount || 0));
      const category = item.component?.category || components.find((c:any) => c.id === item.componentId)?.category;
      
      if (!componentSummary[item.componentId]) {
        componentSummary[item.componentId] = {
          id: item.componentId,
          name: compName,
          totalDue: 0,
          items: []
        };
      }

      // Add all items (paid and unpaid) to show history inside the dropdown
      componentSummary[item.componentId].items.push({
        id: item.id,
        chargeTitle: charge.title,
        dueDate: charge.dueDate,
        amount: Number(item.amount),
        paidAmount: Number(item.paidAmount),
        due: due,
        status: item.status === "WAIVED" ? "WAIVED" : (due <= 0 ? "PAID" : (Number(item.paidAmount) > 0 ? "PARTIAL" : "PENDING")),
        isLateFee: category === "LATE_FEE"
      });

      if (due > 0) {
        componentSummary[item.componentId].totalDue += due;
        totalOutstanding += due;
      }
    }
  }

  // Only show components that have some outstanding due in the collection table
  const componentList = Object.values(componentSummary).filter(c => c.totalDue > 0);

  const toggleComponent = (id: string, totalDue: number) => {
    const isSelected = !selectedComponents[id];
    setSelectedComponents(prev => ({ ...prev, [id]: isSelected }));
    
    if (isSelected) {
      setComponentPayments(prev => ({ ...prev, [id]: totalDue.toString() }));
    } else {
      setComponentPayments(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const updateComponentPayment = (id: string, amount: string) => {
    setComponentPayments(prev => ({ ...prev, [id]: amount }));
    if (Number(amount) > 0 && !selectedComponents[id]) {
      setSelectedComponents(prev => ({ ...prev, [id]: true }));
    } else if (Number(amount) <= 0 && selectedComponents[id]) {
      setSelectedComponents(prev => ({ ...prev, [id]: false }));
    }
  };

  const totalPayment = Object.values(componentPayments).reduce((sum, val) => sum + (Number(val) || 0), 0);

  const generatePreview = () => {
    const preview: any[] = [];
    
    for (const [compId, amountStr] of Object.entries(componentPayments)) {
      if (!selectedComponents[compId]) continue;
      
      let remaining = Number(amountStr);
      if (remaining <= 0) continue;

      const compData = componentSummary[compId];
      if (!compData) continue;

      const allocations = [];
      // Sort items by due date asc (assuming they are already mostly sorted, but we'll sort here to be safe)
      const sortedItems = [...compData.items].sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      for (const item of sortedItems) {
        if (remaining <= 0) break;
        
        const allocAmount = Math.min(item.due, remaining);
        
        let newStatus = "Partial";
        if (item.paidAmount + allocAmount >= item.amount) {
          newStatus = "Paid";
        }

        allocations.push({
          title: item.chargeTitle,
          allocated: allocAmount,
          newStatus
        });
        
        remaining -= allocAmount;
      }

      preview.push({
        componentName: compData.name,
        allocations,
        advance: remaining > 0 ? remaining : 0
      });
    }
    
    return preview;
  };

  const handlePayment = async () => {
    if (totalPayment <= 0) {
      toast.error("Enter payment amounts first.");
      return;
    }
    
    setIsSubmitting(true);
    const toastId = "payment-process";
    toast.loading("Processing payment transaction...", { id: toastId });

    try {
      const payloadPayments = Object.entries(componentPayments)
        .filter(([id, val]) => selectedComponents[id] && Number(val) > 0)
        .map(([id, val]) => ({ componentId: id, amount: Number(val) }));

      const res = await allocatePayment({
        studentId: currentStudent.id,
        componentPayments: payloadPayments,
        method: paymentMethod as any,
        reference,
      });

      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success(`Payment successful! Receipt: ${(res as any).receiptNo}`, { id: toastId });
        setComponentPayments({});
        setSelectedComponents({});
        setShowPreview(false);
        router.refresh();
      }
    } catch {
      toast.error("Payment processing failed", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left Pane: Student Search & Component Ledger */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search student by name or roll number..." 
            className="w-full h-12 pl-10 pr-4 bg-card border rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search.length > 2 && (
            <div className="absolute top-14 left-0 right-0 bg-card border shadow-lg rounded-xl z-50 max-h-64 overflow-y-auto">
              {filteredStudents.map((s:any) => (
                <button 
                  key={s.id} 
                  onClick={() => handleSelectStudent(s)}
                  className="w-full text-left p-3 hover:bg-muted border-b flex justify-between items-center"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">Roll: {s.rollNumber}</span>
                </button>
              ))}
              {filteredStudents.length === 0 && <p className="p-4 text-sm text-center text-muted-foreground">No students found</p>}
            </div>
          )}
        </div>

        {currentStudent ? (
          <div className="space-y-6">
            <div className="bg-card border rounded-xl p-5 flex justify-between items-center shadow-sm">
              <div>
                <h2 className="text-xl font-bold">{currentStudent.name}</h2>
                <p className="text-sm text-muted-foreground">Class {currentStudent.class?.name} • Roll No: {currentStudent.rollNumber}</p>
                <p className="text-sm text-muted-foreground mt-2">Total Outstanding: <span className="font-bold text-red-600">{formatCurrency(totalOutstanding)}</span></p>
              </div>
              <div className="text-right bg-green-50/50 dark:bg-green-950/20 p-4 rounded-lg border border-green-100 dark:border-green-900">
                <p className="text-sm text-muted-foreground">Advance Balance</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(advanceBalance)}</p>
              </div>
            </div>

            <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
                <h3 className="font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-violet-600" /> Outstanding Fees by Component
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/10 border-b">
                    <tr>
                      <th className="w-10 px-4 py-3 text-center"><input type="checkbox" className="rounded" /></th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fee Component</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total Due</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground w-40">Amount to Pay</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {componentList.map((comp:any) => {
                      const isExpanded = expandedComponents[comp.id];
                      return (
                        <React.Fragment key={comp.id}>
                          <tr className={selectedComponents[comp.id] ? "bg-violet-50/30 dark:bg-violet-900/10" : ""}>
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="checkbox" 
                                className="rounded text-violet-600 focus:ring-violet-500" 
                                checked={!!selectedComponents[comp.id]}
                                onChange={() => toggleComponent(comp.id, comp.totalDue)}
                              />
                            </td>
                            <td className="px-4 py-3 font-medium">{comp.name}</td>
                            <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(comp.totalDue)}</td>
                            <td className="px-4 py-3 text-right">
                               <input 
                                 type="number"
                                 className="w-full text-right bg-background border rounded-md p-2 focus:ring-2 focus:ring-violet-500 outline-none"
                                 placeholder="0.00"
                                 value={componentPayments[comp.id] || ""}
                                 onChange={(e) => updateComponentPayment(comp.id, e.target.value)}
                               />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => setExpandedComponents(prev => ({...prev, [comp.id]: !isExpanded}))} className="text-muted-foreground hover:text-foreground">
                                {isExpanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-muted/5">
                              <td colSpan={5} className="p-0 border-b">
                                <div className="px-10 py-3 bg-muted/10 inset-shadow-sm">
                                  <table className="w-full text-xs">
                                    <tbody>
                                      {comp.items.map((item:any, idx:number) => (
                                        <tr key={idx} className="border-b last:border-0 border-muted/50">
                                          <td className="py-2 text-muted-foreground flex items-center gap-2">
                                            <span>{item.chargeTitle}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted border">
                                              {new Date(item.dueDate).toLocaleDateString('en-GB', {month: 'short', year: 'numeric'})}
                                            </span>
                                          </td>
                                          <td className="py-2 text-right">
                                            {item.status === 'PAID' ? (
                                              <span className="text-green-600 font-medium flex items-center justify-end gap-1"><CheckCircle2 className="w-3 h-3"/> Paid</span>
                                            ) : item.status === 'WAIVED' ? (
                                              <span className="text-muted-foreground font-medium flex items-center justify-end gap-1">Waived</span>
                                            ) : (
                                              <div className="flex justify-end items-center gap-2">
                                                <span>Due: {formatCurrency(item.due)}</span>
                                                {item.isLateFee && canEdit && (
                                                  <button 
                                                    disabled={waivingItemId === item.id}
                                                    onClick={async () => {
                                                      setWaivingItemId(item.id);
                                                      const toastId = `waive-${item.id}`;
                                                      toast.loading("Waiving late fee...", { id: toastId });
                                                      try {
                                                        const res = await waiveFeeChargeItem(item.id);
                                                        if (res.error) toast.error(res.error, { id: toastId }); 
                                                        else { toast.success("Late fee waived", { id: toastId }); router.refresh(); }
                                                      } catch {
                                                        toast.error("Failed to waive late fee", { id: toastId });
                                                      } finally {
                                                        setWaivingItemId(null);
                                                      }
                                                    }} 
                                                    className="text-[10px] px-2 py-0.5 rounded border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 font-medium flex items-center gap-1 disabled:opacity-50"
                                                  >
                                                    {waivingItemId === item.id && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                                                    Waive
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {componentList.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No outstanding fees.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Fee Charge History Table */}
            <div className="bg-card border rounded-xl overflow-hidden shadow-sm mt-6">
              <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
                <h3 className="font-semibold flex items-center gap-2">
                  <History className="w-4 h-4 text-violet-600" /> Fee Charge History
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/10 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Charge Title</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Due Month</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Paid</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {studentCharges.map((charge: any) => {
                       const chargeTotal = charge.items.reduce((sum:number, i:any) => sum + Number(i.amount), 0);
                       const chargePaid = charge.items.reduce((sum:number, i:any) => sum + Number(i.paidAmount), 0);
                       return (
                         <tr key={charge.id} className="hover:bg-muted/30">
                           <td className="px-4 py-3 font-medium">{charge.title}</td>
                           <td className="px-4 py-3 text-muted-foreground">
                             {new Date(charge.dueDate).toLocaleDateString('en-GB', {month: 'short', year: 'numeric'})}
                           </td>
                           <td className="px-4 py-3 text-right font-medium">{formatCurrency(chargeTotal)}</td>
                           <td className="px-4 py-3 text-right text-green-600">{formatCurrency(chargePaid)}</td>
                           <td className="px-4 py-3">
                             <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${charge.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200' : charge.status === 'PARTIAL' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                               {charge.status}
                             </span>
                           </td>
                         </tr>
                       );
                    })}
                    {studentCharges.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">No fee charges generated yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        ) : (
          <div className="bg-card border border-dashed rounded-xl h-64 flex flex-col items-center justify-center text-muted-foreground">
            <Wallet className="w-12 h-12 mb-4 opacity-20" />
            <p>Search and select a student to view their component-wise dues</p>
          </div>
        )}

        {/* Global Recent Payments (shows regardless of selected student) */}
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm mt-8">
          <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-600" /> Recent Payments Activity
            </h3>
            <button 
              onClick={() => onNavigate?.("logs")}
              className="text-sm font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/10 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Receipt No</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Student</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions?.slice(0, 5).map((txn: any) => (
                  <tr key={txn.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-violet-600">{txn.receiptNo}</td>
                    <td className="px-4 py-3">{txn.student?.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(txn.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(Number(txn.amount))}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-muted">
                        {txn.paymentMethod}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!transactions || transactions.length === 0) && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">No recent payments.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
      </div>

      {/* Right Pane: Payment Collection Form */}
      <div className="space-y-6">
        <div className={`bg-card border rounded-xl p-6 shadow-sm sticky top-6 ${!currentStudent ? "opacity-50 pointer-events-none" : ""}`}>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><IndianRupee className="w-5 h-5 text-violet-500" /> Payment Summary</h2>
          
          <div className="space-y-5">
            
            <div className="bg-muted/30 p-4 rounded-xl border border-dashed flex justify-between items-center">
               <span className="font-medium text-muted-foreground">Total Payment</span>
               <span className="text-3xl font-bold text-violet-600">{formatCurrency(totalPayment)}</span>
            </div>

            <FormField label="Payment Method" required>
              <select 
                className={selectCls} 
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                <option value="CHEQUE">Cheque</option>
                <option value="DEBIT_CARD">Debit / Credit Card</option>
              </select>
            </FormField>

            <FormField label="Reference Number (Optional)">
              <input 
                type="text" 
                className={inputCls} 
                placeholder="e.g. UPI Txn ID" 
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </FormField>

            {!showPreview ? (
              <button 
                onClick={() => setShowPreview(true)}
                disabled={!canEdit || totalPayment <= 0} 
                className="w-full h-12 bg-muted text-foreground border rounded-xl font-medium hover:bg-muted/80 transition-transform active:scale-95 disabled:opacity-50"
              >
                Preview Allocation
              </button>
            ) : (
              <div className="space-y-4 pt-4 border-t border-dashed">
                <h4 className="font-bold text-sm">Allocation Preview</h4>
                <div className="text-xs space-y-3 bg-muted/20 p-3 rounded-lg border">
                  {generatePreview().map((p, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="font-bold text-violet-600">{p.componentName}</div>
                      {p.allocations.map((a:any, i:number) => (
                         <div key={i} className="flex justify-between text-muted-foreground">
                            <span>{a.title}</span>
                            <span>{formatCurrency(a.allocated)} → <span className={a.newStatus === 'Paid' ? 'text-green-600 font-medium' : 'text-orange-500 font-medium'}>{a.newStatus}</span></span>
                         </div>
                      ))}
                      {p.advance > 0 && (
                        <div className="flex justify-between text-green-600 font-medium mt-1">
                          <span>{p.componentName} Advance</span>
                          <span>+{formatCurrency(p.advance)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowPreview(false)} className="flex-1 py-3 border rounded-xl font-medium text-sm hover:bg-muted">
                    Edit
                  </button>
                  <button 
                    disabled={isSubmitting}
                    onClick={handlePayment}
                    className="flex-[2] py-3 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition-transform active:scale-95 shadow-md shadow-violet-500/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:active:scale-100"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirm Payment
                  </button>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
      
    </div>
  );
}
