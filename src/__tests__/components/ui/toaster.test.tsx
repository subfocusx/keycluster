import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const { mockUseToast } = vi.hoisted(() => ({
  mockUseToast: vi.fn(() => ({
    toasts: [
      { id: '1', title: 'Test Title', description: 'Test Description', open: true },
    ],
    toast: vi.fn(),
    dismiss: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: mockUseToast,
}));

import { Toaster } from '@/components/ui/toaster';

describe('Toaster', () => {
  it('renders toast title and description', () => {
    render(<Toaster />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('renders toast without description', () => {
    mockUseToast.mockReturnValueOnce({
      toasts: [{ id: '2', title: 'Only Title', description: '', open: true }],
      toast: vi.fn(),
      dismiss: vi.fn(),
    });
    render(<Toaster />);
    expect(screen.getByText('Only Title')).toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    mockUseToast.mockReturnValueOnce({
      toasts: [
        { id: '1', title: 'First', description: '', open: true },
        { id: '2', title: 'Second', description: '', open: true },
      ],
      toast: vi.fn(),
      dismiss: vi.fn(),
    });
    render(<Toaster />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('renders without crashing when empty', () => {
    mockUseToast.mockReturnValueOnce({
      toasts: [],
      toast: vi.fn(),
      dismiss: vi.fn(),
    });
    const { container } = render(<Toaster />);
    expect(container).toBeInTheDocument();
  });
});
