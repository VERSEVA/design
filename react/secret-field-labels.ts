/**
 * Built-in words for the write-only secret field. Pure and React-free, so server code can read
 * and spread them; the client file imports them and does not export them again.
 */
export interface SecretFieldLabels {
  /** The badge beside the label once a value is stored. */
  set: string;
  replace: string;
  save: string;
  cancel: string;
  /** Read out in place of the Save label while the save runs. */
  saving: string;
  /** Announced when a save lands. */
  saved: string;
  /** Shown and announced when a save fails. Say how to fix it; never repeat the typed value. */
  error: string;
}

export const SECRET_FIELD_LABELS: SecretFieldLabels = {
  set: 'Set',
  replace: 'Replace',
  save: 'Save',
  cancel: 'Cancel',
  saving: 'Saving',
  saved: 'Saved',
  error: 'Not saved. Check the value and try again.',
};
