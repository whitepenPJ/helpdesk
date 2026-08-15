import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { THEME_INIT_SCRIPT } from "@/app/lib/theme-init-script";

export const metadata: Metadata = {
  title: {
    template: "%s | Helpdesk",
    default: "Helpdesk",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
};

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@fontsource/source-sans-3@5.0.12/index.css"
          integrity="sha256-tXJfXfp6Ewt1ilPzLDtQnJV4hclT9XuaZUKyUvmyr+Q="
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href="/adminlte/css/adminlte.min.css" />
      </head>
      {/* .login-page centers the box; identical rules to .register-page, reused across this route group */}
      <body className="login-page bg-body-secondary" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
