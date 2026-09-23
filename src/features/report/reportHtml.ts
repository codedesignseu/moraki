import type { Report } from '@/domain/report/buildReport';

export type ReportSection = {
  key: string;
  heading: string;
  rows: { label: string; value: string }[];
};

export type ReportLabels = {
  /** "Moraki report — Ella", and the window it covers. */
  title: string;
  subtitle: string;
  /** Section headings and rows, already translated. */
  sections: ReportSection[];
  /** The per-day table: headers, then one row of cells per day. */
  table: { headers: string[]; rows: string[][] } | null;
  footer: string;
};

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const row = (label: string, value: string) =>
  `<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`;

/**
 * The printable report (SDD 6.5): plain HTML that expo-print renders into a
 * PDF on the device, so nothing leaves the phone to make one. Every string
 * arrives already translated — this builds no copy of its own and adds no
 * figure the report didn't have.
 *
 * Styled to hold one page at 24h: system fonts, no images, and no section
 * split across a page break.
 */
export function reportHtml(report: Report, labels: ReportLabels, lang: string): string {
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
      : `<section data-section="days"><table class="days">` +
        `<thead><tr>${labels.table.headers.map((h) => `<th>${escape(h)}</th>`).join('')}</tr></thead>` +
        `<tbody>${labels.table.rows
          .map((cells) => `<tr>${cells.map((c) => `<td>${escape(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></section>`;

  return `<!DOCTYPE html>
<html lang="${escape(lang)}">
<head>
<meta charset="utf-8">
<title>${escape(labels.title)}</title>
<style>
  @page { margin: 16mm; }
  body { font-family: -apple-system, Roboto, sans-serif; font-size: 11pt; color: #2B2621; }
  h1 { font-size: 16pt; margin: 0; }
  h2 { font-size: 12pt; margin: 14pt 0 4pt; }
  p.subtitle { margin: 2pt 0 0; color: #6B635B; }
  section { page-break-inside: avoid; }
  table { border-collapse: collapse; width: 100%; }
  th { text-align: left; font-weight: 400; color: #6B635B; padding: 2pt 8pt 2pt 0; width: 55%; }
  td { padding: 2pt 0; }
  table.days th, table.days td { border-bottom: 0.5pt solid #E0DAD3; text-align: right; width: auto; }
  table.days th:first-child, table.days td:first-child { text-align: left; }
  footer { margin-top: 16pt; color: #6B635B; font-size: 9pt; }
</style>
</head>
<body>
<h1>${escape(labels.title)}</h1>
<p class="subtitle">${escape(labels.subtitle)}</p>
${sections}${table}
<footer>${escape(labels.footer)}</footer>
</body>
</html>`;
}

/** The range a report covers, for a file name a person can recognise. */
export function reportFileName(report: Report, babySlug: string): string {
  const day = new Date(report.to).toISOString().slice(0, 10);
  return `moraki-${babySlug || 'report'}-${report.range}-${day}.pdf`;
}
