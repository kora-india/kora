// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalyticsContent } from "../analytics-content";

const charts = vi.hoisted(() => ({ attendance: vi.fn() }));
vi.mock("../antv-charts", () => ({
  AntvRevenueAreaChart: () => <div>Revenue chart</div>,
  AntvFeePieChart: () => <div>Fee chart</div>,
  AntvPaymentMethodsBarChart: () => <div>Methods chart</div>,
  AntvAttendanceLineChart: ({ data }: { data: unknown[] }) => {
    charts.attendance(data);
    return <div>Attendance chart</div>;
  },
}));

const metrics = {
  totalRevenue: 2200,
  revenueChangePct: 175,
  feeCollectionRate: 64.7,
  totalBilled: 3400,
  totalPaid: 2200,
  avgAttendanceRate: 75,
  avgPresentPerDay: 2,
  newEnrolments: 1,
  activeStudentCount: 3,
};

const props = {
  filterBar: <div>Filters</div>,
  summary: "1 – 31 Oct 2026 · Class 4",
  compareLabel: "vs the month before",
  revenueData: [],
  revenueAreaData: [{ month: "Oct", type: "Collected", amount: 2200 }],
  attendanceData: [
    { month: "1 Oct", rate: 0, totalRecords: 0 },
    { month: "2 Oct", rate: 75, totalRecords: 4 },
    { month: "3 Oct", rate: 0, totalRecords: 4 },
  ],
  feeDistribution: [],
  paymentMethods: [],
  metrics,
};

describe("AnalyticsContent", () => {
  it("says what's showing, above the filters' results", () => {
    render(<AnalyticsContent {...props} />);
    expect(
      screen.getByText("Showing 1 – 31 Oct 2026 · Class 4"),
    ).toBeInTheDocument();
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("names what revenue is compared with", () => {
    render(<AnalyticsContent {...props} />);
    expect(screen.getByText("+175% vs the month before")).toBeInTheDocument();
  });

  it("shows money as collected of billed", () => {
    render(<AnalyticsContent {...props} />);
    expect(screen.getByText("₹2,200 of ₹3,400 billed")).toBeInTheDocument();
  });

  it("plots only days attendance was marked, keeping a real 0%", () => {
    charts.attendance.mockClear();
    render(<AnalyticsContent {...props} />);
    expect(charts.attendance).toHaveBeenCalledWith([
      { month: "2 Oct", rate: 75, totalRecords: 4 },
      { month: "3 Oct", rate: 0, totalRecords: 4 },
    ]);
  });

  it("doesn't call nothing happening 0%", () => {
    render(
      <AnalyticsContent
        {...props}
        attendanceData={[{ month: "Oct", rate: 0, totalRecords: 0 }]}
        metrics={{
          ...metrics,
          feeCollectionRate: 0,
          totalBilled: 0,
          avgAttendanceRate: 0,
        }}
      />,
    );
    expect(
      screen.getByText("Nothing billed in this period"),
    ).toBeInTheDocument();
    expect(screen.getByText("Not marked in this period")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.queryByText(/% average/)).not.toBeInTheDocument();
    expect(
      screen.getByText("No attendance marked in this period"),
    ).toBeInTheDocument();
  });
});
