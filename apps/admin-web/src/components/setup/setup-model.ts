import { z } from "zod";
import {
  Baby,
  BookA,
  Building2,
  CreditCard,
  GraduationCap,
  Landmark,
  MapPin,
  MoreHorizontal,
  School,
  type LucideIcon,
} from "lucide-react";
import {
  PAID_PLAN_IDS,
  TRIAL_DURATION_DAYS,
  TRIAL_PLAN,
  formatPlanPrice,
  paidPlansByPrice,
  type PaidPlanId,
  type PlanCatalog,
} from "@/lib/plans";
import {
  CLASS_CATEGORIES,
  STANDARD_CLASSES,
  categoryForOrder,
  standardClassOrder,
} from "@/lib/class-catalog";

// --- Schema ---

export const SetupSchema = z.object({
  logoUrl: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(3, "Enter your school's name (at least 3 characters)"),
  subdomain: z
    .string()
    .min(3, "Use at least 3 characters")
    .max(40, "Keep it under 40 characters")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens")
    .refine(
      (s) => !s.startsWith("-") && !s.endsWith("-"),
      "Can't start or end with a hyphen",
    ),
  schoolType: z.string().min(1, "Choose the type of institution"),
  board: z.string().min(1, "Choose a board or affiliation"),
  mediumOfInstruction: z.string().optional(),
  expectedStudents: z.coerce
    .number({ invalid_type_error: "Enter a number" })
    .int("Enter a whole number")
    .min(1, "Enter roughly how many students you have"),
  expectedStaff: z.coerce
    .number({ invalid_type_error: "Enter a number" })
    .int("Enter a whole number")
    .min(1, "Enter roughly how many staff you have"),
  address: z.string().trim().min(10, "Enter the full street address"),
  pincode: z.string().regex(/^\d{6}$/, "Enter a 6-digit pincode"),
  city: z.string().trim().min(2, "Enter the city or district"),
  state: z.string().trim().min(2, "Enter the state"),
  country: z.string().trim().min(2, "Enter the country"),
  phone: z
    .string()
    .regex(/^\d{10,11}$/, "Enter a 10-digit number, or 11 with the STD code"),
  email: z.string().email("Enter a valid email address"),
  timezone: z.string().optional(),
  academicSession: z.string().min(1, "Choose an academic session"),
  classes: z.array(z.string()).min(1, "Select at least one class"),
  schoolShift: z.string().min(1, "Choose a shift"),
  workingDays: z.array(z.string()).min(1, "Select at least one working day"),
  gradingSystem: z.string().optional(),
});

export type SetupInput = z.infer<typeof SetupSchema>;
export type SetupField = keyof SetupInput;

// --- Steps ---

export type StepId = 1 | 2 | 3 | 4;

export interface SetupStep {
  id: StepId;
  label: string;
  description: string;
  title: string;
  intro: string;
  icon: LucideIcon;
  /** Fields that must be valid before leaving this step. */
  fields: SetupField[];
}

export const STEPS: SetupStep[] = [
  {
    id: 1,
    label: "Profile",
    description: "Name and web address",
    title: "Tell us about your school",
    intro: "We use these to set up your Kora workspace.",
    icon: Building2,
    fields: [
      "name",
      "subdomain",
      "schoolType",
      "expectedStudents",
      "expectedStaff",
    ],
  },
  {
    id: 2,
    label: "Location",
    description: "Address and contact",
    title: "Where is your school?",
    intro:
      "Enter the pincode first and we'll fill in the city and state for you.",
    icon: MapPin,
    fields: [
      "address",
      "pincode",
      "city",
      "state",
      "country",
      "phone",
      "email",
    ],
  },
  {
    id: 3,
    label: "Academic",
    description: "Board, session and classes",
    title: "How does your school run?",
    intro: "We'll create the session and every class you select here.",
    icon: GraduationCap,
    fields: [
      "board",
      "gradingSystem",
      "academicSession",
      "classes",
      "schoolShift",
      "workingDays",
    ],
  },
  {
    id: 4,
    label: "Plan",
    description: "Free trial or paid plan",
    title: "Review and choose how to start",
    intro: "Check your details, then start a free trial or pay for a plan.",
    icon: CreditCard,
    fields: [],
  },
];

export const LAST_STEP: StepId = 4;

export const getStep = (id: StepId) => STEPS[id - 1];

export const isStepId = (n: unknown): n is StepId =>
  n === 1 || n === 2 || n === 3 || n === 4;

// --- Options ---

