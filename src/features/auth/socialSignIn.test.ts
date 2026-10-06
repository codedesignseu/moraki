import {
  SocialSignInCancelled,
  isAppleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
} from './socialSignIn';

const mockIsAvailable = jest.fn();
const mockSignInAsync = jest.fn();
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: () => mockIsAvailable(),
  signInAsync: (options: unknown) => mockSignInAsync(options),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'the-raw-nonce',
  digestStringAsync: async (_algorithm: unknown, data: string) => `hashed(${data})`,
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

const mockConfigure = jest.fn();
const mockHasPlayServices = jest.fn();
const mockGoogleSignIn = jest.fn();
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: (options: unknown) => mockConfigure(options),
    hasPlayServices: (options: unknown) => mockHasPlayServices(options),
    signIn: () => mockGoogleSignIn(),
  },
}));

afterEach(() => jest.clearAllMocks());

describe('Sign in with Apple (P5-04)', () => {
  it('is only offered where the native check says so', async () => {
    mockIsAvailable.mockResolvedValue(true);
    expect(await isAppleSignInAvailable()).toBe(true);
  });

  it('signs the hashed nonce, but hands Supabase the original', async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: 'the-identity-token' });

    const result = await signInWithApple();

    expect(mockSignInAsync).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: 'hashed(the-raw-nonce)' }),
    );
    expect(result).toEqual({ identityToken: 'the-identity-token', nonce: 'the-raw-nonce' });
  });

  it('asks Apple for the email only, never the name it would not use (P5-F3)', async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: 'the-identity-token' });
    await signInWithApple();
    expect(mockSignInAsync).toHaveBeenCalledWith(expect.objectContaining({ requestedScopes: [1] }));
  });

  it('turns a dismissed sheet into a cancellation, not a failure to explain', async () => {
    const cancelled = Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' });
    mockSignInAsync.mockRejectedValue(cancelled);

    await expect(signInWithApple()).rejects.toBeInstanceOf(SocialSignInCancelled);
  });

  it('lets any other native error through unchanged', async () => {
    mockSignInAsync.mockRejectedValue(new Error('some other native failure'));
    await expect(signInWithApple()).rejects.toThrow('some other native failure');
  });
});

describe('Sign in with Google (P5-04)', () => {
  it('configures with the web client ID and returns the ID token', async () => {
    mockHasPlayServices.mockResolvedValue(true);
    mockGoogleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'the-google-token' } });

    const idToken = await signInWithGoogle(
      'web-client-id.apps.googleusercontent.com',
      'ios-client-id.apps.googleusercontent.com',
    );

    expect(mockConfigure).toHaveBeenCalledWith({
      webClientId: 'web-client-id.apps.googleusercontent.com',
      iosClientId: 'ios-client-id.apps.googleusercontent.com',
    });
    expect(idToken).toBe('the-google-token');
  });

  it('configures with the web client ID alone when there is no iOS one', async () => {
    mockHasPlayServices.mockResolvedValue(true);
    mockGoogleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'the-google-token' } });
    await signInWithGoogle('web-client-id', undefined);
    expect(mockConfigure).toHaveBeenCalledWith({ webClientId: 'web-client-id' });
  });

  it('turns a dismissed sheet into a cancellation, not a failure to explain', async () => {
    mockHasPlayServices.mockResolvedValue(true);
    mockGoogleSignIn.mockResolvedValue({ type: 'cancelled', data: null });

    await expect(signInWithGoogle('web-client-id', undefined)).rejects.toBeInstanceOf(
      SocialSignInCancelled,
    );
  });
});
