import { Badge, type BadgeProps } from '@phenix360/ui';
import { DOCUMENT_STATUS_LABEL, DOCUMENT_STATUS_TONE, type DocumentStatus } from '@phenix360/core';

const TONE_TO_VARIANT: Record<string, BadgeProps['variant']> = {
  success: 'success',
  warning: 'warning',
  neutral: 'neutral',
  info: 'info',
  danger: 'danger',
};

/** Pastille d'état d'un document (✅ / 🟡 / ⚪ / 🔵 / 🔴) via les tokens. */
export function DocumentStatusBadge({ status }: { status: DocumentStatus }): React.JSX.Element {
  return (
    <Badge variant={TONE_TO_VARIANT[DOCUMENT_STATUS_TONE[status]]}>
      {DOCUMENT_STATUS_LABEL[status]}
    </Badge>
  );
}
