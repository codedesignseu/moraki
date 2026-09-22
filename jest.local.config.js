// Tests that talk to a running local Supabase (`supabase start`), run with
// `npm run test:local`. Plain Node environment: jest-expo's setup replaces
// fetch with React Native's, which can't reach a real server from Node.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.local.test.ts'],
  transform: { '\\.[jt]sx?$': 'babel-jest' },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  // These tests hold real sockets (realtime keeps one open). Without this the
  // run finishes but the process lingers, which would hang the CI step; with
  // it, jest runs them one at a time and waits for the sockets to close.
  detectOpenHandles: true,
};
