"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2,
  MapPin,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  Check,
  CheckCircle2,
  LogOut,
  UploadCloud,
  GraduationCap,
  CalendarDays,
  Clock,
  BookOpen,
  Map,
  X,
  Type,
  Sun,
  Moon,
  School,
  Landmark,
  BookA,
  Baby,
  MoreHorizontal,
  Phone,
  Mail,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import * as Sentry from "@sentry/nextjs";

// --- Schema Definitions ---
const SetupSchema = z.object({
  // Step 1
  logoUrl: z.string().optional(),
  name: z.string().min(3, "School name is required"),
  subdomain: z
    .string()
    .min(3, "Subdomain is required")
    .regex(
      /^[a-z0-9-]+$/,
      "Only lowercase letters, numbers, and hyphens allowed",
    ),
  schoolType: z.string().min(1, "School type is required"),
  board: z.string().min(1, "Board/Affiliation is required"),
  mediumOfInstruction: z.string().optional(),
  establishedYear: z.preprocess((val) => Number(val), z.number().optional()),
  expectedStudents: z.preprocess(
    (val) => Number(val),
    z.number().min(1, "Required"),
  ),
  expectedStaff: z.preprocess(
    (val) => Number(val),
    z.number().min(1, "Required"),
  ),

  // Step 2
  address: z.string().min(10, "Please provide a complete address"),
  pincode: z.string().min(6, "Valid pincode required").max(6),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  country: z.string().min(2, "Country is required"),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email("Valid email required"),
  website: z.string().url("Valid URL required").optional().or(z.literal("")),
  officeHoursStart: z.string().optional(),
  officeHoursEnd: z.string().optional(),
  timezone: z.string().optional(),

  // Step 3
  academicSession: z.string().min(1, "Required"),
  classes: z.array(z.string()).min(1, "Select at least one class"),
  schoolShift: z.string().min(1, "Required"),
  workingDays: z.array(z.string()).min(1, "Required"),
  gradingSystem: z.string().optional(),
});

type SetupInput = z.infer<typeof SetupSchema>;

