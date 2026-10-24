"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Laptop, Menu, X } from "lucide-react";
import { cn } from "@schoolos/utils";
import { DownloadModal } from "./download-modal";
import { NAV_LINKS } from "./landing-content";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200",
        scrolled || menuOpen
          ? "border-violet-100 bg-white/95 backdrop-blur-md"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          aria-label="Kora home"
        >
          <Image
            src="/kora-icon.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            priority
          />
          <span className="text-xl font-extrabold tracking-tight text-slate-950">
            Kora
          </span>
        </Link>

        <nav
          aria-label="Main"
          className="hidden flex-1 items-center justify-center gap-8 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-violet-700"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-1 md:flex">
          <button
            type="button"
            onClick={() => setDownloadOpen(true)}
            className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-violet-50 hover:text-violet-700"
          >
            <Laptop className="h-4 w-4" aria-hidden />
            Desktop app
          </button>
          <Link
            href="/login"
            className="flex h-10 items-center rounded-xl px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-violet-50 hover:text-violet-700"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="group ml-2 flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.6)] transition-colors hover:bg-violet-700"
          >
            Start free trial
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="landing-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 md:hidden"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <div
          id="landing-menu"
          className="border-t border-violet-100 bg-white px-4 pb-6 pt-2 md:hidden"
        >
          <nav aria-label="Main" className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="border-b border-slate-100 py-3 text-base font-medium text-slate-700"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-5 grid gap-2.5">
            <Link
              href="/register"
              className="flex h-11 items-center justify-center rounded-xl bg-violet-600 text-sm font-semibold text-white"
            >
              Start free trial
            </Link>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/login"
                className="flex h-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
              >
                Log in
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setDownloadOpen(true);
                }}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
              >
                <Laptop className="h-4 w-4" aria-hidden />
                Desktop app
              </button>
            </div>
          </div>
        </div>
      )}

      <DownloadModal
        isOpen={downloadOpen}
        onClose={() => setDownloadOpen(false)}
      />
    </header>
  );
}
