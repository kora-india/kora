"use client";

import React from "react";
import { Tag, Button, Tooltip, Popconfirm, Empty } from "antd";
import {
  Plus,
  Edit2,
  Trash2,
  User,
  MapPin,
  Coffee,
  Utensils,
} from "lucide-react";
import { DAY_NAMES, PeriodDefinition } from "@/lib/timetable-generator";

interface TimetableGridProps {
  mode: "class" | "teacher";
  days?: number[];
  periods: PeriodDefinition[];
  slots: any[];
  onAddSlot: (dayOfWeek: number, periodNumber: number) => void;
  onEditSlot: (slot: any) => void;
  onDeleteSlot: (slotId: string) => void;
  isReadOnly?: boolean;
}

const SUBJECT_COLORS: Record<string, string> = {
  mathematics: "blue",
  science: "green",
  english: "purple",
  hindi: "orange",
  "social science": "geekblue",
  "social studies": "geekblue",
  "computer science": "cyan",
  computer: "cyan",
  "physical education": "gold",
  pe: "gold",
  "arts & crafts": "magenta",
  art: "magenta",
  music: "pink",
  library: "volcano",
};

export function TimetableGrid({
  mode,
  days = [1, 2, 3, 4, 5, 6], // Monday to Saturday
  periods,
  slots,
  onAddSlot,
  onEditSlot,
  onDeleteSlot,
  isReadOnly = false,
}: TimetableGridProps) {
  // Map slots by key: `${dayOfWeek}_${startTime}`
  const slotMap = new Map<string, any>();
  for (const s of slots) {
    slotMap.set(`${s.dayOfWeek}_${s.startTime}`, s);
  }

  if (periods.length === 0) {
    return (
      <div className="bg-card border rounded-2xl p-12 text-center">
        <Empty description="No timetable periods configured. Open Period Settings to set up your school bell schedule." />
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-2xl overflow-hidden shadow-sm print:border-none print:shadow-none print:rounded-none print:bg-white">
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse text-left timetable-print-table print:w-full print:table-fixed">
          {/* Header Row: Periods & Timings */}
          <thead>
            <tr className="bg-muted/60 border-b divide-x divide-border text-xs font-semibold text-muted-foreground">
              <th className="py-3 px-4 w-28 min-w-[110px] print:min-w-0 print:w-20 print:py-2 print:px-1.5 text-foreground font-bold sticky left-0 bg-muted/90 z-10 backdrop-blur-sm print:static print:backdrop-filter-none print:text-black print:text-[11px]">
                Day / Period
              </th>
              {periods.map((period) => (
                <th
                  key={period.periodNumber}
                  className={`py-2.5 px-3 min-w-[135px] print:min-w-0 print:py-1.5 print:px-1 text-center ${
                    period.isBreak
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 break-cell print:w-14"
                      : "print:w-auto"
                  }`}
                >
                  <div className="font-bold text-foreground text-xs flex items-center justify-center gap-1 print:text-black print:text-[11px]">
                    {period.isBreak &&
                    period.name.toLowerCase().includes("lunch") ? (
                      <Utensils className="w-3.5 h-3.5 text-amber-600 print:w-3 print:h-3 print:text-black" />
                    ) : period.isBreak ? (
                      <Coffee className="w-3.5 h-3.5 text-amber-600 print:w-3 print:h-3 print:text-black" />
                    ) : null}
                    <span>{period.name}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-normal mt-0.5 print:text-black print:text-[9.5px]">
                    {period.startTime} – {period.endTime}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Matrix Rows: Days */}
          <tbody className="divide-y divide-border">
            {days.map((day) => (
              <tr
                key={day}
                className="divide-x divide-border hover:bg-muted/20 transition-colors"
              >
                {/* Day Header */}
                <td className="py-3 px-4 font-semibold text-xs text-foreground bg-muted/30 sticky left-0 z-10 backdrop-blur-sm print:static print:backdrop-filter-none print:text-black print:font-bold print:py-2 print:px-1.5 print:text-[11px]">
                  {DAY_NAMES[day]}
                </td>

                {/* Period Cells */}
                {periods.map((period) => {
                  if (period.isBreak) {
                    return (
                      <td
                        key={period.periodNumber}
                        className="p-2 text-center bg-amber-500/5 select-none break-cell print:p-1"
                      >
                        <div className="flex flex-col items-center justify-center py-3 text-muted-foreground/60 text-xs print:py-1">
                          {period.name.toLowerCase().includes("lunch") ? (
                            <Utensils className="w-4 h-4 mb-1 text-amber-500/60 print:w-3.5 print:h-3.5 print:text-black print:mb-0.5" />
                          ) : (
                            <Coffee className="w-4 h-4 mb-1 text-amber-500/60 print:w-3.5 print:h-3.5 print:text-black print:mb-0.5" />
                          )}
                          <span className="text-[10px] font-medium tracking-wide uppercase text-amber-700/70 dark:text-amber-400/70 print:text-black print:font-bold print:text-[9px]">
                            {period.name}
                          </span>
                        </div>
                      </td>
                    );
                  }

                  const slot = slotMap.get(`${day}_${period.startTime}`);

                  if (slot) {
                    const tagColor =
                      SUBJECT_COLORS[slot.subjectName?.toLowerCase()] ||
                      "violet";

                    return (
                      <td
                        key={period.periodNumber}
                        className="p-2 align-top group relative print:p-1.5"
                      >
                        <div className="bg-card border rounded-xl p-2.5 shadow-xs hover:shadow-md transition-all space-y-1.5 h-full flex flex-col justify-between print:border-none print:shadow-none print:p-0 print:bg-transparent print:space-y-0.5">
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <Tag
                                color={tagColor}
                                className="font-semibold text-[11px] m-0 px-1.5 print:text-[10px] print:px-1 print:py-0 print:m-0 print:leading-tight"
                              >
                                {slot.subjectName}
                              </Tag>

                              {!isReadOnly && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 print:hidden">
                                  <Tooltip title="Edit Class">
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={
                                        <Edit2 className="w-3 h-3 text-muted-foreground" />
                                      }
                                      onClick={() => onEditSlot(slot)}
                                      className="p-1 h-6 w-6"
                                    />
                                  </Tooltip>

                                  <Popconfirm
                                    title="Remove this class?"
                                    onConfirm={() => onDeleteSlot(slot.id)}
                                    okText="Yes"
                                    cancelText="No"
                                  >
                                    <Tooltip title="Delete">
                                      <Button
                                        type="text"
                                        danger
                                        size="small"
                                        icon={<Trash2 className="w-3 h-3" />}
                                        className="p-1 h-6 w-6"
                                      />
                                    </Tooltip>
                                  </Popconfirm>
                                </div>
                              )}
                            </div>

                            {mode === "class" && slot.teacher && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5 font-medium print:mt-1">
                                <User className="w-3 h-3 text-violet-500 flex-shrink-0 print:w-2.5 print:h-2.5 print:text-black" />
                                <span className="truncate print:overflow-visible print:whitespace-normal print:break-words print:text-black print:text-[10px] print:font-semibold print:leading-tight">
                                  {slot.teacher.name}
                                </span>
                              </div>
                            )}

                            {mode === "teacher" && slot.class && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5 font-medium print:mt-1">
                                <span className="text-violet-600 dark:text-violet-400 font-semibold truncate print:overflow-visible print:whitespace-normal print:break-words print:text-black print:text-[10px] print:leading-tight">
                                  {slot.class.name} ({slot.section?.name})
                                </span>
                              </div>
                            )}
                          </div>

                          {slot.room && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80 pt-0.5 print:pt-0">
                              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0 print:w-2.5 print:h-2.5 print:text-gray-700" />
                              <span className="truncate print:overflow-visible print:whitespace-normal print:break-words print:text-gray-700 print:text-[9px] print:leading-tight">
                                {slot.room}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  }

                  // Empty Slot
                  return (
                    <td
                      key={period.periodNumber}
                      className="p-2 align-middle text-center group print:p-1"
                    >
                      {!isReadOnly ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onAddSlot(day, period.periodNumber)}
                            className="w-full h-16 rounded-xl border border-dashed border-border hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-all flex items-center justify-center text-muted-foreground/40 hover:text-violet-600 cursor-pointer group-hover:border-solid print:hidden"
                          >
                            <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                          <div className="hidden print:block w-full h-12 border border-dashed border-gray-300 rounded" />
                        </>
                      ) : (
                        <div className="w-full h-16 print:h-12 rounded-xl print:rounded border border-dashed border-border/40 print:border-gray-300 flex items-center justify-center text-[10px] text-muted-foreground/30 print:text-gray-500">
                          Free
                        </div>
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
