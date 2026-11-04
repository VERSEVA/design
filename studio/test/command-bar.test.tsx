import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import * as React from 'react';
import axe from 'axe-core';
import { CommandBar, CommandBarTrigger } from '../../react/command-bar';
import type { Command, AskResult } from '../../react/command-bar';

const commands = (run: () => void = vi.fn()): Command[] => [
  { group: 'Actions', label: 'New invoice', hint: 'N I', run },
  { group: 'Go to', label: 'Invoices', run },
  { group: 'Actions', label: 'Deploy studio', run, disabled: true },
  { group: 'Recent', label: 'Kestrel Co', run },
];

function Harness(props: { onAsk?: (q: string) => AskResult | Promise<AskResult>; onPin?: () => void; run?: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <header className="tbar"><CommandBarTrigger onOpen={() => setOpen(true)} /></header>
      <CommandBar commands={commands(props.run)} onAsk={props.onAsk} onPin={props.onPin} open={open} onOpenChange={setOpen} />
    </>
  );
}

const input = (c: HTMLElement) => c.querySelector<HTMLInputElement>('.cmdk-input')!;
const options = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[role="option"]')];
const type = (c: HTMLElement, v: string) => fireEvent.change(input(c), { target: { value: v } });

describe('CommandBar', () => {
  it('opens from the trigger as a modal dialog with a combobox over a grouped listbox, and passes axe', async () => {
    const { container, getByRole } = render(<Harness />);
    fireEvent.click(getByRole('button', { name: 'Search or ask' }));
    const dialog = getByRole('dialog', { name: 'Command bar' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(input(container));
    expect(input(container).getAttribute('role')).toBe('combobox');
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    expect([...container.querySelectorAll('.cmdk-group')].map((g) => g.textContent)).toEqual(['Actions', 'Go to', 'Recent']);
    expect(options(container)[0].getAttribute('aria-selected')).toBe('true');
    expect(input(container).getAttribute('aria-activedescendant')).toBe(options(container)[0].id);
    const r = await axe.run(container, { rules: { region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });

  it('arrows wrap and skip disabled options; Enter closes, returns focus to the trigger, then runs', () => {
    const run = vi.fn();
    const { container, getByRole } = render(<Harness run={run} />);
    const trigger = getByRole('button', { name: 'Search or ask' });
    fireEvent.click(trigger);
    fireEvent.keyDown(input(container), { key: 'ArrowDown' });
    expect(options(container)[1].textContent).toContain('Deploy studio');
    expect(options(container)[2].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input(container), { key: 'ArrowUp' });
    fireEvent.keyDown(input(container), { key: 'ArrowUp' });
    expect(options(container)[3].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input(container), { key: 'Enter' });
    expect(container.querySelector('.cmdk')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('Escape closes and focus returns to the trigger; Meta+K toggles', () => {
    const { container, getByRole } = render(<Harness />);
    const trigger = getByRole('button', { name: 'Search or ask' });
    fireEvent.click(trigger);
    fireEvent.keyDown(input(container), { key: 'Escape' });
    expect(container.querySelector('.cmdk')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(container.querySelector('.cmdk')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(container.querySelector('.cmdk')).toBeNull();
  });

  it('without onAsk there is no Ask row: a question with no match shows the no-results state', () => {
    const { container, getByRole } = render(<Harness />);
    fireEvent.click(getByRole('button', { name: 'Search or ask' }));
    type(container, 'what was revenue?');
    expect(options(container)).toHaveLength(0);
    expect(container.querySelector('.cmdk-empty')?.textContent).toBe('No results');
    expect(container.textContent).not.toContain('Ask');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('0 results');
  });

  it('Tab forces the Ask row; Tab again stays inside the dialog', () => {
    const { container, getByRole } = render(<Harness onAsk={() => ({ text: 'ok' })} />);
    fireEvent.click(getByRole('button', { name: 'Search or ask' }));
    type(container, 'invoice');
    expect(options(container)[0].classList.contains('ask')).toBe(false);
    fireEvent.keyDown(input(container), { key: 'Tab' });
    expect(options(container)[0].classList.contains('ask')).toBe(true);
    fireEvent.keyDown(input(container), { key: 'Tab' });
    expect(document.activeElement).toBe(input(container));
  });

  it('a streamed answer is aria-busy while it streams and announced once when done; Pin to Home hands the widget over', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    async function* stream() { yield 'Revenue is '; await gate; yield 'up 12%.'; }
    const onPin = vi.fn();
    const { container, getByRole } = render(<Harness onAsk={() => stream()} onPin={onPin} />);
    fireEvent.click(getByRole('button', { name: 'Search or ask' }));
    type(container, 'what was revenue this month?');
    expect(options(container)[0].textContent).toContain('Ask “what was revenue this month?”');
    fireEvent.keyDown(input(container), { key: 'Enter' });
    await waitFor(() => expect(container.querySelector('.cmdk-a')?.textContent).toBe('Revenue is '));
    const ans = container.querySelector('.cmdk-ans')!;
    expect(ans.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');
    await act(async () => { release(); await gate; });
    await waitFor(() => expect(ans.getAttribute('aria-busy')).toBe('false'));
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Revenue is up 12%.');
    expect(container.querySelector('button.btn-primary')).toBeNull();
    expect(onPin).not.toHaveBeenCalled();
  });

  it('a stream that carries a widget shows it and offers Pin to Home once the stream ends', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    async function* chunks() { yield 'Revenue is '; await gate; yield '₱1.84M.'; }
    const onPin = vi.fn();
    const { container, getByRole, queryByRole } = render(<Harness onAsk={() => Object.assign(chunks(), { widget: <div className="wtile">W</div> })} onPin={onPin} />);
    fireEvent.click(getByRole('button', { name: 'Search or ask' }));
    type(container, 'what was revenue this month?');
    fireEvent.keyDown(input(container), { key: 'Enter' });
    await waitFor(() => expect(container.querySelector('.cmdk-a')?.textContent).toBe('Revenue is '));
    expect(queryByRole('button', { name: 'Pin to Home' })).toBeNull();
    expect(container.querySelector('.cmdk-widget')).toBeNull();
    await act(async () => { release(); await gate; });
    const pin = await waitFor(() => getByRole('button', { name: 'Pin to Home' }));
    expect(container.querySelector('.cmdk-widget')?.textContent).toBe('W');
    fireEvent.click(pin);
    expect(onPin).toHaveBeenCalledWith(expect.objectContaining({ question: 'what was revenue this month?', text: 'Revenue is ₱1.84M.' }));
  });

  it('a whole answer with a widget offers Pin to Home', async () => {
    const onPin = vi.fn();
    const { container, getByRole } = render(<Harness onAsk={async () => ({ text: 'Done.', widget: <div className="wtile">W</div> })} onPin={onPin} />);
    fireEvent.click(getByRole('button', { name: 'Search or ask' }));
    type(container, 'zebra');
    fireEvent.keyDown(input(container), { key: 'Enter' });
    const pin = await waitFor(() => getByRole('button', { name: 'Pin to Home' }));
    fireEvent.click(pin);
    expect(onPin).toHaveBeenCalledWith(expect.objectContaining({ question: 'zebra', text: 'Done.' }));
    expect(container.querySelector('.cmdk')).toBeNull();
  });

  it('an Ask failure shows the error with Retry, and Retry asks again', async () => {
    const onAsk = vi.fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ text: 'Back up.' });
    const { container, getByRole } = render(<Harness onAsk={onAsk} />);
    fireEvent.click(getByRole('button', { name: 'Search or ask' }));
    type(container, 'why?');
    fireEvent.keyDown(input(container), { key: 'Enter' });
    await waitFor(() => expect(container.querySelector('.cmdk-err[role="alert"]')).not.toBeNull());
    fireEvent.click(getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(container.querySelector('.cmdk-a')?.textContent).toBe('Back up.'));
    expect(onAsk).toHaveBeenCalledTimes(2);
  });

  it('typing during an answer returns to the list and drops late chunks', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    async function* stream() { yield 'first'; await gate; yield ' late'; }
    const { container, getByRole } = render(<Harness onAsk={() => stream()} />);
    fireEvent.click(getByRole('button', { name: 'Search or ask' }));
    type(container, 'how?');
    fireEvent.keyDown(input(container), { key: 'Enter' });
    await waitFor(() => expect(container.querySelector('.cmdk-a')?.textContent).toBe('first'));
    type(container, 'inv');
    expect(container.querySelector('.cmdk-ans')).toBeNull();
    await act(async () => { release(); await gate; });
    expect(container.querySelector('.cmdk-ans')).toBeNull();
    expect(options(container).map((o) => o.textContent)).toContain('Invoices');
  });

  it('the Close button in the field row closes and returns focus to the trigger', () => {
    const { container, getByRole } = render(<Harness />);
    const trigger = getByRole('button', { name: 'Search or ask' });
    fireEvent.click(trigger);
    const close = getByRole('button', { name: 'Close' });
    expect(close.closest('.cmdk-field')).not.toBeNull();
    expect(close.classList.contains('cmdk-close')).toBe(true);
    fireEvent.click(close);
    expect(container.querySelector('.cmdk')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keys do nothing during IME composition: Enter, arrows and Escape', () => {
    const run = vi.fn();
    const { container, getByRole } = render(<Harness run={run} />);
    fireEvent.click(getByRole('button', { name: 'Search or ask' }));
    fireEvent.keyDown(input(container), { key: 'ArrowDown', isComposing: true });
    expect(options(container)[0].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input(container), { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input(container), { key: 'Enter', keyCode: 229 });
    expect(run).not.toHaveBeenCalled();
    fireEvent.keyDown(input(container), { key: 'Escape', isComposing: true });
    expect(container.querySelector('.cmdk')).not.toBeNull();
  });

  it('the results count leaves the Ask row out', () => {
    const { container, getByRole } = render(<Harness onAsk={() => ({ text: 'ok' })} />);
    fireEvent.click(getByRole('button', { name: 'Search or ask' }));
    type(container, 'zebra');
    expect(options(container)).toHaveLength(1);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('0 results');
  });
});
