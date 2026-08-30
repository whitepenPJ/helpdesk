"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import type { MonthlySatisfaction, RatingDistributionRow } from "@/app/lib/ticket-report-data";
import { getChartTheme, contrastDataLabelStyle } from "../../../_components/chart-theme";

declare global {
  interface Window {
    ApexCharts: new (el: Element, options: Record<string, unknown>) => { render: () => void };
  }
}

const RATING_COLORS = ["#dc3545", "#fd7e14", "#ffc107", "#0dcaf0", "#198754"];

function renderCharts(ratingDistribution: RatingDistributionRow[], monthly: MonthlySatisfaction[]) {
  const ApexCharts = window.ApexCharts;
  const { mode, foreColor, gridColor } = getChartTheme();

  const pieEl = document.querySelector("#ticket-report-rating-pie");
  const pieData = ratingDistribution.filter((r) => r.count > 0);
  if (pieEl && pieData.length > 0) {
    const colors = pieData.map((r) => RATING_COLORS[r.score - 1]);
    new ApexCharts(pieEl, {
      series: pieData.map((r) => r.count),
      chart: { type: "pie", height: 300, background: "transparent", foreColor },
      theme: { mode },
      labels: pieData.map((r) => `${r.label} (${r.percent.toFixed(0)}%)`),
      colors,
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${val.toFixed(0)}%`,
        ...contrastDataLabelStyle(colors),
      },
      legend: { position: "bottom" },
    }).render();
  } else if (pieEl) {
    pieEl.innerHTML = '<p class="text-secondary text-center mb-0 py-5">No rated tickets in range.</p>';
  }

  const monthEl = document.querySelector("#ticket-report-monthly-chart");
  if (monthEl && monthly.length > 0) {
    new ApexCharts(monthEl, {
      series: [{ name: "Avg Satisfaction", data: monthly.map((m) => (m.avgRating !== null ? Number(m.avgRating.toFixed(2)) : 0)) }],
      chart: { type: "bar", height: 280, toolbar: { show: false }, background: "transparent", foreColor },
      theme: { mode },
      grid: { borderColor: gridColor },
      plotOptions: { bar: { borderRadius: 4 } },
      colors: ["#0d6efd"],
      dataLabels: { enabled: true, ...contrastDataLabelStyle(monthly.map(() => "#0d6efd")) },
      yaxis: { min: 0, max: 5, title: { text: "Avg Rating (1-5)" } },
      xaxis: { categories: monthly.map((m) => m.month) },
    }).render();
  } else if (monthEl) {
    monthEl.innerHTML = '<p class="text-secondary text-center mb-0 py-5">No rated tickets in range.</p>';
  }
}

export function TicketReportCharts({
  ratingDistribution,
  monthly,
}: {
  ratingDistribution: RatingDistributionRow[];
  monthly: MonthlySatisfaction[];
}) {
  const [loaded, setLoaded] = useState(() => typeof window !== "undefined" && Boolean(window.ApexCharts));

  useEffect(() => {
    if (loaded) renderCharts(ratingDistribution, monthly);
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
