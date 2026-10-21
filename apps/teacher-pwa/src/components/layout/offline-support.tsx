"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { toast } from "sonner";
import { QUEUE_EVENT, flushQueue, readQueue } from "@/lib/attendance-queue";

/**
 * Registers the service worker and sends attendance saved on this phone
 * whenever the app opens or comes back online (U8).
 */
export function OfflineSupport() {
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // The app still works online without it.
      });
    }

    let flushing = false;
    const refresh = () => setWaiting(readQueue().length);
    const flush = async () => {
      if (flushing || !navigator.onLine || readQueue().length === 0) return;
      flushing = true;
      try {
        const { sent, refused } = await flushQueue();
        if (sent.length) {
          toast.success(`Sent attendance saved offline: ${sent.join(", ")}`);
        }
        for (const r of refused) {
          toast.error(`Attendance for ${r.label} wasn't saved: ${r.error}`, {
            duration: 10000,
          });
        }
      } finally {
        flushing = false;
        refresh();
      }
    };

    refresh();
    flush();
    window.addEventListener("online", flush);
    window.addEventListener(QUEUE_EVENT, refresh);
    return () => {
      window.removeEventListener("online", flush);
      window.removeEventListener(QUEUE_EVENT, refresh);
    };
  }, []);

  if (waiting === 0) return null;
  return (
    <div className="fixed bottom-20 inset-x-0 z-40 flex justify-center pointer-events-none">
      <div className="flex items-center gap-1.5 rounded-full bg-amber-500 text-white text-[11px] font-semibold px-3 py-1.5 shadow-lg">
        <CloudOff className="w-3.5 h-3.5" />
        {waiting} attendance save{waiting === 1 ? "" : "s"} waiting to send
      </div>
    </div>
  );
}
