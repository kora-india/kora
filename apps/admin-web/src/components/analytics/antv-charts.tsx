"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { formatCurrency } from "@schoolos/utils";
import { Spin } from "antd";

// Dynamically import AntV Charts with ssr: false for Next.js
const Area = dynamic(
  () => import("@ant-design/plots").then((mod) => mod.Area),
  { ssr: false, loading: () => <ChartLoader /> }
);

const Line = dynamic(
  () => import("@ant-design/plots").then((mod) => mod.Line),
  { ssr: false, loading: () => <ChartLoader /> }
);

const Pie = dynamic(
  () => import("@ant-design/plots").then((mod) => mod.Pie),
  { ssr: false, loading: () => <ChartLoader /> }
);

const Column = dynamic(
  () => import("@ant-design/plots").then((mod) => mod.Column),
  { ssr: false, loading: () => <ChartLoader /> }
);

function ChartLoader() {
  return (
    <div className="h-[260px] flex items-center justify-center">
      <Spin size="default" />
    </div>
  );
}

// 1. AntV Area Chart: Fee Collection vs Pending Trend
interface RevenueAreaProps {
  data: { month: string; type: string; amount: number }[];
}

export function AntvRevenueAreaChart({ data }: Readonly<RevenueAreaProps>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <ChartLoader />;

  const config = {
    data,
    xField: "month",
    yField: "amount",
    colorField: "type",
    shapeField: "smooth",
    scale: {
      color: {
        range: ["#7c3aed", "#f59e0b"],
      },
    },
    axis: {
      y: {
        labelFormatter: (v: number) =>
          v >= 100000
            ? `₹${(v / 100000).toFixed(1)}L`
            : v >= 1000
            ? `₹${(v / 1000).toFixed(0)}k`
            : `₹${v}`,
        gridLineDash: [3, 3],
      },
      x: {
        gridLineDash: [3, 3],
      },
    },
    tooltip: {
      items: [
        (d: any) => ({
          name: d.type,
          value: formatCurrency(Number(d.amount || 0)),
        }),
      ],
    },
    style: {
      fillOpacity: 0.45,
      lineWidth: 2.5,
    },
    interaction: {
      tooltip: true,
    },
    height: 260,
  };

  return <Area {...config} />;
}

// 2. AntV Line Chart: Attendance Rate Trend
interface AttendanceLineProps {
  data: { month: string; rate: number }[];
}

export function AntvAttendanceLineChart({ data }: Readonly<AttendanceLineProps>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <ChartLoader />;

  const config = {
    data,
    xField: "month",
    yField: "rate",
    shapeField: "smooth",
    scale: {
      y: {
        domain: [0, 100],
      },
    },
    axis: {
      y: {
        labelFormatter: (v: number) => `${v}%`,
        gridLineDash: [3, 3],
      },
    },
    style: {
      stroke: "#10b981",
      lineWidth: 3,
    },
    point: {
      shapeField: "circle",
      sizeField: 4,
      style: {
        fill: "#10b981",
        stroke: "#ffffff",
        lineWidth: 2,
      },
    },
    tooltip: {
      items: [
        (d: any) => ({
          name: "Attendance Rate",
          value: `${d.rate}%`,
        }),
      ],
    },
    interaction: {
      tooltip: true,
    },
    height: 260,
  };

  return <Line {...config} />;
}

// 3. AntV Donut/Pie Chart: Fee Component Breakdown
interface FeePieProps {
  data: { name: string; value: number; percentage: number }[];
}

export function AntvFeePieChart({ data }: Readonly<FeePieProps>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <ChartLoader />;

  const config = {
    data,
    angleField: "value",
    colorField: "name",
    innerRadius: 0.62,
    radius: 0.9,
    label: {
      text: (d: any) => `${d.percentage}%`,
      style: {
        fontWeight: "bold",
        fontSize: 11,
      },
    },
    legend: {
      color: {
        position: "right",
        rowPadding: 6,
      },
    },
    tooltip: {
      items: [
        (d: any) => ({
          name: d.name,
          value: `${formatCurrency(Number(d.value))} (${d.percentage}%)`,
        }),
      ],
    },
    interaction: {
      tooltip: true,
      elementHighlight: true,
    },
    height: 260,
  };

  return <Pie {...config} />;
}

// 4. AntV Column Chart: Payment Methods Distribution
interface PaymentMethodsBarProps {
  data: { method: string; amount: number }[];
}

export function AntvPaymentMethodsBarChart({ data }: Readonly<PaymentMethodsBarProps>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <ChartLoader />;

  const config = {
    data,
    xField: "method",
    yField: "amount",
    colorField: "method",
    scale: {
      color: {
        range: ["#7c3aed", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"],
      },
    },
    axis: {
      y: {
        labelFormatter: (v: number) =>
          v >= 100000
            ? `₹${(v / 100000).toFixed(1)}L`
            : v >= 1000
            ? `₹${(v / 1000).toFixed(0)}k`
            : `₹${v}`,
      },
    },
    label: {
      text: (d: any) => formatCurrency(Number(d.amount)),
      style: {
        fontSize: 11,
        fill: "#6b7280",
      },
    },
    tooltip: {
      items: [
        (d: any) => ({
          name: d.method,
          value: formatCurrency(Number(d.amount)),
        }),
      ],
    },
    interaction: {
      tooltip: true,
    },
    height: 260,
  };

  return <Column {...config} />;
}
