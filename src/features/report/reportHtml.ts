import type { Report } from '@/domain/report/buildReport';
import { palette } from '@/ui/tokens';

export type ReportSection = {
  key: string;
  heading: string;
  rows: { label: string; value: string }[];
};

/** One figure for a stat tile: what it counts, and the count. */
export type ReportStat = { label: string; value: string };

export type ReportLabels = {
  /** "Moraki report — Ella", and the window it covers. */
  title: string;
  subtitle: string;
  /** The window's counts, drawn as tiles (G reports/report, reports/pdf). */
  stats: ReportStat[];
  /** Section headings and rows, already translated. */
  sections: ReportSection[];
  /** The per-day table: its heading, headers, then one row of cells per day. */
  table: { heading: string; headers: string[]; rows: string[][] } | null;
  footer: string;
};

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const row = (label: string, value: string) =>
  `<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`;

/**
 * The Moraki mark (brand/logos/mark), drawn in the logo's own colour. Shapes
 * only: it carries no words, so screen readers skip it.
 */
const mark = (colour: string) =>
  `<svg class="mark" viewBox="11 19 78 62" aria-hidden="true">` +
  `<path d="M16 76V48a13 13 0 0 1 26 0v28M58 76V48a13 13 0 0 1 26 0v28" fill="none" stroke="${colour}" stroke-width="10" stroke-linecap="round"/>` +
  `<circle cx="50" cy="26" r="7" fill="${colour}"/></svg>`;

/**
 * The printable report (SDD 6.5, G reports/pdf): plain HTML that expo-print
 * renders into a PDF on the device, so nothing leaves the phone to make one.
 * Every string arrives already translated — this builds no copy of its own
 * and adds no figure the report didn't have.
 *
 * G's layout in the system font (decision G6): the title with the mark top
 * right, the counts in outlined boxes, the app's sections, then the days grid.
 * Dark text on white whatever the night mode, and no section split across a
 * page break.
 */
export function reportHtml(report: Report, labels: ReportLabels, lang: string): string {
  const stats =
    `<section data-section="stats" class="stats">` +
    labels.stats
      .map(
        (s) =>
          `<div class="stat"><div class="label">${escape(s.label)}</div>` +
          `<div class="value">${escape(s.value)}</div></div>`,
      )
      .join('') +
    `</section>`;

  const sections = labels.sections
    .filter((section) => section.rows.length > 0)
    .map(
      (section) =>
        `<section data-section="${escape(section.key)}"><h2>${escape(section.heading)}</h2>` +
        `<table>${section.rows.map((r) => row(r.label, r.value)).join('')}</table></section>`,
    )
    .join('');

  const table =
    labels.table === null
      ? ''
      : `<section data-section="days"><h2>${escape(labels.table.heading)}</h2><table class="days">` +
        `<thead><tr>${labels.table.headers.map((h) => `<th>${escape(h)}</th>`).join('')}</tr></thead>` +
        `<tbody>${labels.table.rows
          .map((cells) => `<tr>${cells.map((c) => `<td>${escape(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></section>`;

  // Print colours: the G day palette on white paper, whatever the night mode.
  const { ink, textSoft: soft, line, card: paper, logo } = palette.light;

  return `<!DOCTYPE html>
<html lang="${escape(lang)}">
<head>
<meta charset="utf-8">
<title>${escape(labels.title)}</title>
<style>
  @page { margin: 15mm 16mm; }
  body { margin: 0; font-family: -apple-system, Roboto, sans-serif; font-size: 13px; font-weight: 500; color: ${ink}; background: ${paper}; font-variant-numeric: tabular-nums; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  h1 { font-size: 26px; font-weight: 700; margin: 0; }
  p.subtitle { margin: 2px 0 0; font-size: 15px; font-weight: 600; color: ${soft}; }
  .mark { width: 50px; height: 40px; flex-shrink: 0; }
  h2 { font-size: 15px; font-weight: 700; margin: 0 0 6px; }
  section { page-break-inside: avoid; margin-top: 24px; }
  .stats { display: flex; flex-wrap: wrap; gap: 10px; }
  .stat { flex: 1 1 0; min-width: 90px; border: 1px solid ${line}; border-radius: 14px; padding: 12px 14px; }
  .stat .label { font-size: 12px; font-weight: 600; color: ${soft}; }
  .stat .value { font-size: 22px; font-weight: 700; }
  table { border-collapse: collapse; width: 100%; }
  th, td { height: 38px; border-top: 1px solid ${line}; padding: 0 8px 0 0; vertical-align: middle; }
  th { text-align: left; font-weight: 600; color: ${soft}; width: 55%; }
  table.days thead th { height: auto; border-top: none; padding-bottom: 6px; font-size: 12px; width: auto; }
  table.days td { width: auto; }
  table.days th:first-child, table.days td:first-child { width: 22%; }
  footer { margin-top: 24px; border-top: 1px solid ${line}; padding-top: 12px; font-size: 12px; font-weight: 600; color: ${soft}; }
</style>
</head>
<body>
<header><div><h1>${escape(labels.title)}</h1>
<p class="subtitle">${escape(labels.subtitle)}</p></div>${mark(logo)}</header>
${stats}${sections}${table}
<footer>${escape(labels.footer)}</footer>
</body>
</html>`;
}

/** The range a report covers, for a file name a person can recognise. */
export function reportFileName(report: Report, babySlug: string): string {
  const day = new Date(report.to).toISOString().slice(0, 10);
  return `moraki-${babySlug || 'report'}-${report.range}-${day}.pdf`;
}
