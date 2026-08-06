import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { RootErrorBoundary } from '@/components/RootErrorBoundary';

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test critical error');
  }
  return <div>App content</div>;
}

function GoodComponent() {
  return <div>Working content</div>;
}

describe('RootErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error', () => {
    render(
      <RootErrorBoundary>
        <GoodComponent />
      </RootErrorBoundary>,
    );
    expect(screen.getByText('Working content')).toBeInTheDocument();
  });

  it('shows fallback UI when child throws', () => {
    render(
      <RootErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </RootErrorBoundary>,
    );
    expect(screen.getByText('❌ Root Error')).toBeInTheDocument();
    const pre = document.querySelector('pre');
    expect(pre?.textContent).toContain('Test critical error');
  });

  it('displays error stack trace', () => {
    render(
      <RootErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </RootErrorBoundary>,
    );
    const pre = document.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre?.textContent).toContain('Test critical error');
  });

  it('calls console.error in componentDidCatch', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    render(
      <RootErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </RootErrorBoundary>,
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      '[RootErrorBoundary]',
      expect.any(Error),
      expect.any(Object),
    );
  });
});
