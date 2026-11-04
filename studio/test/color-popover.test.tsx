// Color: one accent dot opens a popover with the five presets, a Custom hue and hex,
// live contrast checks per mode, and Copy theme. Esc closes and focus returns to the dot.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { App } from '../src/App';
import { BRANDS, getTheme, applyTheme } from '../src/theme';
import { CUSTOM_KEY, deriveAccent, themeCss } from '../src/shell/accent';

const root = document.documentElement;
const dot = () => document.querySelector<HTMLButtonElement>('.studio-head button.accentdot')!;
const pop = () => document.querySelector<HTMLElement>('.colorpop');
/* The popover body is its own chunk: wait for it after the press. */
const openPop = async () => {
  await act(async () => { fireEvent.click(dot()); });
  await vi.waitFor(() => { if (!pop()) throw new Error('popover not open'); }, { timeout: 5000 });
  await act(async () => {});
};

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  applyTheme({ brand: '', mode: 'dark' });
  document.getElementById('vsv-custom')?.remove();
});

describe('color popover', () => {
  it('opens from the dot, lists the presets plus Custom as radios, and closes on Esc back to the dot', async () => {
    render(<App />);
    expect(dot().getAttribute('aria-expanded')).toBe('false');
    await openPop();
    expect(dot().getAttribute('aria-expanded')).toBe('true');
    const radios = [...pop()!.querySelectorAll<HTMLElement>('[role="radio"]')];
    expect(radios.map((r) => r.textContent)).toEqual([...BRANDS.map((b) => b.label), 'Custom']);
    expect(document.activeElement).toBe(radios[0]);
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    await act(async () => { fireEvent.keyDown(pop()!, { key: 'Escape' }); });
    expect(pop()).toBeNull();
    expect(document.activeElement).toBe(dot());
  });

  it('arrow keys move between swatches and pick them', async () => {
    render(<App />);
    await openPop();
    const radios = () => [...pop()!.querySelectorAll<HTMLElement>('[role="radio"]')];
    await act(async () => { fireEvent.keyDown(radios()[0], { key: 'ArrowRight' }); });
    expect(document.activeElement).toBe(radios()[1]);
    expect(getTheme().brand).toBe('cobalt');
    expect(root.dataset.brand).toBe('cobalt');
    await act(async () => { fireEvent.keyDown(radios()[1], { key: 'ArrowLeft' }); fireEvent.keyDown(radios()[0], { key: 'ArrowLeft' }); });
    expect(document.activeElement?.textContent).toBe('Custom');
  });

  it('Custom: a hex pick is derived, gated per mode, applied, persisted; a failing pick shows its adjusted value', async () => {
    render(<App />);
    await openPop();
    await act(async () => { fireEvent.click([...pop()!.querySelectorAll<HTMLElement>('[role="radio"]')].at(-1)!); });
    const hex = pop()!.querySelector<HTMLInputElement>('input[aria-label="Hex"]')!;
    expect(pop()!.querySelector('input[type="range"][aria-label="Hue"]')).not.toBeNull();
    await act(async () => { fireEvent.change(hex, { target: { value: '#ffff00' } }); });
    const d = deriveAccent('#FFFF00');
    expect(root.dataset.brand).toBe('custom');
    expect(document.getElementById('vsv-custom')!.textContent).toContain(d.light.accent);
    expect(JSON.parse(localStorage.getItem(CUSTOM_KEY)!).light.accent).toBe(d.light.accent);
    const light = pop()!.querySelector<HTMLElement>('[data-mode-result="light"]')!;
    expect(light.textContent).toContain(d.light.accent);
    expect(light.textContent).toContain('Adjusted');
    expect([...light.querySelectorAll('[data-check]')].length).toBe(7);
    for (const row of light.querySelectorAll('[data-check]')) expect(row.textContent).toMatch(/Pass|Fail/);
    /* an invalid hex is flagged and changes nothing */
    await act(async () => { fireEvent.change(hex, { target: { value: '#12zz' } }); });
    expect(hex.getAttribute('aria-invalid')).toBe('true');
    expect(JSON.parse(localStorage.getItem(CUSTOM_KEY)!).pick).toBe('#FFFF00');
  });

  it('typing a hex one key at a time applies only the full value, and Esc from the page closes', async () => {
    render(<App />);
    await openPop();
    await act(async () => { fireEvent.click([...pop()!.querySelectorAll<HTMLElement>('[role="radio"]')].at(-1)!); });
    const hex = () => pop()!.querySelector<HTMLInputElement>('input[aria-label="Hex"]')!;
    let typed = '';
    for (const ch of '#FFD60A') { typed += ch; await act(async () => { fireEvent.change(hex(), { target: { value: typed } }); }); }
    expect(hex().value).toBe('#FFD60A');
    expect(JSON.parse(localStorage.getItem(CUSTOM_KEY)!).pick).toBe('#FFD60A');
    /* shorthand applies on Enter */
    await act(async () => { fireEvent.change(hex(), { target: { value: '#0af' } }); });
    expect(JSON.parse(localStorage.getItem(CUSTOM_KEY)!).pick).toBe('#FFD60A');
    await act(async () => { fireEvent.keyDown(hex(), { key: 'Enter' }); });
    expect(JSON.parse(localStorage.getItem(CUSTOM_KEY)!).pick).toBe('#00AAFF');
    (document.activeElement as HTMLElement | null)?.blur();
    await act(async () => { fireEvent.keyDown(document.body, { key: 'Escape' }); });
    expect(pop()).toBeNull();
    expect(document.activeElement).toBe(dot());
  });

  it('Copy theme copies the ready theme.css', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<App />);
    await openPop();
    await act(async () => { fireEvent.click([...pop()!.querySelectorAll<HTMLElement>('[role="radio"]')].at(-1)!); });
    await act(async () => { fireEvent.change(pop()!.querySelector('input[aria-label="Hex"]')!, { target: { value: '7c3aed' } }); });
    await act(async () => { fireEvent.click([...pop()!.querySelectorAll('button')].find((b) => b.textContent === 'Copy theme')!); });
    expect(writeText).toHaveBeenCalledWith(themeCss(deriveAccent('#7C3AED')));
    expect(pop()!.textContent).toContain('Copied');
  });

  it('is a bottom sheet under 900px that out-ranks the package rule for .tbar menu panels', () => {
    const css = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../src/studio.css'), 'utf8') as string;
    const phone = css.slice(css.indexOf('@media (max-width: 899.98px)'));
    /* components.css pins .tbar .menu .menu-list.panel under the bar below 900px (0,4,0); the sheet must win */
    expect(phone).toMatch(/\.studio-head \.colorwrap \.menu-list\.colorpop \{[^}]*top: auto;[^}]*bottom: 0;/);
  });

  it('traps focus while open: Tab from the last control wraps to the first, Shift+Tab from the first to the last', async () => {
    render(<App />);
    await openPop();
    await act(async () => { fireEvent.click([...pop()!.querySelectorAll<HTMLElement>('[role="radio"]')].at(-1)!); });
    expect(pop()!.getAttribute('aria-modal')).toBe('true');
    /* the swatches rove: only the checked one is in the tab order */
    const tabbable = () => [...pop()!.querySelectorAll<HTMLElement>('button,input')].filter((el) => el.tabIndex >= 0);
    const first = tabbable()[0];
    expect(first.getAttribute('aria-checked')).toBe('true');
    const last = tabbable().at(-1)!;
    last.focus();
    await act(async () => { fireEvent.keyDown(last, { key: 'Tab' }); });
    expect(document.activeElement).toBe(first);
    await act(async () => { fireEvent.keyDown(first, { key: 'Tab', shiftKey: true }); });
    expect(document.activeElement).toBe(last);
    /* Esc still closes and returns focus to the dot */
    await act(async () => { fireEvent.keyDown(last, { key: 'Escape' }); });
    expect(pop()).toBeNull();
    expect(document.activeElement).toBe(dot());
  });

  it('hue control: 20 steps right then 20 left returns the original pick', async () => {
    render(<App />);
    await openPop();
    await act(async () => { fireEvent.click([...pop()!.querySelectorAll<HTMLElement>('[role="radio"]')].at(-1)!); });
    await act(async () => { fireEvent.change(pop()!.querySelector('input[aria-label="Hex"]')!, { target: { value: '#FFFF00' } }); });
    const hue = () => pop()!.querySelector<HTMLInputElement>('input[aria-label="Hue"]')!;
    const start = Number(hue().value);
    for (let i = 1; i <= 20; i++) await act(async () => { fireEvent.change(hue(), { target: { value: String(start + i) } }); });
    expect(JSON.parse(localStorage.getItem(CUSTOM_KEY)!).pick).not.toBe('#FFFF00');
    for (let i = 19; i >= 0; i--) await act(async () => { fireEvent.change(hue(), { target: { value: String(start + i) } }); });
    expect(JSON.parse(localStorage.getItem(CUSTOM_KEY)!).pick).toBe('#FFFF00');
    expect(pop()!.querySelector<HTMLInputElement>('input[aria-label="Hex"]')!.value).toBe('#FFFF00');
  });

  it('the Custom swatch before any pick is not styled by the package empty-state recipe', async () => {
    render(<App />);
    await openPop();
    const sw = [...pop()!.querySelectorAll('.swatchbtn i')].at(-1)!;
    /* components.css .empty is the padded empty-state block; it stretched this 18px dot to 50 x 98 on the preview */
    expect(sw.classList.contains('empty')).toBe(false);
    expect(sw.classList.contains('swatch-none')).toBe(true);
  });
});
