import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { useDevicePref } from '@/db/react';
import { Button, Card, Page } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * Opens the notice once a phone has been cleared of a household it no
 * longer belongs to (P0.5). Draws nothing.
 */
export function RemovedGate({ onShow }: { onShow: () => void }) {
  const [notice] = useDevicePref('revokedNotice');
  useEffect(() => {
    if (notice) onShow();
  }, [notice, onShow]);
  return null;
}

/** "You're no longer in this household", and why, shown once. */
export function RemovedScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const [notice, setNotice] = useDevicePref('revokedNotice');
  const close = () => {
    setNotice(null);
    onDone();
  };

  return (
    <Page
      title={t('removed.title')}
      kind="close"
      onBack={close}
      backLabel={t('common.close')}
      footer={<Button label={t('removed.ok')} onPress={close} />}
    >
      <Card testID="removed-notice">
        <Text style={s.body}>{t(`removed.${notice ?? 'not_member'}`)}</Text>
      </Card>
    </Page>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    body: { ...theme.type.body, color: theme.palette.ink },
  });
