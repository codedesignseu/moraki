// The Sentry SDK ships ES modules jest doesn't transform. Screens reach it
// through the hidden test-error action in Settings (P4-F4), so every test that
// renders Settings gets this stand-in: crash reporting off, nothing sent.
// A test about Sentry itself replaces it with its own jest.mock.
export const init = jest.fn();
export const setUser = jest.fn();
export const getClient = jest.fn(() => undefined);
export const captureException = jest.fn();
