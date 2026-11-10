import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import * as React from 'react';
import { Modal } from '../../react/modal';

const renderModal = (onClose = vi.fn()) => {
  render(
    <Modal open onClose={onClose} title="Delete project">
      <p>Body copy</p>
    </Modal>,
  );
  return onClose;
};

describe('Modal', () => {
  it('renders a dialog with aria-modal and aria-label from the title', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Delete project' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Delete project');
  });

  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={vi.fn()} title="Hidden">x</Modal>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('calls onClose on Escape', () => {
    const onClose = renderModal();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const onClose = renderModal();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on overlay click but not on a click inside the dialog', () => {
    const onClose = renderModal();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(screen.getByText('Body copy'));
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus into the dialog on open', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
