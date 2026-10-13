// Interface stub: lane L1 fills the bodies against bin/contrast-pairs.mjs.
export type RGB = [number, number, number];
export interface PairResult { fg: string; bg: string; ratio: number; floor: number; pass: boolean }
export function ratio(_fg: RGB, _bg: RGB): number { return 0; }
export function composite(_fg: RGB, _bg: RGB, _alpha: number): RGB { return [0, 0, 0]; }
export function evaluatePairs(_root?: HTMLElement): PairResult[] { return []; }
