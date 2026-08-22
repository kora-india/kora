"use client";

import React, { useState } from "react";
import { formatCurrency, formatDate } from "@schoolos/utils";
import { Search, Filter, ArrowUpRight, ArrowDownRight, IndianRupee, History, FileText, CheckCircle2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";


interface Props {
  transactions: any[];
}

export function LogsTab({ transactions }: Readonly<Props>) {
  const [subTab, setSubTab] = useState<"transactions" | "activities">("transactions");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTx, setSelectedTx] = useState<any>(null);

  const filteredTransactions = transactions.filter(tx => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      tx.receiptNo.toLowerCase().includes(term) ||
      tx.student?.name.toLowerCase().includes(term) ||
      tx.student?.rollNumber.toLowerCase().includes(term) ||
      (tx.reference && tx.reference.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex space-x-1 p-1 bg-muted/30 rounded-xl w-fit border shadow-sm">
        <button
          onClick={() => setSubTab("transactions")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            subTab === "transactions"
              ? "bg-white text-violet-700 shadow-sm dark:bg-zinc-800 dark:text-violet-300"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <IndianRupee className="w-4 h-4" />
          Transactions
        </button>
        <button
          onClick={() => setSubTab("activities")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            subTab === "activities"
              ? "bg-white text-violet-700 shadow-sm dark:bg-zinc-800 dark:text-violet-300"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <History className="w-4 h-4" />
          Activities
        </button>
      </div>

      {subTab === "transactions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search receipt, student..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-xl hover:bg-muted transition-colors">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>

          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Receipt No</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx: any) => (
                      <tr 
                        key={tx.id} 
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedTx(tx)}
                      >
                        <td className="px-4 py-3 font-medium text-violet-600">{tx.receiptNo}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(tx.date)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{tx.student?.name}</div>
                          <div className="text-xs text-muted-foreground">Roll: {tx.student?.rollNumber}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-muted/30 capitalize">
                            {tx.method.toLowerCase().replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {tx.reference || "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold text-emerald-600 flex items-center justify-end gap-1">
                            <ArrowDownRight className="w-3 h-3" />
                            {formatCurrency(Number(tx.amount))}
                          </div>
                          {tx.allocations?.some((a:any) => a.chargeItem?.component?.category === 'LATE_FEE') && (
                            <span className="inline-block mt-1 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200 uppercase font-bold tracking-wider">
                              Includes Late Fee
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subTab === "activities" && (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl bg-muted/10 text-center">
          <div className="w-12 h-12 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center mb-4">
            <History className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-lg">Activity Log</h3>
          <p className="text-muted-foreground mt-1 max-w-sm">
            Detailed history of fee generation, assignment updates, and system activities will appear here.
          </p>
        </div>
      )}

      {/* Transaction Details Modal */}
      <Dialog 
        open={!!selectedTx} 
        onOpenChange={(open) => !open && setSelectedTx(null)}
        title="Transaction Details"
      >
        {selectedTx && (
          <div className="space-y-6">
            
            {/* Header / Summary */}
            <div className="bg-violet-50/50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/50 p-4 rounded-xl flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Amount Paid</p>
                <p className="text-3xl font-bold text-violet-600 flex items-center gap-2">
                  {formatCurrency(Number(selectedTx.amount))} 
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{selectedTx.receiptNo}</p>
                <p className="text-sm text-muted-foreground">{formatDate(selectedTx.createdAt)}</p>
              </div>
            </div>

            {/* Student Info */}
            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/20 p-4 rounded-xl border">
              <div>
                <p className="text-muted-foreground mb-0.5">Student Name</p>
                <p className="font-medium">{selectedTx.student?.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Roll Number</p>
                <p className="font-medium">{selectedTx.student?.rollNumber}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Payment Method</p>
                <p className="font-medium capitalize">{selectedTx.method?.toLowerCase().replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Reference / Notes</p>
                <p className="font-medium">{selectedTx.reference || selectedTx.remarks || "-"}</p>
              </div>
            </div>

            {/* Allocations Breakdown */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-muted-foreground" /> Payment Allocation Breakdown
              </h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Fee Component</th>
                      <th className="px-3 py-2 text-left font-medium">Month / Charge</th>
                      <th className="px-3 py-2 text-right font-medium">Allocated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedTx.allocations?.map((alloc: any) => {
                      const isLateFee = alloc.chargeItem?.component?.category === 'LATE_FEE';
                      return (
                        <tr key={alloc.id} className={isLateFee ? "bg-red-50/50 dark:bg-red-900/10" : "bg-card"}>
                          <td className="px-3 py-2 flex items-center gap-2">
                            {alloc.chargeItem?.component?.name || "Unknown"}
                            {isLateFee && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 rounded border border-red-200">Late Fee</span>}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{alloc.chargeItem?.charge?.title || "-"}</td>
                          <td className="px-3 py-2 text-right font-medium text-emerald-600">{formatCurrency(Number(alloc.amount))}</td>
                        </tr>
                      );
                    })}
                    {(!selectedTx.allocations || selectedTx.allocations.length === 0) && (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                          No specific components allocated (likely Advance payment).
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Derived Advance Calculation */}
              {selectedTx.allocations && (
                (() => {
                  const totalAllocated = selectedTx.allocations.reduce((sum:number, a:any) => sum + Number(a.amount), 0);
                  const advance = Number(selectedTx.amount) - totalAllocated;
                  if (advance > 0) {
                    return (
                      <div className="mt-3 flex justify-between items-center p-3 bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/50 rounded-lg text-sm">
                        <span className="font-medium text-green-700 dark:text-green-400">Added to Advance Ledger</span>
                        <span className="font-bold text-green-600">+{formatCurrency(advance)}</span>
                      </div>
                    );
                  }
                  return null;
                })()
              )}
            </div>
            
          </div>
        )}
      </Dialog>
    </div>
  );
}
