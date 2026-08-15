"use client";

import Script from "next/script";

declare global {
  interface Window {
    ApexCharts: new (el: Element, options: Record<string, unknown>) => { render: () => void };
  }
}

const SPARKLINE_DATA: Record<string, number[]> = {
  "table-sparkline-1": [25, 66, 41, 89, 63, 25, 44, 12, 36, 9, 54],
  "table-sparkline-2": [12, 56, 21, 39, 73, 45, 64, 52, 36, 59, 44],
  "table-sparkline-3": [15, 46, 21, 59, 33, 15, 34, 42, 56, 19, 64],
  "table-sparkline-4": [30, 56, 31, 69, 43, 35, 24, 32, 46, 29, 64],
  "table-sparkline-5": [20, 76, 51, 79, 53, 35, 54, 22, 36, 49, 64],
  "table-sparkline-6": [5, 36, 11, 69, 23, 15, 14, 42, 26, 19, 44],
  "table-sparkline-7": [12, 56, 21, 39, 73, 45, 64, 52, 36, 59, 74],
};

function renderCharts() {
  const ApexCharts = window.ApexCharts;

  const salesChartEl = document.querySelector("#sales-chart");
  if (salesChartEl) {
    new ApexCharts(salesChartEl, {
      series: [
        { name: "Digital Goods", data: [28, 48, 40, 19, 86, 27, 90] },
        { name: "Electronics", data: [65, 59, 80, 81, 56, 55, 40] },
      ],
      chart: { height: 180, type: "area", toolbar: { show: false } },
      legend: { show: false },
      colors: ["#0d6efd", "#20c997"],
      dataLabels: { enabled: false },
      stroke: { curve: "smooth" },
      xaxis: {
        type: "datetime",
        categories: [
          "2023-01-01",
          "2023-02-01",
          "2023-03-01",
          "2023-04-01",
          "2023-05-01",
          "2023-06-01",
          "2023-07-01",
        ],
      },
      tooltip: { x: { format: "MMMM yyyy" } },
    }).render();
  }

  for (const [id, data] of Object.entries(SPARKLINE_DATA)) {
    const el = document.querySelector(`#${id}`);
    if (!el) continue;
    new ApexCharts(el, {
      series: [{ data }],
      chart: { type: "line", width: 150, height: 30, sparkline: { enabled: true } },
      colors: ["var(--bs-primary)"],
      stroke: { width: 2 },
      tooltip: {
        fixed: { enabled: false },
        x: { show: false },
        y: { title: { formatter: () => "" } },
        marker: { show: false },
      },
    }).render();
  }

  const pieChartEl = document.querySelector("#pie-chart");
  if (pieChartEl) {
    new ApexCharts(pieChartEl, {
      series: [700, 500, 400, 600, 300, 100],
      chart: { type: "donut", height: 350 },
      labels: ["Chrome", "Edge", "FireFox", "Safari", "Opera", "IE"],
      dataLabels: { enabled: false },
      colors: ["#0d6efd", "#20c997", "#ffc107", "#d63384", "#6f42c1", "#adb5bd"],
    }).render();
  }
}

export function DashboardCharts() {
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
        onLoad={renderCharts}
      />
    </>
  );
}
