// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { Joyride, STATUS, Step } from "react-joyride";

export function DashboardTour() {
  const [run, setRun] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const hasSeenTour = localStorage.getItem("hasSeenOnboarding");
    if (!hasSeenTour) {
      // Delay slightly to ensure UI is rendered
      setTimeout(() => setRun(true), 1500);
    }
  }, []);

  const steps: Step[] = [
    {
      target: "body",
      content: "Welcome to SchoolOS! Let's take a quick tour to help you get started.",
      placement: "center",
    },
    {
      target: "#tour-nav-classes",
      content: "First, you'll want to create Classes and Sections. This is the foundation of your school structure.",
      placement: "right",
    },
    {
      target: "#tour-nav-students",
      content: "Once classes are ready, you can start admitting Students and assigning them to their respective sections.",
      placement: "right",
    },
    {
      target: "#tour-nav-fees",
      content: "Set up Fee Components (e.g. Tuition, Transport) and Fee Structures to manage collections.",
      placement: "right",
    },
    {
      target: "#tour-nav-teachers",
      content: "Add your teaching staff and assign them to classes here.",
      placement: "right",
    },
  ];

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem("hasSeenOnboarding", "true");
    }
  };

  if (!isClient) return null;

  return (
    // @ts-ignore
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: "#7c3aed", // violet-600
          zIndex: 1000,
        },
        buttonClose: {
          display: "none",
        },
      } as any}
    />
  );
}
