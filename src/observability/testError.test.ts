import { scrubEvent } from './scrub';
import { SentryTestError, TEST_ERROR_MESSAGE, sendTestError } from './testError';

// `mock`-prefixed, because jest hoists the factory above these declarations.
const mockCapture = jest.fn();
let mockClient: object | undefined;
jest.mock('@sentry/react-native', () => ({
  getClient: () => mockClient,
  captureException: (error: unknown) => mockCapture(error),
}));

beforeEach(() => {
  mockCapture.mockClear();
  mockClient = {};
});

describe('the Sentry test error', () => {
  it('sends one clearly named error with a fixed message', async () => {
    expect(await sendTestError()).toBe('sent');

    expect(mockCapture).toHaveBeenCalledTimes(1);
    const error = mockCapture.mock.calls[0]![0] as Error;
    expect(error).toBeInstanceOf(SentryTestError);
    expect(error.name).toBe('SentryTestError');
    // Nothing from the phone: the message is the constant, word for word.
    expect(error.message).toBe(TEST_ERROR_MESSAGE);
  });

  it('says crash reporting is off when the build has no DSN', async () => {
    mockClient = undefined;
    expect(await sendTestError()).toBe('off');
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('reaches Sentry under its own name: the scrubber keeps the fixed message', () => {
    const scrubbed = scrubEvent({
      exception: { values: [{ type: 'SentryTestError', value: TEST_ERROR_MESSAGE }] },
    });
    expect(scrubbed?.exception?.values?.[0]).toEqual({
      type: 'SentryTestError',
      value: TEST_ERROR_MESSAGE,
    });
  });
});
