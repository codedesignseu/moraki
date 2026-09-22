import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useEventsRepository } from '@/db/react';
import type { DiaperPayload } from '@/domain/activities/diaper';
import { formatClock } from '@/domain/time/formatClock';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { Button } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

type Kind = DiaperPayload['kind'];

/** One tap saves: each kind is its own button, logged at the time the sheet opened. */
export function DiaperSheet({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const repository = useEventsRepository();
  const [openedAt] = useState(Date.now);

  const kinds: { value: Kind; label: string }[] = [
    { value: 'wet', label: t('log.diaper.wet') },
    { value: 'dirty', label: t('log.diaper.dirty') },
    { value: 'both', label: t('log.diaper.both') },
  ];

  function log(kind: Kind) {
    repository.insert({ type: 'diaper', occurredAt: openedAt, payload: { kind } });
    onDone();
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.muted}>
        {t('log.time', { time: formatClock(openedAt, deviceTimeZone()) })}
      </Text>
      {kinds.map(({ value, label }) => (
        <Button
          key={value}
          label={label}
          onPress={() => log(value)}
          accessibilityHint={t('log.diaper.hint')}
        />
      ))}
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
  });
