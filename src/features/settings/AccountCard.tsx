import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/sync/AuthProvider';
import { useAccountHousehold } from '@/sync/useAccountHousehold';
import { Button, InlineError, Segmented, TextButton } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { SettingsCard, ValueRow } from './SettingsCard';
import { useCaregivers, type CaregiverRow } from './useCaregivers';
import { useRoles } from './useRoles';
import { useSignOut } from './useSignOut';

/** Typed keys, so a new role can't quietly render nothing. */
const ROLE_LABEL = {
  owner: 'settings.account.role.owner',
  caregiver: 'settings.account.role.caregiver',
  viewer: 'settings.account.role.viewer',
} as const;

/**
 * G Account card (tabs/settings, settings-out): email and household, the
 * caregivers with their roles, invite, sign out. Signed out: the hint and
 * Sign in. Nothing shows while the session is still being read.
 */
export function AccountCard({
  onSignIn,
  onSetUpHousehold,
  onJoinHousehold,
  onInvite,
}: {
  onSignIn: () => void;
  onSetUpHousehold: () => void;
  onJoinHousehold: () => void;
  onInvite: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { state } = useAuth();
  const { household } = useAccountHousehold();
  const caregivers = useCaregivers();
  const roles = useRoles();
  const signOut = useSignOut();

  if (state.status !== 'signedIn' && state.status !== 'signedOut') return null;
  if (state.status === 'signedOut') {
    return (
      <SettingsCard icon="invite" title={t('settings.account.title')} testID="settings-account">
        <Text style={[theme.type.body, s.ink]}>{t('settings.account.signedOutHint')}</Text>
        <Button label={t('settings.account.signIn')} onPress={onSignIn} />
        {/* An invite code can be typed without the link; joining asks to sign in first. */}
        <Button
          label={t('settings.account.joinHousehold')}
          variant="secondary"
          onPress={onJoinHousehold}
        />
      </SettingsCard>
    );
  }

  const email = state.user.email ?? '';
  return (
    <SettingsCard icon="invite" title={t('settings.account.title')} testID="settings-account">
      <ValueRow
        label={t('settings.account.email')}
        value={email}
        accessibilityLabel={t('settings.account.signedInAs', { email })}
      />
      {household ? (
        <>
          <ValueRow
            label={t('settings.account.householdLabel')}
            value={household.babyName}
            accessibilityLabel={t('settings.account.household', { name: household.babyName })}
          />
          {caregivers.length > 0 && (
            <View style={s.caregivers} testID="settings-caregivers">
              <Text accessibilityRole="header" style={[theme.type.detailBold, s.ink]}>
                {t('settings.account.caregivers')}
              </Text>
              {caregivers.map((person: CaregiverRow, index) => (
                <Fragment key={person.userId}>
                  {index > 0 && <View style={s.divider} />}
                  <View style={s.person} testID={`caregiver-${person.userId}`}>
                    <View
                      accessible
                      accessibilityLabel={t(
                        person.you ? 'settings.account.caregiverYou' : 'settings.account.caregiver',
                        { name: person.name, role: t(ROLE_LABEL[person.role]) },
                      )}
                    >
                      <Text style={[theme.type.figureRow, s.ink]}>
                        {person.name}
                        {person.you && (
                          <Text style={[theme.type.small, s.soft]}>
                            {` ${t('settings.account.you')}`}
                          </Text>
                        )}
                      </Text>
                      <Text style={[theme.type.small, s.soft]}>{t(ROLE_LABEL[person.role])}</Text>
                    </View>
                    {/* The owner's own row has no controls: changing your own
                      role or removing yourself is leaving, which is its own
                      question (P4-06). */}
                    {roles.canManage && !person.you && person.role !== 'owner' && (
                      <>
                        <Segmented
                          options={[
                            { value: 'caregiver', label: t('settings.account.role.caregiver') },
                            { value: 'viewer', label: t('settings.account.role.viewer') },
                          ]}
                          value={person.role}
                          onChange={(role) => void roles.setRole(person.userId, role)}
                          accessibilityLabel={t('settings.roles.whatTheyCanDo', {
                            name: person.name,
                          })}
                          disabled={roles.busy}
                        />
                        <TextButton
                          label={t('settings.roles.removeShort')}
                          accessibilityLabel={t('settings.roles.remove', { name: person.name })}
                          tone="destructive"
                          disabled={roles.busy}
                          onPress={() => void roles.remove(person.userId)}
                        />
                      </>
                    )}
                  </View>
                </Fragment>
              ))}
              {roles.problem && (
                <InlineError
                  prefix={t('common.error')}
                  message={t(`settings.roles.problem.${roles.problem}`)}
                  testID="roles-problem"
                />
              )}
              {roles.canManage && (
                <Text style={[theme.type.small, s.soft]}>{t('settings.roles.hint')}</Text>
              )}
            </View>
          )}
          {household.role === 'owner' && (
            <Button
              label={t('settings.account.invite')}
              icon="invite"
              variant="secondary"
              onPress={onInvite}
            />
          )}
        </>
      ) : (
        <>
          <Text style={[theme.type.small, s.soft]}>{t('settings.account.setUpHint')}</Text>
          <Button label={t('settings.account.setUpHousehold')} onPress={onSetUpHousehold} />
          <Button
            label={t('settings.account.joinHousehold')}
            variant="secondary"
            onPress={onJoinHousehold}
          />
        </>
      )}
      {signOut.asking ? (
        <View testID="settings-sign-out" style={s.group}>
          <Text style={[theme.type.body, s.ink]}>{t('settings.signOut.question')}</Text>
          {signOut.unsent > 0 && (
            <Text style={[theme.type.lead, s.ink]}>
              {t('settings.signOut.unsent', { count: signOut.unsent })}
            </Text>
          )}
          <Button label={t('settings.signOut.keep')} onPress={signOut.keep} />
          <Button
            label={t('settings.signOut.clear')}
            variant="destructive"
            onPress={signOut.clear}
          />
          <TextButton
            label={t('settings.signOut.cancel')}
            align="center"
            onPress={signOut.cancel}
          />
        </View>
      ) : (
        <Button label={t('settings.account.signOut')} variant="secondary" onPress={signOut.ask} />
      )}
    </SettingsCard>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    ink: { color: theme.palette.ink },
    soft: { color: theme.palette.textSoft },
    caregivers: { gap: theme.spacing.sm },
    person: { gap: theme.spacing.sm, paddingVertical: theme.spacing.sm },
    divider: { height: theme.size.borderThin, backgroundColor: theme.palette.line },
    group: { gap: theme.spacing.sm },
  });
