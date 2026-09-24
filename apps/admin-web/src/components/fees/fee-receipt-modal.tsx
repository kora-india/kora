"use client";

import React, { useRef, useEffect } from "react";
import { Printer, X, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import type { FeeReceiptData } from "@/lib/actions/fee-allocator";

interface FeeReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: FeeReceiptData | null;
  autoPrint?: boolean;
}

/**
 * Derives a clean filename in the format: name_Fee_Receipt_month_year
 * e.g. "Aaron_Maldonado_Fee_Receipt_September_2026"
 */
export function getReceiptFileName(receiptData: FeeReceiptData): string {
  const cleanName = (receiptData.studentName || "Student")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "");

  let month = "";
  let year = "";

  if (receiptData.paidForMonths) {
    const monthMatch = receiptData.paidForMonths.match(
      /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
    );
    const yearMatch = receiptData.paidForMonths.match(/(20\d\d)/);

    if (monthMatch) month = monthMatch[1];
    if (yearMatch) year = yearMatch[1];
  }

  if (!month || !year) {
    const parsedDate = new Date(receiptData.timestamp || Date.now());
    if (!isNaN(parsedDate.getTime())) {
      if (!month) {
        month = parsedDate.toLocaleString("en-US", { month: "long" });
      }
      if (!year) {
        year = parsedDate.getFullYear().toString();
      }
    } else {
      if (!month) month = "Fee";
      if (!year) year = new Date().getFullYear().toString();
    }
  }

  return `${cleanName}_Fee_Receipt_${month}_${year}`;
}

/**
 * Triggers an isolated print using a dedicated hidden iframe.
 */
