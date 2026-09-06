"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  Table,
  Button,
  Tag,
  Alert,
  Space,
  Popconfirm,
  message,
  Empty,
} from "antd";
import {
  ShieldAlert,
  CheckCircle2,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  User,
} from "lucide-react";
import {
  auditSchoolConflicts,
  deleteTimetableSlot,
} from "@/lib/actions/timetable";
import { DAY_NAMES } from "@/lib/timetable-generator";

interface ConflictAuditModalProps {
  open: boolean;
  onClose: () => void;
  onResolved: () => void;
}

export function ConflictAuditModal({
  open,
  onClose,
  onResolved,
}: ConflictAuditModalProps) {
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);

  const loadConflicts = async () => {
    setLoading(true);
    try {
      const res = await auditSchoolConflicts();
      setConflicts(res);
    } catch (err: any) {
      message.error("Failed to run conflict audit.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadConflicts();
    }
  }, [open]);

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await deleteTimetableSlot(slotId);
      message.success("Conflicting slot removed!");
      loadConflicts();
      onResolved();
    } catch (err: any) {
      message.error(err.message || "Failed to remove slot.");
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-500" />
          <span className="font-semibold text-base">
            School-Wide Timetable Conflict Audit
          </span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
        <Button
          key="refresh"
          type="primary"
          onClick={loadConflicts}
          loading={loading}
          className="bg-violet-600 hover:bg-violet-700"
        >
          Re-scan Schedule
        </Button>,
      ]}
      width={780}
      destroyOnClose
    >
      <div className="space-y-4 my-2">
        <p className="text-xs text-muted-foreground">
          The auditor scans every active class, section, teacher, and facility
          across the school to detect double-bookings and scheduling collisions.
        </p>

        {conflicts.length === 0 && !loading && (
          <div className="py-8 text-center bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <h3 className="font-semibold text-green-800 dark:text-green-300 text-base">
              Zero Schedule Conflicts Found!
            </h3>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              All teacher assignments, rooms, and periods are properly
              synchronized across all classes.
            </p>
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="space-y-3">
            <Alert
              message={`${conflicts.length} Conflict(s) Detected`}
              description="The following classes share the same teacher or room at the exact same day and time slot. You can remove or adjust conflicting slots below."
              type="error"
              showIcon
              className="rounded-lg"
            />

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {conflicts.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-card border border-red-200 dark:border-red-900/50 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag color="red">
                        {c.type === "TEACHER"
                          ? "Teacher Double-Booking"
                          : "Room Double-Booking"}
                      </Tag>
                      <span className="font-semibold text-sm text-foreground">
                        {c.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{DAY_NAMES[c.dayOfWeek]}</span>
                      <Clock className="w-3.5 h-3.5 ml-1" />
                      <span>
                        {c.startTime} - {c.endTime}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {c.description}
                  </p>

                  <div className="bg-muted/40 rounded-lg p-2 divide-y divide-border">
                    {c.slots.map((s: any) => (
                      <div
                        key={s.id}
                        className="py-1.5 flex items-center justify-between first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs">
                            {s.class?.name} ({s.section?.name}):
                          </span>
                          <Tag color="blue" className="text-xs">
                            {s.subjectName}
                          </Tag>
                          {s.room && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {s.room}
                            </span>
                          )}
                          {s.teacher && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {s.teacher.name}
                            </span>
                          )}
                        </div>

                        <Popconfirm
                          title="Remove this slot to resolve conflict?"
                          onConfirm={() => handleDeleteSlot(s.id)}
                          okText="Delete"
                          cancelText="Cancel"
                        >
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                          >
                            Remove
                          </Button>
                        </Popconfirm>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
