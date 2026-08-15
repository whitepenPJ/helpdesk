"use client";

import { useState } from "react";
import Script from "next/script";

// AdminLTE 4 dropped Select2 in favor of Tom Select, but still ships a
// styling-only compatibility theme (adminlte-select2.css) for projects that
// bring their own Select2 — see AdminLTE-master/dist/docs/integrations.html.
// jQuery must load before select2.js; afterInteractive doesn't guarantee
// order, so this chains them via onLoad like VendorScripts/DashboardCharts.
type Stage = "jquery" | "select2" | "done";
const NEXT_STAGE: Record<Stage, Stage> = { jquery: "select2", select2: "done", done: "done" };

export function FormVendorScripts() {
  const [stage, setStage] = useState<Stage>("jquery");
  const advance = () => setStage((s) => NEXT_STAGE[s]);

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.1.0/dist/css/select2.min.css" />
      <link rel="stylesheet" href="/adminlte/css/adminlte-select2.min.css" />
      <Script
        src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"
        strategy="afterInteractive"
        onLoad={advance}
      />
      {(stage === "select2" || stage === "done") && (
        <Script
          src="https://cdn.jsdelivr.net/npm/select2@4.1.0/dist/js/select2.min.js"
          strategy="afterInteractive"
          onLoad={advance}
        />
      )}
    </>
  );
}
