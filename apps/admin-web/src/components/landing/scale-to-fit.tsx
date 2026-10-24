"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Draws its children at a fixed design size and scales them down to the
 * available width, so a detailed mockup stays crisp at any screen size.
 * Hidden until measured, so it never shows at the wrong size.
 */
export function ScaleToFit({
  width,
  height,
  className,
  children,
}: Readonly<{
  width: number;
  height: number;
  className?: string;
  children: React.ReactNode;
}>) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: "relative",
        height: height * (scale ?? 1),
        visibility: scale === null ? "hidden" : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          transform: `scale(${scale ?? 1})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
