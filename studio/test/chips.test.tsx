import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import * as React from 'react';
import { FilterChips, type ChipOption } from '../../react/chips';

/* Chips are native buttons: aria-pressed carries the state, Tab moves between them,
   Enter/Space activate. jsdom does not turn Enter/Space into a click the way browsers
   do, so keyboard tests check the chip is focusable and its keys are not swallowed,
   then fire the click the UA would dispatch. */
const options: ChipOption[] = [
  { value: 'all', label: 'All', count: 12 },
  { value: 'icons', label: 'Icons', count: 7 },
  { value: 'objects', label: 'Objects' },
];

const chip = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const pressed = (name: string) => chip(name).getAttribute('aria-pressed');

/* Controlled harness: feeds onChange back into selected, the way a consumer would. */
function Harness({ multi, initial = [], opts = options, spy }: { multi?: boolean; initial?: string[]; opts?: ChipOption[]; spy?: (v: string[]) => void }) {
  const [selected, setSelected] = React.useState<string[]>(initial);
  return (
    <FilterChips
      options={opts}
      selected={selected}
      multi={multi}
      onChange={(v) => {
        spy?.(v);
        setSelected(v);
      }}
    />
  );
}

describe('FilterChips', () => {
  it('renders one button per option with its label and optional count', () => {
    render(<FilterChips options={options} selected={['all']} onChange={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(chip('All').textContent).toBe('All12');
    expect(chip('Objects').querySelector('.cnt')).toBeNull();
    expect(pressed('All')).toBe('true');
    expect(pressed('Icons')).toBe('false');
  });

  it('single-select: clicking a chip replaces the value and moves aria-pressed', () => {
    const spy = vi.fn();
    render(<Harness initial={['all']} spy={spy} />);
    fireEvent.click(chip('Icons'));
    expect(spy).toHaveBeenLastCalledWith(['icons']);
    expect(pressed('Icons')).toBe('true');
    expect(pressed('All')).toBe('false');
  });

  it('multi-select: clicking toggles a chip in and out of the value', () => {
    const spy = vi.fn();
    render(<Harness multi initial={['all']} spy={spy} />);
    fireEvent.click(chip('Icons'));
    expect(spy).toHaveBeenLastCalledWith(['all', 'icons']);
    expect(pressed('All')).toBe('true');
    expect(pressed('Icons')).toBe('true');
    fireEvent.click(chip('All'));
    expect(spy).toHaveBeenLastCalledWith(['icons']);
    expect(pressed('All')).toBe('false');
  });

  it('chips are focusable buttons in order, so Tab moves between them', () => {
    render(<Harness />);
    const buttons = screen.getAllByRole('button') as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent)).toEqual(['All12', 'Icons7', 'Objects']);
    for (const b of buttons) {
      expect(b.type).toBe('button');
      expect(b.tabIndex).toBe(0);
      b.focus();
      expect(document.activeElement).toBe(b);
    }
  });

  it.each(['Enter', ' '])('keyboard activation with %j matches pointer activation', (key) => {
    const spy = vi.fn();
    render(<Harness multi spy={spy} />);
    const c = chip('Icons');
    c.focus();
    expect(fireEvent.keyDown(c, { key })).toBe(true);
    fireEvent.click(c);
    expect(spy).toHaveBeenLastCalledWith(['icons']);
    expect(pressed('Icons')).toBe('true');
    expect(fireEvent.keyDown(c, { key })).toBe(true);
    fireEvent.click(c);
    expect(spy).toHaveBeenLastCalledWith([]);
    expect(pressed('Icons')).toBe('false');
  });

  it('disabled chips are disabled buttons and do not change the value', () => {
    const spy = vi.fn();
    render(<Harness initial={['all']} spy={spy} opts={[options[0], { ...options[1], disabled: true }, options[2]]} />);
    const c = chip('Icons') as HTMLButtonElement;
    expect(c.disabled).toBe(true);
    fireEvent.click(c);
    expect(spy).not.toHaveBeenCalled();
    expect(pressed('Icons')).toBe('false');
    expect(pressed('All')).toBe('true');
  });
});
