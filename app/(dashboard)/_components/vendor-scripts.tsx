"use client";

import { useState } from "react";
import Script from "next/script";

// `afterInteractive` scripts don't guarantee relative load order, but these
// do have a real dependency chain (bootstrap needs popper; adminlte.js
// needs bootstrap's Dropdown/Collapse), so each stage only renders once the
// previous one's onLoad has fired.
const SIDEBAR_SCROLLBARS_SCRIPT = `
(() => {
  const sidebarWrapper = document.querySelector('.sidebar-wrapper');
  const isMobile = window.innerWidth <= 992;
  if (sidebarWrapper && globalThis.OverlayScrollbarsGlobal?.OverlayScrollbars !== undefined && !isMobile) {
    globalThis.OverlayScrollbarsGlobal.OverlayScrollbars(sidebarWrapper, {
      scrollbars: {
        theme: 'os-theme-light',
        autoHide: 'leave',
        clickScroll: true,
      },
    });
  }
})();
`;

type Stage = "overlayscrollbars" | "popper" | "bootstrap" | "adminlte" | "done";

const NEXT_STAGE: Record<Stage, Stage> = {
  overlayscrollbars: "popper",
  popper: "bootstrap",
  bootstrap: "adminlte",
  adminlte: "done",
  done: "done",
};

export function VendorScripts() {
  const [stage, setStage] = useState<Stage>("overlayscrollbars");
  const advance = () => setStage((s) => NEXT_STAGE[s]);

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/overlayscrollbars@2.11.0/browser/overlayscrollbars.browser.es6.min.js"
        strategy="afterInteractive"
        onLoad={advance}
      />
      {(stage === "popper" || stage === "bootstrap" || stage === "adminlte" || stage === "done") && (
        <Script
          src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.8/dist/umd/popper.min.js"
          strategy="afterInteractive"
          onLoad={advance}
        />
      )}
      {(stage === "bootstrap" || stage === "adminlte" || stage === "done") && (
        <Script
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.min.js"
          strategy="afterInteractive"
          onLoad={advance}
        />
      )}
      {(stage === "adminlte" || stage === "done") && (
        <Script src="/adminlte/js/adminlte.min.js" strategy="afterInteractive" onLoad={advance} />
      )}
      {stage === "done" && (
        <Script id="sidebar-scrollbars" strategy="afterInteractive">
          {SIDEBAR_SCROLLBARS_SCRIPT}
        </Script>
      )}
    </>
  );
}
