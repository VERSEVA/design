import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import * as React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { SecretField } from '../../react/secret-field';
import { SECRET_FIELD_LABELS } from '../../react/secret-field-labels';
import { Page as Components } from '../src/chapters/pages/components';

/* The write-only secret field. The security property is the acceptance test: once onSave
   resolves, the typed value is nowhere. Not in the markup, not in an attribute, not in the
   part's state or refs, not in a message, not in a console call. */

const SECRET = 'zq7-WRITE-ONLY-4f1c9e-sentinel';
const CONSOLE = ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'table', 'group', 'groupCollapsed'] as const;

function spyConsole() {
  return CONSOLE.map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
}
const consoleArgs = (spies: ReturnType<typeof spyConsole>) => spies.flatMap((s) => s.mock.calls.flat());

/** A promise the test settles by hand, so the saving state can be looked at. */
function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Every attribute value of every element in the document. */
const attributeValues = () => [...document.querySelectorAll('*')].flatMap((el) => [...el.attributes].map((a) => a.value));

/** True when `needle` sits in a string reachable from `value`. DOM nodes are not entered: the
    live input is the one legitimate holder while the user is still typing, and it is checked
    on its own. */
function holds(value: unknown, needle: string, seen = new WeakSet<object>(), depth = 0): boolean {
  if (typeof value === 'string') return value.includes(needle);
  if (value === null || typeof value !== 'object' || depth > 8) return false;
  if (typeof Node !== 'undefined' && value instanceof Node) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (value instanceof Error) return holds(value.message, needle, seen, depth + 1) || holds(value.stack, needle, seen, depth + 1);
  return Object.values(value as Record<string, unknown>).some((v) => holds(v, needle, seen, depth + 1));
}

interface Fiber { memoizedProps: unknown; memoizedState: unknown; pendingProps: unknown; child: Fiber | null; sibling: Fiber | null; alternate: Fiber | null }

/** The places React keeps a component's memory: props and every hook (state, refs, memos,
    effects), on the current tree and on the alternate it keeps from the render before. */
function reactMemoryHolds(container: Element, needle: string): boolean {
  const key = Object.keys(container).find((k) => k.startsWith('__reactContainer$'));
  if (!key) throw new Error('no React root on the container');
  const seen = new Set<Fiber>();
  const walk = (fiber: Fiber | null): boolean => {
    for (let f = fiber; f; f = f.sibling) {
      if (seen.has(f)) continue;
      seen.add(f);
      if (holds(f.memoizedProps, needle) || holds(f.pendingProps, needle)) return true;
      for (let hook = f.memoizedState as { memoizedState?: unknown; baseState?: unknown; queue?: unknown; next?: unknown } | null, n = 0; hook && typeof hook === 'object' && n < 200; hook = hook.next as typeof hook, n++) {
        if (holds(hook.memoizedState, needle) || holds(hook.baseState, needle) || holds(hook.queue, needle)) return true;
      }
      if (walk(f.child) || walk(f.alternate)) return true;
    }
    return false;
  };
  return walk((container as unknown as Record<string, Fiber>)[key]);
}

/** The typed value is nowhere outside `except` (the live input while the user may still retry). */
function expectNowhere(container: Element, except?: HTMLInputElement) {
  expect(document.documentElement.outerHTML).not.toContain(SECRET);
  expect(container.innerHTML).not.toContain(SECRET);
  expect(attributeValues().filter((v) => v.includes(SECRET))).toEqual([]);
  expect(document.documentElement.textContent).not.toContain(SECRET);
  for (const el of document.querySelectorAll<HTMLInputElement>('input, textarea')) {
    if (el === except) continue;
    expect(el.value).not.toContain(SECRET);
    expect(el.defaultValue).not.toContain(SECRET);
  }
  expect(reactMemoryHolds(container, SECRET)).toBe(false);
}

