"use client";

import React from "react";
import { Loader2, Coffee, Utensils } from "lucide-react";
import { DAY_NAMES, PeriodDefinition } from "@/lib/timetable-generator";

interface TimetableSkeletonProps {
  periods: PeriodDefinition[];
  days?: number[];
  targetName?: string;
}

export function TimetableSkeleton({
  periods,
  days = [1, 2, 3, 4, 5, 6], // Monday to Saturday
  targetName,
}: TimetableSkeletonProps) {
  // If periods are not yet loaded, show 8 default period columns
  const effectivePeriods =
    periods && periods.length > 0
      ? periods
      : [
          {
            periodNumber: 1,
            name: "Period 1",
            startTime: "08:00",
            endTime: "08:45",
            isBreak: false,
          },
          {
            periodNumber: 2,
            name: "Period 2",
            startTime: "08:45",
            endTime: "09:30",
            isBreak: false,
          },
          {
            periodNumber: 3,
            name: "Period 3",
            startTime: "09:30",
            endTime: "10:15",
            isBreak: false,
          },
          {
            periodNumber: 4,
            name: "Recess",
            startTime: "10:15",
            endTime: "10:35",
            isBreak: true,
          },
          {
            periodNumber: 5,
            name: "Period 4",
            startTime: "10:35",
            endTime: "11:20",
            isBreak: false,
          },
          {
            periodNumber: 6,
            name: "Period 5",
            startTime: "11:20",
            endTime: "12:05",
            isBreak: false,
          },
          {
            periodNumber: 7,
            name: "Lunch",
            startTime: "12:05",
            endTime: "12:45",
            isBreak: true,
          },
          {
            periodNumber: 8,
            name: "Period 6",
            startTime: "12:45",
            endTime: "01:30",
            isBreak: false,
          },
        ];

  return (
    <div className="bg-card border rounded-2xl overflow-hidden shadow-xs relative print:border print:border-slate-300 print:shadow-none print:rounded-lg print:bg-white">
      {/* Top Subtle Loading Indicator Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b text-xs text-muted-foreground print:hidden">
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 animate-spin" />
          <span className="font-medium text-foreground">
            {targetName
              ? `Loading ${targetName}...`
              : "Loading timetable schedule..."}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground/80 hidden sm:inline-block">
          Updating periods & teacher assignments
        </span>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse text-left print:w-full print:table-fixed print:border print:border-slate-300">
          {/* Header Row: Periods & Timings */}
          <thead>
            <tr className="bg-muted/60 border-b divide-x divide-border text-xs font-semibold text-muted-foreground print:bg-slate-100 print:text-black print:divide-slate-300 print:border-slate-300">
              <th className="py-3 px-4 w-28 min-w-[110px] print:min-w-0 print:w-24 print:py-2 print:px-2 text-foreground font-bold sticky left-0 bg-muted/90 z-10 backdrop-blur-sm print:static print:bg-slate-100 print:backdrop-filter-none print:text-black print:border-r print:border-slate-300">
                Day / Period
              </th>
              {effectivePeriods.map((period) => (
                <th
                  key={period.periodNumber}
                  className={`py-2.5 px-3 min-w-[135px] text-center ${
                    period.isBreak
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : ""
                  }`}
                >
                  <div className="font-bold text-foreground text-xs flex items-center justify-center gap-1">
                    {period.isBreak &&
                    period.name.toLowerCase().includes("lunch") ? (
                      <Utensils className="w-3.5 h-3.5 text-amber-600" />
                    ) : period.isBreak ? (
                      <Coffee className="w-3.5 h-3.5 text-amber-600" />
                    ) : null}
                    <span>{period.name}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-normal mt-0.5">
                    {period.startTime} – {period.endTime}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Matrix Rows: Days with Skeleton Placeholders */}
          <tbody className="divide-y divide-border">
            {days.map((day, dayIndex) => (
              <tr
                key={day}
                className="divide-x divide-border hover:bg-muted/20 transition-colors"
              >
                {/* Day Header */}
                <td className="py-3 px-4 font-semibold text-xs text-foreground bg-muted/30 sticky left-0 z-10 backdrop-blur-sm">
                  {DAY_NAMES[day]}
                </td>

                {/* Skeleton Period Cells */}
                {effectivePeriods.map((period, periodIndex) => {
                  if (period.isBreak) {
                    return (
                      <td
                        key={period.periodNumber}
                        className="p-2 text-center bg-amber-500/5 select-none"
                      >
                        <div className="flex flex-col items-center justify-center py-3 text-muted-foreground/50 text-xs">
                          {period.name.toLowerCase().includes("lunch") ? (
                            <Utensils className="w-4 h-4 mb-1 text-amber-500/50" />
                          ) : (
                            <Coffee className="w-4 h-4 mb-1 text-amber-500/50" />
                          )}
                          <span className="text-[10px] font-medium tracking-wide uppercase text-amber-700/60 dark:text-amber-400/60">
                            {period.name}
                          </span>
                        </div>
                      </td>
                    );
                  }

                  // Alternating patterns to make the skeleton look organic like real class cards
                  const isPopulated = (dayIndex + periodIndex) % 4 !== 0;

                  return (
                    <td
                      key={period.periodNumber}
                      className="p-2 align-top select-none"
                    >
                      {isPopulated ? (
                        <div className="bg-card border border-border/70 rounded-xl p-2.5 shadow-2xs space-y-2 h-16 flex flex-col justify-between animate-pulse">
                          <div>
                            {/* Subject tag pill skeleton */}
                            <div
                              className="h-4 rounded bg-muted"
                              style={{
                                width: `${45 + ((dayIndex * 13 + periodIndex * 17) % 35)}%`,
                              }}
                            />
                            {/* Teacher name skeleton */}
                            <div className="h-3 w-20 bg-muted/60 rounded mt-1.5" />
                          </div>
                          {/* Room indicator skeleton */}
                          <div className="h-2.5 w-14 bg-muted/40 rounded" />
                        </div>
                      ) : (
                        // Empty slot skeleton
                        <div className="w-full h-16 rounded-xl border border-dashed border-border/40 bg-muted/10 animate-pulse flex items-center justify-center" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
