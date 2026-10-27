"use client";

import React from "react";
import Link from "next/link";
import { Card, Tag, Button } from "antd";
import { formatPlanPrice, type PlanDefinition } from "@/lib/plans";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
} from "lucide-react";

interface PlanUpgradeGateProps {
  featureName: string;
  description: string;
  /** The cheapest plan with the feature (`cheapestPlanWith`); null if none has it. */
  requiredPlan: PlanDefinition | null;
  highlights: string[];
}

export function PlanUpgradeGate({
  featureName,
  description,
  requiredPlan,
  highlights,
}: PlanUpgradeGateProps) {
  return (
    <div className="p-6 md:p-12 max-w-4xl mx-auto">
      <Card className="rounded-3xl border shadow-lg overflow-hidden bg-gradient-to-b from-card via-card to-violet-50/30 dark:to-violet-950/20">
        <div className="text-center py-6 px-4">
          <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-violet-600 dark:text-violet-300 mx-auto mb-4 shadow-xs">
            <Lock className="w-7 h-7" />
          </div>

          {requiredPlan && (
            <div className="flex items-center justify-center gap-2 mb-2">
              <Tag
                color="purple"
                className="px-2.5 py-0.5 font-bold uppercase tracking-wider text-[10px]"
              >
                {requiredPlan.name} Plan Feature
              </Tag>
            </div>
          )}

          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Unlock {featureName}
          </h2>

          <p className="text-muted-foreground text-sm max-w-lg mx-auto mt-2">
            {description}
          </p>

          {/* Highlights List */}
          <div className="bg-card/80 border rounded-2xl p-6 max-w-lg mx-auto my-6 text-left space-y-3 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {requiredPlan
                ? `What's Included in ${requiredPlan.name}:`
                : "What's Included:"}
            </p>
            {highlights.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-foreground/90">
                  {item}
                </span>
              </div>
            ))}
          </div>

          {requiredPlan ? (
            <>
              {/* Pricing & CTA */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="text-left sm:text-right">
                  <p className="text-xs text-muted-foreground">Starting from</p>
                  <p className="text-xl font-bold text-foreground">
                    {formatPlanPrice(requiredPlan)} / month
                  </p>
                </div>

                <Link href={`/billing?plan=${requiredPlan.id}`}>
                  <Button
                    type="primary"
                    size="large"
                    icon={<Sparkles className="w-4 h-4" />}
                    className="bg-violet-600 hover:bg-violet-700 h-11 px-6 rounded-xl font-semibold flex items-center gap-2"
                  >
                    Upgrade to {requiredPlan.name}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>

              <p className="text-[11px] text-muted-foreground mt-4 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                Activates as soon as you pay · Billed monthly, no auto-renewal
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No plan includes this right now. Contact Kora support to get
              access.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
