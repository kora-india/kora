import type { TourStepProps } from "antd";

export interface PageTourConfig {
  pageTitle: string;
  steps: TourStepProps[];
}

const safeTarget = (id: string) => () => {
  if (typeof document === "undefined") return null as unknown as HTMLElement;
  return document.getElementById(id) as HTMLElement;
};

export const TOUR_CONFIGS: Record<string, PageTourConfig> = {
  "/dashboard": {
    pageTitle: "Dashboard Overview",
    steps: [
      {
        title: "Welcome to Kora SchoolOS!",
        description:
          "This is your central command center. Get a real-time pulse of your school's academics, collections, attendance, and administrative activities.",
        target: null,
      },
      {
        title: "Quick Action Hub",
        description:
          "Quickly admit a new student, record fee collections, or broadcast an urgent announcement to students and parents with a single click.",
        target: safeTarget("tour-dashboard-actions"),
        placement: "bottom",
      },
      {
        title: "Real-Time Metric Cards",
        description:
          "Monitor active student enrollments, teaching staff count, outstanding pending fees, and today's overall attendance percentage at a glance.",
        target: safeTarget("tour-dashboard-stats"),
        placement: "bottom",
      },
      {
        title: "Revenue & Expense Trends",
        description:
          "Track your school's financial trajectory over the last 6 months. Visualize cash inflow from fee payments against school operational expenses.",
        target: safeTarget("tour-dashboard-revenue-chart"),
        placement: "top",
      },
      {
        title: "Class Attendance Breakdown",
        description:
          "See which classes have the highest presence today and quickly detect absenteeism hotspots across grades.",
        target: safeTarget("tour-dashboard-attendance"),
        placement: "left",
      },
      {
        title: "Recent Admissions & Activity",
        description:
          "View the latest student admissions, their fee status, and recently published circulars and notifications.",
        target: safeTarget("tour-dashboard-recent-activity"),
        placement: "top",
      },
      {
        title: "Module Navigation",
        description:
          "Use the sidebar to navigate seamlessly between Students, Fees, Timetable, Attendance, Exams, and School Settings.",
        target: safeTarget("tour-sidebar-nav"),
        placement: "right",
      },
    ],
  },

  "/students": {
    pageTitle: "Students Directory",
    steps: [
      {
        title: "Student Life-cycle Management",
        description:
          "Manage all student records, admissions, class allocations, fee statuses, and 360-degree student profiles in one place.",
        target: null,
      },
      {
        title: "Admit & Bulk Import",
        description:
          "Click 'Add Student' to register an individual student with parent & fee details, or use 'Import' to bulk-upload students from Excel/CSV.",
        target: safeTarget("tour-students-actions"),
        placement: "bottom",
      },
      {
        title: "Smart Filters & Search",
        description:
          "Search students by name, roll number, or admission ID. Filter dynamically by class, section, fee status (Paid, Pending, Overdue), and attendance.",
        target: safeTarget("tour-students-filters"),
        placement: "bottom",
      },
      {
        title: "Interactive Student Roster",
        description:
          "Browse through all enrolled students with live status indicators, parent contact details, and current fee health.",
        target: safeTarget("tour-students-table"),
        placement: "top",
      },
      {
        title: "Student 360 Profile & Quick Actions",
        description:
          "Click on any student row or action menu to view complete profiles, past fee receipts, attendance history, and exam report cards.",
        target: safeTarget("tour-students-row-actions"),
        placement: "left",
      },
    ],
  },

  "/teachers": {
    pageTitle: "Teachers & Staff",
    steps: [
      {
        title: "Faculty & Staff Directory",
        description:
          "Manage all teaching staff, administrators, and support staff (drivers, accountants, security) from a unified console.",
        target: null,
      },
      {
        title: "Staff Category Tabs",
        description:
          "Easily switch between Teaching Faculty and Non-Teaching Staff to manage their distinct roles and qualifications.",
        target: safeTarget("tour-teachers-tabs"),
        placement: "bottom",
      },
      {
        title: "Add Staff Member",
        description:
          "Onboard new teachers with assigned subjects, qualifications, monthly salary, and designated class teacher roles.",
        target: safeTarget("tour-teachers-actions"),
        placement: "bottom",
      },
      {
        title: "Search & Department Filter",
        description:
          "Quickly locate any teacher or support staff by name, phone number, email, or teaching specialization.",
        target: safeTarget("tour-teachers-search"),
        placement: "bottom",
      },
      {
        title: "Faculty Roster & Class Assignments",
        description:
          "View full teacher details, assigned classes, contact information, and edit or update their profiles at any time.",
        target: safeTarget("tour-teachers-list"),
        placement: "top",
      },
    ],
  },

  "/classes": {
    pageTitle: "Classes & Sections",
    steps: [
      {
        title: "Academic Structure",
        description:
          "Configure the fundamental building blocks of your school: grades, classes, sections, and class teacher allocations.",
        target: null,
      },
      {
        title: "Create Academic Class",
        description:
          "Click 'Add Class' to create a new class grade (e.g. Nursery, Grade 1 to 12) and assign a primary Class Teacher.",
        target: safeTarget("tour-classes-add-btn"),
        placement: "bottom",
      },
      {
        title: "Class Cards Grid",
        description:
          "Each card shows total student enrollments, designated sections, and the assigned class teacher responsible for attendance and report cards.",
        target: safeTarget("tour-classes-grid"),
        placement: "top",
      },
      {
        title: "Manage Sections",
        description:
          "Add or modify sections (e.g. Section A, Section B) directly within each class card to balance classroom capacities.",
        target: safeTarget("tour-classes-sections"),
        placement: "bottom",
      },
    ],
  },

  "/timetable": {
    pageTitle: "Timetable Management",
    steps: [
      {
        title: "Master School Timetable",
        description:
          "Design, automate, and publish weekly period schedules for all classes without teacher clashes or workload conflicts.",
        target: null,
      },
      {
        title: "Class & Section Selector",
        description:
          "Choose the target class and section to view or customize its dedicated weekly schedule.",
        target: safeTarget("tour-timetable-class-select"),
        placement: "bottom",
      },
      {
        title: "AI-Powered Timetable Generator",
        description:
          "Let Kora's intelligent scheduling engine automatically create optimized class timetables respecting subject frequencies and teacher availability.",
        target: safeTarget("tour-timetable-actions"),
        placement: "bottom",
      },
      {
        title: "Weekly Schedule Matrix",
        description:
          "View and click any period slot across Monday through Saturday to assign subjects, faculty members, and classroom locations.",
        target: safeTarget("tour-timetable-grid"),
        placement: "top",
      },
    ],
  },

  "/attendance": {
    pageTitle: "Daily Attendance",
    steps: [
      {
        title: "Daily Attendance Marking",
        description:
          "Conduct morning roll-calls, track absent students, and maintain accurate attendance logs for report cards and parent SMS alerts.",
        target: null,
      },
      {
        title: "Date & Class Selection",
        description:
          "Select the attendance date and choose which class and section you are marking attendance for.",
        target: safeTarget("tour-attendance-filters"),
        placement: "bottom",
      },
      {
        title: "Bulk Speed Actions",
        description:
          "Use 'Mark All Present' to speed up daily roll-call, or declare the day as an official 'School Holiday' in one click.",
        target: safeTarget("tour-attendance-bulk-actions"),
        placement: "bottom",
      },
      {
        title: "Student Roster & Statuses",
        description:
          "Toggle individual student statuses between Present, Absent, Late, and Excused with clear color indicators.",
        target: safeTarget("tour-attendance-roster"),
        placement: "top",
      },
      {
        title: "Save & Lock Records",
        description:
          "Save the attendance sheet. Records immediately synchronize with parent notification channels and school analytics.",
        target: safeTarget("tour-attendance-submit-btn"),
        placement: "top",
      },
    ],
  },

  "/exams": {
    pageTitle: "Exams & Results",
    steps: [
      {
        title: "Exams, Marks & Report Cards",
        description:
          "Schedule academic terms, record subject marks, calculate grade percentages, and print official student report cards.",
        target: null,
      },
      {
        title: "Exam Terms & Configuration",
        description:
          "Switch between Term 1, Half-Yearly, Final Exams, and configure custom grading scales (CBSE/State Board).",
        target: safeTarget("tour-exams-tabs"),
        placement: "bottom",
      },
      {
        title: "Schedule New Exam",
        description:
          "Define upcoming exam routines, specify subjects, maximum marks, passing criteria, and dates.",
        target: safeTarget("tour-exams-create-btn"),
        placement: "bottom",
      },
      {
        title: "Marksheet Entry Matrix",
        description:
          "Input marks per student across all subjects. Grades and total percentages are calculated automatically in real time.",
        target: safeTarget("tour-exams-marksheet"),
        placement: "top",
      },
      {
        title: "Generate & Print Report Cards",
        description:
          "Generate professional, formatted student progress cards ready for download, parent portal viewing, or batch printing.",
        target: safeTarget("tour-exams-report-cards"),
        placement: "left",
      },
    ],
  },

  "/fees": {
    pageTitle: "Fee Management",
    steps: [
      {
        title: "Complete Fee & Collection Engine",
        description:
          "Control all school finance workflows: student dues, automated billing, payment collection, and instant receipt generation.",
        target: null,
      },
      {
        title: "Fee Workflow Tabs",
        description:
          "Navigate between Fee Collection, Generate Monthly Bills, Audit Logs & Receipts, Class Assignments, and Fee Settings.",
        target: safeTarget("tour-fees-tabs"),
        placement: "bottom",
      },
      {
        title: "Student Dues & Collection Roster",
        description:
          "Review pending dues per student, due dates, past receipts, and previous payment transactions.",
        target: safeTarget("tour-fees-collection-table"),
        placement: "top",
      },
      {
        title: "Collect Fee & Issue Receipts",
        description:
          "Click 'Collect Fee' to record Cash, UPI, Card, or Cheque payments and instantly generate official printable fee receipts.",
        target: safeTarget("tour-fees-collect-btn"),
        placement: "bottom",
      },
      {
        title: "Automated Fee Generator",
        description:
          "Generate recurring fee invoices for an entire class or session in seconds based on assigned fee structures.",
        target: safeTarget("tour-fees-generator-tab"),
        placement: "bottom",
      },
      {
        title: "Fee Structures & Components",
        description:
          "Set up Tuition, Transport, Admission, and Examination fee components and assemble custom structures for each grade.",
        target: safeTarget("tour-fees-settings-tab"),
        placement: "bottom",
      },
    ],
  },

  "/expenses": {
    pageTitle: "School Expenses",
    steps: [
      {
        title: "Operational Expense Tracking",
        description:
          "Track and categorize all school expenditures including utilities, maintenance, teacher salaries, event costs, and stationery.",
        target: null,
      },
      {
        title: "Monthly Expense KPIs",
        description:
          "View total expenses incurred this month, categorized breakdowns, and budget spending trends.",
        target: safeTarget("tour-expenses-stats"),
        placement: "bottom",
      },
      {
        title: "Record New Expense",
        description:
          "Log expenditures with payee details, category, payment mode (Cash, Bank, UPI), voucher number, and receipt attachments.",
        target: safeTarget("tour-expenses-add-btn"),
        placement: "bottom",
      },
      {
        title: "Filter & Expense History",
        description:
          "Filter historical expenses by date range, department category, or payment mode for transparent bookkeeping.",
        target: safeTarget("tour-expenses-table"),
        placement: "top",
      },
    ],
  },

  "/ledger": {
    pageTitle: "Financial Ledger",
    steps: [
      {
        title: "Double-Entry Financial Ledger",
        description:
          "Audit all financial transactions in real time with an immutable credit and debit journal.",
        target: null,
      },
      {
        title: "Cashflow & Balance Summary",
        description:
          "View total income from fee receipts, total expenses disbursed, and the current net operating balance.",
        target: safeTarget("tour-ledger-summary"),
        placement: "bottom",
      },
      {
        title: "Transaction Journal Roster",
        description:
          "Review all debit and credit entries with transaction date, reference receipt number, payment mode, and category.",
        target: safeTarget("tour-ledger-table"),
        placement: "top",
      },
      {
        title: "Export & Audit Reports",
        description:
          "Filter by date ranges and export complete ledger statements to Excel or PDF for accounting audits.",
        target: safeTarget("tour-ledger-filters"),
        placement: "bottom",
      },
    ],
  },

  "/transport": {
    pageTitle: "Transport & Fleet",
    steps: [
      {
        title: "Fleet & Transport Management",
        description:
          "Manage school bus routes, driver rosters, vehicle documentation, and student pick-up/drop-off assignments.",
        target: null,
      },
      {
        title: "Transport Modules",
        description:
          "Switch between Bus Routes & Stops, Vehicle Fleet Roster, and Student Commuter Allocations.",
        target: safeTarget("tour-transport-tabs"),
        placement: "bottom",
      },
      {
        title: "Add Route or Vehicle",
        description:
          "Create new transport routes with designated pick-up stops, fare amounts, and assign registered bus vehicles and drivers.",
        target: safeTarget("tour-transport-actions"),
        placement: "bottom",
      },
      {
        title: "Bus Routes & Vehicle Details",
        description:
          "Track vehicle registration numbers, insurance validity, driver mobile numbers, and mapped student counts.",
        target: safeTarget("tour-transport-routes"),
        placement: "top",
      },
    ],
  },

  "/assignments": {
    pageTitle: "Assignments & Homework",
    steps: [
      {
        title: "Assignments & Homework",
        description:
          "Distribute daily homework, project assignments, and study materials directly to students and parents.",
        target: null,
      },
      {
        title: "Create New Assignment",
        description:
          "Publish homework tasks with target class, subject, submission deadlines, instructions, and file attachments.",
        target: safeTarget("tour-assignments-create-btn"),
        placement: "bottom",
      },
      {
        title: "Filter by Class & Subject",
        description:
          "Easily filter assignments to inspect homework assigned to specific grades and sections.",
        target: safeTarget("tour-assignments-filters"),
        placement: "bottom",
      },
      {
        title: "Active Homework & Submissions",
        description:
          "Review active assignments, track student submission counts, and evaluate completed work.",
        target: safeTarget("tour-assignments-list"),
        placement: "top",
      },
    ],
  },

  "/notices": {
    pageTitle: "Notices & Circulars",
    steps: [
      {
        title: "School Notice Board",
        description:
          "Broadcast official announcements, holiday circulars, exam notifications, and emergency alerts.",
        target: null,
      },
      {
        title: "Publish Circular",
        description:
          "Draft announcements with rich text, attach circular documents, and choose priority levels.",
        target: safeTarget("tour-notices-create-btn"),
        placement: "bottom",
      },
      {
        title: "Targeted Audience Delivery",
        description:
          "Choose who receives the notice: Entire School, Parents Only, Teaching Staff, or Specific Classes.",
        target: safeTarget("tour-notices-audience"),
        placement: "bottom",
      },
      {
        title: "Active Notices & Archive",
        description:
          "Browse through published circulars, pin high-priority notices, or withdraw expired announcements.",
        target: safeTarget("tour-notices-list"),
        placement: "top",
      },
    ],
  },

  "/analytics": {
    pageTitle: "School Analytics",
    steps: [
      {
        title: "Executive School Analytics",
        description:
          "Gain deep visual insights into financial health, attendance patterns, and academic achievements across your institution.",
        target: null,
      },
      {
        title: "Date Range & Filters",
        description:
          "Select custom fiscal or academic periods to focus the analytics reports.",
        target: safeTarget("tour-analytics-header"),
        placement: "bottom",
      },
      {
        title: "Fee Realization & Dues Breakdown",
        description:
          "Visualize fee collection efficiency, outstanding dues by class, and payment mode breakdowns (UPI vs Cash vs Bank).",
        target: safeTarget("tour-analytics-fees"),
        placement: "top",
      },
      {
        title: "Student Attendance Analytics",
        description:
          "Review attendance consistency curves, seasonal drop-offs, and compare presence rates across different grades.",
        target: safeTarget("tour-analytics-attendance"),
        placement: "top",
      },
    ],
  },

  "/settings": {
    pageTitle: "School Settings",
    steps: [
      {
        title: "School Configuration Hub",
        description:
          "Configure school branding, academic sessions, institution profile details, and subscription plans.",
        target: null,
      },
      {
        title: "Settings Navigation",
        description:
          "Switch between School Profile, Academic Sessions, Account Credentials, and Billing Tiers.",
        target: safeTarget("tour-settings-tabs"),
        placement: "bottom",
      },
      {
        title: "School Branding & Profile",
        description:
          "Update your school's official name, crest/logo, affiliation board, contact email, phone, and physical address.",
        target: safeTarget("tour-settings-profile"),
        placement: "top",
      },
      {
        title: "Academic Sessions",
        description:
          "Define and manage academic years (e.g., 2026-2027), active term dates, and primary billing cycles.",
        target: safeTarget("tour-settings-sessions"),
        placement: "top",
      },
      {
        title: "Subscription & Licensing",
        description:
          "View your active Kora subscription plan (Basic, Pro, Enterprise), renewals, and invoice history.",
        target: safeTarget("tour-settings-billing"),
        placement: "top",
      },
    ],
  },

  "/schools": {
    pageTitle: "Multi-Tenant School Directory",
    steps: [
      {
        title: "Multi-Tenant School Directory",
        description:
          "Super Admin console to oversee all registered schools on the Kora platform.",
        target: null,
      },
      {
        title: "Register New School",
        description:
          "Provision a new tenant school with designated admin credentials and subscription plan.",
        target: safeTarget("tour-schools-add-btn"),
        placement: "bottom",
      },
      {
        title: "School Tenants Roster",
        description:
          "Monitor active schools, student counts, subscription statuses, and manage school access.",
        target: safeTarget("tour-schools-table"),
        placement: "top",
      },
    ],
  },

  "/subscriptions": {
    pageTitle: "Platform Subscriptions",
    steps: [
      {
        title: "SaaS Subscriptions & Billing",
        description:
          "Super Admin overview of recurring platform revenues, subscription tiers, and renewal health.",
        target: null,
      },
      {
        title: "Subscription Metrics & MRR",
        description:
          "Review platform Monthly Recurring Revenue, active paid schools, trial conversions, and churn rate.",
        target: safeTarget("tour-subscriptions-stats"),
        placement: "bottom",
      },
      {
        title: "School Subscription Ledger",
        description:
          "Track each school's active tier, billing cycles, invoice statuses, and upgrade requests.",
        target: safeTarget("tour-subscriptions-table"),
        placement: "top",
      },
    ],
  },
};

/**
 * Resolves the appropriate tour config based on the current pathname.
 * Handles sub-routes by matching prefix patterns.
 */
export function getTourConfigForRoute(pathname: string): PageTourConfig {
  // Exact match
  if (TOUR_CONFIGS[pathname]) {
    return TOUR_CONFIGS[pathname];
  }

  // Prefix match (e.g. /students/123 -> /students, /settings/account -> /settings)
  const matchingKey = Object.keys(TOUR_CONFIGS).find(
    (key) => key !== "/dashboard" && pathname.startsWith(key),
  );

  if (matchingKey && TOUR_CONFIGS[matchingKey]) {
    return TOUR_CONFIGS[matchingKey];
  }

  // Fallback to Dashboard Tour
  return TOUR_CONFIGS["/dashboard"];
}
