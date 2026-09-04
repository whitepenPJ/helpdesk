import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { THEME_INIT_SCRIPT } from "@/app/lib/theme-init-script";
import { Header } from "./_components/header";
import { Sidebar } from "./_components/sidebar";
import { Footer } from "./_components/footer";
import { VendorScripts } from "./_components/vendor-scripts";

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

export default function DashboardLayout({ children }: LayoutProps<"/">) {
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
          href="https://cdn.jsdelivr.net/npm/overlayscrollbars@2.11.0/styles/overlayscrollbars.min.css"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href="/adminlte/css/adminlte.min.css" />
        {/* This project's own overrides — see styles/custom.css (source) and
            scripts/build-css.mjs (minifies it here on every build). Loaded
            last so it can override AdminLTE. */}
        <link rel="stylesheet" href="/adminlte/css/custom.min.css" />
      </head>
      <body className="layout-fixed sidebar-expand-lg bg-body-tertiary" suppressHydrationWarning>
        <div className="app-wrapper">
          <Header />
          <Sidebar />
          <main className="app-main">{children}</main>
          <Footer />
        </div>

        <VendorScripts />
      </body>
    </html>
  );
}
