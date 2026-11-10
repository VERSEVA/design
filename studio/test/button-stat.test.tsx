import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { Button } from '../../react/button';
import { Stat } from '../../react/stat';

/* components.css styles .btn, .btn-<variant>, .btn.sm / .btn.lg and .stat .num / .lbl / .delta:
   the class names are the contract. */
describe('Button', () => {
  it('defaults to a primary, md, type="button" control with no size class', () => {
    render(<Button>Save</Button>);
    const b = screen.getByRole('button', { name: 'Save' });
    expect(b.className).toBe('btn btn-primary');
    expect(b.getAttribute('type')).toBe('button');
    expect((b as HTMLButtonElement).disabled).toBe(false);
    expect(b.hasAttribute('aria-busy')).toBe(false);
  });

  it.each(['primary', 'secondary', 'ghost', 'destructive'] as const)('renders the %s variant class', (variant) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole('button').className).toBe(`btn btn-${variant}`);
  });

  it('adds the bare sm / lg size class and nothing for md', () => {
    const { rerender } = render(<Button size="sm">Go</Button>);
    expect(screen.getByRole('button').className).toBe('btn btn-primary sm');
    rerender(<Button size="lg">Go</Button>);
    expect(screen.getByRole('button').className).toBe('btn btn-primary lg');
    rerender(<Button size="md">Go</Button>);
    expect(screen.getByRole('button').className).toBe('btn btn-primary');
  });

  it('merges className last and forwards other props and the ref', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} variant="ghost" size="sm" className="icon" aria-label="Close" data-testid="b">
        x
      </Button>,
    );
    const b = screen.getByTestId('b');
    expect(b.className).toBe('btn btn-ghost sm icon');
    expect(b.getAttribute('aria-label')).toBe('Close');
    expect(ref.current).toBe(b);
  });

  it('honours an explicit type', () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit');
  });

  it('passes disabled through', () => {
    render(<Button disabled>Save</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('loading disables the button, sets aria-busy and prepends a hidden spinner', () => {
    render(<Button loading>Save</Button>);
    const b = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('aria-busy')).toBe('true');
    const spinner = b.firstElementChild as HTMLElement;
    expect(spinner.className).toBe('spinner');
    expect(spinner.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Stat', () => {
  it('renders the value in .num and the label in .lbl, with no unit or delta by default', () => {
    const { container } = render(<Stat value={42} label="Open invoices" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe('stat');
    expect(Array.from(root.children).map((c) => c.className)).toEqual(['num', 'lbl']);
    expect(root.querySelector('.num')!.textContent).toBe('42');
    expect(root.querySelector('.num i')).toBeNull();
    expect(root.querySelector('.lbl')!.textContent).toBe('Open invoices');
  });

  it('renders a zero value', () => {
    const { container } = render(<Stat value={0} label="Errors" />);
    expect(container.querySelector('.num')!.textContent).toBe('0');
  });

  it('renders the unit in an <i> inside .num', () => {
    const { container } = render(<Stat value="12.4" unit="%" label="Churn" />);
    const num = container.querySelector('.num')!;
    expect(num.textContent).toBe('12.4%');
    expect(num.querySelector('i')!.textContent).toBe('%');
  });

  it('wraps children in .delta after the label', () => {
    const { container } = render(
      <Stat value={8} label="Seats">
        +2 this week
      </Stat>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(Array.from(root.children).map((c) => c.className)).toEqual(['num', 'lbl', 'delta']);
    expect(root.querySelector('.delta')!.textContent).toBe('+2 this week');
  });

  it('merges className and forwards other props', () => {
    render(<Stat value={1} label="L" className="wide" data-testid="s" aria-label="Seats" />);
    const s = screen.getByTestId('s');
    expect(s.className).toBe('stat wide');
    expect(s.getAttribute('aria-label')).toBe('Seats');
  });
});
