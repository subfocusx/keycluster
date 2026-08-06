// ============================================================
// Tests: components/ModuleErrorBoundary.tsx
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ModuleErrorBoundary } from '@/components/ModuleErrorBoundary';
import { getEventBus } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Module error');
  return <div>Module content</div>;
}

// Компонент без ошибок
function GoodComponent() {
  return <div>Good module content</div>;
}

describe('ModuleErrorBoundary', () => {
  beforeEach(() => {
    // Создаём свежий EventBus для каждого теста
    createEventBus();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render children when no error', () => {
    render(
      <ModuleErrorBoundary moduleId="test-module">
        <GoodComponent />
      </ModuleErrorBoundary>,
    );
    expect(screen.getByText('Good module content')).toBeDefined();
  });

  it('should show fallback when child throws', () => {
    render(
      <ModuleErrorBoundary moduleId="failing-module">
        <ThrowingComponent shouldThrow={true} />
      </ModuleErrorBoundary>,
    );
    expect(screen.getByText(/failing-module/)).toBeDefined();
    // "недоступен" is split across elements, use container text
    expect(document.body.textContent).toContain('недоступен');
  });

  it('should show custom fallback when provided', () => {
    render(
      <ModuleErrorBoundary moduleId="custom" fallback={<div>Custom error UI</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ModuleErrorBoundary>,
    );
    expect(screen.getByText('Custom error UI')).toBeDefined();
  });

  it('should emit module:error event on componentDidCatch', () => {
    const handler = vi.fn();
    const eventBus = getEventBus();
    eventBus.on('module:error', handler);

    render(
      <ModuleErrorBoundary moduleId="emit-test">
        <ThrowingComponent shouldThrow={true} />
      </ModuleErrorBoundary>,
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: 'emit-test',
        phase: 'render',
      }),
    );
  });

  it('should have a reload button that resets error state', () => {
    const { rerender } = render(
      <ModuleErrorBoundary moduleId="reload-test">
        <ThrowingComponent shouldThrow={true} />
      </ModuleErrorBoundary>,
    );

    // Should show fallback
    expect(screen.getByText('Перезагрузить')).toBeDefined();

    // Click reload button
    fireEvent.click(screen.getByText('Перезагрузить'));

    // After reset, the boundary should try rendering children again
    // Since ThrowingComponent still throws, it'll catch again
    // But the state was reset, so the button should still be there
    expect(screen.getByText(/reload-test/)).toBeDefined();
  });

  it('should recover after reset if error is resolved', () => {
    let shouldThrow = true;

    function ConditionalThrower() {
      if (shouldThrow) throw new Error('Conditional error');
      return <div>Recovered content</div>;
    }

    render(
      <ModuleErrorBoundary moduleId="recover-test">
        <ConditionalThrower />
      </ModuleErrorBoundary>,
    );

    // Fallback shown
    expect(screen.getByText(/recover-test/)).toBeDefined();

    // Fix the error source
    shouldThrow = false;

    // Click reload
    fireEvent.click(screen.getByText('Перезагрузить'));

    // Should now show recovered content
    expect(screen.getByText('Recovered content')).toBeDefined();
  });

  it('should isolate errors — other modules continue working', () => {
    render(
      <div>
        <ModuleErrorBoundary moduleId="bad-module">
          <ThrowingComponent shouldThrow={true} />
        </ModuleErrorBoundary>
        <ModuleErrorBoundary moduleId="good-module">
          <GoodComponent />
        </ModuleErrorBoundary>
      </div>,
    );

    // Bad module shows fallback
    expect(screen.getByText(/bad-module/)).toBeDefined();
    // Good module still works
    expect(screen.getByText('Good module content')).toBeDefined();
  });
});
