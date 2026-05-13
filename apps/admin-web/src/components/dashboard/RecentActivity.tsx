import { Bell, DollarSign, AlertCircle } from "lucide-react";
import { formatDate, formatCompactCurrency } from "@schoolos/utils";

interface RecentActivityProps {
  notices: Array<{ id: string; title: string; publishedAt: Date; priority: string }>;
  fees: Array<{
    id: string;
    title: string;
    amount: any;
    dueDate: Date;
    status: string;
    student: { firstName: string; lastName: string };
  }>;
}

const priorityColors: Record<string, string> = {
  HIGH: "text-red-500",
  URGENT: "text-red-600",
  MEDIUM: "text-amber-500",
  LOW: "text-green-500",
};

export function RecentActivity({ notices, fees }: RecentActivityProps) {
  return (
    <div className="card-elevated">
      <div className="p-5 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Notices and fee alerts</p>
      </div>
      <div className="divide-y divide-border">
        {notices.map((notice) => (
          <div key={notice.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
              <Bell size={14} className="text-violet-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground font-medium leading-snug truncate">{notice.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{formatDate(notice.publishedAt)}</span>
                <span className={`text-xs font-medium ${priorityColors[notice.priority]}`}>
                  {notice.priority}
                </span>
              </div>
            </div>
          </div>
        ))}

        {fees.slice(0, 3).map((fee) => (
          <div key={fee.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              fee.status === "OVERDUE"
                ? "bg-red-50 dark:bg-red-950/30"
                : "bg-amber-50 dark:bg-amber-950/30"
            }`}>
              {fee.status === "OVERDUE"
                ? <AlertCircle size={14} className="text-red-500" />
                : <DollarSign size={14} className="text-amber-500" />
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground font-medium leading-snug">
                {fee.student.firstName} {fee.student.lastName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{formatCompactCurrency(Number(fee.amount))} due</span>
                <span className={`text-xs font-medium ${fee.status === "OVERDUE" ? "text-red-500" : "text-amber-500"}`}>
                  {fee.status}
                </span>
              </div>
            </div>
          </div>
        ))}

        {notices.length === 0 && fees.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No recent activity
          </div>
        )}
      </div>
    </div>
  );
}
