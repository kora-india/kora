"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface AttendanceOverviewProps {
  present: number;
  total: number;
  pct: number;
}

export function AttendanceOverview({ present, total, pct }: AttendanceOverviewProps) {
  const absent = total - present;
  const data = total > 0
    ? [
        { name: "Present", value: present, color: "#22c55e" },
        { name: "Absent", value: absent, color: "#f97316" },
      ]
    : [{ name: "No data", value: 1, color: "hsl(var(--muted))" }];

  const color = pct >= 90 ? "#22c55e" : pct >= 75 ? "#f59e0b" : "#ef4444";

  return (
    <div className="card-elevated p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Today's Attendance</h3>
          <p className="text-xs text-muted-foreground mt-0.5">School-wide overview</p>
        </div>
      </div>

      {/* Donut chart */}
      <div className="flex flex-col items-center">
        <div className="relative h-40 w-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={68}
                dataKey="value"
                strokeWidth={2}
                stroke="hsl(var(--background))"
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, name: string) => [`${v} students`, name]}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ color }}>{pct}%</span>
            <span className="text-xs text-muted-foreground">present</span>
          </div>
        </div>

        <div className="flex gap-6 mt-4 text-center">
          <div>
            <div className="text-lg font-bold text-green-500">{present}</div>
            <div className="text-xs text-muted-foreground">Present</div>
          </div>
          <div>
            <div className="text-lg font-bold text-orange-500">{absent}</div>
            <div className="text-xs text-muted-foreground">Absent</div>
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">{total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>
      </div>
    </div>
  );
}
