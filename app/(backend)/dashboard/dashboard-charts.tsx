"use client";

import Script from "next/script";
import type { TrendPoint } from "@/app/lib/dashboard-data";
import type { TicketStatus, Priority } from "@/app/generated/prisma/client";
import { getChartTheme, contrastDataLabelStyle } from "../_components/chart-theme";

declare global {
  interface Window {
    ApexCharts: new (el: Element, options: Record<string, unknown>) => { render: () => void };
  }
}

// Mirrors the Bootstrap semantic colors behind ticket-badges.ts's
// STATUS_BADGE / PRIORITY_BADGE classes, so the charts read consistently
// with every badge elsewhere in the app.
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

export type DashboardChartsProps = {
  trend: TrendPoint[];
  statusBreakdown: { status: TicketStatus; count: number }[];
  priorityBreakdown: { priority: Priority; count: number }[];
};

function renderCharts(props: DashboardChartsProps) {
  const ApexCharts = window.ApexCharts;
  const { mode, foreColor, gridColor } = getChartTheme();

  const trendEl = document.querySelector("#ticket-trend-chart");
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
      xaxis: {
        type: "datetime",
        categories: props.trend.map((p) => p.date),
      },
      tooltip: { x: { format: "d MMM" } },
    }).render();
  }

  const statusEl = document.querySelector("#status-donut-chart");
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
    statusEl.innerHTML = '<p class="text-secondary text-center mb-0 py-5">No tickets yet.</p>';
  }

  const priorityEl = document.querySelector("#priority-bar-chart");
  const priorityData = props.priorityBreakdown;
  if (priorityEl) {
    const colors = priorityData.map((p) => PRIORITY_COLOR[p.priority]);
    new ApexCharts(priorityEl, {
      series: [{ name: "Open tickets", data: priorityData.map((p) => p.count) }],
      chart: { type: "bar", height: 260, toolbar: { show: false }, background: "transparent", foreColor },
      theme: { mode },
      grid: { borderColor: gridColor },
      plotOptions: { bar: { horizontal: true, distributed: true, borderRadius: 4 } },
      colors,
      dataLabels: { enabled: true, ...contrastDataLabelStyle(colors) },
      legend: { show: false },
      xaxis: { categories: priorityData.map((p) => p.priority) },
    }).render();
  }
}

export function DashboardCharts(props: DashboardChartsProps) {
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
        onLoad={() => renderCharts(props)}
      />
    </>
  );
}
