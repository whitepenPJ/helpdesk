"use client";

import { useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    jQuery?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (target: unknown): any;
      fn: Record<string, unknown>;
    };
  }
}

// AdminLTE 4 dropped Select2 in favor of Tom Select, but still ships a
// styling-only compatibility theme (adminlte-select2.css) for projects that
// bring their own Select2 — see AdminLTE-master/dist/docs/integrations.html.
// jQuery must load before select2.js/fileinput.js; afterInteractive doesn't
// guarantee order, so this gates them behind jQuery's onLoad like
// VendorScripts/DashboardCharts. select2 and fileinput don't depend on each
// other, only on jQuery, so once it's loaded both can load in parallel.
export function FormVendorScripts({
  select2 = true,
  fileInput = false,
}: {
  select2?: boolean;
  fileInput?: boolean;
} = {}) {
  // Seeded from the live global, not just `false`: this component remounts
  // fresh (new useState) on every page that renders it, but jQuery/select2/
  // fileinput load once into `window` for the whole browser session. If an
  // earlier page already loaded them (e.g. Select2 on a list page, then a
  // client-side nav to this form), next/script's onLoad for that
  // already-cached <script> tag doesn't reliably re-fire on this new
  // instance — so state driven only by onLoad can get stuck false forever,
  // and the scripts gated behind it below would never even be requested,
  // leaving Select2/the file picker as a plain unstyled control. Checking
  // the actual runtime evidence instead avoids depending on that replay.
  const [jqueryLoaded, setJqueryLoaded] = useState(() => typeof window !== "undefined" && Boolean(window.jQuery));
  // The bs5 theme script mutates `$.fn.fileinput`'s registered themes object,
  // so it has to run strictly after fileinput.js sets that up — sibling
  // afterInteractive scripts don't guarantee order, so this is chained too.
  const [fileInputCoreLoaded, setFileInputCoreLoaded] = useState(
    () => typeof window !== "undefined" && Boolean(window.jQuery?.fn.fileinput)
  );

  return (
    <>
      {select2 && (
        <>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.1.0/dist/css/select2.min.css" />
          <link rel="stylesheet" href="/adminlte/css/adminlte-select2.min.css" />
        </>
      )}
      {fileInput && (
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-fileinput@5.5.4/css/fileinput.min.css" />
      )}
      <Script
        src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"
        strategy="afterInteractive"
        onLoad={() => setJqueryLoaded(true)}
      />
      {jqueryLoaded && select2 && (
        <Script src="https://cdn.jsdelivr.net/npm/select2@4.1.0/dist/js/select2.min.js" strategy="afterInteractive" />
      )}
      {jqueryLoaded && fileInput && (
        <Script
          src="https://cdn.jsdelivr.net/npm/bootstrap-fileinput@5.5.4/js/fileinput.min.js"
          strategy="afterInteractive"
          onLoad={() => setFileInputCoreLoaded(true)}
        />
      )}
      {fileInputCoreLoaded && (
        // Krajee's default markup targets Bootstrap 4; the bs5 theme script adapts it to this app's Bootstrap 5.
        <Script
          src="https://cdn.jsdelivr.net/npm/bootstrap-fileinput@5.5.4/themes/bs5/theme.min.js"
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