export function printReceipt(receiptData: FeeReceiptData) {
  const isPaidInFull =
    receiptData.paymentStatus === "PAID_IN_FULL" ||
    (receiptData.remainingOutstanding ?? receiptData.monthRemainingDue ?? 0) <=
      0;

  const remainingBalance = Number(
    receiptData.remainingOutstanding ?? receiptData.monthRemainingDue ?? 0,
  );
  const outstandingBefore = Number(
    receiptData.outstandingBefore || receiptData.total,
  );
  const amountPaid = Number(receiptData.amountPaid);

  const fileName = getReceiptFileName(receiptData);
  const prevTitle = document.title;
  document.title = fileName;

  // Clean up any existing print iframe
  const oldIframe = document.getElementById("kora-receipt-print-frame");
  if (oldIframe) {
    oldIframe.remove();
  }

  const iframe = document.createElement("iframe");
  iframe.id = "kora-receipt-print-frame";
  iframe.title = fileName;
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.zIndex = "-99999";
  iframe.style.opacity = "0";
  document.body.appendChild(iframe);

  // Month Allocations Table Rows
  const monthAllocRows = (receiptData.monthAllocations || [])
    .map((m) => {
      const isMonthPaid = m.status === "PAID" || m.balanceDue <= 0;
      const statusBadge = isMonthPaid
        ? `<span class="badge-status badge-paid">PAID</span>`
        : `<span class="badge-status badge-partial">PARTIALLY PAID</span>`;

      return `
      <tr>
        <td class="col-text font-bold">${m.month}</td>
        <td class="col-num font-mono">₹${m.feeDue.toFixed(2)}</td>
        <td class="col-num font-mono text-muted">₹${m.previouslyPaid.toFixed(2)}</td>
        <td class="col-num font-mono font-bold text-paid">₹${m.paidNow.toFixed(2)}</td>
        <td class="col-num font-mono font-bold ${m.balanceDue > 0 ? "text-due" : "text-paid"}">₹${m.balanceDue.toFixed(2)}</td>
        <td class="col-center">${statusBadge}</td>
      </tr>
    `;
    })
    .join("");

  // Fee Component Breakdown Rows
  const componentRows = (receiptData.items || [])
    .map(
      (item) => `
      <tr>
        <td class="col-text">${item.head}</td>
        <td class="col-num font-mono">₹${Number(item.amount).toFixed(2)}</td>
      </tr>
    `,
    )
    .join("");

  const printDocumentHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${fileName}</title>
        <style>
          @page {
            size: portrait;
            margin: 8mm 10mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            background: #ffffff !important;
            color: #111827 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 11.5px;
            line-height: 1.35;
          }
          .receipt-container {
            width: 100%;
            max-width: 580px;
            margin: 0 auto;
            padding: 8px;
            background: #ffffff;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #111827;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .school-name {
            font-size: 19px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: -0.2px;
            line-height: 1.2;
            color: #111827;
          }
          .school-sub {
            font-size: 11px;
            font-weight: 500;
            color: #4b5563;
            margin-top: 1px;
          }
          .doc-title-row {
            margin-top: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          .receipt-title {
            font-size: 14px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #111827;
          }
          .status-banner {
            font-size: 10.5px;
            font-weight: 800;
            padding: 3px 8px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            display: inline-block;
          }
          .banner-paid {
            background: #dcfce7 !important;
            color: #15803d !important;
            border: 1px solid #86efac;
          }
          .banner-partial {
            background: #fef3c7 !important;
            color: #b45309 !important;
            border: 1px solid #fde68a;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px 16px;
            padding: 6px 0;
            font-size: 11px;
            border-bottom: 1px dashed #d1d5db;
            margin-bottom: 8px;
          }
          .meta-item {
            display: flex;
            justify-content: space-between;
          }
          .meta-label {
            color: #6b7280;
            font-weight: 600;
          }
          .meta-val {
            font-weight: 700;
            color: #111827;
          }
          .section-title {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #4b5563;
            margin-bottom: 4px;
            margin-top: 8px;
          }
          /* 3-Box Summary Deck */
          .summary-deck {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 6px;
            margin-bottom: 8px;
          }
          .summary-card {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 6px 8px;
            background: #f9fafb;
            text-align: center;
          }
          .summary-card.highlight {
            border-color: #86efac;
            background: #f0fdf4;
          }
          .summary-card.due {
            border-color: #fde68a;
            background: #fffbeb;
          }
          .summary-label {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            color: #6b7280;
          }
          .summary-val {
            font-size: 13.5px;
            font-weight: 900;
            margin-top: 2px;
            font-family: monospace, monospace;
          }
          .text-paid {
            color: #15803d;
          }
          .text-due {
            color: #b45309;
          }
          .text-muted {
            color: #6b7280;
          }
          /* Tables */
          .styled-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
            border: 1px solid #111827;
            margin-bottom: 8px;
          }
          .styled-table th {
            background: #f3f4f6;
            border: 1px solid #111827;
            padding: 4px 6px;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 9.5px;
            letter-spacing: 0.3px;
            color: #111827;
          }
          .styled-table td {
            border: 1px solid #d1d5db;
            padding: 4px 6px;
            vertical-align: middle;
          }
          .styled-table tr.total-row td {
            border-top: 1.5px solid #111827;
            border-bottom: 1.5px solid #111827;
            background: #f9fafb;
            font-weight: 800;
          }
          .col-text {
            text-align: left;
          }
          .col-num {
            text-align: right;
            white-space: nowrap;
          }
          .col-center {
            text-align: center;
          }
          .font-bold {
            font-weight: 700;
          }
          .font-mono {
            font-family: monospace, monospace;
          }
          .badge-status {
            display: inline-block;
            font-size: 9px;
            font-weight: 800;
            padding: 1.5px 5px;
            border-radius: 3px;
            text-transform: uppercase;
          }
          .badge-paid {
            background: #dcfce7;
            color: #15803d;
            border: 0.5px solid #86efac;
          }
          .badge-partial {
            background: #fef3c7;
            color: #b45309;
            border: 0.5px solid #fde68a;
          }
          .component-grid-wrapper {
            margin-top: 6px;
            margin-bottom: 8px;
          }
          .footer-box {
            border-top: 1px dashed #d1d5db;
            padding-top: 8px;
            font-size: 10px;
            color: #4b5563;
            line-height: 1.4;
            margin-top: 10px;
          }
          .footer-flex {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
          }
          .mode-badge {
            display: inline-block;
            text-transform: uppercase;
            font-size: 9px;
            font-weight: 800;
            background: #f3f4f6;
            border: 0.5px solid #d1d5db;
            padding: 1px 5px;
            border-radius: 3px;
            margin-left: 3px;
          }
          .notice-box {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            margin: 4px 0;
          }
          .notice-due {
            background: #fef3c7;
            color: #92400e;
            border: 0.5px solid #fde68a;
          }
          .notice-paid {
            background: #f0fdf4;
            color: #166534;
            border: 0.5px solid #bbf7d0;
          }
          .terms-text {
            font-size: 9px;
            color: #6b7280;
            margin-top: 4px;
            line-height: 1.35;
          }
          .sign-area {
            display: flex;
            justify-content: space-between;
            margin-top: 28px;
            padding-bottom: 8px;
          }
          .sign-box {
            text-align: center;
            font-size: 9.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            border-top: 1px solid #4b5563;
            width: 140px;
            padding-top: 4px;
            color: #374151;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <!-- School & Document Header -->
          <div class="header">
            <div class="school-name">${receiptData.schoolName || "Horizon Private School"}</div>
            ${receiptData.schoolAddress ? `<div class="school-sub">${receiptData.schoolAddress}</div>` : ""}
            ${receiptData.schoolContact ? `<div class="school-sub">${receiptData.schoolContact}</div>` : ""}
            <div class="doc-title-row">
              <span class="receipt-title">FEE PAYMENT RECEIPT</span>
              <span class="status-banner ${isPaidInFull ? "banner-paid" : "banner-partial"}">
                ${isPaidInFull ? "PAID IN FULL" : `PARTIAL PAYMENT — ₹${remainingBalance.toFixed(2)} DUE`}
              </span>
            </div>
          </div>

          <!-- Metadata Grid -->
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Receipt No:</span>
              <span class="meta-val font-mono">${receiptData.receiptNo}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date & Time:</span>
              <span class="meta-val">${receiptData.timestamp}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Student Name:</span>
              <span class="meta-val">${receiptData.studentName}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Admission / Reg No:</span>
              <span class="meta-val font-mono">${receiptData.regNo}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Class & Section:</span>
              <span class="meta-val">${receiptData.className}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Roll Number:</span>
              <span class="meta-val font-mono">${receiptData.rollNumber || "-"}</span>
            </div>
          </div>

          <!-- 1. PAYMENT SUMMARY DECK -->
          <div class="section-title">1. Payment Summary</div>
          <div class="summary-deck">
            <div class="summary-card">
              <div class="summary-label">Fee Outstanding Before</div>
              <div class="summary-val text-muted">₹${outstandingBefore.toFixed(2)}</div>
            </div>
            <div class="summary-card highlight">
              <div class="summary-label">Amount Paid Today</div>
              <div class="summary-val text-paid">₹${amountPaid.toFixed(2)}</div>
            </div>
            <div class="summary-card ${remainingBalance > 0 ? "due" : "highlight"}">
              <div class="summary-label">Remaining Balance Due</div>
              <div class="summary-val ${remainingBalance > 0 ? "text-due" : "text-paid"}">
                ₹${remainingBalance.toFixed(2)}
              </div>
            </div>
          </div>

          <!-- 2. PAYMENT ALLOCATION TABLE -->
          <div class="section-title">2. Payment Allocation (Month-Wise Breakdown)</div>
          <table class="styled-table">
            <thead>
              <tr>
                <th class="col-text" style="width: 25%;">Month</th>
                <th class="col-num" style="width: 15%;">Fee Due</th>
                <th class="col-num" style="width: 15%;">Prev. Paid</th>
                <th class="col-num" style="width: 15%;">Paid Today</th>
                <th class="col-num" style="width: 15%;">Balance</th>
                <th class="col-center" style="width: 15%;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${
                monthAllocRows ||
                `<tr><td colspan="6" class="col-center text-muted">Direct fee payment allocated to outstanding dues.</td></tr>`
              }
              <tr class="total-row">
                <td class="col-text font-bold">TOTAL</td>
                <td class="col-num font-mono font-bold">₹${outstandingBefore.toFixed(2)}</td>
                <td class="col-num font-mono font-bold text-muted">
                  ₹${(receiptData.monthAllocations?.reduce((s, m) => s + m.previouslyPaid, 0) || 0).toFixed(2)}
                </td>
                <td class="col-num font-mono font-bold text-paid">₹${amountPaid.toFixed(2)}</td>
                <td class="col-num font-mono font-bold ${remainingBalance > 0 ? "text-due" : "text-paid"}">
                  ₹${remainingBalance.toFixed(2)}
                </td>
                <td class="col-center font-bold">
                  ${isPaidInFull ? `<span class="badge-status badge-paid">CLEARED</span>` : `<span class="badge-status badge-partial">DUE</span>`}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- 3. COMPONENT BREAKDOWN (IF AVAILABLE) -->
          ${
            receiptData.items && receiptData.items.length > 0
              ? `
          <div class="component-grid-wrapper">
            <div class="section-title">3. Fee Structure Breakdown (Monthly Components)</div>
            <table class="styled-table" style="margin-bottom: 4px;">
              <thead>
                <tr>
                  <th class="col-text" style="width: 75%;">Fee Component / Head</th>
                  <th class="col-num" style="width: 25%;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${componentRows}
              </tbody>
            </table>
          </div>
          `
              : ""
          }

          <!-- Footer Information -->
          <div class="footer-box">
            <div class="footer-flex">
              <div>
                <span style="color: #6b7280; font-weight: 600;">Payment Mode:</span>
                <span class="mode-badge">${receiptData.paymentType}</span>
              </div>
              <div>
                <span style="color: #6b7280; font-weight: 600;">Issued By:</span>
                <strong>${receiptData.generatedBy}</strong>
              </div>
            </div>

            ${
              remainingBalance > 0
                ? `<div class="notice-box notice-due">
                    Notice: An outstanding balance of ₹${remainingBalance.toFixed(2)} remains due for clearance.
                  </div>`
                : `<div class="notice-box notice-paid">
                    All selected fee obligations have been cleared in full.
                  </div>`
            }

            <div class="terms-text">
              <div>• Fees once paid are non-refundable and non-transferable.</div>
              <div>• Cheque / Online payments are subject to actual realization.</div>
            </div>

            <div class="sign-area">
              <div class="sign-box">Parent / Guardian</div>
              <div class="sign-box">Cashier / Accountant</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    document.title = prevTitle;
    return;
  }

  doc.open();
  doc.write(printDocumentHtml);
  doc.close();

  const handleCleanup = () => {
    document.title = prevTitle;
    setTimeout(() => {
      iframe.remove();
    }, 1200);
  };

  iframe.contentWindow?.addEventListener("afterprint", handleCleanup);
  window.addEventListener("afterprint", handleCleanup, { once: true });

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
      handleCleanup();
    }
  }, 300);
}

