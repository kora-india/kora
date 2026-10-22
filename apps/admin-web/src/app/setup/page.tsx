import type { Metadata } from "next";
import { SetupWizard } from "@/components/setup/setup-wizard";

export const metadata: Metadata = {
  title: "Set up your school",
};

export default function SetupSchoolPage() {
  return <SetupWizard />;
}
