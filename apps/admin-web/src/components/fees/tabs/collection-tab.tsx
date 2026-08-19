"use client";

import { useState } from "react";
import { formatCurrency } from "@schoolos/utils";
import { processPayment } from "@/lib/actions/fee-allocator";
import { toast } from "sonner";
import { Search, Wallet, AlertCircle, CheckCircle2, IndianRupee } from "lucide-react";
import { FormField, selectCls, inputCls } from "@/components/ui/form-field";

export function CollectionTab({ students, recentCharges, canEdit }: any) {
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  // Filter students based on search
  const filteredStudents = search.length > 2 
    ? students.filter((s:any) => s.name.toLowerCase().includes(search.toLowerCase()) || s.rollNumber.includes(search))
    : [];

  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student);
    setSearch("");
  };

  // Calculate student dues
  const studentCharges = selectedStudent 
    ? recentCharges.filter((c:any) => c.studentId === selectedStudent.id && c.status !== "WAIVED")
    : [];

  const pendingCharges = studentCharges.filter((c:any) => c.status === "PENDING" || c.status === "PARTIAL" || c.status === "OVERDUE");
  const paidCharges = studentCharges.filter((c:any) => c.status === "PAID");

  const totalDue = pendingCharges.reduce((sum: number, charge: any) => {
    const total = charge.items.reduce((s:number, i:any) => s + Number(i.amount), 0);
    const paid = charge.allocations.reduce((s:number, a:any) => s + Number(a.amount), 0);
    return sum + (total - paid);
  }, 0);

  const advanceBalance = selectedStudent?.advanceLedgers?.reduce((sum:number, l:any) => sum + Number(l.amount), 0) || 0;

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0) return;

    const res = await processPayment({
      studentId: selectedStudent.id,
      amount: Number(paymentAmount),
      method: paymentMethod as any,
    });

    if (res.error) toast.error(res.error);
    else {
      toast.success(`Payment successful! Receipt: ${res.receiptNo}`);
      setPaymentAmount("");
      // Ideally refresh the student data here or page refresh
      window.location.reload();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left Pane: Student Search & Ledger */}
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

        {selectedStudent ? (
          <div className="space-y-6">
            <div className="bg-card border rounded-xl p-5 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{selectedStudent.name}</h2>
                <p className="text-sm text-muted-foreground">Roll No: {selectedStudent.rollNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Advance Balance</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(advanceBalance)}</p>
              </div>
            </div>

            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
                <h3 className="font-semibold text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Pending Dues
                </h3>
                <span className="font-bold text-lg">{formatCurrency(totalDue)}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/10">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fee Title</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Paid</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pendingCharges.map((c:any) => {
                    const total = c.items.reduce((s:number, i:any) => s + Number(i.amount), 0);
                    const paid = c.allocations.reduce((s:number, a:any) => s + Number(a.amount), 0);
                    const due = total - paid;
                    return (
                      <tr key={c.id}>
                        <td className="px-4 py-3 font-medium">{c.title}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(total)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{formatCurrency(paid)}</td>
                        <td className="px-4 py-3 text-right text-red-600 font-bold">{formatCurrency(due)}</td>
                      </tr>
                    );
                  })}
                  {pendingCharges.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No pending dues</td></tr>}
                </tbody>
              </table>
            </div>
            
            {/* Show recent paid charges */}
            {paidCharges.length > 0 && (
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="p-3 border-b bg-muted/20 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" /> <span className="font-semibold">Recently Paid</span>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    {paidCharges.slice(0, 5).map((c:any) => {
                       const total = c.items.reduce((s:number, i:any) => s + Number(i.amount), 0);
                       return (
                         <tr key={c.id}>
                           <td className="px-4 py-2">{c.title}</td>
                           <td className="px-4 py-2 text-right text-muted-foreground">{formatCurrency(total)}</td>
                         </tr>
                       );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-card border border-dashed rounded-xl h-64 flex flex-col items-center justify-center text-muted-foreground">
            <Wallet className="w-12 h-12 mb-4 opacity-20" />
            <p>Select a student to view their ledger and collect fees</p>
          </div>
        )}
      </div>

      {/* Right Pane: Payment Collection Form */}
      <div className="space-y-6">
        <div className={`bg-card border rounded-xl p-6 ${!selectedStudent ? "opacity-50 pointer-events-none" : ""}`}>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><IndianRupee className="w-5 h-5 text-violet-500" /> Collect Payment</h2>
          
          <form onSubmit={handlePayment} className="space-y-5">
            <FormField label="Amount Received (₹)" required>
              <input 
                type="number" 
                className={inputCls + " text-xl font-bold h-14"} 
                placeholder="0.00" 
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
              />
            </FormField>

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

            <button 
              type="submit" 
              disabled={!canEdit || !paymentAmount} 
              className="w-full h-12 bg-violet-600 text-white rounded-xl font-bold text-lg hover:bg-violet-700 transition-transform active:scale-95 disabled:opacity-50"
            >
              Confirm Payment
            </button>
            <p className="text-[10px] text-center text-muted-foreground mt-2">
              Payment will automatically be allocated to the oldest pending dues. Excess amount will be added to the student's advance balance.
            </p>
          </form>
        </div>
      </div>
      
    </div>
  );
}
