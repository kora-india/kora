"use client";

import React, { useRef, useEffect } from "react";
import { Printer, X, FileText, CheckCircle2 } from "lucide-react";
import type { FeeReceiptData } from "@/lib/actions/fee-allocator";

interface FeeReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: FeeReceiptData | null;
  autoPrint?: boolean;
}

/**
 * Derives a clean filename in the format: name_month_year
 * e.g. "Aaron_Maldonado_John_September_2021"
 */
export function getReceiptFileName(receiptData: FeeReceiptData): string {
  const cleanName = (receiptData.studentName || "Student")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "");

  let month = "";
  let year = "";

  // 1. Try parsing from paidForMonths (e.g. "September/2021 - September/2021" or "April 2026")
  if (receiptData.paidForMonths) {
    const monthMatch = receiptData.paidForMonths.match(
      /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
    );
    const yearMatch = receiptData.paidForMonths.match(/(20\d\d)/);

    if (monthMatch) month = monthMatch[1];
    if (yearMatch) year = yearMatch[1];
  }

  // 2. Fallback to transaction timestamp
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

  return `${cleanName}_${month}_${year}`;
}

/**
 * Triggers an isolated print using a dedicated hidden iframe.
 * Guarantees that:
 * 1. The output document is never blank (isolated DOM with pure CSS).
 * 2. The suggested PDF filename in Chrome's "Save as PDF" dialog matches document.title (name_month_year).
 * 3. Does not interfere with parent page layout or global print rules.
 */
