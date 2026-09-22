import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RELATIONS } from '@/sync/household';
import { CODE_LENGTH } from '@/sync/invites';
import { Button, Card, Chip, TextField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useJoin } from './useJoin';

/** `join/[code]` and manual entry (SDD 7): joins a household with an invite code. */
export function JoinScreen({
  code,
  onDone,
  onSignIn,
}: {
  code: string;
  onDone: () => void;
  onSignIn: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const join = useJoin(code, onDone);

  if (!join.signedIn) {
    return (
      <ScrollView contentContainerStyle={s.content}>
        <Text style={theme.text.body}>{t('join.signInFirst')}</Text>
        <Button label={t('join.signIn')} onPress={onSignIn} />
      </ScrollView>
    );
  }

  if (join.household) {
    return (
      <ScrollView contentContainerStyle={s.content}>
        <Text style={theme.text.body}>
          {t('join.alreadyIn', { name: join.household.babyName })}
        </Text>
        <Button label={t('join.done')} onPress={onDone} />
      </ScrollView>
    );
  }

  const problem = join.problem ? t(`join.problem.${join.problem}`) : undefined;

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Card testID="join-form">
        <Text style={theme.text.body}>{t('join.intro')}</Text>
        <TextField
          label={t('join.code')}
          value={join.formattedCode}
          onChangeText={join.setCode}
          // Room for the dash and stray spaces; the code itself is trimmed to length.
          maxLength={CODE_LENGTH + 4}
          autoCapitalize="characters"
          invalid={join.problem !== null && join.problem !== 'display_name'}
          message={join.problem === 'display_name' ? undefined : problem}
        />
        <TextField
          label={t('join.yourName')}
          value={join.displayName}
          onChangeText={join.setDisplayName}
          maxLength={40}
          autoComplete="name"
          hint={t('join.yourNameHint')}
          invalid={join.problem === 'display_name'}
          message={join.problem === 'display_name' ? problem : undefined}
        />
        <Text style={s.muted}>{t('householdSetup.you.relation')}</Text>
        <View style={s.chips}>
          {RELATIONS.map((relation) => (
            <Chip
              key={relation}
              label={t(`householdSetup.relation.${relation}`)}
              selected={join.relation === relation}
              onPress={() => join.toggleRelation(relation)}
            />
          ))}
        </View>
        <Button label={t('join.join')} onPress={join.join} disabled={join.busy} />
      </Card>
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  });
