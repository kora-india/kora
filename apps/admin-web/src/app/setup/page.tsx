"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, MapPin, Globe, CreditCard, ChevronRight, ChevronLeft, Check, CheckCircle2 } from "lucide-react";
import { useSession } from "next-auth/react";

const SetupSchema = z.object({
  name: z.string().min(3, "School name is required"),
  subdomain: z.string().min(3, "Subdomain is required").regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens allowed"),
  expectedStudents: z.preprocess((val) => Number(val), z.number().min(1, "Expected students is required")),
  expectedStaff: z.preprocess((val) => Number(val), z.number().min(1, "Expected staff is required")),
  address: z.string().min(10, "Please provide a complete address"),
  pincode: z.string().min(6, "Please provide a valid 6-digit pincode").max(6),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  country: z.string().min(2, "Country is required"),
  phone: z.string().min(10, "Please provide a valid phone number"),
  email: z.string().email("Please provide a valid contact email"),
});

type SetupInput = z.infer<typeof SetupSchema>;

const PLANS = [
  { id: "BASIC", name: "Basic", price: "₹999/mo", features: ["Up to 500 Students", "Basic Analytics", "Standard Support"] },
  { id: "PRO", name: "Pro", price: "₹1,999/mo", features: ["Up to 2000 Students", "Advanced Analytics", "Priority Support"] },
  { id: "ENTERPRISE", name: "Enterprise", price: "₹4,999/mo", features: ["Unlimited Students", "Custom Branding", "24/7 Dedicated Support"] },
];

