"use client";

import { SessionProvider } from "next-auth/react";
import { Suspense } from "react";
import { TopLoader } from "@/components/layout/top-loader";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Suspense fallback={null}>
        <TopLoader />
      </Suspense>
      {children}
    </SessionProvider>
  );
}

