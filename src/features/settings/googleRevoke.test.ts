import { revokeGoogleAccess } from './googleRevoke';

const mockGoogle = {
  configure: jest.fn(),
  hasPreviousSignIn: jest.fn(() => true),
  getCurrentUser: jest.fn((): unknown => ({ user: { id: 'g' } })),
  signInSilently: jest.fn(async () => ({ type: 'success' })),
  revokeAccess: jest.fn(async () => null),
  signOut: jest.fn(async () => null),
};
jest.mock('@react-native-google-signin/google-signin', () => ({ GoogleSignin: mockGoogle }));

const WEB = 'web-client.apps.googleusercontent.com';
const IOS = 'ios-client.apps.googleusercontent.com';

beforeEach(() => {
  for (const fn of Object.values(mockGoogle)) fn.mockClear();
  mockGoogle.hasPreviousSignIn.mockReturnValue(true);
  mockGoogle.getCurrentUser.mockReturnValue({ user: { id: 'g' } });
});

describe('revoking Google access on account deletion (P0.10)', () => {
  it('revokes the access, then signs the Google SDK out', async () => {
    await revokeGoogleAccess(WEB, IOS);
    expect(mockGoogle.configure).toHaveBeenCalledWith({ webClientId: WEB, iosClientId: IOS });
    expect(mockGoogle.revokeAccess).toHaveBeenCalledTimes(1);
    expect(mockGoogle.signOut).toHaveBeenCalledTimes(1);
    expect(mockGoogle.revokeAccess.mock.invocationCallOrder[0]).toBeLessThan(
      mockGoogle.signOut.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('restores the Google user silently first after a fresh launch', async () => {
    mockGoogle.getCurrentUser.mockReturnValue(null);
    await revokeGoogleAccess(WEB, undefined);
    expect(mockGoogle.configure).toHaveBeenCalledWith({ webClientId: WEB });
    expect(mockGoogle.signInSilently).toHaveBeenCalledTimes(1);
    expect(mockGoogle.revokeAccess).toHaveBeenCalledTimes(1);
  });

  it('does nothing on a phone where Google sign in was never used', async () => {
    mockGoogle.hasPreviousSignIn.mockReturnValue(false);
    await revokeGoogleAccess(WEB, IOS);
    expect(mockGoogle.revokeAccess).not.toHaveBeenCalled();
    expect(mockGoogle.signInSilently).not.toHaveBeenCalled();
  });

  it('does nothing in a build without Google configured', async () => {
    await revokeGoogleAccess(undefined, undefined);
    expect(mockGoogle.configure).not.toHaveBeenCalled();
  });

  it('never throws, and still signs out, when Google refuses', async () => {
    mockGoogle.revokeAccess.mockRejectedValueOnce(new Error('NETWORK_ERROR'));
    await expect(revokeGoogleAccess(WEB, IOS)).resolves.toBeUndefined();
    expect(mockGoogle.signOut).toHaveBeenCalledTimes(1);
  });

  it('never throws when the native module is missing', async () => {
    mockGoogle.configure.mockImplementationOnce(() => {
      throw new Error("TurboModuleRegistry.getEnforcing(...): 'RNGoogleSignin' could not be found");
    });
    await expect(revokeGoogleAccess(WEB, IOS)).resolves.toBeUndefined();
    expect(mockGoogle.revokeAccess).not.toHaveBeenCalled();
  });
});
