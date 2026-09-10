import { LandingNav } from "@/components/landing/landing-nav";
import { HeroSection } from "@/components/landing/hero-section";
import { TrustBar } from "@/components/landing/trust-bar";
import { ProblemSection } from "@/components/landing/problem-section";
import { SolutionSection } from "@/components/landing/solution-section";
import { FeatureSections } from "@/components/landing/feature-sections";
import { BeforeAfterSection } from "@/components/landing/before-after-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { BenefitsSection } from "@/components/landing/benefits-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { SecurityTrust } from "@/components/landing/security-trust";
import { FaqSection } from "@/components/landing/faq-section";
import { FinalCTA } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-violet-100 selection:text-violet-900 font-sans antialiased overflow-x-hidden">
      {/* Sticky Compact Glass Header */}
      <LandingNav />

      {/* Main Marketing Narrative */}
      <main>
        {/* 1. Hero Section with Browser Preview Mockup */}
        <HeroSection />

        {/* 2. Trust Bar (Demo / Reference Schools) */}
        <TrustBar />

        {/* 3. Problem Awareness ("Still Managing Your School the Hard Way?") */}
        <ProblemSection />

        {/* 4. One Simple System Solution Overview */}
        <SolutionSection />

        {/* 5. 6 Human-Centered Feature Modules (Problem → Solution → Benefit) */}
        <FeatureSections />

        {/* 6. "From Chaos to Control" Side-by-Side Comparison */}
        <BeforeAfterSection />

        {/* 7. How It Works (3 Simple Steps) */}
        <HowItWorks />

        {/* 8. Large Benefit Cards ("More Time for What Actually Matters") */}
        <BenefitsSection />

        {/* 9. Testimonials from School Leaders */}
        <TestimonialsSection />

        {/* 10. Transparent Pricing (Starter, Growth, Enterprise) */}
        <PricingSection />

        {/* 11. Security & Data Protection (Zero Jargon) */}
        <SecurityTrust />

        {/* 12. Non-Technical Friendly FAQs */}
        <FaqSection />

        {/* 13. High-Conversion Final Call-to-Action with Demo Modal */}
        <FinalCTA />
      </main>

      {/* 14. Light Theme Footer */}
      <LandingFooter />
    </div>
  );
}
