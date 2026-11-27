// The date range control (react/date-range.tsx): controlled, presets from the host, custom
// dates snapped on blur, an invalid range that emits nothing, and the keyboard of both variants.
// The sheet at phone width and real focus are held by test/served/date-range.test.mjs.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import * as React from 'react';
import { DateRange, type DateRangeProps, type DateRangeValue } from '../../react/date-range';
import { DATE_RANGE_LABELS } from '../../react/date-range-state';

const PRESETS = [
  { value: '7', label: 'This week', from: '2026-11-23', to: '2026-11-29' },
  { value: '28', label: '4 weeks', from: '2026-11-02', to: '2026-11-29' },
];
const WEEK: DateRangeValue = { range: '7', from: '2026-11-23', to: '2026-11-29', compare: false };
const DAY = 864e5;
const snapWeek = (date: string, edge: 'from' | 'to') => {
  const t = Date.parse(`${date}T00:00:00Z`);
  const monday = t - ((new Date(t).getUTCDay() + 6) % 7) * DAY;
  return new Date(edge === 'from' ? monday : monday + 6 * DAY).toISOString().slice(0, 10);
};

/* A host that keeps the value, as a page would. */
function Host({ start = WEEK, onChange, ...props }: Partial<DateRangeProps> & { start?: DateRangeValue }) {
  const [value, setValue] = React.useState(start);
  return <DateRange id="t" presets={PRESETS} {...props} value={value} onChange={(v) => { setValue(v); onChange?.(v); }} />;
}
const radio = (name: string) => screen.getByRole('radio', { name });
const input = (k: 'from' | 'to') => document.querySelector<HTMLInputElement>(`input[data-k="${k}"]`)!;
const realMatchMedia = window.matchMedia;
const phone = (on: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: on && q.includes('max-width: 559.98px'), media: q, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
};
afterEach(() => { window.matchMedia = realMatchMedia; });