const PLANS = [
  {
    id: "BASIC",
    name: "Basic",
    price: "₹999",
    description: "Perfect for small schools getting started.",
    features: [
      "Up to 500 students",
      "Student & Staff Management",
      "Attendance Management",
      "Fee Management",
      "Basic Reports & Analytics",
      "Email Support",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: "₹1,999",
    description: "Ideal for growing schools with advanced needs.",
    features: [
      "Up to 2,000 students",
      "Everything in Basic",
      "Advanced Analytics & Reports",
      "Exam & Result Management",
      "Transport Management",
      "Priority Support",
    ],
    popular: true,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: "₹4,999",
    description: "For large schools with custom requirements.",
    features: [
      "Unlimited students",
      "Everything in Pro",
      "Custom Branding",
      "Dedicated Account Manager",
      "24/7 Priority Support",
      "Custom Integrations",
    ],
  },
];

const SCHOOL_TYPES = [
  { id: "School", icon: School },
  { id: "College", icon: Landmark },
  { id: "Coaching Institute", icon: BookA },
  { id: "Preschool", icon: Baby },
  { id: "Other", icon: MoreHorizontal },
];

const BOARDS = ["CBSE", "ICSE", "State Board", "IB", "Cambridge", "Other"];
const CLASSES = [
  "Nursery",
  "LKG",
  "UKG",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
  "Class 13",
  "Class 14",
];
const WORKING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SetupSchoolPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("PRO");
  const [isUploading, setIsUploading] = useState(false);
  const [isValidatingSubdomain, setIsValidatingSubdomain] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<
    "idle" | "available" | "taken"
  >("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    getValues,
    setValue,
    setError,
    clearErrors,
    watch,
    control,
  } = useForm<SetupInput>({
    resolver: zodResolver(SetupSchema),
    defaultValues: {
      email: session?.user?.email || "",
      country: "India",
      schoolType: "School",
      board: "CBSE",
      mediumOfInstruction: "English",
      timezone: "Asia/Kolkata (IST)",
      academicSession: "2026 - 2027",
      classes: [],
      workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      schoolShift: "SINGLE",
      gradingSystem: "Percentage (0 - 100)",
    },
  });

  const logoUrl = watch("logoUrl");
  const selectedClasses = watch("classes") || [];
  const selectedWorkingDays = watch("workingDays") || [];
  const currentSubdomain = watch("subdomain");

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePincodeChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const pin = e.target.value;
    setValue("pincode", pin);
    if (pin.length === 6) {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const data = await res.json();
        if (data && data[0] && data[0].Status === "Success") {
          const postOffice = data[0].PostOffice[0];
          setValue("city", postOffice.District);
          setValue("state", postOffice.State);
          setValue("country", postOffice.Country);
          clearErrors(["city", "state", "country"]);
        }
      } catch (err) {
        // Silently capture
      }
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setValue("logoUrl", data.url);
        toast.success("Logo uploaded successfully");
      } else {
        toast.error("Failed to upload logo");
      }
    } catch (err) {
      toast.error("Error uploading logo");
    } finally {
      setIsUploading(false);
    }
  };

  const checkSubdomain = async (sub: string) => {
    if (!sub || sub.length < 3) return;
    setIsValidatingSubdomain(true);
    try {
      const res = await fetch("/api/school/check-subdomain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subdomain: sub }),
      });
      const data = await res.json();
      if (!data.available) {
        setSubdomainStatus("taken");
      } else {
        setSubdomainStatus("available");
      }
    } catch (err) {
      setSubdomainStatus("idle");
    } finally {
      setIsValidatingSubdomain(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (currentSubdomain && !errors.subdomain) {
        checkSubdomain(currentSubdomain);
      } else {
        setSubdomainStatus("idle");
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [currentSubdomain, errors.subdomain]);

  const nextStep = async () => {
    let isValid = false;
    if (step === 1) {
      isValid = await trigger([
        "name",
        "subdomain",
        "schoolType",
        "board",
        "expectedStudents",
        "expectedStaff",
      ]);
      if (isValid && subdomainStatus === "taken") {
        setError("subdomain", {
          type: "manual",
          message: "Subdomain is already taken",
        });
        isValid = false;
      }
    } else if (step === 2) {
      isValid = await trigger([
        "address",
        "pincode",
        "city",
        "state",
        "country",
        "phone",
        "email",
      ]);
    } else if (step === 3) {
      isValid = await trigger([
        "academicSession",
        "classes",
        "schoolShift",
        "workingDays",
      ]);
    }

    if (isValid) setStep((s) => s + 1);
  };

  const prevStep = () => setStep((s) => s - 1);

  const onSubmit = async () => {
    if (step !== 4) return;
    setIsSubmitting(true);
    try {
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok)
        throw new Error(orderData.error || "Failed to create order");

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Kora",
        description: `${selectedPlan} Plan Subscription`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            const formData = getValues();
            const verifyRes = await fetch("/api/school/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...formData,
                plan: selectedPlan,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok)
              throw new Error(verifyData.error || "Failed to provision school");

            toast.success("School created successfully!");
            await update({ schoolId: verifyData.schoolId });
            router.push("/dashboard");
            router.refresh();
          } catch (err: any) {
            toast.error(err.message || "Payment verification failed");
            setIsSubmitting(false);
          }
        },
        prefill: {
          name: session?.user?.name || "",
          email: session?.user?.email || "",
          contact: getValues("phone"),
        },
        theme: { color: "#7c3aed" },
        modal: {
          ondismiss: function () {
            setIsSubmitting(false);
          },
        },
      };

      const rzp1 = new (window as any).Razorpay(options);
      rzp1.open();
    } catch (error: any) {
      toast.error(error.message);
      setIsSubmitting(false);
    }
  };

  const STEPS = [
    { id: 1, label: "School Profile", sublabel: "Basic information" },
    {
      id: 2,
      label: "Location & Contact",
      sublabel: "Address and communication",
    },
    { id: 3, label: "Academic Setup", sublabel: "Classes, board and session" },
    { id: 4, label: "Plan & Billing", sublabel: "Choose your plan" },
  ];

  const toggleClass = (c: string) => {
    const curr = getValues("classes") || [];
    if (curr.includes(c))
      setValue(
        "classes",
        curr.filter((x) => x !== c),
        { shouldValidate: true },
      );
    else setValue("classes", [...curr, c], { shouldValidate: true });
  };
  const selectAllClasses = () =>
    setValue("classes", CLASSES, { shouldValidate: true });
  const clearAllClasses = () =>
    setValue("classes", [], { shouldValidate: true });

  const toggleDay = (d: string) => {
    const curr = getValues("workingDays") || [];
    if (curr.includes(d))
      setValue(
        "workingDays",
        curr.filter((x) => x !== d),
        { shouldValidate: true },
      );
    else setValue("workingDays", [...curr, d], { shouldValidate: true });
  };

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden font-sans">
      {/* Left Sidebar Fixed */}
      <div className="w-[320px] lg:w-[380px] shrink-0 bg-[#F8F9FE] dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between h-full relative z-10">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-violet-600 rounded-lg flex items-center justify-center text-white shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight leading-none">
                Kora
              </h1>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                School Management System
              </span>
            </div>
          </div>

          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-[15px] top-[24px] bottom-[24px] w-[2px] bg-zinc-200 dark:bg-zinc-800" />
            <div
              className="absolute left-[15px] top-[24px] bottom-[24px] w-[2px] bg-violet-600 transition-all duration-500 origin-top"
              style={{ transform: `scaleY(${(step - 1) / 3})` }}
            />

            <div className="space-y-6 relative z-10">
              {STEPS.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start gap-4 cursor-pointer"
                  onClick={() => s.id < step && setStep(s.id)}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${step > s.id ? "bg-emerald-500 border-emerald-500 text-white" : step === s.id ? "bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-600/30" : "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-700 text-zinc-400"}`}
                  >
                    {step > s.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <span className="text-sm font-semibold">{s.id}</span>
                    )}
                  </div>
                  <div
                    className={`pt-1.5 transition-colors ${step === s.id ? "text-violet-900 dark:text-violet-100 bg-violet-100 dark:bg-violet-900/30 -mt-2 p-3 -ml-2 rounded-xl w-full pr-4" : "opacity-60"}`}
                  >
                    <h3
                      className={`text-sm font-semibold ${step === s.id ? "text-violet-900 dark:text-violet-100" : "text-zinc-900 dark:text-zinc-100"}`}
                    >
                      {s.label}
                    </h3>
                    <p
                      className={`text-xs ${step === s.id ? "text-violet-700 dark:text-violet-300" : "text-zinc-500"}`}
                    >
                      {s.sublabel}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-8 pb-8">
          <div className="w-full h-40 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl mb-6 relative overflow-hidden flex items-end justify-center pb-2">
            {/* Simple School Illustration placeholder */}
            <div className="w-3/4 h-3/4 relative">
              <div className="absolute bottom-0 w-full h-[60%] bg-violet-200 dark:bg-violet-900 rounded-t-xl" />
              <div className="absolute bottom-[60%] left-1/2 -translate-x-1/2 w-1/3 h-1/3 bg-violet-300 dark:bg-violet-800 rounded-t-lg" />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-6 h-8 bg-violet-600 dark:bg-violet-400 rounded-t-md" />
              <Clock className="absolute top-[20%] left-1/2 -translate-x-1/2 w-4 h-4 text-violet-700 dark:text-violet-300" />
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h4 className="text-sm font-bold flex items-center gap-2 mb-1 text-zinc-900 dark:text-white">
              <span className="text-amber-500">💡</span>
              {step === 1 && "You're just a few steps away!"}
              {step === 2 && "Almost there!"}
              {step === 3 && "Set up your academic structure"}
              {step === 4 && "Final step!"}
            </h4>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {step === 1 &&
                "This information helps us configure Kora for your school."}
              {step === 2 &&
                "Add your school's address and contact details so we can set up your workspace properly."}
              {step === 3 &&
                "This helps us configure classes, timetables, fees and other features specifically for your school."}
              {step === 4 &&
                "Choose a plan to activate your Kora workspace. You can change or upgrade anytime."}
            </p>
          </div>

          <div className="mt-6 flex items-center justify-between text-xs font-semibold text-zinc-900 dark:text-white mb-2">
            <span>Step {step} of 4</span>
            <span>{step * 25}%</span>
          </div>
          <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-600 transition-all duration-300 rounded-full"
              style={{ width: `${step * 25}%` }}
            />
          </div>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 relative">
        <div className="absolute top-6 right-6">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg transition-colors shadow-sm"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </button>
        </div>

        <div className="max-w-4xl mx-auto pt-16 px-8 pb-32">
          <div className="mb-8 flex justify-between items-start">
            <div>
              <p className="text-sm font-bold text-violet-600 uppercase tracking-wider mb-2">
                Step {step} of 4
              </p>
              <h2 className="text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight mb-2">
                {step === 1 && (
                  <>
                    Let's get to know your{" "}
                    <span className="text-violet-600">school</span>
                  </>
                )}
                {step === 2 && (
                  <>
                    Location & <span className="text-violet-600">Contact</span>
                  </>
                )}
                {step === 3 && (
                  <>
                    Academic <span className="text-violet-600">Setup</span>
                  </>
                )}
                {step === 4 && (
                  <>
                    Choose your <span className="text-violet-600">plan</span>
                  </>
                )}
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-lg">
                {step === 1 &&
                  "Basic information helps us set up Kora for you."}
                {step === 2 && "Add your school's address and contact details."}
                {step === 3 &&
                  "Tell us about your academic structure so we can set up Kora for you."}
                {step === 4 &&
                  "Select a plan that fits your school's needs. You can upgrade or downgrade anytime."}
              </p>
            </div>

            {/* Contextual Info Card top right */}
            {step === 1 && (
              <div className="bg-violet-50 dark:bg-violet-900/20 p-4 rounded-xl border border-violet-100 dark:border-violet-900/30 flex items-center gap-4 max-w-xs">
                <div className="w-12 h-12 shrink-0 bg-violet-100 dark:bg-violet-900/50 rounded-lg flex items-center justify-center text-2xl">
                  📖
                </div>
                <p className="text-xs text-violet-800 dark:text-violet-200 font-medium leading-relaxed">
                  You can update all details later from Settings.
                </p>
              </div>
            )}
            {step === 2 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-center gap-4 max-w-xs">
                <div className="w-12 h-12 shrink-0 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center text-blue-600">
                  <MapPin className="w-6 h-6" />
                </div>
                <p className="text-xs text-blue-800 dark:text-blue-200 font-medium leading-relaxed">
                  This information will be used for official communication and
                  may also appear on your Kora workspace.
                </p>
              </div>
            )}
            {step === 3 && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 flex items-center gap-4 max-w-xs">
                <div className="w-12 h-12 shrink-0 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center text-indigo-600">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <p className="text-xs text-indigo-800 dark:text-indigo-200 font-medium leading-relaxed">
                  You can always modify these settings later from the Academic
                  Settings.
                </p>
              </div>
            )}
            {step === 4 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 flex items-center gap-4 max-w-xs">
                <div className="w-12 h-12 shrink-0 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center text-2xl">
                  👑
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-200 font-medium leading-relaxed">
                  All plans include a 14-day free trial. No credit card required
                  to get started.
                </p>
              </div>
            )}
          </div>

          <form className="space-y-6">
            {/* --- STEP 1: SCHOOL PROFILE --- */}
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-6">
                  <div className="flex gap-8">
                    <div className="w-1/3">
                      <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 block">
                        School Logo{" "}
                        <span className="text-zinc-400 font-normal">
                          (Optional)
                        </span>
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={fileInputRef}
                          onChange={handleLogoUpload}
                        />
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="w-32 h-32 rounded-xl border-2 border-dashed border-violet-200 dark:border-violet-900/50 hover:border-violet-500 dark:hover:border-violet-500 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-violet-50/50 dark:bg-violet-900/10 text-violet-600 overflow-hidden relative group"
                        >
                          {logoUrl ? (
                            <>
                              <img
                                src={logoUrl}
                                alt="Logo"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                                Change
                              </div>
                            </>
                          ) : isUploading ? (
                            <div className="animate-pulse flex flex-col items-center">
                              <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mb-2" />
                              Uploading
                            </div>
                          ) : (
                            <>
                              <UploadCloud className="w-6 h-6" />
                              <div className="text-center">
                                <p className="text-xs font-bold">Upload Logo</p>
                                <p className="text-[10px] text-zinc-500">
                                  PNG, JPG up to 2MB
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="w-2/3 space-y-6">
                      <div>
                        <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 block">
                          School Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          {...register("name")}
                          placeholder="Delhi Public School"
                          className="w-full h-12 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-medium text-zinc-900 dark:text-zinc-100"
                        />
                        {errors.name && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.name.message}
                          </p>
                        )}
                        <p className="text-xs text-zinc-500 mt-2">
                          The official name that will appear across your Kora
                          workspace.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 block">
                      Subdomain <span className="text-red-500">*</span>
                    </label>
                    <div className="flex">
                      <input
                        {...register("subdomain", {
                          onChange: () => clearErrors("subdomain"),
                        })}
                        placeholder="dmps"
                        className="flex-1 h-12 px-4 rounded-l-xl border border-zinc-200 border-r-0 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-medium text-zinc-900 dark:text-zinc-100"
                      />
                      <div className="h-12 px-4 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-r-xl text-zinc-500 font-medium">
                        .schoolos.com
                      </div>
                    </div>
                    {errors.subdomain && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.subdomain.message}
                      </p>
                    )}
                    {subdomainStatus === "available" && !errors.subdomain && (
                      <p className="text-xs text-emerald-600 mt-2 flex items-center">
                        <CheckCircle2 className="w-3 h-3 mr-1" />{" "}
                        {currentSubdomain}.schoolos.com is available
                      </p>
                    )}
                    {subdomainStatus === "taken" && !errors.subdomain && (
                      <p className="text-xs text-red-500 mt-2 flex items-center">
                        <X className="w-3 h-3 mr-1" /> {currentSubdomain}
                        .schoolos.com is already taken
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3 block">
                      School Type <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-5 gap-3">
                      {SCHOOL_TYPES.map((type) => {
                        const isSelected = watch("schoolType") === type.id;
                        return (
                          <div
                            key={type.id}
                            onClick={() =>
                              setValue("schoolType", type.id, {
                                shouldValidate: true,
                              })
                            }
                            className={`cursor-pointer rounded-xl border-2 p-3 flex flex-col items-center justify-center gap-2 transition-all ${isSelected ? "border-violet-600 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300" : "border-zinc-200 dark:border-zinc-800 hover:border-violet-200 text-zinc-600 dark:text-zinc-400"}`}
                          >
                            <type.icon className="w-6 h-6" />
                            <span className="text-xs font-semibold">
                              {type.id}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {errors.schoolType && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.schoolType.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 block">
                        Board / Affiliation
                      </label>
                      <select
                        {...register("board")}
                        className="w-full h-12 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-medium text-zinc-900 dark:text-zinc-100"
                      >
                        {BOARDS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 block">
                        Medium of Instruction
                      </label>
                      <select
                        {...register("mediumOfInstruction")}
                        className="w-full h-12 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-medium text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Bilingual">Bilingual</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 block">
                        Established Year{" "}
                        <span className="text-zinc-400 font-normal">
                          (Optional)
                        </span>
                      </label>
                      <input
                        type="number"
                        {...register("establishedYear")}
                        placeholder="2008"
                        className="w-full h-12 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-medium text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 block">
                        Expected Students{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        {...register("expectedStudents")}
                        placeholder="1500"
                        className="w-full h-12 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-medium text-zinc-900 dark:text-zinc-100"
                      />
                      {errors.expectedStudents && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.expectedStudents.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 block">
                        Expected Staff/Teachers{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        {...register("expectedStaff")}
                        placeholder="80"
                        className="w-full h-12 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-medium text-zinc-900 dark:text-zinc-100"
                      />
                      {errors.expectedStaff && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.expectedStaff.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Used to recommend the right plan for your school.
                  </p>
                </div>
              </div>
            )}

            {/* --- STEP 2: LOCATION & CONTACT --- */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex gap-8">
                  <div className="w-3/5 space-y-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          School Address
                        </h4>
                        <p className="text-xs text-zinc-500">
                          Enter the complete address of your school.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1.5 block">
                        Street Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        {...register("address")}
                        placeholder="01, Near Railway Station, Main Road"
                        className="w-full h-11 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 focus:outline-none focus:border-violet-500 font-medium text-sm text-zinc-900 dark:text-zinc-100"
                      />
                      {errors.address && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.address.message}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1.5 block">
                          Pincode <span className="text-red-500">*</span>
                        </label>
                        <input
                          {...register("pincode")}
                          maxLength={6}
                          onChange={handlePincodeChange}
                          placeholder="832401"
                          className="w-full h-11 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 focus:outline-none focus:border-violet-500 font-medium text-sm text-zinc-900 dark:text-zinc-100"
                        />
                        {errors.pincode && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.pincode.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1.5 block">
                          City / District{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          {...register("city")}
                          placeholder="Seraikela-Kharsawan"
                          className="w-full h-11 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 focus:outline-none focus:border-violet-500 font-medium text-sm text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1.5 block">
                          State <span className="text-red-500">*</span>
                        </label>
                        <input
                          {...register("state")}
                          placeholder="Jharkhand"
                          className="w-full h-11 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 focus:outline-none focus:border-violet-500 font-medium text-sm text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1.5 block">
                          Country <span className="text-red-500">*</span>
                        </label>
                        <input
                          {...register("country")}
                          placeholder="India"
                          className="w-full h-11 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 focus:outline-none focus:border-violet-500 font-medium text-sm text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="w-2/5 flex flex-col">
                    <div className="flex-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center relative overflow-hidden">
                      {/* Map Placeholder */}
                      <div
                        className="absolute inset-0 bg-emerald-50/50 dark:bg-emerald-900/10"
                        style={{
                          backgroundImage:
                            'url("https://www.transparenttextures.com/patterns/cubes.png")',
                        }}
                      />
                      <div className="relative z-10 flex flex-col items-center">
                        <MapPin className="w-10 h-10 text-violet-600 mb-2 drop-shadow-md" />
                        <div className="bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-full shadow-lg text-xs font-bold text-zinc-800 dark:text-zinc-200 border border-zinc-100 dark:border-zinc-800">
                          {watch("city") || "Map View"}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-violet-700 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                    >
                      <MapPin className="w-4 h-4" /> Use my current location
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        School Contact Details
                      </h4>
                      <p className="text-xs text-zinc-500">
                        These details will be used for important communication.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 block">
                        Official Phone Number{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 overflow-hidden">
                        <div className="px-3 flex items-center bg-zinc-100 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 text-sm font-medium">
                          🇮🇳 +91
                        </div>
                        <input
                          {...register("phone")}
                          placeholder="9304738536"
                          className="flex-1 h-12 px-3 bg-transparent border-none focus:outline-none font-medium text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      {errors.phone && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.phone.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 block">
                        Official Email <span className="text-red-500">*</span>
                      </label>
                      <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 overflow-hidden">
                        <div className="px-3 flex items-center text-zinc-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          {...register("email")}
                          placeholder="support@dmps.com"
                          className="flex-1 h-12 px-3 bg-transparent border-none focus:outline-none font-medium text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      {errors.email && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.email.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 block">
                      Website{" "}
                      <span className="text-zinc-400 font-normal">
                        (Optional)
                      </span>
                    </label>
                    <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 overflow-hidden">
                      <div className="px-3 flex items-center text-zinc-400">
                        🔗
                      </div>
                      <input
                        {...register("website")}
                        placeholder="https://www.dmps.com"
                        className="flex-1 h-12 px-3 bg-transparent border-none focus:outline-none font-medium text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          School Office Hours{" "}
                          <span className="text-zinc-400 font-normal text-xs">
                            (Optional)
                          </span>
                        </h4>
                        <p className="text-xs text-zinc-500">
                          Help us understand your working hours.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        {...register("officeHoursStart")}
                        placeholder="08:00 AM"
                        className="w-full h-11 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 focus:outline-none focus:border-violet-500 text-sm font-medium text-center"
                      />
                      <span className="text-zinc-400">-</span>
                      <input
                        {...register("officeHoursEnd")}
                        placeholder="04:00 PM"
                        className="w-full h-11 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 focus:outline-none focus:border-violet-500 text-sm font-medium text-center"
                      />
                    </div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <Map className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          Timezone
                        </h4>
                        <p className="text-xs text-zinc-500">
                          Used for class schedules, notifications.
                        </p>
                      </div>
                    </div>
                    <select
                      {...register("timezone")}
                      className="w-full h-11 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 focus:outline-none focus:border-violet-500 text-sm font-medium"
                    >
                      <option value="Asia/Kolkata (IST)">
                        Asia/Kolkata (IST)
                      </option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* --- STEP 3: ACADEMIC SETUP --- */}
            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center">
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          Academic Session{" "}
                          <span className="text-red-500">*</span>
                        </h4>
                        <p className="text-xs text-zinc-500">
                          Select the current academic year.
                        </p>
                      </div>
                    </div>
                    <select
                      {...register("academicSession")}
                      className="w-full h-12 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 focus:outline-none focus:border-violet-500 font-medium"
                    >
                      <option value="2026 - 2027">2026 - 2027</option>
                      <option value="2025 - 2026">2025 - 2026</option>
                    </select>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          School Board / Affiliation{" "}
                          <span className="text-red-500">*</span>
                        </h4>
                        <p className="text-xs text-zinc-500">
                          Choose the board your school is affiliated with.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {BOARDS.map((b) => (
                        <div
                          key={b}
                          onClick={() => setValue("board", b)}
                          className={`shrink-0 cursor-pointer rounded-xl border-2 px-4 py-2 flex flex-col items-center justify-center gap-1 transition-all ${watch("board") === b ? "border-violet-600 bg-violet-50 text-violet-700" : "border-zinc-200 hover:border-violet-200 text-zinc-600"}`}
                        >
                          {watch("board") === b && (
                            <CheckCircle2 className="w-4 h-4 absolute top-1 right-1" />
                          )}
                          <BookOpen className="w-5 h-5 mb-1" />
                          <span className="text-xs font-semibold whitespace-nowrap">
                            {b}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          Classes / Grades{" "}
                          <span className="text-red-500">*</span>
                        </h4>
                        <p className="text-xs text-zinc-500">
                          Select the classes offered in your school.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={selectAllClasses}
                        className="text-xs font-semibold text-violet-600 hover:text-violet-700"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={clearAllClasses}
                        className="text-xs font-semibold text-zinc-500 hover:text-zinc-700"
                      >
                        Clear All
                      </button>
                      <span className="text-xs font-bold bg-zinc-100 px-2 py-1 rounded-md">
                        {selectedClasses.length} selected
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {CLASSES.map((c) => {
                      const isSelected = selectedClasses.includes(c);
                      return (
                        <div
                          key={c}
                          onClick={() => toggleClass(c)}
                          className={`cursor-pointer rounded-lg border flex items-center px-3 py-2 gap-2 transition-all ${isSelected ? "border-violet-600 bg-violet-50 text-violet-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
                        >
                          <div
                            className={`w-4 h-4 rounded ${isSelected ? "bg-violet-600 text-white flex items-center justify-center" : "border border-zinc-300"}`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <span className="text-sm font-semibold">{c}</span>
                        </div>
                      );
                    })}
                  </div>
                  {errors.classes && (
                    <p className="text-xs text-red-500 mt-2">
                      {errors.classes.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          School Shift <span className="text-red-500">*</span>
                        </h4>
                        <p className="text-xs text-zinc-500">
                          How does your school operate?
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => setValue("schoolShift", "SINGLE")}
                        className={`cursor-pointer rounded-xl border-2 p-3 flex gap-3 transition-all ${watch("schoolShift") === "SINGLE" ? "border-violet-600 bg-violet-50 text-violet-700" : "border-zinc-200 hover:border-violet-200 text-zinc-600"}`}
                      >
                        <Sun className="w-5 h-5 shrink-0" />
                        <div>
                          <p className="text-sm font-bold">Single Shift</p>
                          <p className="text-[10px] opacity-70">
                            One working shift per day
                          </p>
                        </div>
                        {watch("schoolShift") === "SINGLE" && (
                          <CheckCircle2 className="w-4 h-4 ml-auto" />
                        )}
                      </div>
                      <div
                        onClick={() => setValue("schoolShift", "MULTIPLE")}
                        className={`cursor-pointer rounded-xl border-2 p-3 flex gap-3 transition-all ${watch("schoolShift") === "MULTIPLE" ? "border-violet-600 bg-violet-50 text-violet-700" : "border-zinc-200 hover:border-violet-200 text-zinc-600"}`}
                      >
                        <Moon className="w-5 h-5 shrink-0" />
                        <div>
                          <p className="text-sm font-bold">Multiple Shifts</p>
                          <p className="text-[10px] opacity-70">
                            Two or more shifts per day
                          </p>
                        </div>
                        {watch("schoolShift") === "MULTIPLE" && (
                          <CheckCircle2 className="w-4 h-4 ml-auto" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          Working Days <span className="text-red-500">*</span>
                        </h4>
                        <p className="text-xs text-zinc-500">
                          Select the working days in a week.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {WORKING_DAYS.map((d) => {
                        const isSelected = selectedWorkingDays.includes(d);
                        return (
                          <div
                            key={d}
                            onClick={() => toggleDay(d)}
                            className={`flex-1 cursor-pointer rounded-lg flex flex-col items-center justify-center py-2 gap-1 transition-all ${isSelected ? "bg-violet-100 text-violet-700" : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100"}`}
                          >
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center ${isSelected ? "bg-violet-600 text-white" : "border border-zinc-300 bg-white"}`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <span className="text-[11px] font-bold">{d}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0 text-violet-600">
                      <Type className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-bold text-zinc-900 block mb-1">
                        Medium of Instruction{" "}
                        <span className="text-xs font-normal text-zinc-400">
                          (Optional)
                        </span>
                      </label>
                      <select
                        {...register("mediumOfInstruction")}
                        className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-zinc-50 focus:outline-none text-sm font-medium"
                      >
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                      </select>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-600">
                      📊
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-bold text-zinc-900 block mb-1">
                        Default Grading System{" "}
                        <span className="text-xs font-normal text-zinc-400">
                          (Optional)
                        </span>
                      </label>
                      <select
                        {...register("gradingSystem")}
                        className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-zinc-50 focus:outline-none text-sm font-medium"
                      >
                        <option value="Percentage (0 - 100)">
                          Percentage (0 - 100)
                        </option>
                        <option value="GPA (4.0)">GPA (4.0)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- STEP 4: PLAN & BILLING --- */}
            {step === 4 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="flex justify-center mb-8">
                  <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-full flex items-center shadow-inner">
                    <button
                      type="button"
                      className="px-6 py-2 rounded-full bg-violet-600 text-white text-sm font-bold shadow-sm"
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      className="px-6 py-2 rounded-full text-zinc-500 text-sm font-bold flex items-center gap-2"
                    >
                      Yearly{" "}
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px]">
                        Save 20%
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {PLANS.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative flex flex-col p-6 rounded-3xl border-2 transition-all cursor-pointer bg-white dark:bg-zinc-900 ${
                        selectedPlan === plan.id
                          ? "border-violet-600 shadow-xl shadow-violet-600/10 scale-105 z-10"
                          : "border-zinc-200 hover:border-violet-300"
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                          Most Popular
                        </div>
                      )}

                      <h3 className="font-bold text-xl text-zinc-900 dark:text-white mb-1">
                        {plan.name}
                      </h3>
                      <p className="text-xs text-zinc-500 h-8">
                        {plan.description}
                      </p>

                      <div className="my-6">
                        <span className="text-4xl font-black text-violet-600 dark:text-violet-400">
                          {plan.price}
                        </span>
                        <span className="text-sm font-bold text-zinc-400">
                          {" "}
                          / month
                        </span>
                      </div>

                      <ul className="space-y-3 flex-1 mb-8">
                        {plan.features.map((feature, i) => (
                          <li
                            key={i}
                            className="flex items-start text-sm font-medium text-zinc-600 dark:text-zinc-400"
                          >
                            <Check className="w-4 h-4 text-violet-600 mr-2 flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${selectedPlan === plan.id ? "bg-violet-600 text-white shadow-md shadow-violet-600/20" : "bg-zinc-50 text-violet-600 border border-violet-200 hover:bg-violet-50"}`}
                      >
                        {selectedPlan === plan.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Selected
                          </span>
                        ) : (
                          `Select ${plan.name}`
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Simulated Payment Area for visual matching */}
                <div className="flex gap-6 mt-8">
                  <div className="w-2/3 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm opacity-60 pointer-events-none">
                    <div className="flex items-center gap-3 mb-6">
                      <CreditCard className="w-6 h-6 text-zinc-800" />
                      <div>
                        <h4 className="text-sm font-bold">Payment Details</h4>
                        <p className="text-xs text-zinc-500">
                          Secure and encrypted payment powered by Razorpay.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mb-6 border-b border-zinc-100 pb-2">
                      <div className="px-4 py-2 bg-violet-50 text-violet-700 rounded-lg text-sm font-bold border border-violet-200 flex items-center gap-2">
                        <CreditCard className="w-4 h-4" /> Card
                      </div>
                      <div className="px-4 py-2 text-zinc-500 rounded-lg text-sm font-bold flex items-center gap-2">
                        ▶ UPI
                      </div>
                      <div className="px-4 py-2 text-zinc-500 rounded-lg text-sm font-bold flex items-center gap-2">
                        🏦 Net Banking
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="h-12 bg-zinc-50 rounded-xl border border-zinc-200 px-4 flex items-center justify-between">
                        <span className="text-sm text-zinc-400 font-mono tracking-widest">
                          1234 5678 9012 3456
                        </span>
                      </div>
                      <div className="flex gap-4">
                        <div className="h-12 flex-1 bg-zinc-50 rounded-xl border border-zinc-200 px-4 flex items-center">
                          <span className="text-sm text-zinc-400 font-mono">
                            MM / YY
                          </span>
                        </div>
                        <div className="h-12 flex-1 bg-zinc-50 rounded-xl border border-zinc-200 px-4 flex items-center">
                          <span className="text-sm text-zinc-400 font-mono">
                            123
                          </span>
                        </div>
                        <div className="h-12 flex-[2] bg-zinc-50 rounded-xl border border-zinc-200 px-4 flex items-center">
                          <span className="text-sm text-zinc-400">
                            John Doe
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-1/3 bg-zinc-50 p-6 rounded-2xl border border-zinc-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-zinc-600 shadow-sm">
                        📄
                      </div>
                      <div>
                        <h4 className="text-sm font-bold">Order Summary</h4>
                        <p className="text-[10px] text-zinc-500">
                          Review your plan details.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3 text-sm font-medium text-zinc-600 mb-6">
                      <div className="flex justify-between">
                        <span>Plan</span>
                        <span className="font-bold text-zinc-900">Pro</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Billing Cycle</span>
                        <span className="font-bold text-zinc-900">Monthly</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Amount</span>
                        <span className="font-bold text-zinc-900">₹1,999</span>
                      </div>
                      <div className="flex justify-between">
                        <span>GST (18%)</span>
                        <span className="font-bold text-zinc-900">₹359.82</span>
                      </div>
                    </div>
                    <div className="border-t border-zinc-200 pt-4 mb-6">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold">Total Amount</span>
                        <span className="text-xl font-black text-violet-600">
                          ₹2,358.82
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onSubmit}
                      disabled={isSubmitting}
                      className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-violet-600/30 flex items-center justify-center disabled:opacity-50"
                    >
                      {isSubmitting
                        ? "Processing..."
                        : "Start 14-Day Free Trial →"}
                    </button>
                    <p className="text-center text-[10px] text-zinc-500 mt-4 flex items-center justify-center gap-1">
                      <Check className="w-3 h-3" /> I agree to Terms & Privacy
                      Policy.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* --- ACTION BAR (Steps 1-3) --- */}
            {step < 4 && (
              <div className="fixed bottom-0 left-[320px] lg:left-[380px] right-0 p-6 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center z-50">
                {step === 1 ? (
                  <button
                    type="button"
                    className="flex items-center justify-center px-4 h-12 rounded-xl font-bold text-sm text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors border border-zinc-200 bg-white shadow-sm"
                  >
                    <LogOut className="w-4 h-4 mr-2" /> Save & exit
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={prevStep}
                    disabled={isSubmitting}
                    className="flex items-center justify-center px-6 h-12 rounded-xl font-bold text-sm text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back to{" "}
                    {STEPS[step - 2].label}
                  </button>
                )}

                <button
                  type="button"
                  onClick={nextStep}
                  disabled={isValidatingSubdomain}
                  className="flex items-center justify-center px-8 h-12 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-violet-600/30 disabled:opacity-50"
                >
                  {isValidatingSubdomain
                    ? "Checking..."
                    : `Continue to ${STEPS[step].label}`}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
