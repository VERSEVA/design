// The registry React parts type-check against @types/react 18 and 19 (test/react-types/
// tsconfig.react18.json and .react19.json, both over every react/*.ts(x)), and inert
// renders on each runtime the way that runtime reads it.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import * as React from 'react';
import { inert, inertFor } from '../../react/inert';

const repo = path.resolve(__dirname, '../..');
const tsc = path.join(repo, 'studio/node_modules/typescript/bin/tsc');

function typecheck(version: '18' | '19'): string {
  try {
    execFileSync(process.execPath, [tsc, '-p', path.join(repo, `test/react-types/tsconfig.react${version}.json`)], { encoding: 'utf8', stdio: 'pipe' });
    return '';
  } catch (e) {
    return String((e as { stdout?: string }).stdout || e);
  }
}

describe('registry React parts', () => {
  it.each(['18', '19'] as const)('type-check on @types/react %s', (v) => {
    expect(typecheck(v)).toBe('');
  }, 60000);

  it('the fixtures resolve the React types they name', () => {
    const files = (v: string) => execFileSync(process.execPath, [tsc, '-p', path.join(repo, `test/react-types/tsconfig.react${v}.json`), '--listFilesOnly'], { encoding: 'utf8' });
    expect(files('18')).toMatch(/node_modules\/@types\/react-18\/index\.d\.ts/);
    expect(files('18')).not.toMatch(/node_modules\/@types\/react\/index\.d\.ts/);
    expect(files('19')).toMatch(/node_modules\/@types\/react\/index\.d\.ts/);
  }, 60000);
});

describe('inert', () => {
  it('is the boolean React 19 reads, and the string React 18 renders', () => {
    expect(inertFor('19.2.0', true)).toEqual({ inert: true });
    expect(inertFor('18.3.1', true)).toEqual({ inert: '' });
    expect(inertFor('18.3.1', false)).toEqual({});
    expect(inertFor('19.2.0', false)).toEqual({});
  });

  it('renders the attribute on this runtime (React 19)', () => {
    expect(React.version.startsWith('19')).toBe(true);
    const { container } = render(<><div data-t="on" {...inert(true)} /><div data-t="off" {...inert(false)} /></>);
    expect(container.querySelector('[data-t="on"]')!.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('[data-t="off"]')!.hasAttribute('inert')).toBe(false);
  });
});
