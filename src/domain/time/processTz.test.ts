// Guard for the TZ matrix (SDD 6.6): if TZ is set, the Jest worker must really
// run in it, or the matrix would silently test one timezone three times.
const requested = process.env.TZ;

(requested ? it : it.skip)(`runs in the requested TZ (${requested ?? 'unset'})`, () => {
  const expected = new Intl.DateTimeFormat('en-US', { timeZone: requested }).resolvedOptions()
    .timeZone;
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(expected);
});
