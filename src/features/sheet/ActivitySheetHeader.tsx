import { useTranslation } from 'react-i18next';

import { getActivity, type EventType } from '@/domain/activities';
import { SheetHeader } from '@/ui/primitives';

type Props = {
  /** The activity the sheet logs or edits; its module gives the badge. */
  type: EventType;
  title: string;
  subtitle?: string;
  onClose: () => void;
};

/**
 * SheetHeader for an activity's sheet: the icon and tone come from the
 * activity module (the same badge History draws), the close button is
 * named "Close". Every log route and the entry editor use it.
 */
export function ActivitySheetHeader({ type, title, subtitle, onClose }: Props) {
  const { t } = useTranslation();
  const activity = getActivity(type);
  return (
    <SheetHeader
      icon={activity?.icon ?? 'feed'}
      tone={activity?.tone ?? 'chip'}
      title={title}
      {...(subtitle !== undefined && { subtitle })}
      onClose={onClose}
      closeLabel={t('common.close')}
    />
  );
}
