import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import * as React from 'react';
import axe from 'axe-core';
import { LiveActivity } from '../../react/live-activity';
import type { Activity } from '../../react/live-activity';

const job = (id: string, progress: number | null, extra: Partial<Activity> = {}): Activity => ({ id, name: `Job ${id}`, steps: ['Install', 'Build', 'Upload', 'Promote'], progress, ...extra });

afterEach(() => vi.useRealTimers());

function Bar(props: React.ComponentProps<typeof LiveActivity>) {
  return (
    <header className="tbar">
      <div className="tbar-end">
        <LiveActivity {...props} />
        <button type="button" className="ibtn" aria-label="Notifications">bell</button>
      </div>
    </header>
  );
}

describe('LiveActivity', () => {
  it('capsule shows the running job closest to done, +n running only, and sits before the bell', () => {
    const { container } = render(<Bar activities={[job('a', 0.2), job('b', 0.7), job('c', 1, { done: true })]} />);
    const cap = container.querySelector('.lact')!;
    expect(cap.getAttribute('data-state')).toBe('running');
    expect(container.querySelector('.lact-name')?.textContent).toBe('Job b');
    expect(container.querySelector('.lact-pc')?.textContent).toBe('70%');
    expect(container.querySelector('.lact-more')?.textContent).toBe('+1');
    expect(cap.getAttribute('aria-label')).toBe('Live activity: Job b, 70%, 1 more running');
    const end = container.querySelector('.tbar-end')!;
    expect(end.firstElementChild?.classList.contains('lact-wrap')).toBe(true);
  });

  it('hidden with no jobs; done state, then leaves after the delay and calls onDone once', async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const onLeave = vi.fn();
    const { container, rerender } = render(<Bar activities={[]} onDone={onDone} onLeave={onLeave} />);
    expect((container.querySelector('.lact-wrap') as HTMLElement).hidden).toBe(true);
    rerender(<Bar activities={[job('a', 0.9)]} onDone={onDone} onLeave={onLeave} />);
    expect((container.querySelector('.lact-wrap') as HTMLElement).hidden).toBe(false);
    rerender(<Bar activities={[job('a', 1, { done: true })]} onDone={onDone} onLeave={onLeave} />);
    expect(container.querySelector('.lact')?.getAttribute('data-state')).toBe('done');
    expect(onDone).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(5999); });
    expect((container.querySelector('.lact-wrap') as HTMLElement).hidden).toBe(false);
    await act(async () => { vi.advanceTimersByTime(1); });
    expect((container.querySelector('.lact-wrap') as HTMLElement).hidden).toBe(true);
    expect(onLeave).toHaveBeenCalledWith('a');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('done never leaves while the panel is open', async () => {
    vi.useFakeTimers();
    const { container, getByRole, rerender } = render(<Bar activities={[job('a', 0.5)]} />);
    fireEvent.click(container.querySelector('.lact')!);
    rerender(<Bar activities={[job('a', 1, { done: true })]} />);
    await act(async () => { vi.advanceTimersByTime(60000); });
    expect(getByRole('dialog', { hidden: false }).querySelectorAll('.lact-item')).toHaveLength(1);
    fireEvent.keyDown(container.querySelector('.lact-panel')!, { key: 'Escape' });
    await act(async () => { vi.advanceTimersByTime(5999); });
    expect((container.querySelector('.lact-wrap') as HTMLElement).hidden).toBe(false);
    await act(async () => { vi.advanceTimersByTime(1); });
    expect((container.querySelector('.lact-wrap') as HTMLElement).hidden).toBe(true);
  });

  it('first render announces nothing and fires no onDone, so a remount writes no duplicate notification', () => {
    const onDone = vi.fn();
    const list = [job('a', 1, { done: true }), job('b', 0.3)];
    const { container, unmount } = render(<Bar activities={list} onDone={onDone} />);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('');
    unmount();
    render(<React.StrictMode><Bar activities={list} onDone={onDone} /></React.StrictMode>);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('an identical message is announced again: the region keeps its node, its content node is replaced', () => {
    const { container, rerender } = render(<Bar activities={[job('a', 0)]} />);
    const status = container.querySelector('[role="status"]')!;
    const alert = container.querySelector('[role="alert"]')!;
    rerender(<Bar activities={[job('a', 0.1, { error: 'x' })]} />);
    const firstAlert = alert.firstElementChild;
    expect(alert.textContent).toBe('Job a failed: x');
    rerender(<Bar activities={[job('a', 0)]} />);
    const firstStart = status.firstElementChild;
    expect(status.textContent).toBe('Job a started');
    rerender(<Bar activities={[job('a', 0.1, { error: 'x' })]} />);
    expect(alert.textContent).toBe('Job a failed: x');
    expect(alert.firstElementChild).not.toBe(firstAlert);
    rerender(<Bar activities={[job('a', 0)]} />);
    expect(status.textContent).toBe('Job a started');
    expect(status.firstElementChild).not.toBe(firstStart);
    expect(container.querySelector('[role="status"]')).toBe(status);
  });

  it('duplicate ids: the last one wins, +n is right, one row per id, and a dev warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<Bar activities={[job('a', 0.2), job('b', 0.5), job('a', 1, { done: true })]} />);
    expect(container.querySelector('.lact-name')?.textContent).toBe('Job b');
    expect(container.querySelector('.lact-more')).toBeNull();
    fireEvent.click(container.querySelector('.lact')!);
    expect(container.querySelectorAll('.lact-item')).toHaveLength(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('duplicate activity id "a"'));
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });

  it('a job that finishes and is removed in one push is not announced as cancelled', () => {
    const { container, rerender } = render(<Bar activities={[job('a', 0.9)]} />);
    rerender(<Bar activities={[]} />);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');
  });

  it('onLeave fires once under StrictMode', async () => {
    vi.useFakeTimers();
    const onLeave = vi.fn();
    const { rerender } = render(<React.StrictMode><Bar activities={[job('a', 0.5)]} onLeave={onLeave} /></React.StrictMode>);
    rerender(<React.StrictMode><Bar activities={[job('a', 1, { done: true })]} onLeave={onLeave} /></React.StrictMode>);
    await act(async () => { vi.advanceTimersByTime(6000); });
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('error: danger state with Retry, never auto-leaves, announced as an alert', async () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    const { container, rerender } = render(<Bar activities={[job('a', 0.4)]} onRetry={onRetry} />);
    rerender(<Bar activities={[job('a', 0.4, { error: 'Build failed' })]} onRetry={onRetry} />);
    expect(container.querySelector('.lact')?.getAttribute('data-state')).toBe('error');
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Job a failed: Build failed');
    await act(async () => { vi.advanceTimersByTime(600000); });
    fireEvent.click(container.querySelector('.lact')!);
    const item = container.querySelector('.lact-item')!;
    expect(item.getAttribute('data-state')).toBe('error');
    expect(item.querySelector('.lact-err')?.textContent).toBe('Build failed');
    fireEvent.click(item.querySelector('button')!);
    expect(onRetry).toHaveBeenCalledWith('a');
  });

  it('status announces start, 25% steps and cancel; rows update in place', () => {
    const onCancel = vi.fn();
    const { container, rerender } = render(<Bar activities={[]} onCancel={onCancel} />);
    const status = container.querySelector('[role="status"]')!;
    rerender(<Bar activities={[job('a', 0)]} onCancel={onCancel} />);
    expect(status.textContent).toBe('Job a started');
    fireEvent.click(container.querySelector('.lact')!);
    const row = container.querySelector('.lact-item');
    rerender(<Bar activities={[job('a', 0.1)]} onCancel={onCancel} />);
    expect(status.textContent).toBe('Job a started');
    rerender(<Bar activities={[job('a', 0.55)]} onCancel={onCancel} />);
    expect(status.textContent).toBe('Job a 50%');
    expect(container.querySelector('.lact-item')).toBe(row);
    expect(row?.querySelector('.lact-step')?.textContent).toBe('Upload');
    expect(row?.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('55');
    fireEvent.click(row!.querySelector('button')!);
    expect(onCancel).toHaveBeenCalledWith('a');
    rerender(<Bar activities={[]} onCancel={onCancel} />);
    expect(status.textContent).toBe('Job a cancelled');
    expect(container.querySelector('.panel-empty')?.textContent).toBe('No activity');
  });

  it('panel: dialog semantics, Escape returns focus to the capsule, outside pointer closes, no axe violations', async () => {
    const { container, getByRole } = render(<Bar activities={[job('a', 0.3), job('b', null)]} onCancel={() => {}} onClearDone={() => {}} />);
    const cap = container.querySelector('.lact') as HTMLButtonElement;
    expect(cap.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(cap);
    expect(cap.getAttribute('aria-expanded')).toBe('true');
    const dialog = getByRole('dialog', { name: 'Live activity' });
    expect(dialog.id).toBe(cap.getAttribute('aria-controls'));
    expect(container.querySelector('.lact-item[data-state="pending"] [role="progressbar"]')?.hasAttribute('aria-valuenow')).toBe(false);
    const results = await axe.run(container, { rules: { region: { enabled: false } } });
    expect(results.violations.map((v) => v.id)).toEqual([]);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(dialog.hidden).toBe(true);
    expect(document.activeElement).toBe(cap);
    fireEvent.click(cap);
    fireEvent.pointerDown(document.body);
    expect(dialog.hidden).toBe(true);
  });
});
