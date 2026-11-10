import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { Accordion } from '../../react/accordion';

/* The accordion is native details/summary: the summary is the trigger, details[open]
   is the expanded state. jsdom runs summary's click activation for real but does not
   turn Enter/Space into a click the way browsers do, so keyboard tests check the
   trigger is focusable and its keys are not swallowed, then fire the click the UA
   would dispatch. */
const items = [
  { title: 'Billing', content: 'Billing answer' },
  { title: 'Security', content: 'Security answer' },
];

const trigger = (name: string) => screen.getByText(name, { selector: 'summary' });
const panel = (text: string) => screen.getByText(text, { selector: '.accbody' });
const details = (name: string) => trigger(name).parentElement as HTMLDetailsElement;
const expanded = async (name: string, value: boolean) => {
  expect(details(name).open).toBe(value);
  await waitFor(() => expect(trigger(name).getAttribute('aria-expanded')).toBe(String(value)));
};

describe('Accordion', () => {
  it('starts closed: aria-expanded=false and the panel is not shown', async () => {
    render(<Accordion items={items} />);
    await expanded('Billing', false);
    expect(panel('Billing answer').closest('details')!.open).toBe(false);
  });

  it('honours defaultOpen', async () => {
    render(<Accordion items={[{ ...items[0], defaultOpen: true }, items[1]]} />);
    await expanded('Billing', true);
    await expanded('Security', false);
  });

  it('opens on click and closes on a second click', async () => {
    render(<Accordion items={items} />);
    fireEvent.click(trigger('Billing'));
    await expanded('Billing', true);
    fireEvent.click(trigger('Billing'));
    await expanded('Billing', false);
  });

  it.each(['Enter', ' '])('keyboard activation with %j matches pointer activation', async (key) => {
    render(<Accordion items={items} />);
    const t = trigger('Billing');
    t.focus();
    expect(document.activeElement).toBe(t);
    expect(fireEvent.keyDown(t, { key })).toBe(true);
    fireEvent.click(t);
    await expanded('Billing', true);
    expect(fireEvent.keyDown(t, { key })).toBe(true);
    fireEvent.click(t);
    await expanded('Billing', false);
  });

  it('opens only the activated item; items toggle independently (multi-open)', async () => {
    render(<Accordion items={items} />);
    fireEvent.click(trigger('Security'));
    await expanded('Security', true);
    await expanded('Billing', false);
    fireEvent.click(trigger('Billing'));
    await expanded('Billing', true);
    await expanded('Security', true);
  });
});
