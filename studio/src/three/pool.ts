// Live WebGL context pool for ThreeStage: at most POOL_CAP live renderers on a page.
// A stage that cannot get a slot shows its thumb and waits; the newest waiter is served first.
export const POOL_CAP = 4;

let live = 0;
const waiters: Array<() => void> = [];

/** Takes a slot; returns its idempotent release, or null when the cap is reached. */
export function acquireSlot(): (() => void) | null {
  if (live >= POOL_CAP) return null;
  live++;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    live--;
    const next = waiters.pop();
    if (next) next();
  };
}

/** Calls fn once when a slot frees; returns the cancel. */
export function onSlotFree(fn: () => void): () => void {
  waiters.push(fn);
  return () => {
    const i = waiters.indexOf(fn);
    if (i > -1) waiters.splice(i, 1);
  };
}

export function liveSlots() { return live; }

let probed: boolean | null = null;
export function hasWebGL(): boolean {
  if (probed !== null) return probed;
  try {
    const c = document.createElement('canvas');
    probed = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    probed = false;
  }
  return probed;
}
export function resetWebGLProbe() { probed = null; }
