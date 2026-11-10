import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import * as React from 'react';
import { Tooltip } from '../../react/tooltip';

/* Visibility is CSS-driven (components.css): the box is hidden by default, shown on
   :hover or :focus-within, and .tiphide forces it hidden. jsdom never matches :hover,
   so hover is passed in; :focus-within is matched for real. */
const css = fs.readFileSync(path.resolve(__dirname, '../../components.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const decls = (selector: string) => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|})\\s*${esc}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`no rule for ${selector}`);
  return m[1];
};

const box = () => screen.getByRole('tooltip', { hidden: true });
const shown = (hover = false) =>
  (hover || box().matches('.tip:focus-within .tipbox')) && !box().matches('.tip .tipbox.tiphide');

function Harness() {
  return (
    <>
      <Tooltip text="Copies the link">
        <button type="button">Copy</button>
      </Tooltip>
      <button type="button">Elsewhere</button>
    </>
  );
}

describe('Tooltip', () => {
  it('hides the box by default and reveals it on hover or focus within (CSS contract)', () => {
    expect(decls('.tip .tipbox')).toMatch(/opacity:0/);
    expect(decls('.tip .tipbox')).toMatch(/pointer-events:none/);
    expect(decls('.tip:hover .tipbox,.tip:focus-within .tipbox')).toMatch(/opacity:1/);
    expect(decls('.tip:hover .tipbox,.tip:focus-within .tipbox')).toMatch(/pointer-events:auto/);
    expect(decls('.tip .tipbox.tiphide')).toMatch(/opacity:0/);
  });

  it('is not shown initially', () => {
    render(<Harness />);
    expect(box().textContent).toBe('Copies the link');
    expect(shown()).toBe(false);
  });

  it('shows on focus of the trigger and on hover', () => {
    render(<Harness />);
    screen.getByRole('button', { name: 'Copy' }).focus();
    expect(shown()).toBe(true);
    screen.getByRole('button', { name: 'Elsewhere' }).focus();
    expect(shown()).toBe(false);
    expect(shown(true)).toBe(true);
  });

  it('hides on Escape and shows again after focus leaves and returns', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Copy' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(shown()).toBe(false);
    expect(shown(true)).toBe(false);
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(shown()).toBe(false);
    act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus());
    act(() => trigger.focus());
    expect(shown()).toBe(true);
  });

  it('resets the Escape dismissal when the pointer leaves', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Copy' });
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(shown(true)).toBe(false);
    fireEvent.mouseLeave(trigger.parentElement!);
    expect(shown(true)).toBe(true);
  });

  it('describes the trigger with the tooltip text via aria-describedby', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Copy' });
    expect(trigger.getAttribute('aria-describedby')).toBe(box().id);
    expect(screen.getByRole('button', { description: 'Copies the link' })).toBe(trigger);
  });

  it('gives each tooltip its own id', () => {
    render(
      <>
        <Tooltip text="One"><button type="button">A</button></Tooltip>
        <Tooltip text="Two"><button type="button">B</button></Tooltip>
      </>,
    );
    expect(screen.getByRole('button', { name: 'A' })).toBe(screen.getByRole('button', { description: 'One' }));
    expect(screen.getByRole('button', { name: 'B' })).toBe(screen.getByRole('button', { description: 'Two' }));
  });
});
