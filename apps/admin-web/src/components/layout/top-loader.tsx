"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // When route change completes, finish and reset progress bar
    if (loading) {
      setProgress(100);
      const timer = setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams, loading]);


  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading && progress < 90) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          const diff = Math.max(1, (90 - prev) * 0.15);
          return Math.min(90, prev + diff);
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [loading, progress]);

  useEffect(() => {
    // Intercept internal link clicks to start loading immediately
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.target === "_blank" ||
        target.hasAttribute("download")
      ) {
        return;
      }

      // Check if it's an internal navigation to a different path
      const currentUrl = new URL(window.location.href);
      const targetUrl = new URL(href, window.location.href);

      if (
        targetUrl.origin === currentUrl.origin &&
        (targetUrl.pathname !== currentUrl.pathname || targetUrl.search !== currentUrl.search)
      ) {
        setLoading(true);
        setProgress(20);
      }
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  if (!loading && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none transition-all duration-200 ease-out"
      style={{
        width: `${progress}%`,
        opacity: progress === 100 ? 0 : 1,
        background: "linear-gradient(90deg, #7c3aed 0%, #8b5cf6 50%, #c084fc 100%)",
        boxShadow: "0 0 10px rgba(139, 92, 246, 0.7), 0 0 5px rgba(124, 58, 237, 0.5)",
      }}
    />
  );
}
