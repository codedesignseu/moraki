import { buildReport } from '@/domain/report/buildReport';
import type { Event, EventType } from '@/domain/activities';

import { reportFileName, reportHtml } from './reportHtml';
import { reportLabels } from './reportLabels';

const TZ = 'Europe/Nicosia';
const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-21T14:00:00+03:00');
const BORN = Date.parse('2026-10-09T06:20:00+03:00');
const BABY = { name: 'Ella', bornAt: BORN, birthWeightG: 3400 as number | null };

let n = 0;
const ev = <P>(type: EventType, at: number, payload: P): Event<P> => {
  n += 1;
  return {
    id: `e${n}`,
    householdId: 'h',
    babyId: 'b',
    type,
    occurredAt: at,
    endedAt: null,
    payload,
    groupId: null,
    createdBy: 'u',
    updatedBy: 'u',
    clientCreatedAt: at,
    deletedAt: null as number | null,
  };
};

const events: Event<unknown>[] = [
  ev('feed_bottle', NOW - 20 * HOUR, { ml: 90, milk: 'formula' }),
  ev('diaper', NOW - 19 * HOUR, { kind: 'both' }),
  ev('feed_bottle', NOW - 2 * HOUR, { ml: 100, milk: 'breast' }),
  ev('weight', NOW - HOUR, { grams: 3510, source: 'clinic' }),
  ev('health', NOW - 3 * HOUR, { temp_c: 37.2, note: 'Warm after a feed' }),
  ev('medication', NOW - 4 * HOUR, { name: 'Vitamin D', dose: '1 drop' }),
];

/** Stands in for i18next: the key back, with its values appended. */
const t = (key: string, values?: Record<string, string | number>) =>
  values === undefined ? key : `${key}(${Object.values(values).join(',')})`;
const dateTime = (at: number) => new Date(at).toISOString();

const html = (range: '24h' | '3d' | '7d' = '24h', list = events, baby = BABY) => {
  const report = buildReport(list, baby, range, NOW, TZ);
  return reportHtml(report, reportLabels(report, t, TZ, baby.name, dateTime), 'en');
};

describe('the printable report', () => {
  it('is one HTML document with the report’s title', () => {
    const out = html();
    expect(out.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(out).toContain('<title>report.pdf.title(Ella)</title>');
    expect(out.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('carries the figures, each next to its label', () => {
    const out = html();
    expect(out).toContain('report.call.weight.birth');
    expect(out).toContain('report.call.grams(3400)');
    expect(out).toContain('report.call.weight.latestValue(3510,12)');
    // 90 + 100 mL over two feeds in the last day.
    expect(out).toContain('report.call.ml(190)');
  });

  it('leaves out a section that has nothing to say', () => {
    const out = html('24h', [], { ...BABY, birthWeightG: null });
    expect(out).not.toContain('data-section="weight"');
    expect(out).not.toContain('data-section="health"');
    // The window section still stands: zero feeds is a fact worth printing.
    expect(out).toContain('data-section="feeds"');
  });

  it('prints a day table for 3 and 7 days, and none for 24 hours', () => {
    expect(html('24h')).not.toContain('class="days"');
    const week = html('7d');
    expect(week).toContain('class="days"');
    expect(week.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr>/g)).toHaveLength(7);
  });

  it('escapes what a person typed, so a note can’t become markup', () => {
    const nasty = ev('health', NOW - HOUR, { note: '<script>alert("x")</script> & more' });
    const out = html('24h', [nasty]);
    expect(out).not.toContain('<script>alert');
    expect(out).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more');
  });

  it('keeps sections whole across a page break', () => {
    expect(html()).toContain('page-break-inside: avoid');
  });

  it('names the file by the baby, the range and the day', () => {
    const report = buildReport(events, BABY, '3d', NOW, TZ);
    expect(reportFileName(report, 'ella')).toBe('moraki-ella-3d-2026-10-21.pdf');
    expect(reportFileName(report, '')).toBe('moraki-report-3d-2026-10-21.pdf');
  });

  it('adds no copy of its own: every word in it came from a key or a person', () => {
    const out = html('7d');
    const body = out.slice(out.indexOf('<body>'));
    const text = body.replace(/<[^>]*>/g, ' ');
    const words = text.match(/[A-Za-z][A-Za-z']+/g) ?? [];
    const fromAPerson = ['Ella', 'Vitamin', 'D', 'Warm', 'after', 'a', 'feed', 'drop'];
    const rest = words.filter((w) => !fromAPerson.includes(w));
    // Everything else is an i18n key, printed here by the stand-in for t().
    expect(rest.every((w) => /^(report|insights)$/.test(w) || /^[a-z][A-Za-z]*$/.test(w))).toBe(
      true,
    );
  });
});
