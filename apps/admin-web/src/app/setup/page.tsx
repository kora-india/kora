"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  MapPin,
  CreditCard,
  Check,
  CheckCircle2,
  LogOut,
  UploadCloud,
  GraduationCap,
  CalendarDays,
  Clock,
  BookOpen,
  Map as MapIcon,
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
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";

// --- Schema Definitions ---
const SetupSchema = z.object({
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

const STEPS = [
  { id: 1, label: "Profile", sublabel: "Basic info", icon: Building2 },
  { id: 2, label: "Location", sublabel: "Address & contact", icon: MapPin },
  {
    id: 3,
    label: "Academic",
    sublabel: "Classes & sessions",
    icon: GraduationCap,
  },
  { id: 4, label: "Plan", sublabel: "Choose your plan", icon: CreditCard },
];

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 50 : -50, opacity: 0 }),
  center: { zIndex: 1, x: 0, opacity: 1 },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 50 : -50,
    opacity: 0,
  }),
};

const PROVISIONING_MESSAGES = [
  "Validating payment details...",
  "Provisioning isolated database...",
  "Configuring academic sessions & classes...",
  "Setting up workspace...",
  "Finalizing your dashboard...",
  "Preparing the magic...",
];

export default function SetupSchoolPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [[step, direction], setStep] = useState([1, 0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionMsgIndex, setProvisionMsgIndex] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<string>("PRO");
  const [isUploading, setIsUploading] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<
    "idle" | "available" | "taken"
  >("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    formState: { errors },
    trigger,
    getValues,
    setValue,
    setError,
    clearErrors,
    watch,
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

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProvisioning) {
      interval = setInterval(() => {
        setProvisionMsgIndex((prev) =>
          Math.min(prev + 1, PROVISIONING_MESSAGES.length - 1),
        );
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isProvisioning]);

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
      } catch (err) {}
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
      } else toast.error("Failed to upload logo");
    } catch (err) {
      toast.error("Error uploading logo");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (
        currentSubdomain &&
        currentSubdomain.length >= 3 &&
        !errors.subdomain
      ) {
        try {
          const res = await fetch("/api/school/check-subdomain", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subdomain: currentSubdomain }),
          });
          const data = await res.json();
          setSubdomainStatus(data.available ? "available" : "taken");
        } catch {
          setSubdomainStatus("idle");
        }
      } else {
        setSubdomainStatus("idle");
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [currentSubdomain, errors.subdomain]);

  const paginate = async (newDirection: number) => {
    let isValid = false;
    if (newDirection > 0) {
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
          setError("subdomain", { type: "manual", message: "Taken" });
          isValid = false;
        }
      } else if (step === 2)
        isValid = await trigger([
          "address",
          "pincode",
          "city",
          "state",
          "country",
          "phone",
          "email",
        ]);
      else if (step === 3)
        isValid = await trigger([
          "academicSession",
          "classes",
          "schoolShift",
          "workingDays",
        ]);
      if (isValid) setStep([step + newDirection, newDirection]);
    } else {
      setStep([step + newDirection, newDirection]);
    }
  };

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
      if (!orderRes.ok) throw new Error(orderData.error || "Failed");

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Kora",
        description: `${selectedPlan} Plan`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            setIsProvisioning(true); // Overtake the screen
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
            if (!verifyRes.ok) throw new Error(verifyData.error || "Failed");
            toast.success("School created!");
            await update({ schoolId: verifyData.schoolId });
            window.location.href = "/dashboard"; // Hard reload to guarantee cookie detection
          } catch (err: any) {
            toast.error(err.message);
            setIsSubmitting(false);
            setIsProvisioning(false);
          }
        },
        prefill: {
          name: session?.user?.name || "",
          email: session?.user?.email || "",
          contact: getValues("phone"),
        },
        theme: { color: "#7c3aed" },
        modal: { ondismiss: () => setIsSubmitting(false) },
      };
      const rzp1 = new (window as any).Razorpay(options);
      rzp1.open();
    } catch (error: any) {
      toast.error(error.message);
      setIsSubmitting(false);
    }
  };

  const toggleClass = (c: string) => {
    const curr = getValues("classes") || [];
    curr.includes(c)
      ? setValue(
          "classes",
          curr.filter((x) => x !== c),
          { shouldValidate: true },
        )
      : setValue("classes", [...curr, c], { shouldValidate: true });
  };
  const toggleDay = (d: string) => {
    const curr = getValues("workingDays") || [];
    curr.includes(d)
      ? setValue(
          "workingDays",
          curr.filter((x) => x !== d),
          { shouldValidate: true },
        )
      : setValue("workingDays", [...curr, d], { shouldValidate: true });
  };

  return (
    <>
      <AnimatePresence>
        {isProvisioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col items-center justify-center font-sans text-white"
          >
            {/* Dynamic Background Gradients */}
            <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-violet-900/30 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[20%] right-[20%] w-[40%] h-[40%] bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center max-w-md w-full text-center">
              <div className="w-16 h-16 border-4 border-white/10 border-t-violet-500 rounded-full animate-spin mb-8" />
              <h2 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
                Building Workspace
              </h2>
              <div className="h-6 relative w-full overflow-hidden flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={provisionMsgIndex}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-zinc-400 font-medium text-sm absolute"
                  >
                    {PROVISIONING_MESSAGES[provisionMsgIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex h-screen w-full bg-[#0a0a0a] overflow-hidden font-sans text-zinc-100 relative selection:bg-violet-500/30">
        {/* Dynamic Background Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-violet-900/30 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none" />

        {/* Sidebar Progress (Glassmorphic) */}
        <div className="w-[340px] shrink-0 border-r border-white/10 bg-white/5 backdrop-blur-3xl flex flex-col justify-between h-full relative z-10 p-10">
          <div>
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex items-center gap-4 mb-16"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-violet-500/20">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                  Kora
                </h1>
                <span className="text-xs font-medium text-zinc-400">
                  School OS
                </span>
              </div>
            </motion.div>

            <div className="relative">
              <div className="absolute left-[19px] top-[28px] bottom-[28px] w-[2px] bg-white/5" />
              <motion.div
                className="absolute left-[19px] top-[28px] bottom-[28px] w-[2px] bg-gradient-to-b from-violet-500 to-indigo-500 origin-top"
                initial={false}
                animate={{ scaleY: (step - 1) / 3 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
              <div className="space-y-8 relative z-10">
                {STEPS.map((s) => (
                  <div key={s.id} className="flex items-start gap-5">
                    <motion.div
                      animate={{
                        backgroundColor:
                          step > s.id
                            ? "#10b981"
                            : step === s.id
                              ? "#8b5cf6"
                              : "#18181b",
                        borderColor:
                          step > s.id
                            ? "#10b981"
                            : step === s.id
                              ? "#8b5cf6"
                              : "#3f3f46",
                        scale: step === s.id ? 1.1 : 1,
                      }}
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 text-white shadow-lg"
                    >
                      {step > s.id ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <s.icon className="w-4 h-4" />
                      )}
                    </motion.div>
                    <div
                      className={`pt-2 transition-all duration-300 ${step === s.id ? "opacity-100 translate-x-2" : "opacity-40"}`}
                    >
                      <h3 className="text-sm font-bold text-white">
                        {s.label}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1">{s.sublabel}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-md"
          >
            <p className="text-xs text-zinc-400 leading-relaxed font-medium">
              Setup your school infrastructure in minutes. We are configuring
              isolated databases and storage just for you.
            </p>
          </motion.div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto relative flex flex-col scrollbar-hide">
          <div className="absolute top-8 right-8 z-50">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl transition-all backdrop-blur-md"
            >
              <LogOut className="w-4 h-4 mr-2" /> Exit Setup
            </button>
          </div>

          <div className="max-w-5xl w-full mx-auto pt-24 px-12 pb-32 flex-1 flex flex-col justify-center">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="w-full"
              >
                <div className="mb-10 text-center">
                  <motion.h2
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-5xl font-black text-white tracking-tight mb-4"
                  >
                    {step === 1 && (
                      <>
                        Welcome to{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
                          Kora
                        </span>
                      </>
                    )}
                    {step === 2 && (
                      <>
                        Where are you{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
                          Located?
                        </span>
                      </>
                    )}
                    {step === 3 && (
                      <>
                        Academic{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
                          Structure
                        </span>
                      </>
                    )}
                    {step === 4 && (
                      <>
                        Choose a{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
                          Plan
                        </span>
                      </>
                    )}
                  </motion.h2>
                  <p className="text-zinc-400 text-lg">
                    {step === 1 &&
                      "Let's start with the basics to personalize your workspace."}
                    {step === 2 &&
                      "Add your physical address and contact information."}
                    {step === 3 &&
                      "Configure the classes, sessions, and operational hours."}
                    {step === 4 &&
                      "Select a plan that perfectly scales with your institution."}
                  </p>
                </div>

                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-10 rounded-[2rem] shadow-2xl">
                  {/* --- STEP 1 --- */}
                  {step === 1 && (
                    <div className="space-y-8">
                      <div className="flex gap-10">
                        <div className="shrink-0">
                          <label className="text-sm font-bold text-zinc-300 mb-3 block">
                            School Logo{" "}
                            <span className="text-zinc-500 font-normal">
                              (Optional)
                            </span>
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleLogoUpload}
                          />
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            onClick={() => fileInputRef.current?.click()}
                            className="w-36 h-36 rounded-3xl border-2 border-dashed border-white/20 hover:border-violet-500/50 hover:bg-violet-500/10 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-white/5 overflow-hidden relative group"
                          >
                            {logoUrl ? (
                              <>
                                <img
                                  src={logoUrl}
                                  alt="Logo"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition-opacity">
                                  Change
                                </div>
                              </>
                            ) : isUploading ? (
                              <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
                            ) : (
                              <>
                                <UploadCloud className="w-8 h-8 text-violet-400 mb-1" />
                                <span className="text-xs font-bold text-zinc-300">
                                  Upload Logo
                                </span>
                              </>
                            )}
                          </motion.div>
                        </div>
                        <div className="flex-1 space-y-6">
                          <div>
                            <label className="text-sm font-bold text-zinc-300 mb-2 block">
                              School Name{" "}
                              <span className="text-violet-400">*</span>
                            </label>
                            <input
                              {...register("name")}
                              placeholder="Delhi Public School"
                              className="w-full h-14 px-5 rounded-2xl border border-white/10 bg-white/5 focus:outline-none focus:border-violet-500 focus:bg-white/10 transition-all font-medium text-white text-lg"
                            />
                            {errors.name && (
                              <p className="text-xs text-red-400 mt-2">
                                {errors.name.message}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="text-sm font-bold text-zinc-300 mb-2 block">
                              Workspace Subdomain{" "}
                              <span className="text-violet-400">*</span>
                            </label>
                            <div className="flex">
                              <input
                                {...register("subdomain")}
                                placeholder="dps"
                                className="flex-1 h-14 px-5 rounded-l-2xl border border-white/10 border-r-0 bg-white/5 focus:outline-none focus:border-violet-500 focus:bg-white/10 transition-all font-medium text-white text-lg"
                              />
                              <div className="h-14 px-6 flex items-center justify-center bg-white/10 border border-white/10 border-l-0 rounded-r-2xl text-zinc-400 font-medium">
                                .schoolos.com
                              </div>
                            </div>
                            <div className="mt-2 h-4">
                              {subdomainStatus === "available" && (
                                <p className="text-xs text-emerald-400 flex items-center">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />{" "}
                                  Available
                                </p>
                              )}
                              {subdomainStatus === "taken" && (
                                <p className="text-xs text-red-400 flex items-center">
                                  <X className="w-3 h-3 mr-1" /> Taken
                                </p>
                              )}
                              {errors.subdomain && (
                                <p className="text-xs text-red-400">
                                  {errors.subdomain.message}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-zinc-300 mb-3 block">
                          Institution Type{" "}
                          <span className="text-violet-400">*</span>
                        </label>
                        <div className="grid grid-cols-5 gap-4">
                          {SCHOOL_TYPES.map((type) => (
                            <motion.div
                              whileHover={{ y: -2 }}
                              key={type.id}
                              onClick={() => setValue("schoolType", type.id)}
                              className={`cursor-pointer rounded-2xl border-2 p-4 flex flex-col items-center gap-3 transition-all ${watch("schoolType") === type.id ? "border-violet-500 bg-violet-500/20 text-white shadow-lg shadow-violet-500/20" : "border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400"}`}
                            >
                              <type.icon className="w-7 h-7" />
                              <span className="text-xs font-bold text-center">
                                {type.id}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="text-sm font-bold text-zinc-300 mb-2 block">
                            Expected Students{" "}
                            <span className="text-violet-400">*</span>
                          </label>
                          <input
                            type="number"
                            {...register("expectedStudents")}
                            placeholder="1500"
                            className="w-full h-14 px-5 rounded-2xl border border-white/10 bg-white/5 focus:outline-none focus:border-violet-500 font-medium text-white"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-zinc-300 mb-2 block">
                            Expected Staff{" "}
                            <span className="text-violet-400">*</span>
                          </label>
                          <input
                            type="number"
                            {...register("expectedStaff")}
                            placeholder="80"
                            className="w-full h-14 px-5 rounded-2xl border border-white/10 bg-white/5 focus:outline-none focus:border-violet-500 font-medium text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* --- STEP 2 --- */}
                  {step === 2 && (
                    <div className="space-y-8">
                      <div>
                        <label className="text-sm font-bold text-zinc-300 mb-2 block">
                          Street Address{" "}
                          <span className="text-violet-400">*</span>
                        </label>
                        <input
                          {...register("address")}
                          placeholder="01, Near Railway Station, Main Road"
                          className="w-full h-14 px-5 rounded-2xl border border-white/10 bg-white/5 focus:outline-none focus:border-violet-500 font-medium text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="text-sm font-bold text-zinc-300 mb-2 block">
                            Pincode <span className="text-violet-400">*</span>
                          </label>
                          <input
                            {...register("pincode")}
                            maxLength={6}
                            onChange={handlePincodeChange}
                            placeholder="832401"
                            className="w-full h-14 px-5 rounded-2xl border border-white/10 bg-white/5 focus:outline-none focus:border-violet-500 font-medium text-white"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-zinc-300 mb-2 block">
                            City / District{" "}
                            <span className="text-violet-400">*</span>
                          </label>
                          <input
                            {...register("city")}
                            placeholder="Seraikela-Kharsawan"
                            className="w-full h-14 px-5 rounded-2xl border border-white/10 bg-white/5 focus:outline-none focus:border-violet-500 font-medium text-white"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-zinc-300 mb-2 block">
                            State <span className="text-violet-400">*</span>
                          </label>
                          <input
                            {...register("state")}
                            placeholder="Jharkhand"
                            className="w-full h-14 px-5 rounded-2xl border border-white/10 bg-white/5 focus:outline-none focus:border-violet-500 font-medium text-white"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-zinc-300 mb-2 block">
                            Country <span className="text-violet-400">*</span>
                          </label>
                          <input
                            {...register("country")}
                            placeholder="India"
                            className="w-full h-14 px-5 rounded-2xl border border-white/10 bg-white/5 focus:outline-none focus:border-violet-500 font-medium text-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/10">
                        <div>
                          <label className="text-sm font-bold text-zinc-300 mb-2 block">
                            Official Phone{" "}
                            <span className="text-violet-400">*</span>
                          </label>
                          <div className="flex">
                            <div className="h-14 px-4 flex items-center justify-center bg-white/10 border border-white/10 border-r-0 rounded-l-2xl text-zinc-300 font-bold">
                              +91
                            </div>
                            <input
                              {...register("phone")}
                              placeholder="9304738536"
                              className="flex-1 h-14 px-5 rounded-r-2xl border border-white/10 bg-white/5 focus:outline-none focus:border-violet-500 font-medium text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-bold text-zinc-300 mb-2 block">
                            Official Email{" "}
                            <span className="text-violet-400">*</span>
                          </label>
                          <input
                            {...register("email")}
                            placeholder="support@dmps.com"
                            className="w-full h-14 px-5 rounded-2xl border border-white/10 bg-white/5 focus:outline-none focus:border-violet-500 font-medium text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* --- STEP 3 --- */}
                  {step === 3 && (
                    <div className="space-y-8">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="text-sm font-bold text-zinc-300 mb-2 block">
                            Academic Session{" "}
                            <span className="text-violet-400">*</span>
                          </label>
                          <select
                            {...register("academicSession")}
                            className="w-full h-14 px-5 rounded-2xl border border-white/10 bg-[#121214] focus:outline-none focus:border-violet-500 font-medium text-white appearance-none"
                          >
                            <option value="2026 - 2027">2026 - 2027</option>
                            <option value="2025 - 2026">2025 - 2026</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-bold text-zinc-300 mb-2 block">
                            Board / Affiliation{" "}
                            <span className="text-violet-400">*</span>
                          </label>
                          <select
                            {...register("board")}
                            className="w-full h-14 px-5 rounded-2xl border border-white/10 bg-[#121214] focus:outline-none focus:border-violet-500 font-medium text-white appearance-none"
                          >
                            {BOARDS.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <label className="text-sm font-bold text-zinc-300 block">
                            Classes Offered{" "}
                            <span className="text-violet-400">*</span>
                          </label>
                          <div className="flex gap-4">
                            <button
                              type="button"
                              onClick={() =>
                                setValue("classes", CLASSES, {
                                  shouldValidate: true,
                                })
                              }
                              className="text-xs font-bold text-violet-400 hover:text-violet-300"
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setValue("classes", [], {
                                  shouldValidate: true,
                                })
                              }
                              className="text-xs font-bold text-zinc-500 hover:text-zinc-300"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {CLASSES.map((c) => {
                            const isSelected = selectedClasses.includes(c);
                            return (
                              <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                key={c}
                                onClick={() => toggleClass(c)}
                                className={`cursor-pointer px-4 py-2 rounded-xl border text-sm font-bold transition-all ${isSelected ? "bg-violet-500 border-violet-500 text-white shadow-lg shadow-violet-500/30" : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"}`}
                              >
                                {c}
                              </motion.div>
                            );
                          })}
                        </div>
                        {errors.classes && (
                          <p className="text-xs text-red-400 mt-2">
                            {errors.classes.message}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-8 pt-4 border-t border-white/10">
                        <div>
                          <label className="text-sm font-bold text-zinc-300 mb-4 block">
                            School Shift{" "}
                            <span className="text-violet-400">*</span>
                          </label>
                          <div className="flex gap-4">
                            <motion.div
                              whileHover={{ y: -2 }}
                              onClick={() => setValue("schoolShift", "SINGLE")}
                              className={`flex-1 cursor-pointer rounded-2xl border p-4 flex flex-col items-center gap-2 transition-all ${watch("schoolShift") === "SINGLE" ? "border-violet-500 bg-violet-500/20 text-white" : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"}`}
                            >
                              <Sun className="w-6 h-6" />{" "}
                              <span className="text-sm font-bold">Single</span>
                            </motion.div>
                            <motion.div
                              whileHover={{ y: -2 }}
                              onClick={() =>
                                setValue("schoolShift", "MULTIPLE")
                              }
                              className={`flex-1 cursor-pointer rounded-2xl border p-4 flex flex-col items-center gap-2 transition-all ${watch("schoolShift") === "MULTIPLE" ? "border-violet-500 bg-violet-500/20 text-white" : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"}`}
                            >
                              <Moon className="w-6 h-6" />{" "}
                              <span className="text-sm font-bold">
                                Multiple
                              </span>
                            </motion.div>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-bold text-zinc-300 mb-4 block">
                            Working Days{" "}
                            <span className="text-violet-400">*</span>
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {WORKING_DAYS.map((d) => {
                              const isSelected =
                                selectedWorkingDays.includes(d);
                              return (
                                <motion.div
                                  whileHover={{ scale: 1.05 }}
                                  key={d}
                                  onClick={() => toggleDay(d)}
                                  className={`cursor-pointer w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${isSelected ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30" : "bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10"}`}
                                >
                                  {d.slice(0, 2)}
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* --- STEP 4 --- */}
                  {step === 4 && (
                    <div className="space-y-8">
                      <div className="grid md:grid-cols-3 gap-6">
                        {PLANS.map((plan) => (
                          <motion.div
                            whileHover={{ y: -5 }}
                            key={plan.id}
                            onClick={() => setSelectedPlan(plan.id)}
                            className={`relative p-8 rounded-3xl border transition-all cursor-pointer bg-white/5 backdrop-blur-sm flex flex-col ${selectedPlan === plan.id ? "border-violet-500 ring-2 ring-violet-500/50 bg-violet-500/10" : "border-white/10 hover:bg-white/10"}`}
                          >
                            {plan.popular && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-violet-500/50">
                                Popular
                              </div>
                            )}
                            <h3 className="font-black text-2xl text-white mb-2">
                              {plan.name}
                            </h3>
                            <p className="text-xs text-zinc-400 h-10">
                              {plan.description}
                            </p>
                            <div className="my-6">
                              <span className="text-4xl font-black text-white">
                                {plan.price}
                              </span>
                              <span className="text-sm font-bold text-zinc-500">
                                {" "}
                                / mo
                              </span>
                            </div>
                            <ul className="space-y-4 flex-1 mb-8">
                              {plan.features.map((feature, i) => (
                                <li
                                  key={i}
                                  className="flex items-start text-sm font-medium text-zinc-300"
                                >
                                  <Check className="w-5 h-5 text-violet-400 mr-3 shrink-0" />{" "}
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                            <div
                              className={`w-full py-4 rounded-xl font-bold text-sm text-center transition-colors ${selectedPlan === plan.id ? "bg-violet-500 text-white shadow-lg shadow-violet-500/50" : "bg-white/10 text-white"}`}
                            >
                              {selectedPlan === plan.id
                                ? "Selected"
                                : "Choose Plan"}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Floating Action Bar */}
          <div className="fixed bottom-0 right-0 left-[340px] p-8 flex justify-between items-center z-50 pointer-events-none">
            <div className="pointer-events-auto">
              {step > 1 && (
                <motion.button
                  whileHover={{ x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => paginate(-1)}
                  className="px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center gap-2 backdrop-blur-md transition-all"
                >
                  <ArrowLeft className="w-5 h-5" /> Back
                </motion.button>
              )}
            </div>
            <div className="pointer-events-auto">
              {step < 4 ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => paginate(1)}
                  className="px-10 py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-bold flex items-center gap-2 shadow-xl shadow-violet-500/30 transition-all"
                >
                  Continue <ArrowRight className="w-5 h-5" />
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className="px-12 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold flex items-center gap-2 shadow-xl shadow-emerald-500/30 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Complete Setup"
                  )}
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
