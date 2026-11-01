"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DatePicker, Select } from "antd";
import dayjs from "dayjs";
import { Loader2, RotateCcw } from "lucide-react";
import {
  RECENT_PERIODS,
  analyticsQueryToSearch,
  type AnalyticsQuery,
  type ClassOption,
  type SessionOption,
} from "@/lib/reports/analytics-query";

const { RangePicker } = DatePicker;

const SESSION_VALUE = "session:";

/** Period, class and section for the whole page, kept in the URL. */
export function AnalyticsFilterBar({
  query,
  defaults,
  sessions,
  classes,
}: Readonly<{
  query: AnalyticsQuery;
  defaults: AnalyticsQuery;
  sessions: SessionOption[];
  classes: ClassOption[];
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [updating, startUpdate] = useTransition();
  // "Custom dates" waits for its dates before the page changes.
  const [pickingDates, setPickingDates] = useState(false);

  const show = (next: AnalyticsQuery) =>
    startUpdate(() =>
      router.replace(`${pathname}${analyticsQueryToSearch(next, defaults)}`, {
        scroll: false,
      }),
    );

  const choosePeriod = (value: string) => {
    if (value === "custom") {
      setPickingDates(true);
      return;
    }
    setPickingDates(false);
    show({
      ...query,
      from: null,
      to: null,
      ...(value.startsWith(SESSION_VALUE)
        ? {
            period: "session",
            sessionId: value.slice(SESSION_VALUE.length),
          }
        : { period: value as AnalyticsQuery["period"], sessionId: "" }),
    });
  };

  const period =
    pickingDates || query.period === "custom"
      ? "custom"
      : query.period === "session"
        ? `${SESSION_VALUE}${query.sessionId}`
        : query.period;
  const sections = classes.find((c) => c.id === query.classId)?.sections ?? [];
  const isDefault = analyticsQueryToSearch(query, defaults) === "";

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 print:hidden">
      <Select
        aria-label="Period"
        value={period}
        onChange={choosePeriod}
        className="w-full sm:w-44"
        options={[
          ...(sessions.length > 0
            ? [
                {
                  label: "Academic session",
                  options: sessions.map((s) => ({
                    value: `${SESSION_VALUE}${s.id}`,
                    label: s.name,
                  })),
                },
              ]
            : []),
          { label: "Recent", options: RECENT_PERIODS },
          {
            label: "Other",
            options: [{ value: "custom", label: "Custom dates" }],
          },
        ]}
      />
      {period === "custom" && (
        <RangePicker
          aria-label="Custom dates"
          value={[
            query.from ? dayjs(query.from) : null,
            query.to ? dayjs(query.to) : null,
          ]}
          onChange={(dates) => {
            if (!dates?.[0] || !dates[1]) return;
            setPickingDates(false);
            show({
              ...query,
              period: "custom",
              sessionId: "",
              from: dates[0].format("YYYY-MM-DD"),
              to: dates[1].format("YYYY-MM-DD"),
            });
          }}
          className="w-full sm:w-auto"
        />
      )}
      <Select
        aria-label="Class"
        value={query.classId}
        onChange={(classId) => show({ ...query, classId, sectionId: "all" })}
        className="w-full sm:w-40"
        showSearch
        optionFilterProp="label"
        options={[
          { value: "all", label: "All classes" },
          ...classes.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <Select
        aria-label="Section"
        value={query.sectionId}
        onChange={(sectionId) => show({ ...query, sectionId })}
        disabled={sections.length === 0}
        className="w-full sm:w-36"
        options={[
          { value: "all", label: "All sections" },
          ...sections.map((s) => ({ value: s.id, label: s.name })),
        ]}
      />
      {(!isDefault || pickingDates) && (
        <button
          type="button"
          onClick={() => {
            setPickingDates(false);
            show(defaults);
          }}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground rounded-[10px] hover:bg-muted transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      )}
      {updating && (
        <span
          role="status"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Updating…
        </span>
      )}
    </div>
  );
}
