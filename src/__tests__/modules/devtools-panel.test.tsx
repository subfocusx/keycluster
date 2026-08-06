import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DevToolsPanel } from '@/modules/devtools/DevToolsPanel';

vi.mock('@/modules/devtools/ModulesTab', () => ({
  ModulesTab: () => <div data-testid="modules-tab">Modules</div>,
}));

vi.mock('@/modules/devtools/LogsTab', () => ({
  LogsTab: () => <div data-testid="logs-tab">Logs</div>,
}));

vi.mock('@/modules/devtools/ErrorsTab', () => ({
  ErrorsTab: () => <div data-testid="errors-tab">Errors</div>,
}));

vi.mock('@/modules/devtools/EventsTab', () => ({
  EventsTab: () => <div data-testid="events-tab">Events</div>,
}));

vi.mock('@/modules/devtools/InspectorTab', () => ({
  InspectorTab: () => <div data-testid="inspector-tab">Inspector</div>,
}));

vi.mock('@/modules/devtools/NetworkTab', () => ({
  NetworkTab: () => <div data-testid="network-tab">Network</div>,
}));

vi.mock('@/core/store', () => ({
  useAppStore: (selector: any) => selector({
    devtools: { devtoolsOpen: true, devtoolsTab: 'modules' },
    toggleDevtools: () => {},
    setDevtoolsTab: () => {},
    setDevtoolsOpen: () => {},
  }),
}));

describe('DevToolsPanel', () => {
  it('shows tabs: Модули, Логи, Ошибки, События, Инспектор, Network', () => {
    render(<DevToolsPanel />);
    expect(screen.getByText('Модули')).toBeInTheDocument();
    expect(screen.getByText('Логи')).toBeInTheDocument();
    expect(screen.getByText('Ошибки')).toBeInTheDocument();
    expect(screen.getByText('События')).toBeInTheDocument();
    expect(screen.getByText('Инспектор')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
  });

  it('does not have Плагины tab', () => {
    render(<DevToolsPanel />);
    expect(screen.queryByText('Плагины')).toBeNull();
  });
});
