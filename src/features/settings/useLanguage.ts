import { useTranslation } from 'react-i18next';

import { useDevicePref } from '@/db/react';
import i18n, { deviceLanguage } from '@/i18n';

/** What Settings offers: follow the phone, or pick one. */
export const LANGUAGE_CHOICES = ['device', 'en', 'el'] as const;
export type LanguageChoice = (typeof LANGUAGE_CHOICES)[number];

/** The language a choice resolves to. `device` is whatever the phone reads in. */
export function resolveLanguage(choice: LanguageChoice): string {
  return choice === 'device' ? deviceLanguage() : choice;
}

export type LanguageState = {
  choice: LanguageChoice;
  /** The language in use now, so the hint can name it. */
  language: string;
  choose: (choice: LanguageChoice) => void;
};

/**
 * The app's language on this phone (P4-04). Per phone and never synced: two
 * caregivers sharing a baby do not have to share a language.
 *
 * Resources are bundled, so changing it is immediate — no download, nothing to
 * wait for, and the dates follow because every screen formats with
 * `dateLocale(i18n.language)`.
 */
export function useLanguage(): LanguageState {
  const { i18n: instance } = useTranslation();
  const [choice, setChoice] = useDevicePref('language');
  return {
    choice,
    language: instance.language,
    choose: (next) => {
      setChoice(next);
      // In an event handler, so the screens below re-render once, after it.
      void i18n.changeLanguage(resolveLanguage(next));
    },
  };
}
