"use client";

import React from "react";
import { DatePicker, Select } from "antd";
import dayjs from "dayjs";
import type { LedgerPeriod } from "@/lib/reports/ledger-query";

const { RangePicker } = DatePicker;

const PERIODS: { value: LedgerPeriod; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom dates" },
];

type Period = { period: LedgerPeriod; from: string | null; to: string | null };

/** A period picker; "Custom dates" adds a date range. */
export function PeriodFilter({
  value,
  onChange,
}: Readonly<{ value: Period; onChange: (next: Period) => void }>) {
  return (
    <>
      <Select
        value={value.period}
        onChange={(period) => onChange({ period, from: null, to: null })}
        options={PERIODS}
        className="w-full sm:w-36"
        aria-label="Period"
      />
      {value.period === "custom" && (
        <RangePicker
          value={[
            value.from ? dayjs(value.from) : null,
            value.to ? dayjs(value.to) : null,
          ]}
          onChange={(dates) =>
            onChange({
              period: "custom",
              from: dates?.[0]?.format("YYYY-MM-DD") ?? null,
              to: dates?.[1]?.format("YYYY-MM-DD") ?? null,
            })
          }
          allowEmpty={[true, true]}
          className="w-full sm:w-auto"
        />
      )}
    </>
  );
}
