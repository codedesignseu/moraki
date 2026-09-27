// Manual mock (Jest's convention for a node_modules package: __mocks__/@scope/name.js
// next to node_modules, picked up for every test with no jest.mock() call needed).
//
// The real module calls TurboModuleRegistry.getEnforcing('RNGoogleSignin') at
// import time, which throws immediately outside a real native binary — every
// test that ever imports src/features/auth/socialSignIn.ts (however
// indirectly, e.g. through the sign-in screen) would fail to even load
// without this. expo-apple-authentication needs no such mock: Expo's own
// modules resolve lazily and only fail when a method is actually called, not
// at import time.
//
// A test exercising Google sign in itself (src/features/auth/socialSignIn.test.ts,
// src/features/auth/signIn.test.tsx) replaces this with its own jest.mock of
// the whole package; this default only has to exist so every *other* test
// suite can import the app without a real native module present.
module.exports = {
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() =>
      Promise.reject(new Error('GoogleSignin.signIn is not mocked in this test')),
    ),
    signOut: jest.fn(() => Promise.resolve()),
  },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
  isErrorWithCode: () => false,
};
