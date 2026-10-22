"use client";

import { useEffect, useState } from "react";
import { SetupSchema } from "./setup-model";

export type SubdomainStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "error";

export const SUBDOMAIN_CHECK_DELAY_MS = 400;

/**
 * Asks the server whether a well-formed subdomain is free, once typing pauses.
 * "error" means we couldn't tell; creating the school checks again.
 */
export function useSubdomainCheck(subdomain: string | undefined) {
  const [status, setStatus] = useState<SubdomainStatus>("idle");
  const isWellFormed =
    !!subdomain && SetupSchema.shape.subdomain.safeParse(subdomain).success;

  useEffect(() => {
    if (!isWellFormed) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("checking");
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch("/api/school/check-subdomain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subdomain }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || typeof data.available !== "boolean") {
          setStatus("error");
        } else {
          setStatus(data.available ? "available" : "taken");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }, SUBDOMAIN_CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [subdomain, isWellFormed]);

  return [status, setStatus] as const;
}
