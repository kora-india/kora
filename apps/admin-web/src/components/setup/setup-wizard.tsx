"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@schoolos/utils";
import { PLANS, TRIAL_PLAN, type PaidPlanId } from "@/lib/plans";
import {
  LAST_STEP,
  STEPS,
  SetupSchema,
  academicSessionOptions,
  footerCopy,
  getStep,
  readDraft,
  readSavedPayment,
  setupDefaults,
  writeDraft,
  writeSavedPayment,
  type PlanChoice,
  type SavedPayment,
  type SetupField,
  type SetupInput,
  type StepId,
} from "./setup-model";
import { primaryButtonCls, secondaryButtonCls } from "./setup-fields";
import { openDashboard } from "./navigation";
import { SetupRail } from "./setup-rail";
import { SetupProgress, StarterDataRecovery } from "./setup-status-screens";
import { useSubdomainCheck } from "./use-subdomain-check";
import { ProfileStep } from "./steps/profile-step";
import { LocationStep } from "./steps/location-step";
import { AcademicStep } from "./steps/academic-step";
import { PlanStep } from "./steps/plan-step";

export const DRAFT_SAVE_DELAY_MS = 300;

export function SetupWizard() {
  const { data: session, update } = useSession();
  const userId = session?.user?.id;
  const sessionEmail = session?.user?.email ?? "";

  const form = useForm<SetupInput>({
    resolver: zodResolver(SetupSchema),
    mode: "onTouched",
    defaultValues: setupDefaults(sessionEmail),
  });
  const { getValues, setValue, trigger, setFocus, getFieldState } = form;

  const [step, setStep] = useState<StepId>(1);
  const [furthestStep, setFurthestStep] = useState<StepId>(1);
  const [choice, setChoice] = useState<PlanChoice>("TRIAL");
  const [savedPayment, setSavedPayment] = useState<SavedPayment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [starterDataError, setStarterDataError] = useState<string | null>(null);
  const [isRetryingStarterData, setIsRetryingStarterData] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useSubdomainCheck(
    form.watch("subdomain"),
  );

  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterStep = useRef<"heading" | SetupField | null>(null);
  const hasRestored = useRef(false);
  const isCreated = useRef(false);

  // Resume where this user left off: their answers and any setup payment.
  useEffect(() => {
    if (!userId || hasRestored.current) return;
    hasRestored.current = true;
    const draft = readDraft(userId);
    if (draft) {
      form.reset({ ...setupDefaults(sessionEmail), ...draft.values });
      setStep(draft.step);
      setFurthestStep(draft.step);
    }
    const payment = readSavedPayment(userId);
    if (payment) {
      setSavedPayment(payment);
      setChoice(payment.plan);
    }
  }, [userId, sessionEmail, form]);

  // U6: the session may load after the form; fill the email once it does.
  useEffect(() => {
    if (sessionEmail && !getValues("email")) {
      setValue("email", sessionEmail);
    }
  }, [sessionEmail, getValues, setValue]);

  useEffect(() => {
    if (!userId || !hasRestored.current) return;
    const save = () => {
      if (!isCreated.current) writeDraft(userId, { step, values: getValues() });
    };
    save();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const subscription = form.watch(() => {
      clearTimeout(timeout);
      timeout = setTimeout(save, DRAFT_SAVE_DELAY_MS);
    });
    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [userId, step, form, getValues]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => script.remove();
  }, []);

  // Keep focused fields clear of the sticky header and footer.
  useEffect(() => {
    const root = document.documentElement;
    root.style.scrollPaddingTop = "4.5rem";
    root.style.scrollPaddingBottom = "5.5rem";
    return () => {
      root.style.scrollPaddingTop = "";
      root.style.scrollPaddingBottom = "";
    };
  }, []);

  useEffect(() => {
    const target = focusAfterStep.current;
    focusAfterStep.current = null;
    if (target === "heading") headingRef.current?.focus();
    else if (target) setFocus(target);
  }, [step, setFocus]);

  const show = (target: StepId, focus: "heading" | SetupField = "heading") => {
    focusAfterStep.current = focus;
    setStep(target);
    setFurthestStep((f) => Math.max(f, target) as StepId);
  };

  const validateStep = async (s: StepId, focus: boolean) => {
    const ok = await trigger(getStep(s).fields, { shouldFocus: focus });
    if (ok && s === 1 && subdomainStatus === "taken") {
      if (focus) setFocus("subdomain");
      return false;
    }
    return ok;
  };

  /** Moves to a step; going forward validates every step on the way. */
  const goTo = async (target: StepId) => {
    if (target <= step) {
      show(target);
      return;
    }
    for (let s: number = step; s < target; s++) {
      if (!(await validateStep(s as StepId, s === step))) {
        if (s !== step) show(s as StepId);
        return;
      }
    }
    show(target);
  };

  const markSubdomainTaken = () => {
    setSubdomainStatus("taken");
    show(1, "subdomain");
  };

  const rememberPayment = (payment: SavedPayment | null) => {
    setSavedPayment(payment);
    if (userId) writeSavedPayment(userId, payment);
  };

  /** Creates the school; `extra` carries the payment or the trial flag. */
  const createSchool = async (extra: Record<string, unknown>) => {
    setIsProvisioning(true);
    try {
      const values = getValues();
      const res = await fetch("/api/school/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          logoUrl: values.logoUrl || undefined,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "SUBDOMAIN_TAKEN") markSubdomainTaken();
        throw new Error(data.error || "We couldn't create your school.");
      }
      isCreated.current = true;
      rememberPayment(null);
      if (userId) writeDraft(userId, null);
      await update({ schoolId: data.schoolId });
      if (data.starterDataError) {
        // U6: say so and offer a retry instead of opening an empty school.
        setStarterDataError(data.starterDataError);
        setIsProvisioning(false);
        return;
      }
      toast.success("School created!");
      openDashboard();
    } catch (err: any) {
      toast.error(err.message);
      setIsSubmitting(false);
      setIsProvisioning(false);
    }
  };

  const pay = async (plan: PaidPlanId) => {
    try {
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, subdomain: getValues("subdomain") }),
      });
      const orderData = await orderRes.json();
      if (orderRes.status === 409) markSubdomainTaken();
      if (!orderRes.ok) {
        throw new Error(orderData.error || "We couldn't start the payment.");
      }
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) {
        throw new Error(
          "The payment window didn't load. Check your connection and try again.",
        );
      }
      const checkout = new Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Kora",
        description: `${PLANS[plan].name} plan`,
        order_id: orderData.orderId,
        handler: async (response: any) => {
          const payment: SavedPayment = {
            plan,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          };
          // Kept before anything can fail, so a retry reuses it.
          rememberPayment(payment);
          await createSchool({ ...payment });
        },
        prefill: {
          name: session?.user?.name || "",
          email: session?.user?.email || "",
          contact: getValues("phone"),
        },
        theme: { color: "#7c3aed" },
        modal: { ondismiss: () => setIsSubmitting(false) },
      });
      checkout.open();
    } catch (err: any) {
      toast.error(err.message);
      setIsSubmitting(false);
    }
  };

  const finish = async () => {
    if (isSubmitting) return;
    if (!(await trigger())) {
      const invalid = STEPS.find((s) =>
        s.fields.some((f) => getFieldState(f).invalid),
      );
      if (invalid) show(invalid.id);
      toast.error("A few details need fixing before you continue.");
      return;
    }
    if (subdomainStatus === "taken") {
      markSubdomainTaken();
      return;
    }
    setIsSubmitting(true);
    // U3: already paid; finish with that payment rather than a new checkout.
    if (savedPayment) await createSchool({ ...savedPayment });
    else if (choice === "TRIAL") {
      await createSchool({ plan: TRIAL_PLAN, trial: true });
    } else await pay(choice);
  };

  const retryStarterData = async () => {
    setIsRetryingStarterData(true);
    try {
      const res = await fetch("/api/school/starter-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classes: getValues("classes"),
          academicSession: getValues("academicSession"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That didn't work either.");
      toast.success("Classes and session added");
      openDashboard();
    } catch (err: any) {
      toast.error(err.message);
      setIsRetryingStarterData(false);
    }
  };

  const current = getStep(step);
  const sessionValue = getValues("academicSession");
  const sessionLabel =
    academicSessionOptions().find((s) => s.value === sessionValue)?.label ??
    sessionValue;

  const footer = footerCopy({
    step,
    choice,
    hasSavedPayment: Boolean(savedPayment),
    isSubmitting,
  });

  return (
    <FormProvider {...form}>
      {starterDataError && (
        <StarterDataRecovery
          message={starterDataError}
          isRetrying={isRetryingStarterData}
          onRetry={retryStarterData}
          onSkip={openDashboard}
        />
      )}
      {isProvisioning && (
        <SetupProgress
          schoolName={getValues("name")}
          sessionLabel={sessionLabel}
          classCount={getValues("classes")?.length ?? 0}
        />
      )}

      <div className="flex min-h-screen bg-zinc-50 selection:bg-violet-200 selection:text-violet-950 dark:bg-zinc-950 dark:selection:bg-violet-500/40 dark:selection:text-white">
        <SetupRail
          step={step}
          furthestStep={furthestStep}
          onStepSelect={goTo}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur-sm sm:px-8">
            <div className="flex items-center gap-2 border-r pr-3 lg:hidden">
              <Image
                src="/kora-icon.png"
                alt="Kora"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
              />
              <span className="text-sm font-bold tracking-tight">Kora</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Step{" "}
              <span className="font-medium text-foreground">
                {step} of {STEPS.length}
              </span>
              <span className="hidden sm:inline"> · {current.label}</span>
            </p>
            <div className="ml-auto flex items-center gap-3">
              {session?.user?.email && (
                <span className="hidden max-w-[16rem] truncate text-xs text-muted-foreground md:block">
                  {session.user.email}
                </span>
              )}
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Your answers stay saved on this device"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Sign out
              </button>
            </div>
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-0.5 bg-border lg:hidden"
            >
              <div
                className="h-full bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${(step / STEPS.length) * 100}%` }}
              />
            </div>
          </header>

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (step < LAST_STEP) goTo((step + 1) as StepId);
            }}
            className="flex flex-1 flex-col"
          >
            <main className="flex-1 px-4 py-8 sm:px-8 lg:py-12">
              <div
                key={step}
                className="mx-auto max-w-4xl animate-slide-up motion-reduce:animate-none"
              >
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="scroll-mt-20 text-2xl font-bold tracking-tight focus:outline-none"
                >
                  {current.title}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {current.intro}
                </p>
                <div className="mt-8 space-y-6">
                  {step === 1 && (
                    <ProfileStep subdomainStatus={subdomainStatus} />
                  )}
                  {step === 2 && <LocationStep />}
                  {step === 3 && <AcademicStep />}
                  {step === 4 && (
                    <PlanStep
                      choice={choice}
                      onChoiceChange={setChoice}
                      savedPayment={savedPayment}
                      onEdit={goTo}
                    />
                  )}
                </div>
              </div>
            </main>

            <footer className="sticky bottom-0 z-20 border-t bg-card/95 px-4 backdrop-blur-sm sm:px-8">
              <div className="mx-auto flex max-w-4xl items-center gap-3 py-3">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => goTo((step - 1) as StepId)}
                    disabled={isSubmitting}
                    className={secondaryButtonCls}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Back
                  </button>
                )}
                <p className="ml-auto hidden text-right text-xs text-muted-foreground sm:block">
                  {footer.note}
                </p>
                {step < LAST_STEP ? (
                  <button
                    type="submit"
                    className={cn(primaryButtonCls, "ml-auto sm:ml-0")}
                  >
                    {footer.label}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={finish}
                    disabled={isSubmitting}
                    className={cn(primaryButtonCls, "ml-auto sm:ml-0")}
                  >
                    {isSubmitting && (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    )}
                    {footer.label}
                  </button>
                )}
              </div>
            </footer>
          </form>
        </div>
      </div>
    </FormProvider>
  );
}
