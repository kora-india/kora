"use client";

import { useState } from "react";
import { Plus, GraduationCap, Users, Bell, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const actions = [
  { href: "/students/new", label: "Add Student", icon: GraduationCap },
  { href: "/teachers/new", label: "Add Teacher", icon: Users },
  { href: "/notices/new", label: "Post Notice", icon: Bell },
  { href: "/attendance", label: "Take Attendance", icon: ClipboardCheck },
];

export function QuickActions() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
      >
        <Plus size={15} />
        New
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-xl shadow-elevation z-20 py-1 overflow-hidden"
            >
              {actions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <action.icon size={14} className="text-muted-foreground" />
                  {action.label}
                </Link>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
