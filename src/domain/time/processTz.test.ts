import { offsetMinutes } from './zoned';

// Guard for the TZ matrix (SDD 6.6). `npm run test:tz` sets EXPECTED_TZ next to
// TZ; if TZ is dropped or ignored, every run would silently share one timezone.
// This checks what the worker actually does, not just that the env var is set.
const expected = process.env.EXPECTED_TZ;

(expected ? describe : describe.skip)(`process timezone (expected ${expected ?? 'unset'})`, () => {
  it('matches EXPECTED_TZ in Intl', () => {
    const canonical = new Intl.DateTimeFormat('en-US', { timeZone: expected }).resolvedOptions()
      .timeZone;
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(canonical);
  });

  it.each([
    ['January', Date.UTC(2026, 0, 15, 12)],
    ['July', Date.UTC(2026, 6, 15, 12)],
  ])('matches EXPECTED_TZ in Date local time in %s', (_month, instant) => {
    // getTimezoneOffset is minutes behind UTC, so its sign is the reverse of ours.
    // `0 -` rather than unary minus: -0 would fail toBe(0) under UTC.
    const dateOffset = 0 - new Date(instant).getTimezoneOffset();
    expect(dateOffset).toBe(offsetMinutes(instant, expected ?? 'UTC'));
  });
});
