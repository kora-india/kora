"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Users, IndianRupee, FileText } from "lucide-react";
import { CollectionTab } from "./tabs/collection-tab";
import { SetupTab } from "./tabs/setup-tab";
import { AssignmentsTab } from "./tabs/assignments-tab";
import { GeneratorTab } from "./tabs/generator-tab";
import { LogsTab } from "./tabs/logs-tab";
import { Activity } from "lucide-react";

interface Props {
  sessions: any[];
  components: any[];
  structures: any[];
  classes: any[];
  students: any[];
  recentCharges: any[];
  transactions: any[];
  school?: any;
  canEdit: boolean;
}

export function FeesContent(props: Readonly<Props>) {
  const [activeTab, setActiveTab] = useState("collection");

  const TABS = [
    { id: "collection", label: "Fee Collection", icon: IndianRupee },
    { id: "generator", label: "Generate Fees", icon: FileText },
    { id: "logs", label: "Logs & Activities", icon: Activity },
    { id: "assignments", label: "Class & Student Setup", icon: Users },
    { id: "settings", label: "Fee Settings", icon: Settings },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fee Management</h1>
          <p className="text-muted-foreground mt-1">
            Complete financial control for academic sessions, fee structures, and collections.
          </p>
        </div>
      </div>

      <div className="flex space-x-1 p-1 bg-muted/50 rounded-xl w-fit border shadow-sm">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors z-10 ${
                isActive ? "text-violet-700 dark:text-violet-300" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-background rounded-lg shadow-sm -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="pt-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "collection" && <CollectionTab {...props} onNavigate={setActiveTab} />}
            { activeTab === "generator" && <GeneratorTab {...props} /> }
            { activeTab === "logs" && <LogsTab transactions={props.transactions} /> }
            { activeTab === "assignments" && <AssignmentsTab {...props} /> }
            {activeTab === "settings" && <SetupTab {...props} school={props.school} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
