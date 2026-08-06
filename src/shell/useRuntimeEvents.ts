import { useEffect, useRef } from 'react';
import { getEventBus } from '@/plugin-sdk';

export const RUNTIME_EVENTS = [
  'module:initialized', 'module:enabled', 'module:disabled',
  'module:reloaded', 'plugin:uninstalled', 'module:error',
] as const;

export function useRuntimeEvents(callback: () => void): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    callbackRef.current();
    const bus = getEventBus();
    const stableHandler = () => callbackRef.current();
    const unsubs = RUNTIME_EVENTS.map(event => bus.on(event, stableHandler));
    return () => unsubs.forEach(u => u());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
