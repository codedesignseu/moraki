// https://docs.expo.dev/guides/using-eslint/
const fs = require('fs');
const path = require('path');

const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');
const i18next = require('eslint-plugin-i18next');

// SDD 15.1, P4-03. The layer table lives in architecture.js, which
// .dependency-cruiser.js reads too, so the two tools enforce one rule.
const { LAYERS, layerDir, forbiddenFor, layerMessage, FEATURE_MESSAGE } = require('./architecture');

// One zone per layer, listing the layers it may not reach.
const LAYER_ZONES = Object.keys(LAYERS).map((layer) => ({
  target: `./${layerDir(layer)}`,
  from: forbiddenFor(layer).map((other) => `./${layerDir(other)}`),
  message: layerMessage(layer),
}));

// A feature never imports another feature; shared behaviour moves down a layer.
// Read from disk so a new feature is covered the moment its folder exists.
const FEATURE_ZONES = fs
  .readdirSync(path.join(__dirname, 'src/features'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    target: `./src/features/${entry.name}`,
    from: './src/features',
    except: [`./${entry.name}`],
    message: FEATURE_MESSAGE,
  }));

// Style properties whose numeric values are lengths or type sizes.
const STYLE_NUMBER_KEYS =
  '/^(width|height|(min|max)(Width|Height)|(margin|padding|inset)[A-Za-z]*|gap|rowGap|columnGap|top|right|bottom|left|start|end|fontSize|lineHeight|letterSpacing|border[A-Za-z]*(Radius|Width))$/';

// SDD 15.4: no component contains a hex value, a pixel number or a font name.
const TOKEN_SELECTORS = [
  {
    selector: 'Literal[value=/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
    message: 'Colour literal outside src/ui/tokens.ts. Use theme.colors.',
  },
  {
    selector: 'Literal[value=/^(rgb|hsl)a?\\(/i]',
    message: 'Colour literal outside src/ui/tokens.ts. Use theme.colors.',
  },
  {
    selector: "Property[key.name='fontFamily']",
    message: 'Font name outside src/ui/tokens.ts. Use theme.text.',
  },
  {
    selector: "Property[key.name='fontWeight'] Literal",
    message: 'Font weight outside src/ui/tokens.ts. Use theme.text.',
  },
  {
    selector: `Property[key.name=${STYLE_NUMBER_KEYS}] > Literal[raw=/^[1-9]|^0\\.[0-9]*[1-9]/]`,
    message: 'Pixel number outside src/ui/tokens.ts. Use theme.spacing, radius, size or text.',
  },
  {
    selector: `Property[key.name=${STYLE_NUMBER_KEYS}] > UnaryExpression > Literal`,
    message: 'Pixel number outside src/ui/tokens.ts. Use theme.spacing, radius, size or text.',
  },
];

// CLAUDE.md rule 9 for copy outside JSX (P0-F5): an object property that carries
// copy, like a Segmented option's `label`, must come from t(), not a literal.
const COPY_PROPERTY =
  '/^(label|title|text|unit|placeholder|message|closeLabel|accessibility(Label|Hint))$/';
const COPY_SELECTORS = [
  {
    selector: `Property[key.name=${COPY_PROPERTY}] > Literal[value=/[A-Za-z]/]`,
    message: 'User-facing string outside src/i18n. Add it to src/i18n/en.json and use t().',
  },
  {
    selector: `Property[key.name=${COPY_PROPERTY}] > TemplateLiteral[expressions.length=0]`,
    message: 'User-facing string outside src/i18n. Add it to src/i18n/en.json and use t().',
  },
];

module.exports = defineConfig([
  expoConfig,
  {
    // design/ is the Sage export: reference only, never imported by the app.
    ignores: ['dist/*', '.expo/*', 'expo-env.d.ts', 'design/**'],
  },
  {
    // Root config files run in Node.
    files: ['*.config.js'],
    languageOptions: {
      globals: { __dirname: 'readonly' },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },
  {
    // SDD 15.4: no component contains a hex value, a pixel number or a font name.
    // Those live in src/ui/tokens.ts only.
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['src/ui/tokens.ts', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...TOKEN_SELECTORS],
    },
  },
  {
    // CLAUDE.md rule 9: no user-facing string outside src/i18n. Checks JSX text and
    // the props that carry copy; props like accessibilityRole="button" are not copy.
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: [
      '**/*.test.{ts,tsx}',
      // Developer-only screens labelled with token and primitive names.
      'app/tokens.tsx',
      'src/ui/showcase/**',
      // The one place literal colours and sizes live.
      'src/ui/tokens.ts',
    ],
    plugins: { i18next },
    rules: {
      // Replaces the rule for these files, so the token selectors are repeated here.
      'no-restricted-syntax': ['error', ...TOKEN_SELECTORS, ...COPY_SELECTORS],
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            include: [
              '^(label|title|text|unit|placeholder|message|closeLabel)$',
              '^accessibility(Label|Hint)$',
            ],
          },
          message: 'User-facing string outside src/i18n. Add it to src/i18n/en.json and use t().',
        },
      ],
    },
  },
  {
    // SDD 15.1: the dependency rule, checked per file as it is written.
    // Tests and the test harness are outside it: a test drives the app from
    // any layer it likes, which is what makes it an app-level test.
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', 'src/testing/**'],
    // eslint-config-expo registers the import plugin already; redefining it
    // here is a config error, so this only names the resolver and the rule.
    settings: {
      'import/resolver': { typescript: { project: __dirname } },
    },
    rules: {
      'import/no-restricted-paths': [
        'error',
        { basePath: __dirname, zones: [...LAYER_ZONES, ...FEATURE_ZONES] },
      ],
    },
  },
  {
    // Jest's manual-mock convention for a node_modules package: a plain file
    // outside any *.test.* glob, so it needs the `jest` global spelled out.
    files: ['__mocks__/**/*.js'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
  // Last: turns off every rule that would fight Prettier.
  prettierConfig,
]);
