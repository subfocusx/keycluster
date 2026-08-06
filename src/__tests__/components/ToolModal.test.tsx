import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ToolModal } from '@/components/modals/ToolModal';

describe('ToolModal', () => {
  const PanelComponent = ({ ctx }: { ctx?: any }) => (
    <div data-testid="panel-component">Panel: {JSON.stringify(ctx)}</div>
  );

  it('renders when open', () => {
    render(
      <ToolModal
        open={true}
        onOpenChange={vi.fn()}
        title="Test Tool"
        icon="search"
        moduleId="test-module"
        ctx={{ key: 'value' }}
        PanelComponent={PanelComponent}
      />,
    );
    expect(screen.getByText('Test Tool')).toBeInTheDocument();
    expect(screen.getByTestId('panel-component')).toBeInTheDocument();
  });

  it('renders panel with ctx prop', () => {
    render(
      <ToolModal
        open={true}
        onOpenChange={vi.fn()}
        title="Test"
        icon="search"
        moduleId="test-module"
        ctx={{ data: 42 }}
        PanelComponent={PanelComponent}
      />,
    );
    expect(screen.getByText(/"data":42/)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <ToolModal
        open={false}
        onOpenChange={vi.fn()}
        title="Test"
        icon="search"
        moduleId="test-module"
        ctx={{}}
        PanelComponent={PanelComponent}
      />,
    );
    expect(screen.queryByText('Test')).not.toBeInTheDocument();
  });

  it('renders help popover for known module', () => {
    render(
      <ToolModal
        open={true}
        onOpenChange={vi.fn()}
        title="Clustering"
        icon="search"
        moduleId="clustering"
        ctx={{}}
        PanelComponent={PanelComponent}
      />,
    );
    expect(screen.getByTitle('Справка')).toBeInTheDocument();
  });

  it('does not render help popover for unknown module', () => {
    render(
      <ToolModal
        open={true}
        onOpenChange={vi.fn()}
        title="Unknown"
        icon="search"
        moduleId="non-existent"
        ctx={{}}
        PanelComponent={PanelComponent}
      />,
    );
    expect(screen.queryByTitle('Справка')).not.toBeInTheDocument();
  });
});
