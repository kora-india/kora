"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { usePathname } from "next/navigation";
import { Tour, ConfigProvider, theme as antTheme } from "antd";
import { useTheme } from "next-themes";
import { getTourConfigForRoute } from "./tour-configs";

interface TourContextValue {
  isOpen: boolean;
  currentStep: number;
  startTour: (routeOverride?: string) => void;
  closeTour: () => void;
  setCurrentStep: (step: number) => void;
  pageTitle: string;
  hasTour: boolean;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}

interface TourProviderProps {
  children: React.ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const pathname = usePathname() || "/dashboard";
  const { resolvedTheme } = useTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeRouteOverride, setActiveRouteOverride] = useState<string | null>(
    null,
  );
  const [isMounted, setIsMounted] = useState(false);

  const activeRoute = activeRouteOverride || pathname;
  const tourConfig = useMemo(
    () => getTourConfigForRoute(activeRoute),
    [activeRoute],
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // When pathname changes, reset route override and close if open
  useEffect(() => {
    setActiveRouteOverride(null);
    setIsOpen(false);
    setCurrentStep(0);
  }, [pathname]);

  // First-time onboarding trigger for dashboard
  useEffect(() => {
    if (!isMounted) return;

    // Check if user has seen the onboarding tour
    const storageKey = `kora_tour_completed_${pathname.replace(/\//g, "_")}`;
    const hasSeenTour = localStorage.getItem(storageKey);

    // On /dashboard, offer automatic start on first visit after slight delay
    if (!hasSeenTour && pathname === "/dashboard") {
      const timer = setTimeout(() => {
        setIsOpen(true);
        setCurrentStep(0);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isMounted, pathname]);

  const startTour = useCallback((routeOverride?: string) => {
    if (routeOverride) {
      setActiveRouteOverride(routeOverride);
    } else {
      setActiveRouteOverride(null);
    }
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
    // Mark as completed in localStorage
    const storageKey = `kora_tour_completed_${activeRoute.replace(/\//g, "_")}`;
    try {
      localStorage.setItem(storageKey, "true");
      // Also maintain backward-compatible legacy key
      if (activeRoute === "/dashboard") {
        localStorage.setItem("hasSeenOnboarding", "true");
      }
    } catch {
      // Ignore localStorage errors (e.g. private mode)
    }
  }, [activeRoute]);

  const isDark = isMounted && resolvedTheme === "dark";

  return (
    <TourContext.Provider
      value={{
        isOpen,
        currentStep,
        startTour,
        closeTour,
        setCurrentStep,
        pageTitle: tourConfig.pageTitle,
        hasTour: tourConfig.steps.length > 0,
      }}
    >
      {children}

      {isMounted && (
        <ConfigProvider
          theme={{
            algorithm: isDark
              ? antTheme.darkAlgorithm
              : antTheme.defaultAlgorithm,
            token: {
              colorPrimary: "#7c3aed", // violet-600
              borderRadius: 12,
              colorBgElevated: isDark ? "#18181b" : "#ffffff",
              colorText: isDark ? "#f4f4f5" : "#09090b",
              colorTextSecondary: isDark ? "#a1a1aa" : "#71717a",
            },
          }}
        >
          <Tour
            open={isOpen}
            current={currentStep}
            onChange={(step) => setCurrentStep(step)}
            onClose={closeTour}
            onFinish={closeTour}
            steps={tourConfig.steps}
            mask={{
              color: isDark ? "rgba(0, 0, 0, 0.75)" : "rgba(0, 0, 0, 0.45)",
            }}
          />
        </ConfigProvider>
      )}
    </TourContext.Provider>
  );
}
