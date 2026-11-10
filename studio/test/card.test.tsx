import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { Card, CardHeader, CardBody, CardFooter } from '../../react/card';

/* components.css styles .card > .hd / .bd / .ft and .card .hd h4: the class names are the
   contract, and a text header must surface as a heading so the card has an accessible name. */
describe('Card', () => {
  it('renders the root and the three slots with their documented classes, in order', () => {
    const { container } = render(
      <Card>
        <CardHeader>Invoices</CardHeader>
        <CardBody>Body text</CardBody>
        <CardFooter>
          <button>Save</button>
        </CardFooter>
      </Card>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe('card');
    expect(Array.from(root.children).map((c) => c.className)).toEqual(['hd', 'bd', 'ft']);
    expect(root.querySelector('.bd')!.textContent).toBe('Body text');
    expect(root.querySelector('.ft')!.contains(screen.getByRole('button', { name: 'Save' }))).toBe(true);
  });

  it('merges an extra className through cx and forwards other props', () => {
    const { container } = render(
      <Card className="wide" data-testid="c" aria-label="Billing">
        <CardHeader className="x">T</CardHeader>
        <CardBody className="y" />
        <CardFooter className="z" />
      </Card>,
    );
    const root = screen.getByTestId('c');
    expect(root.className).toBe('card wide');
    expect(root.getAttribute('aria-label')).toBe('Billing');
    expect(Array.from(container.firstElementChild!.children).map((c) => c.className)).toEqual([
      'hd x',
      'bd y',
      'ft z',
    ]);
  });

  it('drops falsy className values instead of rendering "undefined"', () => {
    render(<Card data-testid="c" className={undefined} />);
    expect(screen.getByTestId('c').className).toBe('card');
  });

  it('wraps a string header in an h4 heading', () => {
    render(<CardHeader>Invoices</CardHeader>);
    const h = screen.getByRole('heading', { level: 4, name: 'Invoices' });
    expect(h.parentElement!.className).toBe('hd');
  });

  it('wraps an interpolated text header (string + number) in one h4 heading', () => {
    const count = 3;
    render(<CardHeader>Invoices {count}</CardHeader>);
    expect(screen.getByRole('heading', { level: 4, name: 'Invoices 3' })).toBeTruthy();
  });

  it('passes element children through untouched so callers can supply their own heading', () => {
    render(
      <CardHeader>
        <h2>Custom</h2>
        <span>meta</span>
      </CardHeader>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Custom' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 4 })).toBeNull();
  });
});
