import { defineConfig } from 'drizzle-kit';

// `npx drizzle-kit generate` writes SQL migrations plus migrations.js, the bundle
// the app's expo-sqlite migrator imports.
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
});
