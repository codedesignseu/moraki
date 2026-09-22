import { useTranslation } from 'react-i18next';

import { useUndoState } from '@/db/undo';
import { Toast } from '@/ui/primitives';

type Translate = (key: string) => string;

/** Shows the latest save with an Undo button for UNDO_WINDOW_MS (P1-12). */
export function UndoToast() {
  const { t: typedT } = useTranslation();
  const t = typedT as unknown as Translate;
  const { pending, runUndo } = useUndoState();
  if (!pending) return null;
  return (
    <Toast
      key={pending.key}
      message={t(pending.messageKey)}
      actionLabel={t('undo.action')}
      onAction={runUndo}
    />
  );
}