export function FeeReceiptModal({
  isOpen,
  onClose,
  receiptData,
  autoPrint = false,
}: Readonly<FeeReceiptModalProps>) {
  const printTriggered = useRef(false);

  useEffect(() => {
    if (isOpen && autoPrint && receiptData && !printTriggered.current) {
      printTriggered.current = true;
      const timer = setTimeout(() => {
        printReceipt(receiptData);
      }, 400);
      return () => clearTimeout(timer);
    }
    if (!isOpen) {
      printTriggered.current = false;
    }
  }, [isOpen, autoPrint, receiptData]);

  if (!isOpen || !receiptData) return null;

  const isPaidInFull =
    receiptData.paymentStatus === "PAID_IN_FULL" ||
    (receiptData.remainingOutstanding ?? receiptData.monthRemainingDue ?? 0) <=
      0;

  const remainingBalance = Number(
    receiptData.remainingOutstanding ?? receiptData.monthRemainingDue ?? 0,
  );
  const outstandingBefore = Number(
    receiptData.outstandingBefore || receiptData.total,
  );
  const amountPaid = Number(receiptData.amountPaid);

  const fileName = getReceiptFileName(receiptData);

  const handleManualPrint = () => {
    printReceipt(receiptData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-6">
        {/* Top Control Bar */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
              Fee Payment Receipt
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border whitespace-nowrap ${
                isPaidInFull
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                  : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
              }`}
            >
              {isPaidInFull
                ? "Paid in Full"
                : `Partial Paid (₹${remainingBalance.toFixed(0)} Due)`}
            </span>
            <span className="text-xs font-mono text-muted-foreground bg-neutral-200/60 dark:bg-neutral-800 px-2.5 py-0.5 rounded whitespace-nowrap">
              {receiptData.receiptNo}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleManualPrint}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer whitespace-nowrap ${
                isPaidInFull
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-violet-600 hover:bg-violet-700"
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              Print Receipt
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Suggested File Name Indicator */}
        <div className="px-5 py-2 bg-violet-50/70 dark:bg-violet-950/30 border-b border-violet-100 dark:border-violet-900/50 flex items-center justify-between text-xs gap-2 min-w-0">
          <span className="text-muted-foreground flex items-center gap-1.5 whitespace-nowrap flex-shrink-0">
            <FileText className="w-3.5 h-3.5 text-violet-600" />
            PDF File:
          </span>
          <span className="font-mono font-semibold text-violet-700 dark:text-violet-300 truncate">
            {fileName}.pdf
          </span>
        </div>

        {/* Scrollable Receipt Preview Container */}
        <div className="p-4 sm:p-6 bg-neutral-100 dark:bg-neutral-950/50 flex justify-center max-h-[75vh] overflow-y-auto">
          {/* Visual Paper Document */}
          <div className="w-full max-w-[580px] bg-white text-neutral-900 p-6 sm:p-8 pb-12 shadow-lg border border-neutral-300 font-sans select-none rounded-md">
            {/* School Header */}
            <div className="text-center pb-3 border-b-2 border-neutral-900">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug uppercase text-neutral-900">
                {receiptData.schoolName || "Horizon Private School"}
              </h1>
              {receiptData.schoolAddress && (
                <p className="text-xs text-neutral-600 font-medium leading-tight mt-0.5">
                  {receiptData.schoolAddress}
                </p>
              )}
              {receiptData.schoolContact && (
                <p className="text-xs text-neutral-600 font-medium leading-tight">
                  {receiptData.schoolContact}
                </p>
              )}
              <div className="mt-2 flex items-center justify-center gap-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">
                  FEE PAYMENT RECEIPT
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${
                    isPaidInFull
                      ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                      : "border-amber-700 bg-amber-50 text-amber-900"
                  }`}
                >
                  {isPaidInFull
                    ? "PAID IN FULL"
                    : `PARTIAL PAYMENT — ₹${remainingBalance.toFixed(0)} DUE`}
                </span>
              </div>
            </div>

            {/* Meta Information */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 py-3 text-xs border-b border-dashed border-neutral-300">
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">
                  Receipt No:
                </span>
                <span className="font-mono font-bold text-neutral-900">
                  {receiptData.receiptNo}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">
                  Date & Time:
                </span>
                <span className="font-medium text-neutral-900">
                  {receiptData.timestamp}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">
                  Student Name:
                </span>
                <span className="font-bold text-neutral-900">
                  {receiptData.studentName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">
                  Admission No:
                </span>
                <span className="font-mono font-semibold text-neutral-900">
                  {receiptData.regNo}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">
                  Class & Section:
                </span>
                <span className="font-medium text-neutral-900">
                  {receiptData.className}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">
                  Roll Number:
                </span>
                <span className="font-mono font-semibold text-neutral-900">
                  {receiptData.rollNumber || "-"}
                </span>
              </div>
            </div>

            {/* 1. PAYMENT SUMMARY DECK */}
            <div className="mt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                1. Payment Summary
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="border border-neutral-200 rounded-lg p-2 bg-neutral-50 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                    Outstanding Before
                  </p>
                  <p className="text-xs sm:text-sm font-black font-mono text-neutral-700 mt-0.5">
                    ₹{outstandingBefore.toFixed(2)}
                  </p>
                </div>
                <div className="border border-emerald-300 rounded-lg p-2 bg-emerald-50/60 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                    Paid Today
                  </p>
                  <p className="text-xs sm:text-sm font-black font-mono text-emerald-800 mt-0.5">
                    ₹{amountPaid.toFixed(2)}
                  </p>
                </div>
                <div
                  className={`border rounded-lg p-2 text-center ${
                    remainingBalance > 0
                      ? "border-amber-300 bg-amber-50/60 text-amber-900"
                      : "border-emerald-300 bg-emerald-50/60 text-emerald-900"
                  }`}
                >
                  <p
                    className={`text-[9px] font-bold uppercase tracking-wider ${
                      remainingBalance > 0
                        ? "text-amber-700"
                        : "text-emerald-700"
                    }`}
                  >
                    Remaining Due
                  </p>
                  <p
                    className={`text-xs sm:text-sm font-black font-mono mt-0.5 ${
                      remainingBalance > 0
                        ? "text-amber-800"
                        : "text-emerald-800"
                    }`}
                  >
                    ₹{remainingBalance.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. PAYMENT ALLOCATION TABLE */}
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                2. Payment Allocation (Month-Wise Breakdown)
              </p>
              <table className="w-full border border-neutral-900 border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-100 border-b border-neutral-900 text-[10px] font-bold uppercase">
                    <th className="border-r border-neutral-900 p-1.5 text-left">
                      Month
                    </th>
                    <th className="border-r border-neutral-900 p-1.5 text-right">
                      Fee Due
                    </th>
                    <th className="border-r border-neutral-900 p-1.5 text-right">
                      Prev. Paid
                    </th>
                    <th className="border-r border-neutral-900 p-1.5 text-right text-emerald-700">
                      Paid Today
                    </th>
                    <th className="border-r border-neutral-900 p-1.5 text-right">
                      Balance
                    </th>
                    <th className="p-1.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {(receiptData.monthAllocations || []).map((alloc, idx) => {
                    const isMonthPaid =
                      alloc.status === "PAID" || alloc.balanceDue <= 0;
                    return (
                      <tr key={idx} className="hover:bg-neutral-50/50">
                        <td className="border-r border-neutral-300 px-2 py-1.5 font-bold text-left">
                          {alloc.month}
                        </td>
                        <td className="border-r border-neutral-300 px-2 py-1.5 font-mono text-right text-neutral-700">
                          ₹{alloc.feeDue.toFixed(2)}
                        </td>
                        <td className="border-r border-neutral-300 px-2 py-1.5 font-mono text-right text-neutral-500">
                          ₹{alloc.previouslyPaid.toFixed(2)}
                        </td>
                        <td className="border-r border-neutral-300 px-2 py-1.5 font-mono font-bold text-right text-emerald-700">
                          ₹{alloc.paidNow.toFixed(2)}
                        </td>
                        <td
                          className={`border-r border-neutral-300 px-2 py-1.5 font-mono font-bold text-right ${
                            alloc.balanceDue > 0
                              ? "text-amber-700"
                              : "text-emerald-700"
                          }`}
                        >
                          ₹{alloc.balanceDue.toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {isMonthPaid ? (
                            <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                              PAID
                            </span>
                          ) : (
                            <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              {Math.round(alloc.coveragePercent || 0)}% paid • ₹
                              {alloc.balanceDue.toFixed(0)} due
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {(!receiptData.monthAllocations ||
                    receiptData.monthAllocations.length === 0) && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-2 py-3 text-center text-neutral-500"
                      >
                        Payment allocated towards student fee dues.
                      </td>
                    </tr>
                  )}
                  {/* Total Row */}
                  <tr className="border-t-2 border-neutral-900 bg-neutral-100 font-bold text-xs">
                    <td className="border-r border-neutral-900 px-2 py-1.5 text-left font-black">
                      TOTAL
                    </td>
                    <td className="border-r border-neutral-900 px-2 py-1.5 font-mono text-right">
                      ₹{outstandingBefore.toFixed(2)}
                    </td>
                    <td className="border-r border-neutral-900 px-2 py-1.5 font-mono text-right text-neutral-500">
                      ₹
                      {(
                        receiptData.monthAllocations?.reduce(
                          (s, m) => s + m.previouslyPaid,
                          0,
                        ) || 0
                      ).toFixed(2)}
                    </td>
                    <td className="border-r border-neutral-900 px-2 py-1.5 font-mono text-right text-emerald-700 font-black">
                      ₹{amountPaid.toFixed(2)}
                    </td>
                    <td
                      className={`border-r border-neutral-900 px-2 py-1.5 font-mono text-right font-black ${
                        remainingBalance > 0
                          ? "text-amber-700"
                          : "text-emerald-700"
                      }`}
                    >
                      ₹{remainingBalance.toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-center font-bold">
                      {isPaidInFull ? (
                        <span className="text-[10px] text-emerald-700">
                          CLEARED
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-700">DUE</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 3. FEE COMPONENT BREAKDOWN (IF PRESENT) */}
            {receiptData.items && receiptData.items.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                  3. Fee Structure Breakdown (Monthly Components)
                </p>
                <div className="border border-neutral-300 rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-100 border-b border-neutral-300 text-[10px] font-semibold text-neutral-600">
                      <tr>
                        <th className="px-2 py-1 text-left">
                          Component / Head
                        </th>
                        <th className="px-2 py-1 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {receiptData.items.map((item, i) => (
                        <tr key={i} className="hover:bg-neutral-50/50">
                          <td className="px-2 py-1 text-neutral-800">
                            {item.head}
                          </td>
                          <td className="px-2 py-1 text-right font-mono text-neutral-700">
                            ₹{Number(item.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payment Details & Notice */}
            <div className="mt-5 pt-3.5 border-t border-dashed border-neutral-300 text-xs text-neutral-700 space-y-2">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <span className="text-neutral-500 font-medium">
                    Payment Mode:
                  </span>
                  <span className="font-bold uppercase tracking-wide text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded text-[11px] border border-neutral-200">
                    {receiptData.paymentType}
                  </span>
                </span>
                <span className="text-neutral-600">
                  <span className="text-neutral-500 font-medium">
                    Issued By:
                  </span>{" "}
                  <strong className="text-neutral-900">
                    {receiptData.generatedBy}
                  </strong>
                </span>
              </div>

              {remainingBalance > 0 ? (
                <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-700" />
                  <span>
                    Notice: An outstanding balance of ₹
                    {remainingBalance.toFixed(2)} remains due for clearance.
                  </span>
                </div>
              ) : (
                <div className="p-1.5 rounded bg-emerald-50/70 border border-emerald-200 text-emerald-800 text-[10.5px] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
                  <span>
                    All selected fee obligations have been cleared in full.
                  </span>
                </div>
              )}

              <div className="text-[10px] text-neutral-400 space-y-0.5 pt-0.5">
                <p>• Fees once paid are non-refundable and non-transferable.</p>
                <p>
                  • Cheque / Online payments are subject to actual realization.
                </p>
              </div>
            </div>

            {/* Signature Area with generous spacing and clear lines */}
            <div className="mt-8 pt-4 pb-2 flex justify-between items-end text-neutral-800">
              <div className="text-center w-36">
                <div className="border-b border-neutral-400 mb-1.5"></div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 block">
                  Parent / Guardian
                </span>
              </div>
              <div className="text-center w-36">
                <div className="border-b border-neutral-400 mb-1.5"></div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 block">
                  Cashier / Accountant
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80">
          <p className="text-xs text-muted-foreground">
            {isPaidInFull
              ? "All selected fee dues have been fully settled."
              : `Partial payment recorded. ₹${remainingBalance.toFixed(2)} remains outstanding.`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleManualPrint}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-semibold shadow-sm transition-all cursor-pointer whitespace-nowrap ${
                isPaidInFull
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-violet-600 hover:bg-violet-700"
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              Print Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
