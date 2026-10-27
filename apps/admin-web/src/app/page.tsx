import { existsSync } from "fs";
import path from "path";
import { LandingNav } from "@/components/landing/landing-nav";
import { HeroSection } from "@/components/landing/hero-section";
import { ModuleStrip } from "@/components/landing/module-strip";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { FactsBand } from "@/components/landing/facts-band";
import { HowItWorks } from "@/components/landing/how-it-works";
import { PricingSection } from "@/components/landing/pricing-section";
import { FaqSection } from "@/components/landing/faq-section";
import { CtaBand } from "@/components/landing/cta-band";
import { LandingFooter } from "@/components/landing/landing-footer";
import { getPlanCatalog } from "@/lib/plan-catalog";

// Plans come from the database: rebuilt when the super admin saves a plan
// (see updatePlan), and at least every five minutes.
export const revalidate = 300;

// The feature section's photo: drop a transparent cut-out at one of these
// paths in /public and it's used on the next build.
const PHOTO_PATHS = [
  "/landing/student.png",
  "/landing/student.webp",
  "/landing/student.jpg",
];

function featurePhoto() {
  return (
    PHOTO_PATHS.find((p) =>
      existsSync(path.join(process.cwd(), "public", p)),
    ) ?? null
  );
}

export default async function Home() {
  const plans = await getPlanCatalog();
  return (
    <div className="min-h-screen overflow-x-hidden bg-white font-sans text-slate-900 antialiased selection:bg-violet-200 selection:text-violet-950">
      <LandingNav />
      <main>
        <HeroSection />
        <ModuleStrip />
        <FeatureShowcase photoSrc={featurePhoto()} />
        <FactsBand plans={plans} />
        <HowItWorks />
        <PricingSection plans={plans} />
        <FaqSection plans={plans} />
        <CtaBand plans={plans} />
      </main>
      <LandingFooter />
    </div>
  );
}
