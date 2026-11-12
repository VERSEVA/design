import * as React from 'react';
import { inertFor } from './inert-for';

export { inertFor };

/**
 * Props that make an element inert, the same on React 18 and React 19.
 * Spread the result: `<div {...inert(hidden)}>`.
 */
export function inert(on: boolean): Record<string, unknown> {
  return inertFor(React.version, on);
}
