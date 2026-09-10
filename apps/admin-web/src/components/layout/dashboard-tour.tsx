"use client";

import { useEffect, useState } from "react";
import { Tour, ConfigProvider } from "antd";
import type { TourProps } from "antd";

export function DashboardTour() {
  const [open, setOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const hasSeenTour = localStorage.getItem("hasSeenOnboarding");
    if (!hasSeenTour) {
      // Delay slightly to ensure UI is rendered
      setTimeout(() => setOpen(true), 1500);
    }
  }, []);

  const steps: TourProps["steps"] = [
    {
      title: "Welcome to Kora!",
      description: "Let's take a quick tour to help you get started.",
      target: null, // Will center on screen
    },
    {
      title: "Classes & Sections",
      description:
        "First, you'll want to create Classes and Sections. This is the foundation of your school structure.",
      target: () => document.getElementById("tour-nav-classes") as HTMLElement,
    },
    {
      title: "Students",
      description:
        "Once classes are ready, you can start admitting Students and assigning them to their respective sections.",
      target: () => document.getElementById("tour-nav-students") as HTMLElement,
    },
    {
      title: "Fees",
      description:
        "Set up Fee Components (e.g. Tuition, Transport) and Fee Structures to manage collections.",
      target: () => document.getElementById("tour-nav-fees") as HTMLElement,
    },
    {
      title: "Teachers",
      description: "Add your teaching staff and assign them to classes here.",
      target: () => document.getElementById("tour-nav-teachers") as HTMLElement,
    },
  ];

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem("hasSeenOnboarding", "true");
  };

  if (!isClient) return null;

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#7c3aed", // violet-600
        },
      }}
    >
      <Tour
        open={open}
        onClose={handleClose}
        onFinish={handleClose}
        steps={steps}
        mask={{ color: "rgba(0, 0, 0, 0.4)" }}
      />
    </ConfigProvider>
  );
}
