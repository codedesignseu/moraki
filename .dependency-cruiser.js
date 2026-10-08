// SDD 15.1, P4-03. The second half of the dependency rule: eslint checks one
// file as it is written, dependency-cruiser checks the graph the modules make
// together. Only it can see a cycle, and only it can see what a layer reaches
// outside this repository — which is how CLAUDE.md rule 3 (domain is pure) is
// checked rather than trusted.
//
// The layer table itself is architecture.js, which eslint.config.js reads too.

const { LAYERS, layerDir, forbiddenFor, layerMessage, FEATURE_MESSAGE } = require('./architecture');

const layerRules = Object.keys(LAYERS)
  .filter((layer) => forbiddenFor(layer).length > 0)
  .map((layer) => ({
    name: `layer-${layer}`,
    comment: layerMessage(layer),
    severity: 'error',
    from: { path: `^${layerDir(layer)}/` },
    to: {
      path: `^(${forbiddenFor(layer)
        .map((other) => `${layerDir(other)}/`)
        .join('|')})`,
    },
  }));

module.exports = {
  forbidden: [
    ...layerRules,
    {
      name: 'feature-to-feature',
      comment: FEATURE_MESSAGE,
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/([^/]+)/', pathNot: '^src/features/$1/' },
    },
    {
      name: 'domain-is-pure',
      comment:
        'CLAUDE.md rule 3: domain is pure logic. No React, no navigation, no SQLite, no platform.',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'core'],
        // zod writes the payload schemas (rule 6) and uuid makes an event id from
        // randomness rather than from a clock. Neither reads the outside world.
        pathNot: '^node_modules/(zod|uuid)/',
      },
    },
    {
      name: 'ui-takes-props',
      comment:
        'SDD 15.1: a primitive knows nothing about babies, storage or the network. It takes props.',
      severity: 'error',
      from: { path: '^src/ui/' },
      to: {
        dependencyTypes: ['npm'],
        path: '^node_modules/(@supabase|drizzle-orm|expo-sqlite|i18next|react-i18next)/',
      },
    },
    {
      name: 'no-test-helpers-in-the-app',
      comment: 'src/testing is for tests. Nothing shipped imports it.',
      severity: 'error',
      from: { path: '^(app|src)/', pathNot: '(\\.test\\.tsx?$|^src/testing/)' },
      to: { path: '^src/testing/' },
    },
    {
      name: 'no-design-export-in-the-app',
      comment:
        'design/ is the Sage export, kept for reference. Its values live in src/ui/tokens.ts.',
      severity: 'error',
      from: { path: '^(app|src)/' },
      to: { path: '^design/' },
    },
    {
      name: 'no-circular',
      comment: 'A cycle means the two modules are one module that has not been written yet.',
      severity: 'error',
      from: {},
      // Type-only edges are erased before anything runs, so two modules naming
      // each other's types are not a cycle in the built app.
      to: { circular: true, dependencyTypesNot: ['type-only'] },
    },
  ],
  options: {
    // Tests sit outside the dependency rule, as in eslint.config.js: an app-level
    // test drives the app from whatever layer it needs. src/testing stays in the
    // graph so `no-test-helpers-in-the-app` can see anything shipped reaching it.
    exclude: { path: '\\.test\\.tsx?$' },
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
