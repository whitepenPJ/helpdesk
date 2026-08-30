"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import type { TicketStatus, Priority } from "@/app/generated/prisma/client";
import { getChartTheme, contrastDataLabelStyle } from "../../_components/chart-theme";

declare global {
  interface Window {
    ApexCharts: new (el: Element, options: Record<string, unknown>) => { render: () => void };
  }
}

// Mirrors dashboard-charts.tsx's colors so a status/priority reads
// consistently between Dashboard and Report.
const STATUS_COLOR: Record<TicketStatus, string> = {
  NEW: "#6c757d",
  ASSIGNED: "#0dcaf0",
  RESOLVED: "#0d6efd",
  REOPENED: "#ffc107",
  CLOSED: "#212529",
  WAITING: "#dc3545",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  LOW: "#6c757d",
  MEDIUM: "#0dcaf0",
  HIGH: "#ffc107",
  URGENT: "#dc3545",
};

export type ReportChartsProps = {
  trend: { date: string; created: number; closed: number }[];
  statusBreakdown: { status: TicketStatus; count: number }[];
  priorityBreakdown: { priority: Priority; count: number }[];
};

function renderCharts(props: ReportChartsProps) {
  const ApexCharts = window.ApexCharts;
  const { mode, foreColor, gridColor } = getChartTheme();

  const trendEl = document.querySelector("#report-trend-chart");
  if (trendEl) {
    new ApexCharts(trendEl, {
      series: [
        { name: "Created", data: props.trend.map((p) => p.created) },
        { name: "Closed", data: props.trend.map((p) => p.closed) },
      ],
      chart: { height: 220, type: "area", toolbar: { show: false }, background: "transparent", foreColor },
      theme: { mode },
      grid: { borderColor: gridColor },
      legend: { show: true, position: "top" },
      colors: ["#0d6efd", "#198754"],
      dataLabels: { enabled: false },
      stroke: { curve: "smooth", width: 2 },
      xaxis: { type: "datetime", categories: props.trend.map((p) => p.date) },
      tooltip: { x: { format: "d MMM" } },
    }).render();
  }

  const statusEl = document.querySelector("#report-status-donut-chart");
  const statusData = props.statusBreakdown.filter((s) => s.count > 0);
  if (statusEl && statusData.length > 0) {
    const colors = statusData.map((s) => STATUS_COLOR[s.status]);
    new ApexCharts(statusEl, {
      series: statusData.map((s) => s.count),
      chart: { type: "donut", height: 260, background: "transparent", foreColor },
      theme: { mode },
      labels: statusData.map((s) => s.status),
      colors,
      dataLabels: { enabled: true, ...contrastDataLabelStyle(colors) },
      legend: { position: "bottom" },
    }).render();
  } else if (statusEl) {
    statusEl.innerHTML = '<p class="text-secondary text-center mb-0 py-5">No tickets match these filters.</p>';
  }

  const priorityEl = document.querySelector("#report-priority-bar-chart");
  const priorityData = props.priorityBreakdown.filter((p) => p.count > 0);
  if (priorityEl && priorityData.length > 0) {
    const colors = priorityData.map((p) => PRIORITY_COLOR[p.priority]);
    new ApexCharts(priorityEl, {
      series: [{ name: "Tickets", data: priorityData.map((p) => p.count) }],
      chart: { type: "bar", height: 260, toolbar: { show: false }, background: "transparent", foreColor },
      theme: { mode },
      grid: { borderColor: gridColor },
      plotOptions: { bar: { horizontal: true, distributed: true, borderRadius: 4 } },
      colors,
      dataLabels: { enabled: true, ...contrastDataLabelStyle(colors) },
      legend: { show: false },
      xaxis: { categories: priorityData.map((p) => p.priority) },
    }).render();
  } else if (priorityEl) {
    priorityEl.innerHTML = '<p class="text-secondary text-center mb-0 py-5">No tickets match these filters.</p>';
  }
}

export function ReportCharts(props: ReportChartsProps) {
  // Seeded from the live global rather than assuming it still needs
  // loading: if ApexCharts was already loaded by an earlier page in this
  // session (e.g. Dashboard), next/script's onLoad won't reliably re-fire
  // for the already-cached <script> tag on this fresh mount — same fix
  // already applied to FormVendorScripts this session.
  const [loaded, setLoaded] = useState(() => typeof window !== "undefined" && Boolean(window.ApexCharts));

  useEffect(() => {
    if (loaded) renderCharts(props);
    // Chart data is static per page load (server-rendered from the current
    // filters) — only re-run when the load-gate itself flips.
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
