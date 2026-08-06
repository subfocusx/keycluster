import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from '@/components/ui/toast';

describe('Toast components', () => {
  it('renders Toast with title and description', () => {
    render(
      <ToastProvider>
        <Toast open={true}>
          <ToastTitle data-testid="toast-title">Title</ToastTitle>
          <ToastDescription data-testid="toast-desc">Description</ToastDescription>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast-title')).toHaveTextContent('Title');
    expect(screen.getByTestId('toast-desc')).toHaveTextContent('Description');
  });

  it('renders ToastAction', () => {
    render(
      <ToastProvider>
        <Toast open={true}>
          <ToastTitle>Title</ToastTitle>
          <ToastAction data-testid="toast-action" altText="undo">Undo</ToastAction>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast-action')).toHaveTextContent('Undo');
  });

  it('applies custom className to Toast', () => {
    render(
      <ToastProvider>
        <Toast open={true} className="custom-toast" data-testid="toast">
          <ToastTitle>Title</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast')).toHaveClass('custom-toast');
  });

  it('renders destructive variant', () => {
    render(
      <ToastProvider>
        <Toast open={true} variant="destructive" data-testid="toast">
          <ToastTitle>Error</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast')).toBeInTheDocument();
  });
});
