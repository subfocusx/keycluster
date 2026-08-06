import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Progress } from '@/components/ui/progress';

describe('Progress', () => {
  const getIndicator = (container: HTMLElement) =>
    container.querySelector('[data-slot="progress-indicator"]');

  it('renders with default props', () => {
    render(<Progress data-testid="progress" />);
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('renders indicator with given value', () => {
    const { container } = render(<Progress value={60} />);
    const indicator = getIndicator(container);
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveStyle({ transform: 'translateX(-40%)' });
  });

  it('renders indicator with 0 value', () => {
    const { container } = render(<Progress value={0} />);
    expect(getIndicator(container)).toHaveStyle({ transform: 'translateX(-100%)' });
  });

  it('renders indicator with 100 value', () => {
    const { container } = render(<Progress value={100} />);
    const indicator = getIndicator(container);
    expect(indicator).toHaveAttribute('style', expect.stringContaining('translateX(-0%)'));
  });

  it('applies custom className', () => {
    render(<Progress className="custom-class" data-testid="progress" />);
    expect(screen.getByTestId('progress')).toHaveClass('custom-class');
  });

  it('has progressbar role', () => {
    render(<Progress value={50} data-testid="progress" />);
    expect(screen.getByTestId('progress')).toHaveAttribute('role', 'progressbar');
  });
});
