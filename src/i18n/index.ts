import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';

export const resources = {
  en: { translation: en },
} as const;

export const supportedLanguages = Object.keys(resources) as (keyof typeof resources)[];

// The locale dates are displayed in, per app language. English follows British
// order ("Friday 23 October"), which is how English is read in Cyprus, not US
// order ("Friday, October 23"). Greek is added with P4-04.
const DATE_LOCALES: Record<string, string> = { en: 'en-GB' };

/** Locale for Intl date formatting in the given app language. */
export function dateLocale(language: string): string {
  return DATE_LOCALES[language] ?? language;
}

/** First device language we have a locale for, else English. Greek arrives in P4-04. */
function deviceLanguage(): string {
  const preferred = getLocales().map((locale) => locale.languageCode);
  return preferred.find((code) => code && code in resources) ?? 'en';
}

const i18n = createInstance();

// Resources are bundled, so init synchronously: the first render already has strings.
void i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: 'en',
  supportedLngs: supportedLanguages,
  initAsync: false,
  interpolation: { escapeValue: false },
});

export default i18n;