export const SCHOOL_TYPES: { id: string; icon: LucideIcon }[] = [
  { id: "School", icon: School },
  { id: "College", icon: Landmark },
  { id: "Coaching Institute", icon: BookA },
  { id: "Preschool", icon: Baby },
  { id: "Other", icon: MoreHorizontal },
];

export const BOARDS = [
  "CBSE",
  "ICSE",
  "State Board",
  "IB",
  "Cambridge",
  "Other",
];

export const GRADING_OPTIONS = [
  { value: "CBSE_9_POINT", label: "CBSE 9-point", detail: "A1 to E" },
  { value: "PERCENTAGE_LETTER", label: "Letter grades", detail: "A+ to F" },
  { value: "MARKS_ONLY", label: "Marks only", detail: "Pass or fail" },
];

export const SHIFTS = [
  { value: "SINGLE", label: "Single shift", detail: "One timetable a day" },
  {
    value: "MULTIPLE",
    label: "Multiple shifts",
    detail: "Morning and afternoon batches",
  },
];

export const WORKING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_NAMES: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

export const dayName = (day: string) => DAY_NAMES[day] ?? day;

export const SUBDOMAIN_SUFFIX = ".schoolos.com";

// U6: the class catalogue's names ("Grade 1", not "Class 1"), so classes
// added later from the Classes page are recognised as the same ones.
export const CLASSES = STANDARD_CLASSES.map((c) => c.name);

export interface ClassGroup {
  id: string;
  label: string;
  classes: string[];
}

/** Standard classes grouped as on the Classes page (Early Years, Primary…). */
export const CLASS_GROUPS: ClassGroup[] = CLASS_CATEGORIES.map((category) => ({
  id: category.id,
  label: category.groupLabel,
  classes: STANDARD_CLASSES.filter(
    (c) => categoryForOrder(c.order).id === category.id,
  ).map((c) => c.name),
})).filter((group) => group.classes.length > 0);

// --- Defaults ---

/** The browser's IANA time zone ("Asia/Kolkata"), the school's default. */
export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

/**
 * The current and next academic sessions, which start in April. Values keep
 * the "2026 - 2027" form that starter data parses into session dates.
 */
export function academicSessionOptions(now: Date = new Date()) {
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return [start, start + 1].map((year) => ({
    value: `${year} - ${year + 1}`,
    label: `${year}–${String(year + 1).slice(-2)}`,
  }));
}

export function setupDefaults(
  email = "",
  now: Date = new Date(),
): Partial<SetupInput> {
  return {
    logoUrl: "",
    name: "",
    subdomain: "",
    email,
    address: "",
    pincode: "",
    city: "",
    state: "",
    country: "India",
    phone: "",
    schoolType: "School",
    board: "CBSE",
    mediumOfInstruction: "English",
    timezone: browserTimeZone(),
    academicSession: academicSessionOptions(now)[0].value,
    classes: [],
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    schoolShift: "SINGLE",
    gradingSystem: "CBSE_9_POINT",
  };
}

// --- Input helpers ---

/** "St. Mary's Convent, Ranchi" → "st-marys-convent-ranchi" */
export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/-$/, "");
}

/** Keeps what can be typed into a subdomain; spaces become hyphens. */
export function normalizeSubdomainInput(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
}

export const digitsOnly = (raw: string, max: number) =>
  raw.replace(/\D/g, "").slice(0, max);

export function toggleItem<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

const classOrder = (name: string) => standardClassOrder(name) ?? 99;

export const sortClasses = (classes: readonly string[]) =>
  [...classes].sort((a, b) => classOrder(a) - classOrder(b));

/** "14 classes · Nursery to Grade 12" */
export function describeClasses(classes: readonly string[]) {
  if (classes.length === 0) return "No classes selected";
  const sorted = sortClasses(classes);
  if (sorted.length === 1) return `1 class · ${sorted[0]}`;
  return `${sorted.length} classes · ${sorted[0]} to ${sorted[sorted.length - 1]}`;
}

/** "Mon – Sat" for a run of days, "Mon, Wed, Fri" otherwise. */
export function describeWorkingDays(days: readonly string[]) {
  const sorted = WORKING_DAYS.filter((d) => days.includes(d));
  if (sorted.length === 0) return "No working days";
  const first = WORKING_DAYS.indexOf(sorted[0]);
  const isRun = sorted.every((d, i) => WORKING_DAYS.indexOf(d) === first + i);
  return isRun && sorted.length > 2
    ? `${sorted[0]} – ${sorted[sorted.length - 1]}`
    : sorted.join(", ");
}

