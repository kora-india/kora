"use client";

import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Select, Alert, Tag, Space, message } from "antd";
import { Clock, User, MapPin, BookOpen, AlertTriangle } from "lucide-react";
import { checkSlotConflict } from "@/lib/actions/timetable";
import { DAY_NAMES, PeriodDefinition } from "@/lib/timetable-generator";

const COMMON_SUBJECTS = [
  { label: "Mathematics", value: "Mathematics", color: "blue" },
  { label: "Science", value: "Science", color: "green" },
  { label: "English", value: "English", color: "purple" },
  { label: "Hindi", value: "Hindi", color: "orange" },
  { label: "Social Science", value: "Social Science", color: "geekblue" },
  { label: "Computer Science", value: "Computer Science", color: "cyan" },
  { label: "Physical Education", value: "Physical Education", color: "gold" },
  { label: "Arts & Crafts", value: "Arts & Crafts", color: "magenta" },
  { label: "Music", value: "Music", color: "pink" },
  { label: "Library / Reading", value: "Library", color: "volcano" },
];

interface SlotDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (
    data: any,
  ) => Promise<boolean | { success: boolean; error?: string }>;
  initialData?: any;
  classes: any[];
  teachers: any[];
  periods: PeriodDefinition[];
  selectedClassId?: string;
  selectedSectionId?: string;
  defaultDayOfWeek?: number;
  defaultPeriodNumber?: number;
}

