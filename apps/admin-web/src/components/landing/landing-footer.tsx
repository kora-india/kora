"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, ShieldCheck } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 text-slate-600 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-slate-200 text-sm">
          {/* Brand Column */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center p-1.5 shadow-sm group-hover:scale-105 transition-transform">
                <Image
                  src="/kora-icon.png"
                  alt="Kora"
                  width={28}
                  height={28}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="font-extrabold text-lg text-slate-900 tracking-tight">
                  Kora
                </span>
                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-md bg-violet-100 text-violet-700">
                  2.0
                </span>
              </div>
            </Link>
            <p className="text-slate-500 text-xs leading-relaxed max-w-sm">
              School Management, Made Simple. Built specifically for school
              leaders, principals, and administrative teams who want less
              paperwork and more control.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Safe & Secure Education Platform</span>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Product
            </p>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <a
                  href="#why-kora"
                  className="hover:text-violet-600 transition-colors"
                >
                  Why Kora
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-violet-600 transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  className="hover:text-violet-600 transition-colors"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="hover:text-violet-600 transition-colors"
                >
                  Pricing
                </a>
              </li>
              <li>
                <a
                  href="#faq"
                  className="hover:text-violet-600 transition-colors"
                >
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Company Links */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Company
            </p>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <Link
                  href="/"
                  className="hover:text-violet-600 transition-colors"
                >
                  About Kora
                </Link>
              </li>
              <li>
                <a
                  href="#final-cta"
                  className="hover:text-violet-600 transition-colors"
                >
                  Contact
                </a>
              </li>
              <li>
                <Link
                  href="/"
                  className="hover:text-violet-600 transition-colors"
                >
                  Careers
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-violet-600 transition-colors"
                >
                  Admin Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Support & Legal */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Support & Legal
            </p>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <a
                  href="#final-cta"
                  className="hover:text-violet-600 transition-colors"
                >
                  Help Center
                </a>
              </li>
              <li>
                <a
                  href="#final-cta"
                  className="hover:text-violet-600 transition-colors"
                >
                  Contact Support
                </a>
              </li>
              <li>
                <Link
                  href="/"
                  className="hover:text-violet-600 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/"
                  className="hover:text-violet-600 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} Kora Inc. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Built with care for progressive schools.
          </p>
        </div>
      </div>
    </footer>
  );
}
