"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider, useTheme } from "next-themes";
import { ConfigProvider, theme as antTheme } from "antd";
import { useEffect, useState } from "react";

function AntdThemeAdapter({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#7c3aed",
          borderRadius: 8,
          colorBgContainer: isDark ? "#09090b" : "#ffffff",
          colorBgElevated: isDark ? "#18181b" : "#ffffff",
          colorBorder: isDark ? "#27272a" : "#e4e4e7",
          colorBorderSecondary: isDark ? "#27272a" : "#f4f4f5",
          colorText: isDark ? "#f4f4f5" : "#09090b",
          colorTextSecondary: isDark ? "#a1a1aa" : "#71717a",
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange={false}
      >
        <AntdThemeAdapter>{children}</AntdThemeAdapter>
      </ThemeProvider>
    </SessionProvider>
  );
}
