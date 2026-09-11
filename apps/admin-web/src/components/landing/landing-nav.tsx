"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Menu, X, Sparkles, Laptop } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DownloadModal } from "./download-modal";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center p-1.5 shadow-sm group-hover:scale-105 transition-transform duration-300">
            <Image
              src="/kora-icon.png"
              alt="Kora"
              width={32}
              height={32}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-slate-900">
                Kora
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-violet-100 text-violet-700">
                2.0
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium -mt-0.5 hidden sm:block">
              School Management, Made Simple
            </span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
          <a
            href="#why-kora"
            className="hover:text-violet-600 transition-colors"
          >
            Why Kora
          </a>
          <a
            href="#features"
            className="hover:text-violet-600 transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="hover:text-violet-600 transition-colors"
          >
            How It Works
          </a>
          <a
            href="#pricing"
            className="hover:text-violet-600 transition-colors"
          >
            Pricing
          </a>
          <a
            href="#testimonials"
            className="hover:text-violet-600 transition-colors"
          >
            Testimonials
          </a>
          <a href="#faq" className="hover:text-violet-600 transition-colors">
            FAQ
          </a>
        </nav>

        {/* Right CTA Links */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            onClick={() => setDownloadOpen(true)}
            className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-xl transition-colors hover:bg-slate-100 flex items-center gap-1.5"
          >
            <Laptop className="w-4 h-4 text-violet-600" />
            <span>Download</span>
          </button>

          <Link
            href="/login"
            className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-4 py-2 rounded-xl transition-colors hover:bg-slate-100"
          >
            Admin Login
          </Link>

          <Link
            href="/register"
            className="relative group overflow-hidden px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-md shadow-violet-500/20 hover:shadow-violet-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2"
          >
            <span>Start Free Trial</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b border-slate-200 bg-white/95 backdrop-blur-2xl px-6 py-6 space-y-4 shadow-lg"
          >
            <div className="flex flex-col gap-3 text-base font-semibold text-slate-700">
              <a
                href="#why-kora"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-violet-600 transition-colors"
              >
                Why Kora
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-violet-600 transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-violet-600 transition-colors"
              >
                How It Works
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-violet-600 transition-colors"
              >
                Pricing
              </a>
              <a
                href="#testimonials"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-violet-600 transition-colors"
              >
                Testimonials
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-violet-600 transition-colors"
              >
                FAQ
              </a>
            </div>
            <div className="pt-4 border-t border-slate-200 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setDownloadOpen(true);
                }}
                className="w-full text-center py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                <Laptop className="w-4 h-4 text-violet-600" />
                <span>Download App</span>
              </button>
              <Link
                href="/login"
                className="w-full text-center py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50"
              >
                Admin Login
              </Link>
              <Link
                href="/register"
                className="w-full text-center py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-md shadow-violet-500/25"
              >
                Start Free Trial
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Download Dialog */}
      <DownloadModal
        isOpen={downloadOpen}
        onClose={() => setDownloadOpen(false)}
      />
    </header>
  );
}