// --- Pincode lookup ---

export interface PincodePlace {
  city: string;
  state: string;
  country: string;
}

/** Reads the India Post pincode API's answer; null when it found nothing. */
export function parsePincodeResponse(data: unknown): PincodePlace | null {
  if (!Array.isArray(data)) return null;
  const first = data[0];
  if (first?.Status !== "Success" || !Array.isArray(first.PostOffice)) {
    return null;
  }
  const office = first.PostOffice[0];
  if (!office?.District || !office?.State) return null;
  return {
    city: office.District,
    state: office.State,
    country: office.Country || "India",
  };
}

export async function lookupPincode(pin: string): Promise<PincodePlace | null> {
  const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
  if (!res.ok) return null;
  return parsePincodeResponse(await res.json());
}

// --- Plans ---

export type PlanChoice = "TRIAL" | PaidPlanId;

export const fitsPlan = (
  plans: PlanCatalog,
  plan: PaidPlanId,
  students?: number,
) => !students || students <= plans[plan].limits.maxStudents;

/** The cheapest paid plan with room for this many students, else the biggest. */
export function recommendedPlan(
  plans: PlanCatalog,
  students?: number,
): PaidPlanId {
  if (!students) return TRIAL_PLAN;
  const byPrice = paidPlansByPrice(plans);
  const fits = byPrice.find((p) => fitsPlan(plans, p.id, students));
  if (fits) return fits.id;
  return byPrice.reduce((a, b) =>
    b.limits.maxStudents > a.limits.maxStudents ? b : a,
  ).id;
}

/** The footer's primary button label and the note beside it. */
export function footerCopy({
  plans,
  step,
  choice,
  hasSavedPayment,
  isSubmitting,
}: {
  plans: PlanCatalog;
  step: StepId;
  choice: PlanChoice;
  hasSavedPayment: boolean;
  isSubmitting: boolean;
}) {
  if (step < LAST_STEP) {
    return {
      label: "Continue",
      note: "Your answers are saved on this device as you go.",
    };
  }
  if (hasSavedPayment) {
    return {
      label: isSubmitting ? "Creating your school…" : "Finish setup",
      note: "Your payment is already recorded.",
    };
  }
  if (choice === "TRIAL") {
    return {
      label: isSubmitting
        ? "Creating your school…"
        : `Start ${TRIAL_DURATION_DAYS}-day free trial`,
      note: "No payment needed to start the trial.",
    };
  }
  return {
    label: isSubmitting
      ? "Opening payment…"
      : `Pay ${formatPlanPrice(plans[choice])} & create school`,
    note: "Paid monthly through Razorpay. Nothing renews automatically.",
  };
}

// --- Browser storage ---

/**
 * U3: a payment made during setup is kept in this browser until the school
 * exists, so a failed creation is retried with it instead of a new charge.
 */
export interface SavedPayment {
  plan: PaidPlanId;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface SetupDraft {
  step: StepId;
  values: Partial<SetupInput>;
}

export const savedPaymentKey = (userId: string) =>
  `kora:setup-payment:${userId}`;
export const draftKey = (userId: string) => `kora:setup-draft:${userId}`;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const browserStore = (): Store | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

function readJson(key: string, store: Store | null): unknown {
  try {
    const raw = store?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Unreadable storage: treat it as empty.
    return null;
  }
}

function writeJson(key: string, value: unknown, store: Store | null) {
  try {
    if (value === null) store?.removeItem(key);
    else store?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the page still works until it is closed.
  }
}

export function readSavedPayment(
  userId: string,
  store: Store | null = browserStore(),
): SavedPayment | null {
  const data = readJson(savedPaymentKey(userId), store) as SavedPayment | null;
  return data &&
    (PAID_PLAN_IDS as string[]).includes(data.plan) &&
    data.razorpay_payment_id
    ? data
    : null;
}

export function writeSavedPayment(
  userId: string,
  payment: SavedPayment | null,
  store: Store | null = browserStore(),
) {
  writeJson(savedPaymentKey(userId), payment, store);
}

export function readDraft(
  userId: string,
  store: Store | null = browserStore(),
): SetupDraft | null {
  const data = readJson(draftKey(userId), store) as SetupDraft | null;
  if (!data || typeof data.values !== "object" || data.values === null) {
    return null;
  }
  return { step: isStepId(data.step) ? data.step : 1, values: data.values };
}

export function writeDraft(
  userId: string,
  draft: SetupDraft | null,
  store: Store | null = browserStore(),
) {
  writeJson(draftKey(userId), draft, store);
}
