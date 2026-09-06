"use client";

import { useState, useMemo } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Table,
  Tag,
  Badge,
  Empty,
  Button,
  Segmented,
  Select,
  Divider,
  Tooltip,
  Alert,
  Typography,
  Space,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  Award,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  FileText,
  AlertCircle,
  TrendingUp,
  BookOpen,
  UserCheck,
} from "lucide-react";

const { Text, Title } = Typography;

interface StudentPerformanceTabProps {
  student: any;
  onViewReportCard?: (examId: string) => void;
  loadingReportCard?: boolean;
}

export function StudentPerformanceTab({
  student,
  onViewReportCard,
  loadingReportCard,
}: StudentPerformanceTabProps) {
  const [activeSegment, setActiveSegment] = useState<
    "academic" | "attendance" | "overview"
  >("academic");

  const exams: any[] = student?.exams || [];
  const attendances: any[] = student?.attendances || [];
  const attendanceSummary = student?.attendanceSummary || {
    totalDays: attendances.length,
    presentDays: attendances.filter((a: any) => a.status === "PRESENT").length,
    absentDays: attendances.filter((a: any) => a.status === "ABSENT").length,
    lateDays: attendances.filter((a: any) => a.status === "LATE").length,
    excusedDays: attendances.filter((a: any) => a.status === "EXCUSED").length,
    attendanceRate: 100,
  };

  const [selectedExamId, setSelectedExamId] = useState<string>(
    exams.length > 0 ? exams[0].id : "",
  );

  const [attendanceFilter, setAttendanceFilter] = useState<string>("ALL");

  const currentExam = useMemo(() => {
    if (!exams || exams.length === 0) return null;
    return exams.find((e) => e.id === selectedExamId) || exams[0];
  }, [exams, selectedExamId]);

  // Filtered attendance list
  const filteredAttendances = useMemo(() => {
    if (attendanceFilter === "ALL") return attendances;
    return attendances.filter((a) => a.status === attendanceFilter);
  }, [attendances, attendanceFilter]);

  // Subject Table Columns
  const subjectColumns: ColumnsType<any> = [
    {
      title: "#",
      key: "index",
      width: 45,
      render: (_: any, __: any, index: number) => (
        <span className="text-muted-foreground text-xs">{index + 1}</span>
      ),
    },
    {
      title: "Subject",
      dataIndex: "subjectName",
      key: "subjectName",
      render: (name: string) => (
        <div className="font-semibold text-sm">{name}</div>
      ),
    },
    {
      title: "Max",
      dataIndex: "maxMarks",
      key: "maxMarks",
      width: 75,
      align: "center",
      render: (val: number) => <span className="text-xs">{val}</span>,
    },
    {
      title: "Pass",
      dataIndex: "passMarks",
      key: "passMarks",
      width: 75,
      align: "center",
      render: (val: number) => (
        <span className="text-xs text-muted-foreground">{val}</span>
      ),
    },
    {
      title: "Obtained",
      key: "marksObtained",
      width: 100,
      align: "center",
      render: (_: any, record: any) => {
        if (record.isAbsent) {
          return <Tag color="error">ABSENT</Tag>;
        }
        if (
          record.marksObtained === null ||
          record.marksObtained === undefined
        ) {
          return <Tag color="default">Pending</Tag>;
        }
        return (
          <span
            className={`font-bold text-sm ${
              record.isPass
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {record.marksObtained}
          </span>
        );
      },
    },
    {
      title: "Score %",
      key: "percentage",
      width: 130,
      render: (_: any, record: any) => {
        if (
          record.marksObtained === null ||
          record.marksObtained === undefined
        ) {
          return <span className="text-muted-foreground text-xs">-</span>;
        }
        return (
          <div className="flex items-center gap-2">
            <Progress
              percent={record.percentage}
              size="small"
              strokeColor={record.isPass ? "#7c3aed" : "#ef4444"}
              format={(pct) => `${pct}%`}
            />
          </div>
        );
      },
    },
    {
      title: "Grade",
      key: "grade",
      width: 90,
      align: "center",
      render: (_: any, record: any) => {
        if (!record.isEvaluated)
          return <span className="text-xs text-muted-foreground">-</span>;
        return (
          <Tag color={record.isPass ? "purple" : "red"}>
            {record.grade} ({record.gradePoint})
          </Tag>
        );
      },
    },
    {
      title: "Status",
      key: "isPass",
      width: 90,
      align: "center",
      render: (_: any, record: any) => {
        if (!record.isEvaluated) {
          return <Tag color="default">Pending</Tag>;
        }
        return record.isPass ? (
          <Tag color="green">PASS</Tag>
        ) : (
          <Tag color="red">FAIL</Tag>
        );
      },
    },
    {
      title: "Remarks",
      dataIndex: "remarks",
      key: "remarks",
      render: (remarks: string, record: any) => (
        <span className="text-xs text-muted-foreground italic">
          {remarks || record.remark || "—"}
        </span>
      ),
    },
  ];

  // Attendance Table Columns
  const attendanceColumns: ColumnsType<any> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 150,
      render: (dateStr: string) => {
        const d = new Date(dateStr);
        return (
          <div className="text-sm font-medium">
            {d.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </div>
        );
      },
    },
    {
      title: "Day",
      dataIndex: "date",
      key: "day",
      width: 130,
      render: (dateStr: string) => {
        const d = new Date(dateStr);
        return (
          <span className="text-xs text-muted-foreground">
            {d.toLocaleDateString("en-IN", { weekday: "long" })}
          </span>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: string) => {
        switch (status) {
          case "PRESENT":
            return (
              <Tag
                color="green"
                icon={<CheckCircle2 className="w-3 h-3 inline mr-1" />}
              >
                Present
              </Tag>
            );
          case "ABSENT":
            return (
              <Tag
                color="red"
                icon={<XCircle className="w-3 h-3 inline mr-1" />}
              >
                Absent
              </Tag>
            );
          case "LATE":
            return (
              <Tag
                color="gold"
                icon={<Clock className="w-3 h-3 inline mr-1" />}
              >
                Late
              </Tag>
            );
          case "EXCUSED":
            return (
              <Tag
                color="blue"
                icon={<AlertCircle className="w-3 h-3 inline mr-1" />}
              >
                Excused
              </Tag>
            );
          default:
            return <Tag>{status}</Tag>;
        }
      },
    },
    {
      title: "Remarks",
      dataIndex: "remarks",
      key: "remarks",
      render: (remarks: string) => (
        <span className="text-xs text-muted-foreground">{remarks || "—"}</span>
      ),
    },
  ];

  const getResultTag = (result: string) => {
    switch (result) {
      case "PASSED":
        return (
          <Tag color="green" className="font-semibold text-xs px-2.5 py-0.5">
            PASSED
          </Tag>
        );
      case "FAILED":
        return (
          <Tag color="red" className="font-semibold text-xs px-2.5 py-0.5">
            FAILED
          </Tag>
        );
      case "COMPARTMENT":
        return (
          <Tag color="gold" className="font-semibold text-xs px-2.5 py-0.5">
            COMPARTMENT
          </Tag>
        );
      case "ABSENT":
        return (
          <Tag color="default" className="font-semibold text-xs px-2.5 py-0.5">
            ABSENT
          </Tag>
        );
      default:
        return (
          <Tag color="blue" className="font-semibold text-xs px-2.5 py-0.5">
            {result}
          </Tag>
        );
    }
  };

  return (
    <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1 scrollbar-hide py-1">
      {/* Top Segmented Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b">
        <Segmented
          value={activeSegment}
          onChange={(val) => setActiveSegment(val as any)}
          options={[
            {
              label: (
                <div className="flex items-center gap-1.5 px-1 py-0.5 font-medium">
                  <Award className="w-4 h-4 text-violet-600" />
                  <span>Academic & Exams</span>
                  {exams.length > 0 && (
                    <Badge
                      count={exams.length}
                      overflowCount={99}
                      size="small"
                      style={{ backgroundColor: "#7c3aed" }}
                    />
                  )}
                </div>
              ),
              value: "academic",
            },
            {
              label: (
                <div className="flex items-center gap-1.5 px-1 py-0.5 font-medium">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>Attendance History</span>
                  <Badge
                    count={`${attendanceSummary.attendanceRate}%`}
                    style={{
                      backgroundColor:
                        attendanceSummary.attendanceRate >= 75
                          ? "#10b981"
                          : "#ef4444",
                    }}
                  />
                </div>
              ),
              value: "attendance",
            },
            {
              label: (
                <div className="flex items-center gap-1.5 px-1 py-0.5 font-medium">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span>Overview & Analytics</span>
                </div>
              ),
              value: "overview",
            },
          ]}
        />

        {activeSegment === "academic" && exams.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Select Exam:</span>
            <Select
              value={currentExam?.id}
              onChange={(id) => setSelectedExamId(id)}
              className="w-56"
              options={exams.map((e) => ({
                label: `${e.name} (${e.academicYear})`,
                value: e.id,
              }))}
            />
          </div>
        )}
      </div>

      {/* -------------------- 1. ACADEMIC & EXAMS VIEW -------------------- */}
      {activeSegment === "academic" && (
        <div className="space-y-4">
          {exams.length === 0 ? (
            <Card className="rounded-xl border border-dashed text-center py-10">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <p className="font-semibold text-base mb-1">
                      No Examinations Configured
                    </p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      No examinations have been scheduled or evaluated for this
                      student&apos;s class yet. Create or configure exam
                      subjects in the Exam Management module to record
                      performance.
                    </p>
                  </div>
                }
              />
            </Card>
          ) : currentExam ? (
            <>
              {/* Exam Header Banner Card */}
              <Card
                className="rounded-xl shadow-xs border bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-transparent dark:from-violet-950/20 dark:via-purple-950/20"
                bodyStyle={{ padding: "16px 20px" }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold m-0">
                        {currentExam.name}
                      </h3>
                      <Tag color="purple">{currentExam.academicYear}</Tag>
                      <Tag color="cyan">
                        {currentExam.type?.replace("_", " ")}
                      </Tag>
                      {currentExam.isPublished ? (
                        <Tag color="green">Published</Tag>
                      ) : (
                        <Tag color="gold">Draft</Tag>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground m-0">
                      Window:{" "}
                      {new Date(currentExam.startDate).toLocaleDateString()} —{" "}
                      {new Date(currentExam.endDate).toLocaleDateString()} ·
                      Grading System:{" "}
                      <span className="font-medium">
                        {currentExam.gradingSystem?.replace(/_/g, " ")}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {onViewReportCard && (
                      <Button
                        type="primary"
                        icon={<FileText className="w-3.5 h-3.5 mr-1" />}
                        onClick={() => onViewReportCard(currentExam.id)}
                        loading={loadingReportCard}
                        className="bg-violet-600 hover:bg-violet-700 shadow-sm text-xs font-semibold"
                      >
                        Official Report Card
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {/* Exam Metrics Row */}
              <Row gutter={[12, 12]} className="items-stretch">
                <Col xs={12} sm={6} className="flex flex-col">
                  <Card
                    bodyStyle={{
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      height: "100%",
                      minHeight: 115,
                    }}
                    className="rounded-xl border h-full shadow-xs"
                  >
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">
                        Total Score
                      </span>
                      <div className="flex items-center text-lg sm:text-xl font-bold">
                        <Award className="w-4 h-4 text-violet-600 mr-1.5 shrink-0 inline" />
                        <span>
                          {currentExam.summary.totalMarksObtained} /{" "}
                          {currentExam.summary.totalMaxMarks}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground block mt-2">
                      Max obtainable: {currentExam.summary.totalMaxMarks}
                    </span>
                  </Card>
                </Col>

                <Col xs={12} sm={6} className="flex flex-col">
                  <Card
                    bodyStyle={{
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      height: "100%",
                      minHeight: 115,
                    }}
                    className="rounded-xl border h-full shadow-xs"
                  >
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">
                        Percentage
                      </span>
                      <div className="text-lg sm:text-xl font-bold">
                        {currentExam.summary.overallPercentage}%
                      </div>
                    </div>
                    <Progress
                      percent={currentExam.summary.overallPercentage}
                      strokeColor="#7c3aed"
                      size="small"
                      showInfo={false}
                      className="m-0 mt-2"
                    />
                  </Card>
                </Col>

                <Col xs={12} sm={6} className="flex flex-col">
                  <Card
                    bodyStyle={{
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      height: "100%",
                      minHeight: 115,
                    }}
                    className="rounded-xl border h-full shadow-xs"
                  >
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">
                        Overall Grade / CGPA
                      </span>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-lg sm:text-xl font-bold">
                          {currentExam.summary.overallGrade || "—"}
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">
                          ({currentExam.summary.cgpa} CGPA)
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground block mt-2">
                      CBSE 9-Point Scale
                    </span>
                  </Card>
                </Col>

                <Col xs={12} sm={6} className="flex flex-col">
                  <Card
                    bodyStyle={{
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      height: "100%",
                      minHeight: 115,
                    }}
                    className="rounded-xl border h-full shadow-xs"
                  >
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">
                        Assessment Result
                      </span>
                      <div className="pt-0.5">
                        {currentExam.hasMarks ? (
                          getResultTag(currentExam.summary.result)
                        ) : (
                          <Tag color="processing">EVALUATION PENDING</Tag>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground block mt-2 truncate">
                      {currentExam.summary.failedSubjectsCount === 0
                        ? "All subjects passed"
                        : `${currentExam.summary.failedSubjectsCount} subject(s) compartment/failed`}
                    </span>
                  </Card>
                </Col>
              </Row>

              {/* Subject Breakdown Table */}
              <div className="border rounded-xl overflow-hidden bg-background">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h4 className="text-sm font-bold m-0 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-violet-600" />
                    <span>Subject-wise Marks & Evaluation</span>
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {currentExam.subjects.length} Subjects Evaluated
                  </span>
                </div>
                <Table
                  dataSource={currentExam.subjects}
                  columns={subjectColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  className="overflow-x-auto"
                />
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* -------------------- 2. ATTENDANCE HISTORY VIEW -------------------- */}
      {activeSegment === "attendance" && (
        <div className="space-y-4">
          {/* Attendance KPI Cards */}
          <Row gutter={[12, 12]} className="items-stretch">
            <Col xs={24} sm={8} className="flex flex-col">
              <Card
                bodyStyle={{
                  padding: "16px",
                  display: "flex",
                  alignItems: "center",
                  height: "100%",
                  minHeight: 105,
                }}
                className="rounded-xl border h-full shadow-xs"
              >
                <div className="flex items-center gap-4">
                  <Progress
                    type="circle"
                    percent={attendanceSummary.attendanceRate}
                    size={68}
                    strokeColor={
                      attendanceSummary.attendanceRate >= 75
                        ? "#10b981"
                        : "#ef4444"
                    }
                  />
                  <div>
                    <h4 className="font-bold text-sm m-0">
                      Overall Attendance
                    </h4>
                    <p className="text-xs text-muted-foreground m-0 mt-0.5">
                      {attendanceSummary.attendanceRate >= 75
                        ? "Satisfactory Attendance"
                        : "Below 75% Requirement"}
                    </p>
                    <span className="inline-block mt-1.5 text-[10px] uppercase font-semibold text-muted-foreground border px-1.5 py-0.5 rounded">
                      CBSE Standard: 75%
                    </span>
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={12} sm={4} className="flex flex-col">
              <Card
                bodyStyle={{
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  height: "100%",
                  minHeight: 105,
                }}
                className="rounded-xl border text-center h-full shadow-xs"
              >
                <Statistic
                  title={
                    <span className="text-xs text-muted-foreground">
                      Total Days
                    </span>
                  }
                  value={attendanceSummary.totalDays}
                  valueStyle={{ fontSize: "1.2rem", fontWeight: 700 }}
                />
              </Card>
            </Col>

            <Col xs={12} sm={4} className="flex flex-col">
              <Card
                bodyStyle={{
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  height: "100%",
                  minHeight: 105,
                }}
                className="rounded-xl border text-center h-full shadow-xs"
              >
                <Statistic
                  title={
                    <span className="text-xs text-muted-foreground">
                      Present
                    </span>
                  }
                  value={attendanceSummary.presentDays}
                  valueStyle={{
                    color: "#10b981",
                    fontSize: "1.2rem",
                    fontWeight: 700,
                  }}
                />
              </Card>
            </Col>

            <Col xs={12} sm={4} className="flex flex-col">
              <Card
                bodyStyle={{
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  height: "100%",
                  minHeight: 105,
                }}
                className="rounded-xl border text-center h-full shadow-xs"
              >
                <Statistic
                  title={
                    <span className="text-xs text-muted-foreground">
                      Absent
                    </span>
                  }
                  value={attendanceSummary.absentDays}
                  valueStyle={{
                    color: "#ef4444",
                    fontSize: "1.2rem",
                    fontWeight: 700,
                  }}
                />
              </Card>
            </Col>

            <Col xs={12} sm={4} className="flex flex-col">
              <Card
                bodyStyle={{
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  height: "100%",
                  minHeight: 105,
                }}
                className="rounded-xl border text-center h-full shadow-xs"
              >
                <Statistic
                  title={
                    <span className="text-xs text-muted-foreground">
                      Late / Excused
                    </span>
                  }
                  value={
                    attendanceSummary.lateDays + attendanceSummary.excusedDays
                  }
                  valueStyle={{
                    color: "#f59e0b",
                    fontSize: "1.2rem",
                    fontWeight: 700,
                  }}
                />
              </Card>
            </Col>
          </Row>

          {/* Filter Bar and Attendance Table */}
          <div className="border rounded-xl overflow-hidden bg-background">
            <div className="p-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/10">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold m-0">Attendance Log</h4>
                <Tag color="default">{filteredAttendances.length} Records</Tag>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Filter:</span>
                <Select
                  value={attendanceFilter}
                  onChange={(val) => setAttendanceFilter(val)}
                  size="small"
                  className="w-36"
                  options={[
                    { label: "All Records", value: "ALL" },
                    {
                      label: `Present (${attendanceSummary.presentDays})`,
                      value: "PRESENT",
                    },
                    {
                      label: `Absent (${attendanceSummary.absentDays})`,
                      value: "ABSENT",
                    },
                    {
                      label: `Late (${attendanceSummary.lateDays})`,
                      value: "LATE",
                    },
                    {
                      label: `Excused (${attendanceSummary.excusedDays})`,
                      value: "EXCUSED",
                    },
                  ]}
                />
              </div>
            </div>

            {filteredAttendances.length === 0 ? (
              <div className="py-12">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span className="text-xs text-muted-foreground">
                      No attendance records matching filter
                    </span>
                  }
                />
              </div>
            ) : (
              <Table
                dataSource={filteredAttendances}
                columns={attendanceColumns}
                rowKey="id"
                pagination={{
                  pageSize: 7,
                  size: "small",
                  showSizeChanger: false,
                }}
                size="small"
              />
            )}
          </div>
        </div>
      )}

      {/* -------------------- 3. OVERVIEW & ANALYTICS VIEW -------------------- */}
      {activeSegment === "overview" && (
        <div className="space-y-4">
          {/* Key Insights Alert */}
          {attendanceSummary.attendanceRate < 75 ? (
            <Alert
              message="Attendance Warning"
              description="Student's overall attendance rate is below the mandatory 75% threshold required for examination eligibility."
              type="warning"
              showIcon
              className="rounded-xl"
            />
          ) : (
            <Alert
              message="Scholastic Status: Excellent"
              description="Student demonstrates regular attendance and active participation in class examinations."
              type="success"
              showIcon
              className="rounded-xl"
            />
          )}

          <Row gutter={[12, 12]}>
            {/* Academic Snapshot */}
            <Col xs={24} md={12}>
              <Card
                className="rounded-xl border h-full"
                title={
                  <span className="text-sm font-bold flex items-center gap-2">
                    <Award className="w-4 h-4 text-violet-600" />
                    Academic Standing
                  </span>
                }
              >
                {exams.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-1 border-b">
                      <span className="text-xs text-muted-foreground">
                        Latest Examination
                      </span>
                      <span className="text-xs font-semibold">
                        {exams[0].name}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b">
                      <span className="text-xs text-muted-foreground">
                        Overall Percentage
                      </span>
                      <span className="text-sm font-bold text-violet-600">
                        {exams[0].summary.overallPercentage}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b">
                      <span className="text-xs text-muted-foreground">
                        Assigned Grade
                      </span>
                      <Tag color="purple" className="font-bold">
                        {exams[0].summary.overallGrade} ({exams[0].summary.cgpa}{" "}
                        CGPA)
                      </Tag>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b">
                      <span className="text-xs text-muted-foreground">
                        Result Status
                      </span>
                      {getResultTag(exams[0].summary.result)}
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-xs text-muted-foreground">
                        Total Exams Tracked
                      </span>
                      <span className="text-xs font-semibold">
                        {exams.length} Exams
                      </span>
                    </div>
                  </div>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No exams on record"
                  />
                )}
              </Card>
            </Col>

            {/* Attendance Snapshot */}
            <Col xs={24} md={12}>
              <Card
                className="rounded-xl border h-full"
                title={
                  <span className="text-sm font-bold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    Attendance Health
                  </span>
                }
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-1 border-b">
                    <span className="text-xs text-muted-foreground">
                      Attendance Percentage
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        attendanceSummary.attendanceRate >= 75
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}
                    >
                      {attendanceSummary.attendanceRate}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b">
                    <span className="text-xs text-muted-foreground">
                      Total Working Days
                    </span>
                    <span className="text-xs font-semibold">
                      {attendanceSummary.totalDays} Days
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b">
                    <span className="text-xs text-muted-foreground">
                      Days Attended
                    </span>
                    <span className="text-xs font-semibold text-emerald-600">
                      {attendanceSummary.attendedDays} Days
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b">
                    <span className="text-xs text-muted-foreground">
                      Unexcused Absences
                    </span>
                    <span className="text-xs font-semibold text-rose-600">
                      {attendanceSummary.absentDays} Days
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-muted-foreground">
                      Late Arrivals
                    </span>
                    <span className="text-xs font-semibold text-amber-600">
                      {attendanceSummary.lateDays} Days
                    </span>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )}
    </div>
  );
}
