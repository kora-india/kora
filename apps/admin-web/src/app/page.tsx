import { LandingNav } from "@/components/landing/landing-nav";
import { HeroSection } from "@/components/landing/hero-section";
import { BentoGrid } from "@/components/landing/bento-grid";
import { FeatureTabs } from "@/components/landing/feature-tabs";
import { PricingSection } from "@/components/landing/pricing-section";
import { FaqSection } from "@/components/landing/faq-section";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#07070d] text-white selection:bg-violet-500/30 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Sticky Glass Navbar */}
      <LandingNav />

      {/* Main Sections */}
      <main>
        {/* Hero Section */}
        <HeroSection />

        {/* Magic UI Bento Grid Skeleton Dashboard */}
        <BentoGrid />

        {/* Feature Deep Dive Interactive Tabs */}
        <FeatureTabs />

        {/* Transparent Flat Pricing */}
        <PricingSection />

        {/* Frequently Asked Questions */}
        <FaqSection />
      </main>

      {/* Footer & Final Spotlight CTA */}
      <LandingFooter />
    </div>
  );
}