export default function SetupSchoolPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("PRO");

  const { register, handleSubmit, formState: { errors }, trigger, getValues, setValue, setError, clearErrors } = useForm<SetupInput>({
    resolver: zodResolver(SetupSchema),
    defaultValues: {
      email: session?.user?.email || "",
      country: "India",
    }
  });

  const [isValidatingSubdomain, setIsValidatingSubdomain] = useState(false);

  // Auto-fill address using Pincode API
  const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        } else {
          toast.error("Invalid Pincode");
        }
      } catch (err) {
        console.error("Failed to fetch pincode details", err);
      }
    }
  };

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const nextStep = async () => {
    let isValid = false;
    if (step === 1) {
      isValid = await trigger(["name", "subdomain", "expectedStudents", "expectedStaff"]);
      
      // Perform backend subdomain validation if local validation passes
      if (isValid) {
        setIsValidatingSubdomain(true);
        try {
          const res = await fetch("/api/school/check-subdomain", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subdomain: getValues("subdomain") }),
          });
          const data = await res.json();
          if (!data.available) {
            setError("subdomain", { type: "manual", message: "This subdomain is already taken" });
            toast.error("Subdomain is already taken");
            isValid = false;
          }
        } catch (err) {
          toast.error("Failed to verify subdomain");
          isValid = false;
        } finally {
          setIsValidatingSubdomain(false);
        }
      }
    } else if (step === 2) {
      isValid = await trigger(["address", "pincode", "city", "state", "country", "phone", "email"]);
    }
    
    if (isValid) setStep((s) => s + 1);
  };

  const prevStep = () => {
    setStep((s) => s - 1);
  };

  const onSubmit = async () => {
    if (step !== 3) return;
    setIsSubmitting(true);
    try {
      // 1. Create Razorpay Order
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const orderData = await orderRes.json();
      
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to create order");

      // 2. Open Razorpay Checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "SchoolOS",
        description: `${selectedPlan} Plan Subscription`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            // 3. Verify Payment & Create School
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
            if (!verifyRes.ok) throw new Error(verifyData.error || "Failed to provision school");

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
        theme: {
          color: "#7c3aed",
        },
        modal: {
          ondismiss: function () {
            setIsSubmitting(false);
          }
        }
      };

      const rzp1 = new (window as any).Razorpay(options);
      rzp1.open();
      
    } catch (error: any) {
      toast.error(error.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-3xl text-center mb-8">
        <div className="w-12 h-12 bg-violet-600 text-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-600/20">
          <Building2 className="w-6 h-6" />
        </div>
        <h2 className="text-3xl font-extrabold text-foreground tracking-tight">Let's set up your school</h2>
        <p className="mt-2 text-sm text-muted-foreground">You're just a few steps away from your new dashboard.</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-3xl">
        <div className="bg-background py-8 px-4 shadow-xl shadow-zinc-200/50 dark:shadow-none border border-zinc-200/50 dark:border-zinc-800 sm:rounded-2xl sm:px-10">
          
          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-8 relative max-w-xl mx-auto">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full z-0">
              <div 
                className="h-full bg-violet-600 rounded-full transition-all duration-300"
                style={{ width: `${((step - 1) / 2) * 100}%` }}
              />
            </div>
            {[
              { id: 1, icon: Globe, label: "Basic Info" },
              { id: 2, icon: MapPin, label: "Contact" },
              { id: 3, icon: CreditCard, label: "Plan & Pay" },
            ].map((s) => (
              <div key={s.id} className="relative z-10 flex flex-col items-center gap-2 bg-background px-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  step >= s.id 
                    ? "border-violet-600 bg-violet-600 text-white" 
                    : "border-zinc-200 dark:border-zinc-700 bg-background text-muted-foreground"
                }`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <span className={`text-xs font-medium ${step >= s.id ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Step 1 */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 max-w-xl mx-auto">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">School Name</label>
                  <input
                    {...register("name")}
                    placeholder="E.g. Delhi Public School"
                    className="w-full h-11 px-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                  />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Subdomain</label>
                  <div className="flex rounded-lg border focus-within:ring-2 focus-within:ring-violet-500 transition-colors bg-background">
                    <input
                      {...register("subdomain", {
                        onChange: () => clearErrors("subdomain")
                      })}
                      placeholder="dps"
                      className="flex-1 h-11 px-3 rounded-l-lg bg-transparent border-none focus:outline-none focus:ring-0 min-w-0"
                    />
                    <div className="flex items-center px-3 text-sm text-muted-foreground border-l bg-muted/50 rounded-r-lg whitespace-nowrap">
                      .schoolos.com
                    </div>
                  </div>
                  {errors.subdomain && <p className="text-xs text-destructive mt-1">{errors.subdomain.message}</p>}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Expected Students</label>
                    <input
                      {...register("expectedStudents")}
                      type="number"
                      placeholder="e.g. 1500"
                      className="w-full h-11 px-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                    />
                    {errors.expectedStudents && <p className="text-xs text-destructive mt-1">{errors.expectedStudents.message}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Expected Staff/Teachers</label>
                    <input
                      {...register("expectedStaff")}
                      type="number"
                      placeholder="e.g. 50"
                      className="w-full h-11 px-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                    />
                    {errors.expectedStaff && <p className="text-xs text-destructive mt-1">{errors.expectedStaff.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 max-w-xl mx-auto">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Street Address</label>
                  <textarea
                    {...register("address")}
                    placeholder="123 Education Lane..."
                    rows={2}
                    className="w-full p-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors resize-none"
                  />
                  {errors.address && <p className="text-xs text-destructive mt-1">{errors.address.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Pincode</label>
                    <input
                      type="text"
                      maxLength={6}
                      {...register("pincode")}
                      onChange={handlePincodeChange}
                      placeholder="e.g. 110001"
                      className="w-full h-11 px-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                    />
                    {errors.pincode && <p className="text-xs text-destructive mt-1">{errors.pincode.message}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">City / District</label>
                    <input
                      {...register("city")}
                      className="w-full h-11 px-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                    />
                    {errors.city && <p className="text-xs text-destructive mt-1">{errors.city.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">State</label>
                    <input
                      {...register("state")}
                      className="w-full h-11 px-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                    />
                    {errors.state && <p className="text-xs text-destructive mt-1">{errors.state.message}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Country</label>
                    <input
                      {...register("country")}
                      className="w-full h-11 px-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                    />
                    {errors.country && <p className="text-xs text-destructive mt-1">{errors.country.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Phone Number</label>
                    <input
                      {...register("phone")}
                      placeholder="+91 9876543210"
                      className="w-full h-11 px-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                    />
                    {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Contact Email</label>
                    <input
                      {...register("email")}
                      type="email"
                      className="w-full h-11 px-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                    />
                    {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="grid md:grid-cols-3 gap-4">
                  {PLANS.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative flex flex-col p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                        selectedPlan === plan.id
                          ? "border-violet-600 bg-violet-50 dark:bg-violet-900/10 shadow-lg shadow-violet-500/10"
                          : "border-zinc-200 dark:border-zinc-800 hover:border-violet-300 dark:hover:border-violet-800"
                      }`}
                    >
                      {selectedPlan === plan.id && (
                        <div className="absolute top-4 right-4 text-violet-600">
                          <CheckCircle2 className="w-6 h-6 fill-violet-100" />
                        </div>
                      )}
                      <h3 className="font-bold text-lg">{plan.name}</h3>
                      <p className="text-2xl font-black mt-2 text-violet-600 dark:text-violet-400">{plan.price}</p>
                      
                      <ul className="mt-6 space-y-3 flex-1">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start text-sm text-muted-foreground">
                            <Check className="w-4 h-4 text-violet-600 mr-2 flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-8 border-t border-zinc-100 dark:border-zinc-800 max-w-xl mx-auto">
              <button
                type="button"
                onClick={prevStep}
                disabled={step === 1 || isSubmitting}
                className="flex items-center justify-center px-4 h-10 rounded-lg font-medium text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-0 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </button>
              
              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={isValidatingSubdomain}
                  className="flex items-center justify-center px-6 h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {isValidatingSubdomain ? "Checking..." : "Continue"} <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit(onSubmit)}
                  disabled={isSubmitting}
                  className="flex items-center justify-center px-8 h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Processing..." : "Create & Pay"}
                </button>
              )}
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
