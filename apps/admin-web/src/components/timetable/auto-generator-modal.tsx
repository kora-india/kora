"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Select,
  Input,
  InputNumber,
  Button,
  Table,
  Space,
  Checkbox,
  Alert,
  Tag,
  Divider,
  message,
} from "antd";
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { generateAutomatedTimetableAction } from "@/lib/actions/timetable";
import { PeriodDefinition, SubjectQuota } from "@/lib/timetable-generator";

interface AutoGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  classes: any[];
  teachers: any[];
  periods: PeriodDefinition[];
  selectedClassId?: string;
  selectedSectionId?: string;
  onGenerated: () => void;
}

export function AutoGeneratorModal({
  open,
  onClose,
  classes,
  teachers,
  periods,
  selectedClassId,
  selectedSectionId,
  onGenerated,
}: AutoGeneratorModalProps) {
  const [form] = Form.useForm();
  const [generating, setGenerating] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [unassigned, setUnassigned] = useState<any[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(true);

  const teachablePeriods = periods.filter((p) => !p.isBreak);
  const totalWeeklyCapacity = teachablePeriods.length * 6; // 6 days (Mon-Sat)

  const [subjectsList, setSubjectsList] = useState<SubjectQuota[]>([]);

  useEffect(() => {
    if (!open) {
      setDiagnostics([]);
      setUnassigned([]);
      return;
    }

    form.setFieldsValue({
      classId: selectedClassId || classes[0]?.id,
      sectionId: selectedSectionId || classes[0]?.sections?.[0]?.id,
    });

    // Generate smart defaults based on teachers in the school
    const defaultSubjects: SubjectQuota[] = [
      { subjectName: "Mathematics", periodsPerWeek: 6, maxPerDay: 2 },
      {
        subjectName: "Science",
        periodsPerWeek: 6,
        maxPerDay: 2,
        room: "Science Lab",
      },
      { subjectName: "English", periodsPerWeek: 5, maxPerDay: 1 },
      { subjectName: "Social Science", periodsPerWeek: 5, maxPerDay: 1 },
      { subjectName: "Hindi", periodsPerWeek: 4, maxPerDay: 1 },
      {
        subjectName: "Computer Science",
        periodsPerWeek: 3,
        maxPerDay: 1,
        room: "Computer Lab",
      },
      {
        subjectName: "Physical Education",
        periodsPerWeek: 3,
        maxPerDay: 1,
        room: "Playground",
      },
      {
        subjectName: "Arts & Crafts",
        periodsPerWeek: 2,
        maxPerDay: 1,
        room: "Art Room",
      },
    ].map((sub) => {
      // Find matching teacher
      const matchingTeacher = teachers.find(
        (t) => t.subject?.toLowerCase() === sub.subjectName.toLowerCase(),
      );
      return {
        ...sub,
        teacherId: matchingTeacher?.id || null,
        teacherName: matchingTeacher?.name || null,
      };
    });

    setSubjectsList(defaultSubjects);
  }, [open, selectedClassId, selectedSectionId, classes, teachers, periods]);

  const totalPeriodsRequested = subjectsList.reduce(
    (sum, s) => sum + (s.periodsPerWeek || 0),
    0,
  );

  const handleQuotaChange = (
    index: number,
    field: keyof SubjectQuota,
    value: any,
  ) => {
    const updated = [...subjectsList];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "teacherId") {
      const t = teachers.find((tch) => tch.id === value);
      updated[index].teacherName = t?.name || null;
    }
    setSubjectsList(updated);
  };

  const handleAddSubjectRow = () => {
    setSubjectsList([
      ...subjectsList,
      {
        subjectName: "New Subject",
        periodsPerWeek: 2,
        maxPerDay: 1,
      },
    ]);
  };

  const handleDeleteSubjectRow = (index: number) => {
    setSubjectsList(subjectsList.filter((_, idx) => idx !== index));
  };

  const handleGenerate = async () => {
    const values = await form.validateFields();
    setGenerating(true);
    setDiagnostics([]);
    setUnassigned([]);

    try {
      const res = await generateAutomatedTimetableAction({
        classId: values.classId,
        sectionId: values.sectionId,
        daysOfWeek: [1, 2, 3, 4, 5, 6], // Monday to Saturday
        subjects: subjectsList,
        replaceExisting,
      });

      if (res.success) {
        message.success(
          `Timetable successfully generated! ${res.allocatedSlots} class periods scheduled with zero clashes.`,
        );
        onGenerated();
        onClose();
      } else {
        setDiagnostics(res.diagnostics || []);
        setUnassigned(res.unassignedSubjects || []);
        if (res.allocatedSlots && res.allocatedSlots > 0) {
          message.warning(
            `Partially scheduled ${res.allocatedSlots} slots. Some subjects could not be placed due to teacher conflicts.`,
          );
          onGenerated();
        } else {
          message.error("Could not schedule timetable. Check teacher clashes.");
        }
      }
    } catch (err: any) {
      message.error(err.message || "Failed to generate timetable.");
    } finally {
      setGenerating(false);
    }
  };

  const currentClassId = Form.useWatch("classId", form);
  const currentClass = classes.find((c) => c.id === currentClassId);
  const sections = currentClass?.sections || [];

  const columns = [
    {
      title: "Subject",
      dataIndex: "subjectName",
      key: "subjectName",
      width: 170,
      render: (name: string, _: any, idx: number) => (
        <Input
          value={name}
          onChange={(e) =>
            handleQuotaChange(idx, "subjectName", e.target.value)
          }
          size="middle"
        />
      ),
    },
    {
      title: "Periods/Wk",
      dataIndex: "periodsPerWeek",
      key: "periodsPerWeek",
      width: 105,
      render: (val: number, _: any, idx: number) => (
        <InputNumber
          min={1}
          max={15}
          value={val}
          onChange={(v) => handleQuotaChange(idx, "periodsPerWeek", v || 1)}
          className="w-full"
        />
      ),
    },
    {
      title: "Assigned Teacher",
      dataIndex: "teacherId",
      key: "teacherId",
      render: (teacherId: string | undefined, _: any, idx: number) => (
        <Select
          allowClear
          showSearch
          placeholder="Select Teacher"
          value={teacherId || undefined}
          optionFilterProp="label"
          options={teachers.map((t) => ({
            label: `${t.name} (${t.subject || "General"})`,
            value: t.id,
          }))}
          onChange={(v) => handleQuotaChange(idx, "teacherId", v)}
          className="w-full"
        />
      ),
    },
    {
      title: "Room / Lab",
      dataIndex: "room",
      key: "room",
      width: 140,
      render: (room: string | undefined, _: any, idx: number) => (
        <Input
          placeholder="e.g. Lab, Rm 101"
          value={room || ""}
          onChange={(e) => handleQuotaChange(idx, "room", e.target.value)}
        />
      ),
    },
    {
      title: "",
      key: "action",
      width: 50,
      render: (_: any, __: any, idx: number) => (
        <Button
          type="text"
          danger
          icon={<Trash2 className="w-4 h-4" />}
          onClick={() => handleDeleteSubjectRow(idx)}
        />
      ),
    },
  ];

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-600" />
          <span className="font-semibold text-base">
            Automated Timetable Generator
          </span>
        </div>
      }
      open={open}
      onCancel={onClose}
      onOk={handleGenerate}
      confirmLoading={generating}
      okText="Generate & Apply Timetable"
      cancelText="Cancel"
      okButtonProps={{ className: "bg-violet-600 hover:bg-violet-700" }}
      width={780}
      destroyOnClose
    >
      <div className="space-y-4 my-2">
        <p className="text-xs text-muted-foreground">
          The constraint-satisfaction engine automatically schedules weekly
          periods, prevents teacher and room double-bookings across the entire
          school, and balances subject distribution.
        </p>

        <Form form={form} layout="vertical">
          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              label="Target Class"
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
                }}
              />
            </Form.Item>

            <Form.Item
              label="Target Section"
              name="sectionId"
              rules={[{ required: true, message: "Section is required" }]}
            >
              <Select
                placeholder="Select Section"
                options={sections.map((s: any) => ({
                  label: `Section ${s.name}`,
                  value: s.id,
                }))}
              />
            </Form.Item>
          </div>
        </Form>

        <Divider className="my-2" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">
              Subject Weekly Allocation
            </span>
            <Tag
              color={
                totalPeriodsRequested <= totalWeeklyCapacity ? "green" : "red"
              }
            >
              {totalPeriodsRequested} / {totalWeeklyCapacity} Weekly Slots
            </Tag>
          </div>

          <Button
            size="small"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={handleAddSubjectRow}
          >
            Add Subject
          </Button>
        </div>

        <Table
          dataSource={subjectsList}
          columns={columns}
          rowKey={(_, idx) => String(idx)}
          pagination={false}
          size="small"
          bordered
          className="border rounded-lg overflow-hidden"
        />

        <div className="flex items-center justify-between pt-1">
          <Checkbox
            checked={replaceExisting}
            onChange={(e) => setReplaceExisting(e.target.checked)}
          >
            <span className="text-xs">
              Replace existing slots for this section (uncheck to preserve
              manually placed locked slots)
            </span>
          </Checkbox>
        </div>

        {diagnostics.length > 0 && (
          <Alert
            message="Scheduling Constraints / Warnings"
            description={
              <ul className="list-disc list-inside text-xs space-y-1">
                {diagnostics.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            }
            type="warning"
            showIcon
            className="rounded-lg"
          />
        )}

        {unassigned.length > 0 && (
          <Alert
            message="Unassigned Subject Quotas"
            description={
              <ul className="list-disc list-inside text-xs space-y-1">
                {unassigned.map((u, i) => (
                  <li key={i}>
                    <strong>{u.subjectName}</strong>: {u.remaining} period(s)
                    unplaced — {u.reason}
                  </li>
                ))}
              </ul>
            }
            type="error"
            showIcon
            className="rounded-lg"
          />
        )}
      </div>
    </Modal>
  );
}
