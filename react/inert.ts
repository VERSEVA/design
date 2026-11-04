import * as React from 'react';

/**
 * Props that make an element inert, the same on React 18 and React 19.
 * React 19 knows `inert` as a boolean and drops an empty string; React 18 does not know it,
 * drops a boolean, and only renders it from a string. Spread the result: `<div {...inert(hidden)}>`.
 */
export function inertFor(version: string, on: boolean): Record<string, unknown> {
  if (!on) return {};
  return { inert: Number.parseInt(version, 10) < 19 ? '' : true };
}

export function inert(on: boolean): Record<string, unknown> {
  return inertFor(React.version, on);
}
