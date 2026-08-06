import React from 'react';
import { useModuleEnabled } from './useModuleEnabled';

interface Props {
  moduleId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ModuleGuard({ moduleId, children, fallback = null }: Props) {
  const enabled = useModuleEnabled(moduleId);
  return enabled ? <>{children}</> : <>{fallback}</>;
}