describe('DateRange, segmented', () => {
  it('is a radiogroup on .seg with the host presets, and ships none of its own', () => {
    const { container } = render(<Host />);
    const group = screen.getByRole('radiogroup', { name: 'Range' });
    expect(group.className).toBe('seg');
    expect(group.parentElement!.className).toBe('range-ctl');
    expect(screen.getAllByRole('radio').map((b) => [b.textContent, b.getAttribute('aria-checked'), b.tabIndex])).toEqual([['This week', 'true', 0], ['4 weeks', 'false', -1]]);
    expect(container.querySelector('.fchip, .range-fields')).toBeNull();
    expect(container.querySelector('.range-ctl > .metaline')!.textContent).toBe('23 Nov to 29 Nov 2026');
    const none = render(<DateRange presets={[]} value={WEEK} onChange={() => {}} />);
    expect(none.container.querySelectorAll('[role="radio"]').length).toBe(0);
  });

  it('is controlled: a choice is one onChange with the whole value, and nothing moves until the host hands it back', () => {
    const onChange = vi.fn();
    render(<DateRange id="t" presets={PRESETS} value={WEEK} onChange={onChange} custom compare />);
    fireEvent.click(radio('4 weeks'));
    expect(onChange.mock.calls).toEqual([[{ range: '28', from: '2026-11-02', to: '2026-11-29', compare: false }]]);
    expect(radio('This week').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(radio('This week'));
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Compare with previous period' }));
    expect(onChange.mock.calls[1]).toEqual([{ ...WEEK, compare: true }]);
    fireEvent.click(radio('Custom'));
    expect(onChange.mock.calls[2]).toEqual([{ ...WEEK, range: 'custom' }]);
  });

  it('shows the date fields for Custom, snaps on blur and never while typing', () => {
    const onChange = vi.fn();
    const { container } = render(<Host custom snap={snapWeek} onChange={onChange} />);
    const fields = container.querySelector<HTMLElement>('.range-fields')!;
    expect(fields.hidden).toBe(true);
    fireEvent.click(radio('Custom'));
    expect(fields.hidden).toBe(false);
    onChange.mockClear();
    fireEvent.change(input('from'), { target: { value: '2026-11-04' } });
    expect([input('from').value, onChange.mock.calls.length]).toEqual(['2026-11-04', 0]);
    fireEvent.blur(input('from'));
    expect(input('from').value).toBe('2026-11-02');
    expect(onChange.mock.calls).toEqual([[{ range: 'custom', from: '2026-11-02', to: '2026-11-29', compare: false }]]);
    fireEvent.blur(input('from'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('an invalid custom range shows the field error and emits nothing', () => {
    const onChange = vi.fn();
    render(<Host custom start={{ ...WEEK, range: 'custom' }} onChange={onChange} min="2026-01-05" max="2026-11-29" />);
    const state = (k: 'from' | 'to') => {
      const help = document.getElementById(`t-${k}-e`)!;
      return [input(k).closest('.field')!.classList.contains('error'), input(k).getAttribute('aria-invalid'), help.hidden ? null : help.textContent, input(k).getAttribute('aria-describedby')];
    };
    fireEvent.change(input('to'), { target: { value: '2026-11-01' } });
    fireEvent.blur(input('to'));
    expect(state('to')).toEqual([true, 'true', 'End is before start', 't-to-e']);
    expect(state('from')).toEqual([false, null, null, null]);
    fireEvent.change(input('to'), { target: { value: '' } });
    fireEvent.blur(input('to'));
    expect(state('to')[2]).toBe('Enter an end date');
    fireEvent.change(input('to'), { target: { value: '2026-12-06' } });
    fireEvent.blur(input('to'));
    expect(state('to')[2]).toBe('Latest end is 29 Nov 2026');
    fireEvent.change(input('from'), { target: { value: '2025-12-29' } });
    fireEvent.blur(input('from'));
    expect(state('from')[2]).toBe('Earliest start is 5 Jan 2026');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input('from'), { target: { value: '2026-11-09' } });
    fireEvent.change(input('to'), { target: { value: '2026-11-15' } });
    fireEvent.keyDown(input('to'), { key: 'Enter' });
    expect(onChange.mock.calls).toEqual([[{ range: 'custom', from: '2026-11-09', to: '2026-11-15', compare: false }]]);
    expect([state('from')[0], state('to')[0]]).toEqual([false, false]);
  });

  it('shows the error of a value the host hands it invalid', () => {
    render(<DateRange id="t" presets={PRESETS} custom value={{ range: 'custom', from: '2026-11-16', to: '2026-11-08', compare: false }} onChange={() => {}} />);
    expect(input('to').getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById('t-to-e')!.textContent).toBe('End is before start');
  });

  it('arrows, Home and End move focus and choose, wrapping', () => {
    const onChange = vi.fn();
    render(<Host custom onChange={onChange} />);
    radio('This week').focus();
    const press = (key: string) => { fireEvent.keyDown(document.activeElement!, { key }); return [document.activeElement!.textContent, onChange.mock.lastCall![0].range]; };
    expect(press('ArrowRight')).toEqual(['4 weeks', '28']);
    expect(press('End')).toEqual(['Custom', 'custom']);
    expect(press('ArrowDown')).toEqual(['This week', '7']);
    expect(press('ArrowLeft')).toEqual(['Custom', 'custom']);
    expect(press('Home')).toEqual(['This week', '7']);
    expect(screen.getAllByRole('radio').map((b) => b.tabIndex)).toEqual([0, -1, -1]);
    fireEvent.keyDown(document.activeElement!, { key: 'a' });
    expect(onChange).toHaveBeenCalledTimes(5);
  });

  it('disables every control', () => {
    const onChange = vi.fn();
    const { container } = render(<Host custom compare disabled start={{ ...WEEK, range: 'custom' }} onChange={onChange} />);
    const controls = [...container.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input')];
    expect(controls.length).toBe(6);
    expect(controls.every((c) => c.disabled)).toBe(true);
    fireEvent.click(radio('This week'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('takes the host words, the range text and the zone', () => {
    const { container } = render(<Host custom compare zone="UTC" start={{ ...WEEK, compare: true }} labels={{ custom: 'Pick dates', compare: 'Versus', vsPrevious: 'vs prior' }} formatRange={(a, b) => `${a}/${b}`} />);
    expect(radio('Pick dates')).toBeTruthy();
    expect(container.querySelector('.fchip')!.textContent).toBe('Versus');
    expect(container.querySelector('.range-ctl > .metaline')!.textContent).toBe('2026-11-23/2026-11-29 · UTC · vs prior');
    expect(DATE_RANGE_LABELS.custom).toBe('Custom');
  });

  it('under 560px Custom opens the sheet, and only Apply with a valid range emits', async () => {
    phone(true);
    const onChange = vi.fn();
    const { container } = render(<Host custom snap={snapWeek} onChange={onChange} />);
    await waitFor(() => expect(radio('Custom').getAttribute('aria-haspopup')).toBe('dialog'));
    fireEvent.click(radio('Custom'));
    const sheet = () => container.querySelector<HTMLDialogElement>('dialog.sheet');
    expect(sheet()).not.toBeNull();
    expect(sheet()!.querySelector('.grab')).not.toBeNull();
    expect(document.getElementById(sheet()!.getAttribute('aria-labelledby')!)!.textContent).toBe('Custom range');
    expect(onChange).not.toHaveBeenCalled();
    const inDialog = (k: string) => sheet()!.querySelector<HTMLInputElement>(`input[data-k="${k}"]`)!;
    fireEvent.change(inDialog('from'), { target: { value: '2026-11-18' } });
    fireEvent.change(inDialog('to'), { target: { value: '2026-11-11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply', hidden: true }));
    expect([sheet() !== null, inDialog('to').getAttribute('aria-invalid'), onChange.mock.calls.length]).toEqual([true, 'true', 0]);
    fireEvent.change(inDialog('to'), { target: { value: '2026-11-25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply', hidden: true }));
    expect(onChange.mock.calls).toEqual([[{ range: 'custom', from: '2026-11-16', to: '2026-11-29', compare: false }]]);
    expect(sheet()).toBeNull();
    fireEvent.click(radio('Custom'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', hidden: true }));
    expect([sheet(), onChange.mock.calls.length]).toEqual([null, 1]);
  });
});

describe('DateRange, what counts as chosen', () => {
  const LAST_WEEK: DateRangeValue = { range: '7', from: '2026-11-16', to: '2026-11-22', compare: false };

  it('a preset is chosen only when its name and both dates match; other dates under its name read as Custom', () => {
    const { container } = render(<DateRange id="t" presets={PRESETS} custom value={LAST_WEEK} onChange={() => {}} />);
    expect(screen.getAllByRole('radio').map((b) => [b.textContent, b.getAttribute('aria-checked'), b.tabIndex])).toEqual([['This week', 'false', -1], ['4 weeks', 'false', -1], ['Custom', 'true', 0]]);
    expect(container.querySelector<HTMLElement>('.range-fields')!.hidden).toBe(false);
    expect([input('from').value, input('to').value]).toEqual(['2026-11-16', '2026-11-22']);
    expect(container.querySelector('.range-ctl > .metaline')!.textContent).toBe('16 Nov to 22 Nov 2026');
  });

  it('without Custom nothing is chosen, and the first preset is the tab stop', () => {
    render(<DateRange id="t" presets={PRESETS} value={LAST_WEEK} onChange={() => {}} />);
    expect(screen.getAllByRole('radio').map((b) => [b.getAttribute('aria-checked'), b.tabIndex])).toEqual([['false', 0], ['false', -1]]);
  });

  it('the menu trigger reads Custom, the host formatter, or the range itself, never nothing', () => {
    const face = () => document.querySelector('.menu > .btn')!.textContent;
    const { rerender } = render(<DateRange id="t" variant="menu" presets={PRESETS} custom value={LAST_WEEK} onChange={() => {}} />);
    expect(face()).toBe('Range: Custom16 Nov to 22 Nov 2026');
    expect([...document.querySelectorAll('.menu-item')].map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
    rerender(<DateRange id="t" variant="menu" presets={PRESETS} custom value={LAST_WEEK} onChange={() => {}} formatCustom={() => '1 week'} />);
    expect(face()).toBe('Range: 1 week16 Nov to 22 Nov 2026');
    rerender(<DateRange id="t" variant="menu" presets={PRESETS} compare value={{ ...LAST_WEEK, compare: true }} onChange={() => {}} />);
    expect(face()).toBe('Range: 16 Nov to 22 Nov 2026 · vs previous');
    expect(document.querySelector('.menu > .btn .metaline')).toBeNull();
  });

  it('two presets with one value: the first is chosen, React gets distinct keys, and development hears about it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<DateRange id="t" presets={[...PRESETS, { ...PRESETS[0], label: 'Again' }]} value={WEEK} onChange={() => {}} min="soon" />);
    expect(screen.getAllByRole('radio').map((b) => b.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(error).not.toHaveBeenCalled();
    expect(warn.mock.calls.map((c) => String(c[0]))).toEqual(['DateRange: two presets share the value "7"; the first one is the one chosen.', 'DateRange: min="soon" is not a YYYY-MM-DD date and is ignored.']);
    warn.mockRestore(); error.mockRestore();
  });
});

describe('DateRange, the fields and the host', () => {
  const CUSTOM: DateRangeValue = { range: 'custom', from: '2026-11-02', to: '2026-11-15', compare: false };

  it('when the host refuses a change, the fields go back to the value', () => {
    const onChange = vi.fn();
    render(<DateRange id="t" presets={PRESETS} custom value={CUSTOM} onChange={onChange} />);
    fireEvent.change(input('to'), { target: { value: '2026-11-22' } });
    fireEvent.blur(input('to'));
    expect(onChange.mock.calls).toEqual([[{ ...CUSTOM, to: '2026-11-22' }]]);
    expect(input('to').value).toBe('2026-11-15');
  });

  it('when the host changes the range or the dates, typed text and its error are dropped', () => {
    const { rerender } = render(<DateRange id="t" presets={PRESETS} custom value={CUSTOM} onChange={() => {}} />);
    fireEvent.change(input('from'), { target: { value: '2026-10-05' } });
    rerender(<DateRange id="t" presets={PRESETS} custom value={{ ...CUSTOM, from: '2026-11-09', to: '2026-11-29' }} onChange={() => {}} />);
    expect([input('from').value, input('to').value]).toEqual(['2026-11-09', '2026-11-29']);
    fireEvent.change(input('to'), { target: { value: '2026-11-01' } });
    fireEvent.blur(input('to'));
    expect(input('to').getAttribute('aria-invalid')).toBe('true');
    rerender(<DateRange id="t" presets={PRESETS} custom value={{ ...CUSTOM, range: 'other', from: '2026-11-09', to: '2026-11-29' }} onChange={() => {}} />);
    expect([input('to').value, input('to').getAttribute('aria-invalid')]).toEqual(['2026-11-29', null]);
    fireEvent.change(input('from'), { target: { value: '2026-10-05' } });
    rerender(<DateRange id="t" presets={PRESETS} custom value={{ ...CUSTOM, range: 'other', from: '2026-11-09', to: '2026-11-29', compare: true }} onChange={() => {}} />);
    expect(input('from').value).toBe('2026-10-05');
  });

  /* An edit abandoned by choosing a preset must not come back, or be sent, when Custom returns. */
  for (const [edge, typed, kept] of [['from', '2026-11-20', '2026-11-23'], ['from', '', '2026-11-23'], ['to', '2026-10-01', '2026-11-29'], ['to', '', '2026-11-29']] as const) {
    it(`an abandoned ${edge} edit (${typed || 'emptied'}) is gone after a preset and Custom again`, () => {
      const onChange = vi.fn();
      render(<Host custom start={CUSTOM} onChange={onChange} />);
      fireEvent.change(input(edge), { target: { value: typed } });
      fireEvent.blur(input(edge));
      expect([input(edge).value, document.querySelectorAll('[aria-invalid]').length, onChange.mock.calls.length]).toEqual([typed, 1, 0]);
      fireEvent.click(radio('This week'));
      fireEvent.click(radio('Custom'));
      expect(onChange.mock.lastCall![0]).toEqual({ ...WEEK, range: 'custom' });
      expect([input(edge).value, document.querySelectorAll('[aria-invalid]').length]).toEqual([kept, 0]);
      const other = edge === 'from' ? 'to' : 'from';
      fireEvent.blur(input(other));
      fireEvent.blur(input(edge));
      expect(onChange).toHaveBeenCalledTimes(2);
    });
  }

  it('when the custom fields close with no change of value, typed text and its error are dropped', () => {
    const LAST_WEEK: DateRangeValue = { range: '7', from: '2026-11-16', to: '2026-11-22', compare: false };
    const { container, rerender } = render(<DateRange id="t" presets={PRESETS} custom value={LAST_WEEK} onChange={() => {}} />);
    fireEvent.change(input('to'), { target: { value: '2026-11-01' } });
    fireEvent.blur(input('to'));
    expect(input('to').getAttribute('aria-invalid')).toBe('true');
    const BACK = [{ ...PRESETS[0], from: '2026-11-16', to: '2026-11-22' }, PRESETS[1]];
    rerender(<DateRange id="t" presets={BACK} custom value={LAST_WEEK} onChange={() => {}} />);
    expect(container.querySelector<HTMLElement>('.range-fields')!.hidden).toBe(true);
    rerender(<DateRange id="t" presets={PRESETS} custom value={LAST_WEEK} onChange={() => {}} />);
    expect([input('to').value, input('to').getAttribute('aria-invalid')]).toEqual(['2026-11-22', null]);
  });

  it('a half-typed year is a missing date, not year 2', () => {
    const onChange = vi.fn();
    render(<DateRange id="t" presets={PRESETS} custom value={CUSTOM} onChange={onChange} />);
    fireEvent.change(input('from'), { target: { value: '0002-11-02' } });
    fireEvent.blur(input('from'));
    expect([document.getElementById('t-from-e')!.textContent, onChange.mock.calls.length]).toEqual(['Enter a start date', 0]);
  });

  it('ignores a malformed min or max', () => {
    const onChange = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<DateRange id="t" presets={PRESETS} custom value={CUSTOM} onChange={onChange} min="nope" max="2026-99-99" />);
    expect([input('from').getAttribute('min'), input('from').getAttribute('max')]).toEqual([null, null]);
    fireEvent.change(input('to'), { target: { value: '2026-11-22' } });
    fireEvent.blur(input('to'));
    expect(onChange).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('the range line is a polite live region, and the menu groups its presets apart from Compare', () => {
    const { container, unmount } = render(<DateRange id="t" presets={PRESETS} value={WEEK} onChange={() => {}} />);
    expect(container.querySelector('.range-ctl > .metaline')!.getAttribute('aria-live')).toBe('polite');
    unmount();
    const menu = render(<DateRange id="t" variant="menu" presets={PRESETS} custom compare value={WEEK} onChange={() => {}} />);
    const group = menu.container.querySelector('.menu-list > [role="group"]')!;
    expect([group.getAttribute('aria-label'), [...group.children].map((c) => c.getAttribute('role'))]).toEqual(['Range', ['menuitemradio', 'menuitemradio', 'menuitemradio']]);
    expect([...menu.container.querySelector('.menu-list')!.children].map((c) => c.getAttribute('role'))).toEqual(['group', 'separator', 'menuitemcheckbox']);
  });
});

describe('DateRange, menu', () => {
  const trigger = () => document.querySelector<HTMLButtonElement>('.menu > .btn')!;
  const list = () => document.querySelector<HTMLElement>('.menu-list')!;
  const items = () => [...list().querySelectorAll<HTMLButtonElement>('.menu-item')];

  it('is one trigger on the existing .menu; no Custom and no Compare unless the host passes them', () => {
    const { container, rerender } = render(<DateRange id="t" variant="menu" presets={PRESETS} value={WEEK} onChange={() => {}} />);
    expect(container.firstElementChild!.className).toBe('menu');
    expect([trigger().getAttribute('aria-haspopup'), trigger().getAttribute('aria-expanded'), trigger().getAttribute('aria-controls'), list().id, list().hidden]).toEqual(['menu', 'false', 't-m', 't-m', true]);
    expect(trigger().textContent).toBe('Range: This week23 Nov to 29 Nov 2026');
    expect(items().map((b) => b.getAttribute('role'))).toEqual(['menuitemradio', 'menuitemradio']);
    expect(container.querySelector('.menu-sep, .range-ctl')).toBeNull();
    rerender(<DateRange id="t" variant="menu" presets={PRESETS} value={WEEK} onChange={() => {}} custom compare />);
    expect(items().map((b) => b.getAttribute('role'))).toEqual(['menuitemradio', 'menuitemradio', 'menuitemradio', 'menuitemcheckbox']);
  });

  it('opens on the checked preset, moves with the arrows, Home and End, and Escape returns focus to the trigger', async () => {
    const onChange = vi.fn();
    render(<Host variant="menu" custom compare start={{ ...WEEK, range: '28', from: '2026-11-02' }} onChange={onChange} />);
    trigger().focus();
    fireEvent.click(trigger());
    await waitFor(() => expect(document.activeElement).toBe(items()[1]));
    const press = (key: string) => { fireEvent.keyDown(document.activeElement!, { key }); return items().indexOf(document.activeElement as HTMLButtonElement); };
    expect([press('ArrowDown'), press('End'), press('ArrowDown'), press('ArrowUp'), press('Home')]).toEqual([2, 3, 0, 3, 0]);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect([list().hidden, trigger().getAttribute('aria-expanded'), document.activeElement === trigger(), onChange.mock.calls.length]).toEqual([true, 'false', true, 0]);
    fireEvent.keyDown(trigger(), { key: 'ArrowUp' });
    await waitFor(() => expect(document.activeElement).toBe(items()[3]));
    fireEvent.click(items()[0]);
    expect(onChange.mock.calls).toEqual([[WEEK]]);
    expect([list().hidden, document.activeElement === trigger(), trigger().textContent]).toEqual([true, true, 'Range: This week23 Nov to 29 Nov 2026']);
    fireEvent.click(trigger());
    fireEvent.click(items()[3]);
    expect(onChange.mock.lastCall).toEqual([{ ...WEEK, compare: true }]);
    expect(trigger().textContent).toBe('Range: This week23 Nov to 29 Nov 2026 · vs previous');
    fireEvent.click(trigger());
    act(() => { fireEvent.pointerDown(document.body); });
    expect(list().hidden).toBe(true);
  });

  it('Custom opens the modal on a desktop and the sheet on a phone', () => {
    const { container, unmount } = render(<Host variant="menu" custom />);
    fireEvent.click(trigger());
    fireEvent.click(items()[2]);
    expect(container.querySelector('dialog')!.className).toBe('modal');
    expect(container.querySelector('dialog .bd > .btn.icon')!.getAttribute('aria-label')).toBe('Close');
    fireEvent.click(container.querySelector('dialog .bd > .btn.icon')!);
    expect(container.querySelector('dialog')).toBeNull();
    unmount();
    phone(true);
    const next = render(<Host variant="menu" custom />);
    fireEvent.click(trigger());
    fireEvent.click(items()[2]);
    expect(next.container.querySelector('dialog')!.className).toBe('sheet');
  });

  it('disables the trigger', () => {
    render(<Host variant="menu" disabled />);
    expect(trigger().disabled).toBe(true);
  });
});

describe('DateRange on the server', () => {
  it('renders both variants with no window, with the ids it is given', () => {
    const html = renderToString(<><DateRange id="a" presets={PRESETS} value={WEEK} onChange={() => {}} custom compare /><DateRange id="b" variant="menu" presets={PRESETS} value={WEEK} onChange={() => {}} /></>);
    expect(html).toContain('id="a-from"');
    expect(html).toContain('id="b-m"');
    expect(html).not.toContain('aria-haspopup="dialog"');
  });
});
