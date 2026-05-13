import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "SchoolOS — Modern School Management Platform", description: "Premium multi-tenant school ERP SaaS" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
