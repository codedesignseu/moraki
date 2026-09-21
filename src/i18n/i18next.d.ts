import 'i18next';

import type en from './en.json';

// Makes every t() key typed against en.json: a missing or misspelled key is a
// compile error, not a silent fallback at runtime.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof en;
    };
  }
}
