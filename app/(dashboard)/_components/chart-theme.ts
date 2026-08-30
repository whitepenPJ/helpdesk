// ApexCharts defaults to light-theme text/grid colors regardless of the
// app's actual theme — left alone, dark mode renders axis/legend/data
// labels in a near-black gray that's unreadable against the dark page
// background (and a solid white chart backdrop clashing with it), which is
// the "มองไม่เห็น label" bug. Mirrors AdminLTE's own Bootstrap dark-mode
// body color (--bs-body-color, checked in adminlte.min.css) so chart text
// reads exactly like the rest of the page in both themes.
export function getChartTheme(): { mode: "light" | "dark"; foreColor: string; gridColor: string } {
  const isDark =
    typeof document !== "undefined" && document.documentElement.getAttribute("data-bs-theme") === "dark";
  return {
    mode: isDark ? "dark" : "light",
    foreColor: isDark ? "#dee2e6" : "#212529",
    gridColor: isDark ? "#495057" : "#e9ecef",
  };
}

// Distributed bar/donut/pie charts fill each segment with a different solid
// color (status/priority/rating colors spanning both light, saturated hues
// like #ffc107 and near-black ones like #212529) — a single flat data-label
// color (e.g. always white) reads fine on the dark fills but goes low-
// contrast on the light ones in light mode specifically, which is the "hard
// to read" bug. Picking black vs. white per segment from its own fill's
// relative luminance (WCAG formula) guarantees contrast against every
// color, regardless of app theme.
function relativeLuminance(hex: string): number {
  const channels = hex.replace("#", "").match(/.{2}/g) ?? ["00", "00", "00"];
  const [r, g, b] = channels.map((c) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastTextColor(hex: string): string {
  return relativeLuminance(hex) > 0.55 ? "#000000" : "#ffffff";
}

// `colors` is the same per-segment fill array passed to the chart's own
// `colors` option — pass it here too so each label is colored against its
// own segment rather than a single guess for the whole chart.
export function contrastDataLabelStyle(colors: string[]) {
  return { style: { colors: colors.map(contrastTextColor), fontWeight: 600 } };
}
