import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import * as React from 'react';
import { ToastProvider, useToast } from '../../react/toast';

/* One toast at a time in a polite live region; the dismiss button and the ~2.4s timer
   both clear it. Fake timers keep the timeout deterministic. */
function Trigger({ text, tone }: { text: string; tone?: 'ok' | 'err' }) {
  const toast = useToast();
  return <button onClick={() => toast(text, tone)}>show {text}</button>;
}

const mount = () =>
  render(
    <ToastProvider>
      <Trigger text="Quote issued." />
      <Trigger text="Blocked: ruling open." tone="err" />
    </ToastProvider>,
  );

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastProvider / useToast', () => {
  it('renders nothing until a toast is shown', () => {
    mount();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the message in a polite status live region with its tone class', () => {
    mount();
    fireEvent.click(screen.getByText('show Quote issued.'));
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toContain('Quote issued.');
    expect(region.querySelector('.toast')!.className).toBe('toast ok');
  });

  it('marks an error toast with the err tone, still announced', () => {
    mount();
    fireEvent.click(screen.getByText('show Blocked: ruling open.'));
    const region = screen.getByRole('status');
    expect(region.textContent).toContain('Blocked: ruling open.');
    expect(region.querySelector('.toast')!.className).toBe('toast err');
  });

  it('removes the toast when Dismiss is clicked', () => {
    mount();
    fireEvent.click(screen.getByText('show Quote issued.'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('Quote issued.')).toBeNull();
  });

  it('hides the toast after the 2.4s timeout (fake timers)', () => {
    vi.useFakeTimers();
    mount();
    fireEvent.click(screen.getByText('show Quote issued.'));
    act(() => vi.advanceTimersByTime(2399));
    expect(screen.getByRole('status').textContent).toContain('Quote issued.');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('keeps one toast at a time and restarts the timer on a new show', () => {
    vi.useFakeTimers();
    mount();
    fireEvent.click(screen.getByText('show Quote issued.'));
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByText('show Blocked: ruling open.'));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toContain('Blocked: ruling open.');
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole('status').textContent).toContain('Blocked: ruling open.');
    act(() => vi.advanceTimersByTime(400));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('clears its pending timer on unmount', () => {
    vi.useFakeTimers();
    const { unmount } = mount();
    fireEvent.click(screen.getByText('show Quote issued.'));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
