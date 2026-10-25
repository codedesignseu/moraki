import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { useGuardianDeclaration } from '@/privacy/useGuardianDeclaration';
import { TextButton } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';

import { SettingsCard } from './SettingsCard';

/**
 * For a member who hasn't declared they are the baby's parent or guardian
 * (P0.1): only someone who has can take the household over. Also an owner
 * whose declaration the server has no record of, until they make it.
 */
export function GuardianCard({ onDeclare }: { onDeclare: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const guardian = useGuardianDeclaration();

  if (!guardian.needed) return null;
  return (
    <SettingsCard icon="private" title={t('settings.guardian.title')} testID="settings-guardian">
      <Text style={[theme.type.detail, { color: theme.palette.textSoft }]}>
        {t(guardian.owner ? 'settings.guardian.bodyOwner' : 'settings.guardian.bodyMember')}
      </Text>
      <TextButton label={t('settings.guardian.button')} onPress={onDeclare} />
    </SettingsCard>
  );
}
