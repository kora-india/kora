"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

/**
 * Manages URL query parameter synchronization for tabs.
 *
 * @param options.paramKey Name of the query parameter (defaults to "tab")
 * @param options.validTabs Array of allowed tab values
 * @param options.defaultTab Default fallback tab when query param is absent or invalid
 */
export function useQueryTab<T extends string>({
  paramKey = "tab",
  validTabs,
  defaultTab,
}: {
  paramKey?: string;
  validTabs: readonly T[] | T[];
  defaultTab: T;
}): [T, (newTab: T) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const getValidTab = useCallback((): T => {
    const raw = searchParams.get(paramKey);
    if (raw && (validTabs as T[]).includes(raw as T)) {
      return raw as T;
    }
    return defaultTab;
  }, [searchParams, paramKey, validTabs, defaultTab]);

  const [activeTab, setActiveTabState] = useState<T>(getValidTab);

  // Sync state if URL changes externally or via browser back/forward
  useEffect(() => {
    const tabFromUrl = getValidTab();
    if (tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl);
    }
  }, [getValidTab, activeTab]);

  const setActiveTab = useCallback(
    (newTab: T) => {
      setActiveTabState(newTab);
      try {
        const params = new URLSearchParams(
          typeof window !== "undefined"
            ? window.location.search
            : searchParams.toString(),
        );
        params.set(paramKey, newTab);
        const query = params.toString();
        const newUrl = query ? `${pathname}?${query}` : pathname;
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", newUrl);
        }
        router.replace(newUrl, { scroll: false });
      } catch {
        // Fallback for SSR or non-browser environments
      }
    },
    [pathname, paramKey, router, searchParams],
  );

  return [activeTab, setActiveTab];
}

/**
 * Manages an individual filter synced with the URL query parameters.
 *
 * @param key The query parameter key (e.g. "classId", "status", "q")
 * @param defaultValue Fallback value when query param is missing or cleared
 */
export function useQueryState<T extends string = string>(
  key: string,
  defaultValue: string = "",
): [T, (valOrFn: T | ((prev: T) => T)) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const getVal = useCallback((): T => {
    const p = searchParams.get(key);
    return (p !== null && p !== undefined ? p : defaultValue) as T;
  }, [searchParams, key, defaultValue]);

  const [state, setState] = useState<T>(getVal);

  useEffect(() => {
    const valFromUrl = getVal();
    if (valFromUrl !== state) {
      setState(valFromUrl);
    }
  }, [getVal, state]);

  const setQueryState = useCallback(
    (newValOrFn: T | ((prev: T) => T)) => {
      setState((prev) => {
        const newVal =
          typeof newValOrFn === "function"
            ? (newValOrFn as (p: T) => T)(prev)
            : newValOrFn;
        try {
          const params = new URLSearchParams(
            typeof window !== "undefined"
              ? window.location.search
              : searchParams.toString(),
          );
          if (!newVal || newVal === defaultValue) {
            params.delete(key);
          } else {
            params.set(key, newVal);
          }
          const query = params.toString();
          const newUrl = query ? `${pathname}?${query}` : pathname;
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", newUrl);
          }
          router.replace(newUrl, { scroll: false });
        } catch {
          // Fallback for SSR or non-browser environments
        }
        return newVal;
      });
    },
    [pathname, key, defaultValue, router, searchParams],
  );

  return [state, setQueryState];
}

/**
 * Helper hook for batch updating multiple URL query parameters at once.
 */
export function useQueryParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const getParam = useCallback(
    (key: string, defaultValue: string = "") => {
      const p = searchParams.get(key);
      return p !== null && p !== undefined ? p : defaultValue;
    },
    [searchParams],
  );

  const setParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      try {
        const params = new URLSearchParams(
          typeof window !== "undefined"
            ? window.location.search
            : searchParams.toString(),
        );
        for (const [key, value] of Object.entries(updates)) {
          if (value === null || value === undefined || value === "") {
            params.delete(key);
          } else {
            params.set(key, value);
          }
        }
        const query = params.toString();
        const newUrl = query ? `${pathname}?${query}` : pathname;
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", newUrl);
        }
        router.replace(newUrl, { scroll: false });
      } catch {
        // Fallback for SSR or non-browser environments
      }
    },
    [pathname, router, searchParams],
  );

  return { getParam, setParams, searchParams };
}
