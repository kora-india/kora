"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@schoolos/utils";
import {
  formatPlanPrice,
  getPlan,
  paidPlansByPrice,
  type PaidPlanId,
  type PlanCatalog,
} from "@/lib/plans";

interface BillingStatus {
  plan: string;
  isTrial: boolean;
  isPastDue: boolean;
  isExpired: boolean;
  /** null when the plan has no end date. */
  daysRemaining: number | null;
  trialEndsAt: string | null;
  periodEnd: string | null;
}

interface Props {
  /** The live plan catalogue (`getPlanCatalog()`). */
  plans: PlanCatalog;
  schoolName: string;
  /** Only the school admin pays; other staff see the status. */
  canPay: boolean;
  status: BillingStatus;
  suggestedPlan: PaidPlanId | null;
}

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

function statusLine(status: BillingStatus, plans: PlanCatalog) {
  const planName = getPlan(plans, status.plan).name;
  const days = status.daysRemaining ?? 0;
  if (status.isExpired) {
    return {
      tone: "expired" as const,
      title: "Your plan has ended",
      detail:
        "Choose a plan to get back in. Your students, classes and fee records are kept safe.",
    };
  }
  if (status.isTrial) {
    return {
      tone: "trial" as const,
      title: `Free trial · ${days} day${days === 1 ? "" : "s"} left`,
      detail: `Ends ${formatDate(status.trialEndsAt)}. Choose a plan any time; your paid month starts when the trial ends.`,
    };
  }
  if (status.isPastDue) {
    return {
      tone: "due" as const,
      title: `${planName} · payment due`,
      detail: `Your paid month has ended. Renew within ${days} day${days === 1 ? "" : "s"} to keep access.`,
    };
  }
  return {
    tone: "active" as const,
    title: `${planName} plan`,
    detail: status.periodEnd
      ? `Paid until ${formatDate(status.periodEnd)}. Paying now adds a month after that.`
      : "Active.",
  };
}

const TONES = {
  expired:
    "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200",
  trial:
    "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-200",
  due: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
};

export function BillingContent({
  plans,
  schoolName,
  canPay,
  status,
  suggestedPlan,
}: Readonly<Props>) {
  const [payingPlan, setPayingPlan] = useState<PaidPlanId | null>(null);
  const line = statusLine(status, plans);
  const currentPaid = !status.isTrial && !status.isExpired;

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const pay = async (plan: PaidPlanId) => {
    setPayingPlan(plan);
    try {
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, purpose: "RENEWAL" }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok)
        throw new Error(order.error || "Couldn't start the payment");

      const Razorpay = (window as any).Razorpay;
      if (!Razorpay)
        throw new Error(
          "The payment window didn't load. Refresh and try again.",
        );

      new Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "Kora",
        description: `${plans[plan].name} plan · 1 month`,
        order_id: order.orderId,
        handler: async (response: any) => {
          try {
            const res = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const data = await res.json();
            if (!res.ok)
              throw new Error(data.error || "We couldn't confirm the payment");
            toast.success(`${plans[plan].name} plan is active`);
            window.location.href = "/dashboard";
          } catch (err: any) {
            toast.error(
              `${err.message}. If you were charged, contact billing@kora.app with payment ID ${response.razorpay_payment_id}.`,
              { duration: 15000 },
            );
            setPayingPlan(null);
          }
        },
        theme: { color: "#7c3aed" },
        modal: { ondismiss: () => setPayingPlan(null) },
      }).open();
    } catch (err: any) {
      toast.error(err.message);
      setPayingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {schoolName}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              Plan & billing
            </h1>
          </div>
          {!status.isExpired && (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Link>
          )}
        </div>

        <div
          className={cn("rounded-2xl border p-5 flex gap-3", TONES[line.tone])}
        >
          <Clock className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{line.title}</p>
            <p className="text-sm opacity-90 mt-0.5">{line.detail}</p>
          </div>
        </div>

        {!canPay && (
          <p className="text-sm text-muted-foreground">
            Only your school admin can choose or pay for a plan.
          </p>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {paidPlansByPrice(plans).map((plan) => {
            const { id } = plan;
            const isCurrent = currentPaid && status.plan === id;
            const highlighted = suggestedPlan
              ? suggestedPlan === id
              : plan.popular;
            return (
              <div
                key={id}
                className={cn(
                  "rounded-2xl border bg-card p-6 flex flex-col",
                  highlighted && "border-violet-500 ring-1 ring-violet-500/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">{plan.name}</h2>
                  {isCurrent && (
                    <span className="text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-0.5">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {plan.tagline}
                </p>
                <p className="mt-4">
                  <span className="text-3xl font-bold">
                    {formatPlanPrice(plan)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {" "}
                    / month
                  </span>
                </p>
                <ul className="mt-5 space-y-2.5 text-sm flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={!canPay || payingPlan !== null}
                  onClick={() => pay(id)}
                  className={cn(
                    "mt-6 h-11 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    highlighted
                      ? "bg-violet-600 hover:bg-violet-700 text-white"
                      : "border hover:bg-muted",
                  )}
                >
                  {payingPlan === id
                    ? "Opening payment…"
                    : isCurrent
                      ? "Pay for another month"
                      : `Choose ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Paid monthly through Razorpay. Nothing renews automatically.
        </p>
      </div>
    </div>
  );
}
