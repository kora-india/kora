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
    <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          {/* Header Row: Periods & Timings */}
          <thead>
            <tr className="bg-muted/60 border-b divide-x divide-border text-xs font-semibold text-muted-foreground">
              <th className="py-3 px-4 w-28 min-w-[110px] text-foreground font-bold sticky left-0 bg-muted/90 z-10 backdrop-blur-sm">
                Day / Period
              </th>
              {periods.map((period) => (
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

          {/* Matrix Rows: Days */}
          <tbody className="divide-y divide-border">
            {days.map((day) => (
              <tr
                key={day}
                className="divide-x divide-border hover:bg-muted/20 transition-colors"
              >
                {/* Day Header */}
                <td className="py-3 px-4 font-semibold text-xs text-foreground bg-muted/30 sticky left-0 z-10 backdrop-blur-sm">
                  {DAY_NAMES[day]}
                </td>

                {/* Period Cells */}
                {periods.map((period) => {
                  if (period.isBreak) {
                    return (
                      <td
                        key={period.periodNumber}
                        className="p-2 text-center bg-amber-500/5 select-none"
                      >
                        <div className="flex flex-col items-center justify-center py-3 text-muted-foreground/60 text-xs">
                          {period.name.toLowerCase().includes("lunch") ? (
                            <Utensils className="w-4 h-4 mb-1 text-amber-500/60" />
                          ) : (
                            <Coffee className="w-4 h-4 mb-1 text-amber-500/60" />
                          )}
                          <span className="text-[10px] font-medium tracking-wide uppercase text-amber-700/70 dark:text-amber-400/70">
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
                        className="p-2 align-top group relative"
                      >
                        <div className="bg-card border rounded-xl p-2.5 shadow-xs hover:shadow-md transition-all space-y-1.5 h-full flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <Tag
                                color={tagColor}
                                className="font-semibold text-[11px] m-0 px-1.5"
                              >
                                {slot.subjectName}
                              </Tag>

                              {!isReadOnly && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
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
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5 font-medium">
                                <User className="w-3 h-3 text-violet-500 flex-shrink-0" />
                                <span className="truncate">
                                  {slot.teacher.name}
                                </span>
                              </div>
                            )}

                            {mode === "teacher" && slot.class && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5 font-medium">
                                <span className="text-violet-600 dark:text-violet-400 font-semibold truncate">
                                  {slot.class.name} ({slot.section?.name})
                                </span>
                              </div>
                            )}
                          </div>

                          {slot.room && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80 pt-0.5">
                              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">{slot.room}</span>
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
                      className="p-2 align-middle text-center group"
                    >
                      {!isReadOnly ? (
                        <button
                          type="button"
                          onClick={() => onAddSlot(day, period.periodNumber)}
                          className="w-full h-16 rounded-xl border border-dashed border-border hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-all flex items-center justify-center text-muted-foreground/40 hover:text-violet-600 cursor-pointer group-hover:border-solid"
                        >
                          <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ) : (
                        <div className="w-full h-16 rounded-xl border border-dashed border-border/40 flex items-center justify-center text-[10px] text-muted-foreground/30">
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
