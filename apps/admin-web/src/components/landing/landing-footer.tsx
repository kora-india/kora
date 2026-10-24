import Image from "next/image";
import Link from "next/link";
import { NAV_LINKS } from "./landing-content";

export function LandingFooter() {
  return (
    <footer className="border-t border-violet-100 bg-[#faf9ff]">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 md:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))] lg:px-8">
        <div className="max-w-sm">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            aria-label="Kora home"
          >
            <Image
              src="/kora-icon.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
            <span className="text-lg font-extrabold tracking-tight text-slate-950">
              Kora
            </span>
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            School management for students, staff, fees, attendance, exams and
            transport, in one simple place.
          </p>
        </div>
        <nav aria-label="Product">
          <p className="text-sm font-semibold text-slate-900">Product</p>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="hover:text-violet-700">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Account">
          <p className="text-sm font-semibold text-slate-900">Get started</p>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>
              <Link href="/register" className="hover:text-violet-700">
                Start free trial
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-violet-700">
                Log in
              </Link>
            </li>
            <li>
              <Link href="/forgot-password" className="hover:text-violet-700">
                Reset your password
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-violet-100">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Kora. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
