import { startCrashReporting } from './sentry';

// `mock`-prefixed, because jest hoists the factory above these declarations.
const mockInit = jest.fn();
const mockSetUser = jest.fn();
jest.mock('@sentry/react-native', () => ({
  init: (options: unknown) => mockInit(options),
  setUser: (user: unknown) => mockSetUser(user),
}));

type Options = {
  dsn: string;
  environment: string;
  sendDefaultPii: boolean;
  enableCaptureFailedRequests: boolean;
  enableAutoPerformanceTracing: boolean;
  tracesSampleRate: number;
  maxBreadcrumbs: number;
  beforeSend: (event: unknown) => unknown;
  beforeBreadcrumb: (crumb: unknown) => unknown;
};

const EU = 'https://examplekey@o123456.ingest.de.sentry.io/456';
const options = () => mockInit.mock.calls[0]?.[0] as Options;

beforeEach(() => {
  mockInit.mockClear();
  mockSetUser.mockClear();
});

describe('starting crash reporting', () => {
  it('does nothing without a DSN, so a local build reports nothing', () => {
    expect(startCrashReporting(null)).toBe(false);
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('turns off everything that would carry content', () => {
    expect(startCrashReporting({ dsn: EU, environment: 'preview' })).toBe(true);
    expect(options()).toMatchObject({
      dsn: EU,
      environment: 'preview',
      sendDefaultPii: false,
      enableCaptureFailedRequests: false,
      enableAutoPerformanceTracing: false,
      tracesSampleRate: 0,
      maxBreadcrumbs: 20,
    });
  });

  it('tells Sentry nothing about who is signed in', () => {
    startCrashReporting({ dsn: EU, environment: 'preview' });
    expect(mockSetUser).toHaveBeenCalledWith(null);
  });

  it('runs every event through the scrubber', () => {
    startCrashReporting({ dsn: EU, environment: 'preview' });
    const sent = options().beforeSend({
      level: 'error',
      user: { email: 'parent@example.test' },
      extra: { note: 'Rash on her back' },
    }) as Record<string, unknown>;
    expect(sent.level).toBe('error');
    expect(sent.user).toBeUndefined();
    expect(sent.extra).toBeUndefined();
  });

  it('runs every breadcrumb through the scrubber', () => {
    startCrashReporting({ dsn: EU, environment: 'preview' });
    expect(options().beforeBreadcrumb({ category: 'console', message: 'temp 38.1' })).toBeNull();
    expect(options().beforeBreadcrumb({ category: 'navigation', message: 'log/health' })).toEqual({
      category: 'navigation',
      message: 'log/health',
    });
  });
});
