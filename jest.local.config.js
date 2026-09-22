// Tests that talk to a running local Supabase (`supabase start`), run with
// `npm run test:local`. Plain Node environment: jest-expo's setup replaces
// fetch with React Native's, which can't reach a real server from Node.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.local.test.ts'],
  transform: { '\\.[jt]sx?$': 'babel-jest' },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  // Real sockets, one server: run them one at a time rather than in parallel
  // workers. The script also passes --forceExit, because the realtime socket
  // can outlive the tests and a CI step that never returns is worse than one
  // that ends a moment early.
  maxWorkers: 1,
};
