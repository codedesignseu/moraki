import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { RELATIONS } from '@/sync/household';
import { CODE_LENGTH } from '@/sync/invites';
import { Button, Card, Chip, Page, TextField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useJoin } from './useJoin';

/**
 * `join/[code]` and manual entry (SDD 7; G account/join, -signed-out,
 * -already, -invalid): joins a household with an invite code. The app's
 * problem messages are kept; G's "Leave first" is not (decision G3).
 */
export function JoinScreen({
  code,
  onDone,
  onClose,
  onSignIn,
}: {
  code: string;
  onDone: () => void;
  onClose: () => void;
  onSignIn: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const join = useJoin(code, onDone);
  const page = {
    title: t('join.title'),
    kind: 'close',
    onBack: onClose,
    backLabel: t('common.close'),
  } as const;
  // The code from the link, shown greyed while it can't be used.
  const heldCode =
    join.code === '' ? null : (
      <Card>
        <TextField
          label={t('join.code')}
          value={join.formattedCode}
          onChangeText={join.setCode}
          disabled
        />
      </Card>
    );

  if (!join.signedIn) {
    return (
      <Page {...page}>
        <Card tone="warning" icon="alert" message={t('join.signInFirst')}>
          <Button label={t('join.signIn')} onPress={onSignIn} />
        </Card>
        {heldCode}
      </Page>
    );
  }

  if (join.household) {
    return (
      <Page {...page} footer={<Button label={t('join.done')} onPress={onDone} />}>
        <Card
          tone="warning"
          icon="alert"
          message={t('join.alreadyIn', { name: join.household.babyName })}
        />
        {heldCode}
      </Page>
    );
  }

  const problem = join.problem ? t(`join.problem.${join.problem}`) : undefined;

  return (
    <Page {...page} footer={<Button label={t('join.join')} onPress={join.join} busy={join.busy} />}>
      <Text style={s.intro}>{t('join.intro')}</Text>
      <Card testID="join-form">
        <TextField
          label={t('join.code')}
          value={join.formattedCode}
          onChangeText={join.setCode}
          // Room for the dash and stray spaces; the code itself is trimmed to length.
          maxLength={CODE_LENGTH + 4}
          autoCapitalize="characters"
          invalid={join.problem !== null && join.problem !== 'display_name'}
          message={join.problem === 'display_name' ? undefined : problem}
          errorPrefix={t('common.error')}
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
          errorPrefix={t('common.error')}
        />
        {/* Read out: the chips below carry no group name of their own. */}
        <Text style={s.label}>{t('householdSetup.you.relation')}</Text>
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
      </Card>
    </Page>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    intro: { ...theme.type.detail, color: theme.palette.textSoft },
    label: { ...theme.type.small, color: theme.palette.textSoft },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  });
