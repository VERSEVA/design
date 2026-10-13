// Node 25 ships a global localStorage that shadows jsdom's; give tests a working one.
class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
Object.defineProperty(window, 'localStorage', { value: globalThis.localStorage, configurable: true });

if (!window.matchMedia) {
  window.matchMedia = (q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }) as MediaQueryList;
}
if (!window.requestAnimationFrame) window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0) as unknown as number;
window.scrollTo = (() => {}) as typeof window.scrollTo;
Element.prototype.scrollIntoView = function () {};
