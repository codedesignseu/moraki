import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking } from 'react-native';

/** What to read out or type by hand: the address without its scheme. */
function addressOf(url: string): string {
  return url.replace(/^(https?:\/\/|mailto:)/, '').replace(/\/$/, '');
}

/**
 * Opens a page or an email address outside the app, and says so when the phone
 * can't (MORAKI-6): no browser or mail app to hand it to, or the system
 * refusing. The address is in the message, so the Terms and the Privacy Policy
 * can still be reached from the screens that ask someone to agree to them.
 *
 * An Alert rather than a line on the screen: the four screens that open links
 * share this, two of them as modals, and it needs no room on any of them.
 */
export function useOpenLink(): (url: string) => void {
  const { t } = useTranslation();
  return useCallback(
    (url: string) => {
      Linking.openURL(url).catch(() => {
        Alert.alert(t('openLink.title'), t('openLink.body', { address: addressOf(url) }), [
          { text: t('openLink.ok') },
        ]);
      });
    },
    [t],
  );
}
