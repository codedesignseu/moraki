// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

// Style properties whose numeric values are lengths or type sizes.
const STYLE_NUMBER_KEYS =
  '/^(width|height|(min|max)(Width|Height)|(margin|padding|inset)[A-Za-z]*|gap|rowGap|columnGap|top|right|bottom|left|start|end|fontSize|lineHeight|letterSpacing|border[A-Za-z]*(Radius|Width))$/';

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'expo-env.d.ts'],
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
      'no-restricted-syntax': [
        'error',
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
          message:
            'Pixel number outside src/ui/tokens.ts. Use theme.spacing, radius, size or text.',
        },
        {
          selector: `Property[key.name=${STYLE_NUMBER_KEYS}] > UnaryExpression > Literal`,
          message:
            'Pixel number outside src/ui/tokens.ts. Use theme.spacing, radius, size or text.',
        },
      ],
    },
  },
  // Last: turns off every rule that would fight Prettier.
  prettierConfig,
]);