export function printReceipt(receiptData: FeeReceiptData) {
  const fileName = getReceiptFileName(receiptData);
  const prevTitle = document.title;
  document.title = fileName;

  // Clean up any existing print iframe
  const oldIframe = document.getElementById("schoolos-receipt-print-frame");
  if (oldIframe) {
    oldIframe.remove();
  }

  const iframe = document.createElement("iframe");
  iframe.id = "schoolos-receipt-print-frame";
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

  const itemsRows = receiptData.items
    .map(
      (item) => `
      <tr class="row-item">
        <td class="col-head">${item.head}</td>
        <td class="col-amount">${Number(item.amount).toFixed(2)}</td>
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
            margin: 8mm 12mm;
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
            color: #000000 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 12px;
            line-height: 1.35;
          }
          .receipt-container {
            width: 100%;
            max-width: 530px;
            margin: 0 auto;
            padding: 8px;
            background: #ffffff;
          }
          .header {
            text-align: center;
            margin-bottom: 6px;
          }
          .school-name {
            font-size: 20px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: -0.2px;
            line-height: 1.2;
            color: #000000;
          }
          .school-sub {
            font-size: 11.5px;
            font-weight: 500;
            line-height: 1.3;
            color: #000000;
          }
          .receipt-title {
            font-size: 13.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 4px;
            color: #000000;
          }
          .meta-section {
            font-size: 11.5px;
            line-height: 1.4;
            margin-top: 6px;
            margin-bottom: 6px;
            color: #000000;
          }
          .meta-flex {
            display: flex;
            justify-content: space-between;
          }
          .bold {
            font-weight: 700;
          }
          .receipt-table {
            width: 100%;
            border: 1px solid #000000;
            border-collapse: collapse;
            font-size: 11.5px;
            color: #000000;
          }
          .receipt-table th,
          .receipt-table td {
            padding: 3.5px 7px;
            color: #000000;
            vertical-align: middle;
          }
          .receipt-table thead tr {
            border-bottom: 1px solid #000000;
          }
          .col-head {
            text-align: left;
            border-right: 1px solid #000000;
            width: 72%;
          }
          .col-amount {
            text-align: right;
            width: 28%;
            font-family: monospace, monospace;
          }
          .row-item td {
            border-bottom: 0.5px solid #d1d5db;
          }
          .row-total td,
          .row-amount-paid td {
            border-top: 1px solid #000000;
            font-weight: 700;
          }
          .row-full td {
            border-top: 1px solid #000000;
          }
          .disclaimer {
            font-size: 10px;
            line-height: 1.35;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">
            <div class="school-name">${receiptData.schoolName || "Horizon Private School"}</div>
            ${receiptData.schoolAddress ? `<div class="school-sub">${receiptData.schoolAddress}</div>` : ""}
            ${receiptData.schoolContact ? `<div class="school-sub">${receiptData.schoolContact}</div>` : ""}
            <div class="receipt-title">SCHOOL FEE TRANSACTION RECEIPT</div>
          </div>

          <div class="meta-section">
            <div><span class="bold">Transaction Timestamp:</span> ${receiptData.timestamp}</div>
            <div class="meta-flex">
              <div><span class="bold">Receipt No:</span> ${receiptData.receiptNo}</div>
              <div><span class="bold">Reg No:</span> ${receiptData.regNo}</div>
            </div>
            <div class="meta-flex">
              <div><span class="bold">Name:</span> ${receiptData.studentName}</div>
              <div><span class="bold">Class:</span> ${receiptData.className}</div>
            </div>
          </div>

          <table class="receipt-table">
            <thead>
              <tr>
                <th class="col-head bold">Fee Head</th>
                <th class="col-amount bold">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
              <tr class="row-total">
                <td class="col-head bold">Total</td>
                <td class="col-amount bold">${Number(receiptData.total).toFixed(2)}</td>
              </tr>
              <tr class="row-amount-paid">
                <td class="col-head bold">Amount Paid</td>
                <td class="col-amount bold">${Number(receiptData.amountPaid).toFixed(2)}</td>
              </tr>
              ${
                receiptData.paidForMonths
                  ? `
              <tr class="row-full">
                <td colspan="2"><span class="bold">Paid for Months:</span> ${receiptData.paidForMonths}</td>
              </tr>`
                  : ""
              }
              <tr class="row-full">
                <td colspan="2"><span class="bold">Payment Type:</span> ${receiptData.paymentType}</td>
              </tr>
              <tr class="row-full">
                <td colspan="2" class="disclaimer">
                  Receipt generated by ${receiptData.generatedBy}. This is a computer generated receipt and does not require a signature. Please bring this receipt the next time you come to pay the fees.
                </td>
              </tr>
            </tbody>
          </table>
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

  // Allow styles to register inside the iframe before initiating print
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

  const fileName = getReceiptFileName(receiptData);

  const handleManualPrint = () => {
    printReceipt(receiptData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-6">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
              Fee Receipt
            </span>
            <span className="text-xs font-mono text-muted-foreground bg-neutral-200/60 dark:bg-neutral-800 px-2 py-0.5 rounded">
              {receiptData.receiptNo}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualPrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
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
        <div className="px-5 py-2 bg-violet-50/70 dark:bg-violet-950/30 border-b border-violet-100 dark:border-violet-900/50 flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-violet-600" />
            Save as PDF filename:
          </span>
          <span className="font-mono font-semibold text-violet-700 dark:text-violet-300">
            {fileName}.pdf
          </span>
        </div>

        {/* Scrollable Receipt Preview Container */}
        <div className="p-6 sm:p-8 bg-neutral-100 dark:bg-neutral-950/50 flex justify-center max-h-[75vh] overflow-y-auto">
          {/* Exact Visual Receipt Paper matching Image 2 */}
          <div className="w-full max-w-[520px] bg-white text-black p-6 sm:p-7 shadow-md border border-neutral-300 font-sans select-none">
            {/* School Header */}
            <div className="text-center space-y-0.5 pb-2">
              <h1 className="text-xl sm:text-2xl font-bold text-black tracking-tight leading-snug uppercase">
                {receiptData.schoolName || "Horizon Private School"}
              </h1>
              {receiptData.schoolAddress && (
                <p className="text-xs text-black font-medium leading-tight">
                  {receiptData.schoolAddress}
                </p>
              )}
              {receiptData.schoolContact && (
                <p className="text-xs text-black font-medium leading-tight">
                  {receiptData.schoolContact}
                </p>
              )}
              <h2 className="text-sm font-bold text-black uppercase tracking-wider pt-1">
                SCHOOL FEE TRANSACTION RECEIPT
              </h2>
            </div>

            {/* Meta Information */}
            <div className="text-xs text-black space-y-0.5 pt-2 pb-2 font-medium">
              <div>
                <span className="font-bold">Transaction Timestamp: </span>
                <span>{receiptData.timestamp}</span>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-bold">Receipt No: </span>
                  <span>{receiptData.receiptNo}</span>
                </div>
                <div>
                  <span className="font-bold">Reg No: </span>
                  <span>{receiptData.regNo}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-bold">Name: </span>
                  <span className="font-semibold">
                    {receiptData.studentName}
                  </span>
                </div>
                <div>
                  <span className="font-bold">Class: </span>
                  <span>{receiptData.className}</span>
                </div>
              </div>
            </div>

            {/* Table with Black Border */}
            <div className="mt-1">
              <table className="w-full border border-black border-collapse text-xs text-black">
                <thead>
                  <tr className="border-b border-black font-bold">
                    <th className="border-r border-black p-1.5 text-left font-bold w-[72%]">
                      Fee Head
                    </th>
                    <th className="p-1.5 text-right font-bold w-[28%]">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {receiptData.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-black/20">
                      <td className="border-r border-black px-2 py-1 text-left font-normal">
                        {item.head}
                      </td>
                      <td className="px-2 py-1 text-right font-mono font-medium">
                        {Number(item.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}

                  {/* Total Row */}
                  <tr className="border-t border-black font-bold">
                    <td className="border-r border-black px-2 py-1.5 text-left font-bold">
                      Total
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold">
                      {Number(receiptData.total).toFixed(2)}
                    </td>
                  </tr>

                  {/* Amount Paid Row */}
                  <tr className="border-t border-black font-bold">
                    <td className="border-r border-black px-2 py-1.5 text-left font-bold">
                      Amount Paid
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold">
                      {Number(receiptData.amountPaid).toFixed(2)}
                    </td>
                  </tr>

                  {/* Paid for Months Row */}
                  {receiptData.paidForMonths && (
                    <tr className="border-t border-black">
                      <td colSpan={2} className="px-2 py-1 text-left">
                        <span className="font-bold">Paid for Months: </span>
                        <span>{receiptData.paidForMonths}</span>
                      </td>
                    </tr>
                  )}

                  {/* Payment Type Row */}
                  <tr className="border-t border-black">
                    <td colSpan={2} className="px-2 py-1 text-left">
                      <span className="font-bold">Payment Type: </span>
                      <span className="capitalize">
                        {receiptData.paymentType}
                      </span>
                    </td>
                  </tr>

                  {/* Disclaimer & Authorization Row */}
                  <tr className="border-t border-black">
                    <td
                      colSpan={2}
                      className="px-2 py-1.5 text-left text-[11px] leading-relaxed text-black"
                    >
                      Receipt generated by{" "}
                      <span className="font-medium">
                        {receiptData.generatedBy}
                      </span>
                      . This is a computer generated receipt and does not
                      require a signature. Please bring this receipt the next
                      time you come to pay the fees.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80">
          <p className="text-xs text-muted-foreground">
            Saves as portrait PDF formatted to single-sheet receipt standards.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleManualPrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
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
