import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import * as React from 'react';
import { Segmented } from '../../react/segmented';

/* Segmented renders a tablist of buttons; the selected option carries aria-selected.
   It has no arrow-key handling, so selection moves on click only. */
const options = ['Day', 'Week', 'Month'];

function Controlled({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = React.useState('Week');
  return (
    <Segmented
      aria-label="Range"
      options={options}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

const selected = () => screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true');

describe('Segmented', () => {
  it('renders one button per option inside a labelled tablist', () => {
    render(<Segmented aria-label="Range" options={options} value="Day" onChange={() => {}} className="extra" />);
    const list = screen.getByRole('tablist', { name: 'Range' });
    expect(list.className).toBe('seg extra');
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(options);
    for (const t of tabs) {
      expect(t.tagName).toBe('BUTTON');
      expect(t.getAttribute('type')).toBe('button');
    }
  });

  it('marks exactly the selected option with aria-selected', () => {
    render(<Segmented options={options} value="Month" onChange={() => {}} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
  });

  it('fires onChange with the clicked option', () => {
    const onChange = vi.fn();
    render(<Segmented options={options} value="Day" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Month' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('Month');
  });

  it('moves the selection when a controlling parent updates value', () => {
    render(<Controlled />);
    expect(selected().map((t) => t.textContent)).toEqual(['Week']);
    fireEvent.click(screen.getByRole('tab', { name: 'Day' }));
    expect(selected().map((t) => t.textContent)).toEqual(['Day']);
  });

  it('does not change selection on arrow keys (not implemented)', () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const week = screen.getByRole('tab', { name: 'Week' });
    fireEvent.keyDown(week, { key: 'ArrowRight' });
    fireEvent.keyDown(week, { key: 'ArrowLeft' });
    expect(onChange).not.toHaveBeenCalled();
    expect(selected().map((t) => t.textContent)).toEqual(['Week']);
  });
});
