"use client";

import { Select } from "antd";
import { UserRound } from "lucide-react";

export interface TeacherOption {
  id: string;
  name: string;
  email?: string | null;
}

interface TeacherSelectorProps {
  teachers: TeacherOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  id?: string;
}

export function TeacherSelector({
  teachers,
  value,
  onChange,
  id,
}: Readonly<TeacherSelectorProps>) {
  return (
    <Select
      id={id}
      allowClear
      showSearch
      optionFilterProp="search"
      placeholder="Select class teacher"
      prefix={<UserRound className="w-4 h-4 text-muted-foreground mr-1" />}
      value={value || undefined}
      onChange={(val) => onChange(val || null)}
      notFoundContent={
        <span className="block py-3 text-center text-xs text-muted-foreground">
          {teachers.length === 0
            ? "No active teachers yet"
            : "No teacher found"}
        </span>
      }
      options={teachers.map((t) => ({
        value: t.id,
        search: `${t.name} ${t.email ?? ""}`,
        label: (
          <span className="flex items-baseline gap-2 min-w-0">
            <span className="truncate">{t.name}</span>
            {t.email && (
              <span className="truncate text-xs text-muted-foreground">
                {t.email}
              </span>
            )}
          </span>
        ),
      }))}
      getPopupContainer={(triggerNode) =>
        triggerNode.parentElement || document.body
      }
      virtual={false}
      listHeight={240}
      className="w-full"
      style={{ width: "100%" }}
      size="large"
    />
  );
}
