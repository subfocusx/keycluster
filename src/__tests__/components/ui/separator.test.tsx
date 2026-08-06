import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Separator } from '@/components/ui/separator';

describe('Separator', () => {
  it('renders with default props', () => {
    render(<Separator data-testid="sep" />);
    const sep = screen.getByTestId('sep');
    expect(sep).toBeInTheDocument();
  });

  it('renders horizontal orientation by default', () => {
    render(<Separator data-testid="sep" />);
    const sep = screen.getByTestId('sep');
    expect(sep).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('renders vertical orientation when specified', () => {
    render(<Separator orientation="vertical" data-testid="sep" />);
    const sep = screen.getByTestId('sep');
    expect(sep).toHaveAttribute('data-orientation', 'vertical');
  });

  it('has decorative prop true by default', () => {
    render(<Separator data-testid="sep" />);
    const sep = screen.getByTestId('sep');
    expect(sep).toHaveAttribute('role', 'none');
  });

  it('applies custom className', () => {
    render(<Separator className="custom-class" data-testid="sep" />);
    const sep = screen.getByTestId('sep');
    expect(sep).toHaveClass('custom-class');
  });
});
