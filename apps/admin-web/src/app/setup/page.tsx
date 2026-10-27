import type { Metadata } from "next";
import { SetupWizard } from "@/components/setup/setup-wizard";
import { getPlanCatalog } from "@/lib/plan-catalog";

export const metadata: Metadata = {
  title: "Set up your school",
};

export default async function SetupSchoolPage() {
  return <SetupWizard plans={await getPlanCatalog()} />;
}
