"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import type { CategoryReportRow } from "@/app/lib/category-report-data";
import { getChartTheme } from "../../../_components/chart-theme";

declare global {
  interface Window {
    ApexCharts: new (el: Element, options: Record<string, unknown>) => { render: () => void };
  }
}

const TOP_N = 15;

function renderChart(rows: CategoryReportRow[]) {
  const ApexCharts = window.ApexCharts;
  const el = document.querySelector("#category-report-chart");
  if (!el) return;

  const top = rows.slice(0, TOP_N);
  if (top.length === 0) {
    el.innerHTML = '<p class="text-secondary text-center mb-0 py-5">No categories match these filters.</p>';
    return;
  }

  const { mode, foreColor, gridColor } = getChartTheme();
  new ApexCharts(el, {
    series: [
      { name: "Active", data: top.map((r) => r.active) },
      { name: "Processing", data: top.map((r) => r.processing) },
      { name: "Done", data: top.map((r) => r.done) },
    ],
    chart: { type: "bar", height: 360, stacked: true, toolbar: { show: false }, background: "transparent", foreColor },
    theme: { mode },
    grid: { borderColor: gridColor },
    plotOptions: { bar: { horizontal: true, borderRadius: 3 } },
    colors: ["#0dcaf0", "#dc3545", "#198754"],
    dataLabels: { enabled: false },
    legend: { position: "top" },
    xaxis: { categories: top.map((r) => r.categoryName) },
  }).render();
}

export function CategoryReportCharts({ rows }: { rows: CategoryReportRow[] }) {
  const [loaded, setLoaded] = useState(() => typeof window !== "undefined" && Boolean(window.ApexCharts));

  useEffect(() => {
    if (loaded) renderChart(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/apexcharts@3.37.1/dist/apexcharts.css"
        integrity="sha256-4MX+61mt9NVvvuPjUWdUdyfZfxSB1/Rf9WtqRHgG5S0="
        crossOrigin="anonymous"
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/apexcharts@3.37.1/dist/apexcharts.min.js"
        integrity="sha256-+vh8GkaU7C9/wbSLIcwq82tQ2wTf44aOHA8HlBMwRI8="
        crossOrigin="anonymous"
        strategy="afterInteractive"
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}
