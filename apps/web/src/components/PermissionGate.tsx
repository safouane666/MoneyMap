'use client';

import { can, type PermissionAction, type SpaceRole } from '@clear-money/domain';
import { useI18n } from '@/lib/i18n';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function PermissionGate({
  role,
  action,
  children,
  fallback,
}: {
  role: SpaceRole;
  action: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { t } = useI18n();
  if (!can(role, action)) {
    return (
      fallback ?? (
        <Alert variant="warning">
          <AlertDescription>{t('app.permissionDenied')}</AlertDescription>
        </Alert>
      )
    );
  }
  return <>{children}</>;
}
