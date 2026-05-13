import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getFeeStatusLabel } from "@schoolos/utils";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  rollNumber: string;
  section: {
    name: string;
    class: { name: string };
  };
  fees: Array<{ status: string }>;
}

interface RecentStudentsProps {
  students: Student[];
}

const statusColors: Record<string, string> = {
  PAID: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  OVERDUE: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function RecentStudents({ students }: RecentStudentsProps) {
  return (
    <div className="card-elevated">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Recent Students</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Latest enrollments</p>
        </div>
        <Link
          href="/students"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View all <ArrowRight size={12} />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th className="px-4 py-2.5 text-left">Student</th>
              <th className="px-4 py-2.5 text-left">Class</th>
              <th className="px-4 py-2.5 text-left">Roll</th>
              <th className="px-4 py-2.5 text-left">Fee Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const feeStatus = student.fees[0]?.status ?? "PAID";
              return (
                <tr key={student.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                        {student.firstName[0]}{student.lastName[0]}
                      </div>
                      <span className="font-medium text-foreground text-sm">
                        {student.firstName} {student.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {student.section.class.name} — {student.section.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {student.rollNumber}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[feeStatus] ?? "bg-muted text-muted-foreground"}`}>
                      {getFeeStatusLabel(feeStatus)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {students.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No students yet
          </div>
        )}
      </div>
    </div>
  );
}