export function SlotDialog({
  open,
  onClose,
  onSave,
  initialData,
  classes,
  teachers,
  periods,
  selectedClassId,
  selectedSectionId,
  defaultDayOfWeek,
  defaultPeriodNumber,
}: SlotDialogProps) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const nonBreakPeriods = periods.filter((p) => !p.isBreak);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setConflictWarning(null);
      return;
    }

    if (initialData) {
      const matchingPeriod = nonBreakPeriods.find(
        (p) => p.startTime === initialData.startTime,
      );

      form.setFieldsValue({
        id: initialData.id,
        classId: initialData.classId,
        sectionId: initialData.sectionId,
        dayOfWeek: initialData.dayOfWeek,
        periodNumber: matchingPeriod?.periodNumber || 1,
        startTime: initialData.startTime,
        endTime: initialData.endTime,
        subjectName: initialData.subjectName,
        teacherId: initialData.teacherId || undefined,
        room: initialData.room || undefined,
      });
    } else {
      const defPeriod =
        nonBreakPeriods.find((p) => p.periodNumber === defaultPeriodNumber) ||
        nonBreakPeriods[0];

      form.setFieldsValue({
        classId: selectedClassId || classes[0]?.id,
        sectionId: selectedSectionId || classes[0]?.sections?.[0]?.id,
        dayOfWeek: defaultDayOfWeek || 1,
        periodNumber: defPeriod?.periodNumber || 1,
        startTime: defPeriod?.startTime || "08:00",
        endTime: defPeriod?.endTime || "08:45",
        subjectName: "Mathematics",
        teacherId: undefined,
        room: undefined,
      });
    }
  }, [
    open,
    initialData,
    selectedClassId,
    selectedSectionId,
    defaultDayOfWeek,
    defaultPeriodNumber,
  ]);

  const handlePeriodChange = (periodNum: number) => {
    const period = nonBreakPeriods.find((p) => p.periodNumber === periodNum);
    if (period) {
      form.setFieldsValue({
        startTime: period.startTime,
        endTime: period.endTime,
      });
      runConflictCheck();
    }
  };

  const runConflictCheck = async () => {
    try {
      const values = form.getFieldsValue();
      if (
        !values.classId ||
        !values.sectionId ||
        !values.dayOfWeek ||
        !values.startTime
      ) {
        return;
      }

      const res = await checkSlotConflict({
        classId: values.classId,
        sectionId: values.sectionId,
        dayOfWeek: values.dayOfWeek,
        startTime: values.startTime,
        endTime: values.endTime,
        teacherId: values.teacherId || null,
        room: values.room || null,
        excludeSlotId: initialData?.id,
      });

      if (res.hasConflict) {
        setConflictWarning(res.message || "Conflict detected.");
      } else {
        setConflictWarning(null);
      }
    } catch {
      // Ignore check errors during typing
    }
  };

  const handleFinish = async (values: any) => {
    setSaving(true);
    try {
      const payload = {
        id: initialData?.id,
        classId: values.classId,
        sectionId: values.sectionId,
        dayOfWeek: Number(values.dayOfWeek),
        startTime: values.startTime,
        endTime: values.endTime,
        subjectName: values.subjectName,
        teacherId: values.teacherId || null,
        room: values.room || null,
      };

      const res: any = await onSave(payload);
      if (res && res.success === false) {
        setConflictWarning(res.error || "Failed to save slot due to conflict.");
        return;
      }

      message.success(
        initialData
          ? "Timetable slot updated!"
          : "Class scheduled successfully!",
      );
      onClose();
    } catch (err: any) {
      message.error(err.message || "Failed to save timetable slot.");
    } finally {
      setSaving(false);
    }
  };

  const currentClassId = Form.useWatch("classId", form);
  const currentClass = classes.find((c) => c.id === currentClassId);
  const sections = currentClass?.sections || [];

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-violet-600" />
          <span className="font-semibold text-base">
            {initialData ? "Edit Timetable Slot" : "Schedule New Class"}
          </span>
        </div>
      }
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText={initialData ? "Update Slot" : "Assign Class"}
      cancelText="Cancel"
      okButtonProps={{ className: "bg-violet-600 hover:bg-violet-700" }}
      destroyOnClose
      width={540}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        className="mt-4 space-y-3"
      >
        {conflictWarning && (
          <Alert
            message="Scheduling Conflict Detected"
            description={conflictWarning}
            type="error"
            showIcon
            icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
            className="mb-3 rounded-lg"
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Form.Item
            label="Class"
            name="classId"
            rules={[{ required: true, message: "Class is required" }]}
          >
            <Select
              placeholder="Select Class"
              options={classes.map((c) => ({ label: c.name, value: c.id }))}
              onChange={(val) => {
                const target = classes.find((c) => c.id === val);
                if (target?.sections?.[0]) {
                  form.setFieldsValue({ sectionId: target.sections[0].id });
                }
                runConflictCheck();
              }}
            />
          </Form.Item>

          <Form.Item
            label="Section"
            name="sectionId"
            rules={[{ required: true, message: "Section is required" }]}
          >
            <Select
              placeholder="Select Section"
              options={sections.map((s: any) => ({
                label: `Section ${s.name}`,
                value: s.id,
              }))}
              onChange={runConflictCheck}
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Form.Item
            label="Day of Week"
            name="dayOfWeek"
            rules={[{ required: true, message: "Day is required" }]}
          >
            <Select
              placeholder="Select Day"
              options={[1, 2, 3, 4, 5, 6].map((day) => ({
                label: DAY_NAMES[day],
                value: day,
              }))}
              onChange={runConflictCheck}
            />
          </Form.Item>

          <Form.Item
            label="Period"
            name="periodNumber"
            rules={[{ required: true, message: "Period is required" }]}
          >
            <Select
              placeholder="Select Period"
              options={nonBreakPeriods.map((p) => ({
                label: `${p.name} (${p.startTime} - ${p.endTime})`,
                value: p.periodNumber,
              }))}
              onChange={handlePeriodChange}
            />
          </Form.Item>
        </div>

        {/* Hidden start and end time fields */}
        <Form.Item name="startTime" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="endTime" hidden>
          <Input />
        </Form.Item>

        <Form.Item
          label="Subject"
          name="subjectName"
          rules={[{ required: true, message: "Subject is required" }]}
          extra={
            <div className="flex flex-wrap gap-1 mt-1.5">
              {COMMON_SUBJECTS.map((sub) => (
                <Tag
                  key={sub.value}
                  className="cursor-pointer hover:opacity-80"
                  color={sub.color}
                  onClick={() =>
                    form.setFieldsValue({ subjectName: sub.value })
                  }
                >
                  {sub.label}
                </Tag>
              ))}
            </div>
          }
        >
          <Select
            showSearch
            placeholder="Select or enter subject"
            options={COMMON_SUBJECTS.map((s) => ({
              label: s.label,
              value: s.value,
            }))}
            onChange={(val) => {
              // Auto-suggest teacher who teaches this subject if available
              const teacher = teachers.find(
                (t) => t.subject?.toLowerCase() === val.toLowerCase(),
              );
              if (teacher && !form.getFieldValue("teacherId")) {
                form.setFieldsValue({ teacherId: teacher.id });
                runConflictCheck();
              }
            }}
          />
        </Form.Item>

        <div className="grid grid-cols-2 gap-3">
          <Form.Item
            label={
              <Space size={4}>
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Assigned Teacher</span>
              </Space>
            }
            name="teacherId"
          >
            <Select
              allowClear
              showSearch
              placeholder="Select Teacher (Optional)"
              optionFilterProp="label"
              options={teachers.map((t) => ({
                label: `${t.name} (${t.subject || "General"})`,
                value: t.id,
              }))}
              onChange={runConflictCheck}
            />
          </Form.Item>

          <Form.Item
            label={
              <Space size={4}>
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Room / Venue</span>
              </Space>
            }
            name="room"
          >
            <Input
              placeholder="e.g. Room 201, Science Lab"
              onBlur={runConflictCheck}
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