const input = (c: Element) => c.querySelector<HTMLInputElement>('input');
const type = (el: HTMLInputElement, value: string) => fireEvent.input(el, { target: { value } });
const button = (name: string) => screen.getByRole('button', { name });

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('SecretField: the value is gone after save', () => {
  it('holds the typed value nowhere once onSave resolves, and the input is unmounted', async () => {
    const spies = spyConsole();
    const d = deferred();
    const onSave = vi.fn((_value: string) => d.promise);
    const { container } = render(<SecretField label="Access token" isSet={false} onSave={onSave} />);
    const typed = input(container)!;
    type(typed, SECRET);
    expect(typed.value).toBe(SECRET);
    fireEvent.click(button('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]).toEqual([SECRET]);

    await act(async () => { d.resolve(); });

    expect(input(container)).toBeNull();
    expect(typed.isConnected).toBe(false);
    expect(typed.value).toBe('');
    expect(typed.defaultValue).toBe('');
    expect(typed.getAttribute('value')).toBeNull();
    expectNowhere(container);
    expect(consoleArgs(spies).filter((a) => holds(a, SECRET))).toEqual([]);
    expect(spies.every((s) => s.mock.calls.length === 0)).toBe(true);
  });

  it('opens Replace on an empty input, with nothing of the old value behind it', async () => {
    const { container } = render(<SecretField label="Access token" isSet={false} onSave={() => Promise.resolve()} />);
    type(input(container)!, SECRET);
    await act(async () => { fireEvent.click(button('Save')); });
    fireEvent.click(button('Replace'));
    const fresh = input(container)!;
    expect(fresh.value).toBe('');
    expect(fresh.getAttribute('value')).toBeNull();
    expectNowhere(container);
  });

  it('keeps the value out of the markup, the attributes and the state while typing and while saving', () => {
    const d = deferred();
    const { container } = render(<SecretField label="Access token" isSet={false} onSave={() => d.promise} />);
    const typed = input(container)!;
    type(typed, SECRET);
    expectNowhere(container, typed);
    fireEvent.click(button('Save'));
    expect(typed.value).toBe(SECRET);
    expectNowhere(container, typed);
  });

  it('on a rejected save keeps the value in the same input for a retry, and nowhere else', async () => {
    const spies = spyConsole();
    const first = deferred();
    const onSave = vi.fn<(value: string) => Promise<void>>().mockReturnValueOnce(first.promise).mockResolvedValueOnce(undefined);
    const { container } = render(<SecretField label="Access token" isSet={false} onSave={onSave} />);
    const typed = input(container)!;
    type(typed, SECRET);
    fireEvent.click(button('Save'));

    /* A host error that carries the value: the part must not show, keep or log it. */
    await act(async () => { first.reject(new Error(`rejected: ${SECRET}`)); });

    expect(input(container)).toBe(typed);
    expect(typed.value).toBe(SECRET);
    expect(typed.disabled).toBe(false);
    expect(document.activeElement).toBe(typed);
    expect(typed.getAttribute('aria-invalid')).toBe('true');
    const help = container.querySelector('.field.error .help')!;
    expect(help.textContent).toBe(SECRET_FIELD_LABELS.error);
    expect(help.getAttribute('role')).toBe('alert');
    expect(typed.getAttribute('aria-describedby')).toBe(help.id);
    expectNowhere(container, typed);
    expect(spies.every((s) => s.mock.calls.length === 0)).toBe(true);

    await act(async () => { fireEvent.click(button('Save')); });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[1]).toEqual([SECRET]);
    expect(typed.isConnected).toBe(false);
    expect(typed.value).toBe('');
    expectNowhere(container);
    expect(spies.every((s) => s.mock.calls.length === 0)).toBe(true);
  });

  it('treats a synchronous throw from onSave as a rejected save', async () => {
    const spies = spyConsole();
    const onSave = () => { throw new Error(`sync: ${SECRET}`); };
    const { container } = render(<SecretField label="Access token" isSet={false} onSave={onSave as unknown as (v: string) => Promise<void>} />);
    const typed = input(container)!;
    type(typed, SECRET);
    await act(async () => { fireEvent.click(button('Save')); });
    expect(typed.value).toBe(SECRET);
    expect(container.querySelector('.help')!.textContent).toBe(SECRET_FIELD_LABELS.error);
    expectNowhere(container, typed);
    expect(spies.every((s) => s.mock.calls.length === 0)).toBe(true);
  });

  it('drops the typed value on Cancel', async () => {
    const { container } = render(<SecretField label="Access token" isSet onSave={() => Promise.resolve()} />);
    fireEvent.click(button('Replace'));
    const typed = input(container)!;
    type(typed, SECRET);
    fireEvent.click(button('Cancel'));
    expect(typed.isConnected).toBe(false);
    expect(typed.value).toBe('');
    expectNowhere(container);
  });

  it('stays in the input when the host flips isSet while the save is still running', async () => {
    const d = deferred();
    const view = (isSet: boolean) => <SecretField label="Access token" isSet={isSet} onSave={() => d.promise} />;
    const { container, rerender } = render(view(false));
    const typed = input(container)!;
    type(typed, SECRET);
    fireEvent.click(button('Save'));
    rerender(view(true));
    expect(input(container)).toBe(typed);
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(container.querySelector('.btn-primary'));
    await act(async () => { d.reject(new Error(SECRET)); });
    expect(input(container)).toBe(typed);
    expect(typed.value).toBe(SECRET);
    expect(document.activeElement).toBe(typed);
    expect(container.querySelector('.help')!.textContent).toBe(SECRET_FIELD_LABELS.error);
    expectNowhere(container, typed);
    fireEvent.click(button('Cancel'));
    expect(typed.value).toBe('');
    expect(document.activeElement).toBe(button('Replace'));
  });

  it('settles quietly when it unmounts mid-save', async () => {
    const spies = spyConsole();
    const d = deferred();
    const { container, unmount } = render(<SecretField label="Access token" isSet={false} onSave={() => d.promise} />);
    const typed = input(container)!;
    type(typed, SECRET);
    fireEvent.click(button('Save'));
    unmount();
    await act(async () => { d.reject(new Error(SECRET)); });
    expect(typed.value).toBe('');
    expect(spies.every((s) => s.mock.calls.length === 0)).toBe(true);
  });

  it('has no prop that carries a value in', () => {
    const noop = () => Promise.resolve();
    // @ts-expect-error the part never receives the stored value
    const a = <SecretField label="Access token" isSet onSave={noop} value="x" />;
    // @ts-expect-error nor a starting one
    const b = <SecretField label="Access token" isSet onSave={noop} defaultValue="x" />;
    const { container } = render(<>{a}{b}</>);
    expect(container.innerHTML).not.toContain('value=');
  });
});

describe('SecretField: input', () => {
  it('is a password input that asks the browser to stay out of it, with no name unless the host gives one', () => {
    const { container, rerender } = render(<SecretField label="Access token" isSet={false} onSave={() => Promise.resolve()} />);
    const el = input(container)!;
    expect(el.type).toBe('password');
    expect(el.getAttribute('autocomplete')).toBe('off');
    expect(el.getAttribute('spellcheck')).toBe('false');
    expect(el.getAttribute('autocapitalize')).toBe('off');
    expect(el.hasAttribute('name')).toBe(false);
    expect(el.hasAttribute('value')).toBe(false);
    expect(el.hasAttribute('placeholder')).toBe(false);
    expect(el.closest('form')).toBeNull();
    expect(screen.getByLabelText('Access token')).toBe(el);
    rerender(<SecretField label="Access token" isSet={false} onSave={() => Promise.resolve()} name="token" id="tok" />);
    expect([el.getAttribute('name'), el.id]).toEqual(['token', 'tok']);
  });
});

describe('SecretField: states', () => {
  it('unset: an empty input, Save disabled, no badge, no Cancel', () => {
    const { container } = render(<SecretField label="Access token" isSet={false} onSave={() => Promise.resolve()} />);
    expect(container.querySelector('.field')!.className).toBe('field');
    expect(input(container)!.value).toBe('');
    expect((button('Save') as HTMLButtonElement).disabled).toBe(true);
    expect(button('Save').className).toBe('btn btn-primary sm');
    expect(container.querySelector('.badge')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull();
  });

  it('typing: Save turns on with the first character and off again when the input is emptied', () => {
    const { container } = render(<SecretField label="Access token" isSet={false} onSave={() => Promise.resolve()} />);
    type(input(container)!, 'a');
    expect((button('Save') as HTMLButtonElement).disabled).toBe(false);
    type(input(container)!, '');
    expect((button('Save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('saving: the input is disabled, Save is busy and holds focus, and one save runs', () => {
    const d = deferred();
    const onSave = vi.fn(() => d.promise);
    const { container } = render(<SecretField label="Access token" isSet={false} onSave={onSave} />);
    type(input(container)!, SECRET);
    fireEvent.click(button('Save'));
    const save = container.querySelector<HTMLButtonElement>('.btn-primary')!;
    expect(input(container)!.disabled).toBe(true);
    expect(save.getAttribute('aria-busy')).toBe('true');
    expect(save.disabled).toBe(false);
    expect(save.querySelector('.spinner')!.getAttribute('aria-hidden')).toBe('true');
    expect(save.querySelector('.sr-only')!.textContent).toBe('Saving');
    expect(document.activeElement).toBe(save);
    fireEvent.click(save);
    fireEvent.keyDown(input(container)!, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('set: a neutral badge reading Set and a Replace action; no input', () => {
    const { container } = render(<SecretField label="Access token" isSet onSave={() => Promise.resolve()} />);
    const badge = container.querySelector('.badge')!;
    expect(badge.className).toBe('badge neutral');
    expect(badge.textContent).toBe('Set');
    expect(badge.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(input(container)).toBeNull();
    const replace = button('Replace');
    expect(replace.className).toBe('btn btn-secondary sm');
    const label = container.querySelector('label')!;
    expect(label.hasAttribute('for')).toBe(false);
    expect(replace.getAttribute('aria-describedby')).toBe(label.id);
  });

  it('replacing: an empty input in the same spot, with Cancel before Save; the badge stays', () => {
    const { container } = render(<SecretField label="Access token" isSet onSave={() => Promise.resolve()} />);
    fireEvent.click(button('Replace'));
    expect(input(container)!.value).toBe('');
    expect(container.querySelector('.badge')!.textContent).toBe('Set');
    const row = [...container.querySelectorAll('.field > .chiprow:last-of-type button')];
    expect(row.map((b) => b.textContent)).toEqual(['Cancel', 'Save']);
    expect(row[0].className).toBe('btn btn-ghost sm');
    expect((row[1] as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('.field > :nth-child(2)')).toBe(input(container));
  });

  it('error: the field takes the error class and the message replaces nothing the user typed', async () => {
    const { container } = render(<SecretField label="Access token" isSet onSave={() => Promise.reject(new Error('no'))} labels={{ error: 'The provider rejected this token. Paste a new one.' }} />);
    fireEvent.click(button('Replace'));
    type(input(container)!, SECRET);
    await act(async () => { fireEvent.click(button('Save')); });
    expect(container.querySelector('.field')!.className).toBe('field error');
    expect(container.querySelector('.help')!.textContent).toBe('The provider rejected this token. Paste a new one.');
    expect(input(container)!.value).toBe(SECRET);
    expect((button('Cancel') as HTMLButtonElement).disabled).toBe(false);
    expect((button('Save') as HTMLButtonElement).disabled).toBe(false);
    type(input(container)!, `${SECRET}x`);
    expect(container.querySelector('.field')!.className).toBe('field error');
  });

  it('never repeats the typed value in the error, even when the host label is built from it', async () => {
    const { container } = render(<SecretField label="Access token" isSet={false} onSave={() => Promise.reject()} labels={{ error: `Rejected ${SECRET}` }} />);
    const typed = input(container)!;
    type(typed, SECRET);
    await act(async () => { fireEvent.click(button('Save')); });
    expect(container.querySelector('.help')!.textContent).toBe(SECRET_FIELD_LABELS.error);
    expect(document.documentElement.outerHTML).not.toContain(SECRET);
  });
});

describe('SecretField: focus never drops to the page', () => {
  const notOnBody = () => expect(document.activeElement).not.toBe(document.body);

  it('lands on Replace after a save, in the input after Replace, on Replace after Cancel', async () => {
    const { container } = render(<SecretField label="Access token" isSet={false} onSave={() => Promise.resolve()} />);
    const typed = input(container)!;
    typed.focus();
    type(typed, SECRET);
    button('Save').focus();
    await act(async () => { fireEvent.click(button('Save')); });
    expect(document.activeElement).toBe(button('Replace'));
    fireEvent.click(button('Replace'));
    expect(document.activeElement).toBe(input(container));
    fireEvent.click(button('Cancel'));
    expect(document.activeElement).toBe(button('Replace'));
    notOnBody();
  });

  it('Enter saves and Escape cancels a replace, each with focus placed', async () => {
    const onSave = vi.fn(() => Promise.resolve());
    const { container } = render(<SecretField label="Access token" isSet onSave={onSave} />);
    fireEvent.click(button('Replace'));
    fireEvent.keyDown(input(container)!, { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.keyDown(input(container)!, { key: 'Escape' });
    expect(document.activeElement).toBe(button('Replace'));
    fireEvent.click(button('Replace'));
    type(input(container)!, SECRET);
    await act(async () => { fireEvent.keyDown(input(container)!, { key: 'Enter' }); });
    expect(onSave).toHaveBeenCalledWith(SECRET);
    expect(document.activeElement).toBe(button('Replace'));
    notOnBody();
  });

  it('Escape does nothing on an unset field: there is nothing to go back to', () => {
    const { container } = render(<SecretField label="Access token" isSet={false} onSave={() => Promise.resolve()} />);
    const typed = input(container)!;
    typed.focus();
    type(typed, SECRET);
    fireEvent.keyDown(typed, { key: 'Escape' });
    expect(input(container)).toBe(typed);
    expect(typed.value).toBe(SECRET);
  });

  it('Save on an empty input puts focus in the input and saves nothing', () => {
    const onSave = vi.fn(() => Promise.resolve());
    const { container } = render(<SecretField label="Access token" isSet={false} onSave={onSave} />);
    fireEvent.keyDown(input(container)!, { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows Set and focuses Replace after a save even while the host has not flipped isSet yet', async () => {
    const { container, rerender } = render(<SecretField label="Access token" isSet={false} onSave={() => Promise.resolve()} />);
    type(input(container)!, SECRET);
    await act(async () => { fireEvent.click(button('Save')); });
    expect(container.querySelector('.badge')!.textContent).toBe('Set');
    expect(document.activeElement).toBe(button('Replace'));
    expect(container.querySelector('[role="status"]')!.textContent).toBe('Saved');
    rerender(<SecretField label="Access token" isSet onSave={() => Promise.resolve()} />);
    expect(document.activeElement).toBe(button('Replace'));
    rerender(<SecretField label="Access token" isSet={false} onSave={() => Promise.resolve()} />);
    expect(container.querySelector('.badge')).toBeNull();
    expect(input(container)!.value).toBe('');
  });
});

describe('SecretField: labels', () => {
  it('takes its words from the pure module and lets the host replace any of them', async () => {
    expect(SECRET_FIELD_LABELS).toEqual({ set: 'Set', replace: 'Replace', save: 'Save', cancel: 'Cancel', saving: 'Saving', saved: 'Saved', error: 'Not saved. Check the value and try again.' });
    const { container } = render(<SecretField label="Access token" isSet onSave={() => Promise.resolve()} labels={{ replace: 'Replace token', save: 'Save token', saved: 'Token saved' }} />);
    fireEvent.click(button('Replace token'));
    type(input(container)!, SECRET);
    await act(async () => { fireEvent.click(button('Save token')); });
    expect(container.querySelector('[role="status"]')!.textContent).toBe('Token saved');
    expect(button('Replace token')).toBeTruthy();
  });

  it('opens with the client directive; the labels module is pure and the client file does not export them', () => {
    const dir = path.resolve(__dirname, '../../react');
    const part = fs.readFileSync(path.join(dir, 'secret-field.tsx'), 'utf8');
    const labels = fs.readFileSync(path.join(dir, 'secret-field-labels.ts'), 'utf8');
    expect(part.startsWith("'use client';\n")).toBe(true);
    expect(part).not.toMatch(/export\s+(const|let|var)\s+[A-Z_]+LABELS|export\s*\{[^}]*LABELS/);
    expect(labels).not.toMatch(/use client|from 'react'|from "react"/);
  });
});

describe('SecretField: the studio specimen is the part', () => {
  /* Attributes in name order, so the comparison is of what is there, not of how it was written. */
  const canon = (el: Element) => {
    const copy = el.cloneNode(true) as Element;
    for (const n of [copy, ...copy.querySelectorAll('*')]) {
      const attrs = [...n.attributes].map((a) => [a.name, a.value] as const).sort(([a], [b]) => a.localeCompare(b));
      for (const [name] of attrs) n.removeAttribute(name);
      for (const [name, value] of attrs) n.setAttribute(name, value);
    }
    return copy.outerHTML;
  };
  const LABELS = { save: 'Save token', replace: 'Replace token', error: 'The provider rejected this token. Paste a new one.' };
  const mount = (id: string, isSet: boolean, onSave: () => Promise<void>) => render(<SecretField id={id} label="Access token" isSet={isSet} onSave={onSave} labels={LABELS} />).container;
  const STATES: Record<string, (id: string) => Promise<Element>> = {
    Unset: async (id) => mount(id, false, () => Promise.resolve()),
    Typing: async (id) => { const c = mount(id, false, () => Promise.resolve()); type(input(c)!, SECRET); return c; },
    Saving: async (id) => { const c = mount(id, false, () => new Promise<void>(() => {})); type(input(c)!, SECRET); fireEvent.click(c.querySelector('.btn-primary')!); return c; },
    Set: async (id) => mount(id, true, () => Promise.resolve()),
    Replacing: async (id) => { const c = mount(id, true, () => Promise.resolve()); fireEvent.click(c.querySelector('.btn-secondary')!); return c; },
    Error: async (id) => {
      const c = mount(id, true, () => Promise.reject(new Error('no')));
      fireEvent.click(c.querySelector('.btn-secondary')!);
      type(input(c)!, SECRET);
      await act(async () => { fireEvent.click(c.querySelector('.btn-primary')!); });
      return c;
    },
  };

  it('shows all six states, each one the markup the part renders in that state', async () => {
    const page = render(<Components />).container;
    const states = [...page.querySelectorAll('#secret .secret-state')];
    expect(states.map((s) => s.querySelector('.grouplabel')!.textContent)).toEqual(['Unset', 'Typing', 'Saving', 'Set', 'Replacing', 'Error']);
    for (const state of states) {
      const name = state.querySelector('.grouplabel')!.textContent!;
      const want = state.querySelector('.specimen > .field')!;
      const id = (want.querySelector('label')!.id).replace(/-l$/, '');
      const got = (await STATES[name](id)).querySelector('.field')!;
      expect(canon(got), name).toBe(canon(want));
    }
  });

  it('writes no value into the specimen markup and spends no accent on the badge', () => {
    const page = render(<Components />).container;
    const tile = page.querySelector('#secret')!;
    expect([...tile.querySelectorAll('input')].map((i) => [i.type, i.hasAttribute('value')])).toEqual(Array(5).fill(['password', false]));
    expect([...tile.querySelectorAll('.badge')].map((b) => b.className)).toEqual(Array(3).fill('badge neutral'));
    expect([...tile.querySelectorAll('.specimen')].every((s) => s.hasAttribute('inert'))).toBe(true);
  });
});
