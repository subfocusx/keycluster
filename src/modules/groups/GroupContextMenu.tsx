'use client';

import type { PluginContext } from '@/plugin-sdk';

/** @deprecated GroupContextMenu is no longer used as a UI contribution.
 *  The real context menu is GroupItemContextMenu in group-context-menu.tsx,
 *  directly rendered in GroupItem.tsx. This component exists only for
 *  backward-compatible re-exports.
 */
export function GroupContextMenu(_props: { ctx: PluginContext }) {
  return null;
}
