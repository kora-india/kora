"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, Search, CheckCircle2, XCircle } from "lucide-react";

const PLAN_BADGE: Record<string, string> = {
  FREE: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700",
  BASIC: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  PRO: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800",
  ENTERPRISE: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
};

interface SchoolsContentProps {
  schools: any[];
}

export function SchoolsContent({ schools }: SchoolsContentProps) {
  const [search, setSearch] = useState("");

  const filtered = schools.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.subdomain.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schools</h1>
          <p className="text-muted-foreground text-sm mt-1">{schools.length} schools registered</p>
        </div>
        <button className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">
          <Plus className="w-4 h-4" />
          Add School
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          placeholder="Search by name, subdomain, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border bg-card overflow-hidden"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="h-10 px-5 text-left text-xs font-medium text-muted-foreground uppercase">School</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Subdomain</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Plan</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Students</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Teachers</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <motion.tr
                key={s.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: i * 0.03 } }}
                className="border-b hover:bg-muted/30 transition-colors"
              >
                <td className="h-12 px-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.email ?? s.phone ?? "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="h-12 px-4 text-xs text-muted-foreground">{s.subdomain}</td>
                <td className="h-12 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${PLAN_BADGE[s.plan] ?? PLAN_BADGE.FREE}`}>
                    {s.plan}
                  </span>
                </td>
                <td className="h-12 px-4 text-xs">{s._count.students}</td>
                <td className="h-12 px-4 text-xs">{s._count.teachers}</td>
                <td className="h-12 px-4">
                  {s.isActive ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 dark:text-green-400">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
                      <XCircle className="w-3 h-3" /> Inactive
                    </span>
                  )}
                </td>
                <td className="h-12 px-4">
                  <button className="text-xs text-violet-600 hover:underline">View</button>
                </td>
              </motion.tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="h-32 text-center text-xs text-muted-foreground">No schools found</td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
