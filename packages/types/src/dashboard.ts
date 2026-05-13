export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  pendingFees: number;
  attendancePercentage: number;
  monthlyRevenue: number;
  activeClasses: number;
}

export interface RevenueData {
  month: string;
  collected: number;
  pending: number;
}

export interface AttendanceData {
  date: string;
  present: number;
  absent: number;
  total: number;
}
