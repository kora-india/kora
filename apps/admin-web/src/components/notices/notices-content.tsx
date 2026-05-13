"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Megaphone } from "lucide-react";

interface NoticesContentProps { notices: any[] }

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  HIGH: { label: "High", dot: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800" },
  MEDIUM: { label: "Medium", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800" },
  LOW: { label: "Low", dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800" },
};

export function NoticesContent({ notices }: NoticesContentProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notices</h1>
          <p className="text-muted-foreground text-sm mt-1">{notices.length} published notices</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Publish Notice
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold">New Notice</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1 block">Title</label>
              <input className="w-full h-9 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Notice title..." />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Priority</label>
              <select className="w-full h-9 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="HIGH">High</option>
                <option value="MEDIUM" selected>Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium mb-1 block">Content</label>
              <textarea rows={3} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Notice content..." />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">Publish</button>
            <button onClick={() => setShowForm(false)} className="h-9 px-4 border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="space-y-3">
        {(notices.length > 0 ? notices : mockNotices).map((n, i) => {
          const cfg = PRIORITY_CONFIG[n.priority] ?? PRIORITY_CONFIG.MEDIUM;
          return (
            <motion.div
              key={n.id ?? i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
              className="rounded-xl border bg-card p-5 hover:shadow-sm transition-shadow cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{n.title}</h3>
                    <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                    <span>By {n.publishedBy?.name ?? "Admin"}</span>
                    <span>·</span>
                    <span>{new Date(n.createdAt ?? Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    {n.targetClassId && <><span>·</span><span>Targeted class</span></>}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

const mockNotices = [
  { id: "1", title: "Annual Sports Day — 20 May 2025", content: "All students are required to participate in the Annual Sports Day event. Students should report in sports attire by 7:30 AM.", priority: "HIGH", createdAt: new Date().toISOString(), publishedBy: { name: "Arjun Dubey" } },
  { id: "2", title: "Mid-Term Exams Schedule Released", content: "Mid-term examinations will be held from June 2–10. Timetable available on the portal.", priority: "MEDIUM", createdAt: new Date().toISOString(), publishedBy: { name: "Arjun Dubey" } },
  { id: "3", title: "Parent-Teacher Meeting", content: "PT Meeting scheduled for Saturday, May 25. Parents of Grade 10 and 12 are requested to attend.", priority: "LOW", createdAt: new Date().toISOString(), publishedBy: { name: "Arjun Dubey" } },
];
