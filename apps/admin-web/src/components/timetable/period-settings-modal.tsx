"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  Table,
  Button,
  Input,
  Switch,
  TimePicker,
  Space,
  Tag,
  message,
  Popconfirm,
} from "antd";
import { Settings2, Plus, Trash2, Clock, RotateCcw } from "lucide-react";
import { savePeriodSettings } from "@/lib/actions/timetable";
import { DEFAULT_PERIODS, PeriodDefinition } from "@/lib/timetable-generator";
import dayjs from "dayjs";

interface PeriodSettingsModalProps {
  open: boolean;
  onClose: () => void;
  periods: PeriodDefinition[];
  onSaved: () => void;
}

export function PeriodSettingsModal({
  open,
  onClose,
  periods: initialPeriods,
  onSaved,
}: PeriodSettingsModalProps) {
  const [periods, setPeriods] = useState<PeriodDefinition[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPeriods(
        initialPeriods.length > 0 ? [...initialPeriods] : [...DEFAULT_PERIODS],
      );
    }
  }, [open, initialPeriods]);

  const handleTimeChange = (
    index: number,
    field: "startTime" | "endTime",
    timeString: string,
  ) => {
    const updated = [...periods];
    updated[index] = { ...updated[index], [field]: timeString };
    setPeriods(updated);
  };

  const handleNameChange = (index: number, name: string) => {
    const updated = [...periods];
    updated[index] = { ...updated[index], name };
    setPeriods(updated);
  };

  const handleBreakToggle = (index: number, isBreak: boolean) => {
    const updated = [...periods];
    updated[index] = { ...updated[index], isBreak };
    setPeriods(updated);
  };

  const handleAddPeriod = () => {
    const lastPeriod = periods[periods.length - 1];
    const newPeriodNum = (lastPeriod?.periodNumber || 0) + 1;
    setPeriods([
      ...periods,
      {
        periodNumber: newPeriodNum,
        name: `Period ${newPeriodNum}`,
        startTime: "03:00",
        endTime: "03:45",
        isBreak: false,
      },
    ]);
  };

  const handleDeletePeriod = (index: number) => {
    if (periods.length <= 1) {
      message.warning("At least one period is required.");
      return;
    }
    const updated = periods.filter((_, i) => i !== index);
    setPeriods(updated);
  };

  const handleResetDefaults = () => {
    setPeriods([...DEFAULT_PERIODS]);
    message.info("Reset to standard CBSE/ICSE 8-period timetable template.");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate unique start times
      const startTimes = periods.map((p) => p.startTime);
      if (new Set(startTimes).size !== startTimes.length) {
        message.error("Each period must have a unique start time.");
        setSaving(false);
        return;
      }

      await savePeriodSettings(
        periods.map((p, idx) => ({
          periodNumber: idx + 1,
          name: p.name,
          startTime: p.startTime,
          endTime: p.endTime,
          isBreak: p.isBreak,
        })),
      );

      message.success("Period timings and break schedules saved!");
      onSaved();
      onClose();
    } catch (err: any) {
      message.error(err.message || "Failed to save period settings.");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: "#",
      key: "index",
      width: 50,
      render: (_: any, __: any, index: number) => (
        <span className="font-semibold text-xs text-muted-foreground">
          {index + 1}
        </span>
      ),
    },
    {
      title: "Period Name",
      dataIndex: "name",
      key: "name",
      render: (name: string, _: any, index: number) => (
        <Input
          value={name}
          onChange={(e) => handleNameChange(index, e.target.value)}
          size="middle"
          className="font-medium"
        />
      ),
    },
    {
      title: "Start Time",
      dataIndex: "startTime",
      key: "startTime",
      width: 140,
      render: (time: string, _: any, index: number) => (
        <TimePicker
          format="HH:mm"
          value={dayjs(`2026-01-01 ${time}`, "YYYY-MM-DD HH:mm")}
          onChange={(_, timeStr) => {
            const str = Array.isArray(timeStr) ? timeStr[0] : timeStr;
            if (str) handleTimeChange(index, "startTime", str);
          }}
          minuteStep={5}
          needConfirm={false}
          className="w-full"
        />
      ),
    },
    {
      title: "End Time",
      dataIndex: "endTime",
      key: "endTime",
      width: 140,
      render: (time: string, _: any, index: number) => (
        <TimePicker
          format="HH:mm"
          value={dayjs(`2026-01-01 ${time}`, "YYYY-MM-DD HH:mm")}
          onChange={(_, timeStr) => {
            const str = Array.isArray(timeStr) ? timeStr[0] : timeStr;
            if (str) handleTimeChange(index, "endTime", str);
          }}
          minuteStep={5}
          needConfirm={false}
          className="w-full"
        />
      ),
    },
    {
      title: "Type",
      dataIndex: "isBreak",
      key: "isBreak",
      width: 120,
      render: (isBreak: boolean, _: any, index: number) => (
        <Space>
          <Switch
            checked={isBreak}
            onChange={(checked) => handleBreakToggle(index, checked)}
          />
          <Tag color={isBreak ? "orange" : "blue"}>
            {isBreak ? "Break" : "Class"}
          </Tag>
        </Space>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 70,
      render: (_: any, __: any, index: number) => (
        <Popconfirm
          title="Delete this period slot?"
          onConfirm={() => handleDeletePeriod(index)}
          okText="Yes"
          cancelText="No"
        >
          <Button
            type="text"
            danger
            icon={<Trash2 className="w-4 h-4" />}
            size="small"
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-violet-600" />
          <span className="font-semibold text-base">
            School Bell Schedule & Period Settings
          </span>
        </div>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      okText="Save Bell Schedule"
      cancelText="Cancel"
      okButtonProps={{ className: "bg-violet-600 hover:bg-violet-700" }}
      width={720}
      destroyOnClose
    >
      <div className="space-y-4 my-2">
        <p className="text-xs text-muted-foreground">
          Define daily period timings and recesses for your school. The
          timetable grid and conflict detector will dynamically align to this
          schedule.
        </p>

        <div className="flex orientation-row items-center justify-between">
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={handleAddPeriod}
            className="text-violet-600 border-violet-300"
          >
            Add Period
          </Button>

          <Button
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={handleResetDefaults}
            type="text"
            className="text-muted-foreground"
          >
            Reset to Standard 8 Periods
          </Button>
        </div>

        <Table
          dataSource={periods}
          columns={columns}
          rowKey={(_, idx) => String(idx)}
          pagination={false}
          size="small"
          bordered
          className="border rounded-lg overflow-hidden"
        />
      </div>
    </Modal>
  );
}
