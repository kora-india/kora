import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";
import { brandHex, brandStyleSheet } from "@schoolos/types";
import { OfflineSupport } from "@/components/layout/offline-support";
import { ColorModeSync } from "@/components/layout/color-mode-sync";
import { getAppearance } from "@/lib/appearance";

export const metadata: Metadata = {
  title: "Kora Teacher",
  description: "Teacher attendance and class management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kora",
  },
};

export async function generateViewport(): Promise<Viewport> {
  const { themeColor } = await getAppearance();
  return {
    // The phone's status bar takes the school's color.
    themeColor: brandHex(themeColor),
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { themeColor, colorMode } = await getAppearance();
  const brandStyles = brandStyleSheet(themeColor);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {brandStyles && (
          <style dangerouslySetInnerHTML={{ __html: brandStyles }} />
        )}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <ColorModeSync saved={colorMode} />
          {children}
          <OfflineSupport />
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
