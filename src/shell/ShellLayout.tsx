// ============================================================
// ShellLayout — Pure Structural Layout
// Key Collector desktop UI style container
// Tab bar + Ribbon toolbar + Main Content + Status Bar
// No state, no business logic — only CSS structure and slots
// ============================================================

'use client';

import React from 'react';
import { MIcon } from '@/shell/shared-icon';

// ---- Shell Layout Props ----

export interface ShellLayoutProps {
  /** Tab bar section (TabBar component) */
  tabBar: React.ReactNode;
  /** Main content area (PhrasesTable + right panel) */
  mainContent: React.ReactNode;
  /** Status bar section */
  statusBar: React.ReactNode;
  /** Modal/panel overlays (ToolModals, CommandPalette, etc.) */
  overlays?: React.ReactNode;
}

// ---- Shell Layout Component ----

export function ShellLayout({
  tabBar,
  mainContent,
  statusBar,
  overlays,
}: ShellLayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)] overflow-hidden">
      {/* Tab bar */}
      {tabBar}

      {/* Main content area */}
      {mainContent}

      {/* Status bar */}
      {statusBar}

      {/* Overlays (modals, panels, palettes) */}
      {overlays}
    </div>
  );
}

// ---- Loading Screen — Cluster Animation ----

const CLUSTER_DOTS = [
  { dx: -40, dy: -40, delay: 0 },
  { dx: 40, dy: -30, delay: 0.15 },
  { dx: -30, dy: 40, delay: 0.3 },
  { dx: 35, dy: 35, delay: 0.45 },
  { dx: 0, dy: -48, delay: 0.6 },
  { dx: 48, dy: 0, delay: 0.75 },
  { dx: -48, dy: 0, delay: 0.9 },
  { dx: 0, dy: 48, delay: 1.05 },
];

export function ShellLoadingScreen() {
  return (
    <div className="h-screen flex items-center justify-center bg-[var(--kc-bg)]">
      <div className="flex flex-col items-center gap-8 select-none">
        {/* Cluster dots */}
        <div className="relative w-24 h-24" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          {CLUSTER_DOTS.map((dot, i) => (
            <div
              key={i}
              className="absolute w-[10px] h-[10px] rounded-full top-1/2 left-1/2 -mt-[5px] -ml-[5px]"
              style={{
                backgroundColor: `var(--kc-blue)`,
                opacity: 0.8,
                animation: 'cluster-dot 2.8s ease-in-out infinite',
                animationDelay: `${dot.delay}s`,
                '--dx': `${dot.dx}px`,
                '--dy': `${dot.dy}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* App name — system font, no external deps */}
        <div
          className="text-xl font-bold tracking-tight"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: 'var(--kc-text)' }}
        >
          KeyCluster
        </div>

        {/* Shimmer loading bar */}
        <div className="w-32 h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: 'var(--kc-border-light)' }}>
          <div
            className="h-full w-1/3 rounded-full"
            style={{
              backgroundColor: 'var(--kc-blue)',
              animation: 'cluster-shimmer 1.5s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
}
