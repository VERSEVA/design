// ThreeStage: load + recolor, context pool, motion, themed thumbs. three is mocked (jsdom has no WebGL).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as mount, act, fireEvent, cleanup } from '@testing-library/react';

const fake = await vi.hoisted(async () => {
  const { vi: v } = await import('vitest');
  class Color { value: string; constructor(v = '') { this.value = String(v); } copy(c: Color) { this.value = c.value; return this; } }
  class Vec { x = 0; y = 0; z = 0; set() { return this; } sub() { return this; } copy() { return this; } normalize() { return this; } multiplyScalar() { return this; } length() { return 1; } }
  const renderers: Array<Record<string, ReturnType<typeof v.fn>> & { opts: unknown }> = [];
  const mixers: Array<{ update: ReturnType<typeof v.fn> }> = [];
  const materials: Array<{ name: string; color: Color }> = [];
  class WebGLRenderer {
    opts: unknown;
    setPixelRatio = v.fn(); getPixelRatio = v.fn(() => 1); setSize = v.fn(); setClearColor = v.fn();
    render = v.fn(); dispose = v.fn(); forceContextLoss = v.fn();
    toneMapping = 0; outputColorSpace = '';
    constructor(opts: unknown) { this.opts = opts; renderers.push(this as never); }
  }
  class Obj { position = new Vec(); rotation = new Vec(); children: unknown[] = []; add(o: unknown) { this.children.push(o); } remove() {} lookAt() {} updateProjectionMatrix() {} traverse() {} }
  class Scene extends Obj { environment: unknown = null; }
  class PerspectiveCamera extends Obj { fov = 30; aspect = 1; }
  class DirectionalLight extends Obj {}
  class AnimationMixer { update = v.fn(); constructor() { mixers.push(this); } clipAction() { return { play() {} }; } }
  class Clock { getDelta() { return 0.016; } }
  class Box3 { setFromObject() { return this; } getSize() { return new Vec(); } getCenter() { return new Vec(); } }
  class PMREMGenerator { fromScene() { return { texture: {} }; } dispose() {} }
  const THREE = {
    Color, Vector3: Vec, WebGLRenderer, Scene, PerspectiveCamera, DirectionalLight, AnimationMixer, Clock, Box3, PMREMGenerator,
    MathUtils: { degToRad: (d: number) => (d * Math.PI) / 180 }, ACESFilmicToneMapping: 4, SRGBColorSpace: 'srgb',
  };
  function model(url: string) {
    const crimson = { name: 'VSV Crimson Satin', color: new Color('authored') };
    const graphite = { name: 'Graphite', color: new Color('authored') };
    materials.push(crimson, graphite);
    const meshes = [{ isMesh: true, material: crimson }, { isMesh: true, material: [graphite] }];
    const scene = Object.assign(new Obj(), { traverse: (fn: (o: unknown) => void) => meshes.forEach(fn) });
    return { scene, animations: /loop/.test(url) ? [{ name: 'clip' }] : [] };
  }
  class GLTFLoader { loadAsync(url: string) { return Promise.resolve(model(url)); } }
  class RoomEnvironment {}
  return { THREE, GLTFLoader, RoomEnvironment, renderers, mixers, materials };
});

vi.mock('three', () => fake.THREE);
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: fake.GLTFLoader }));
vi.mock('three/addons/environments/RoomEnvironment.js', () => ({ RoomEnvironment: fake.RoomEnvironment }));

import { ThreeStage } from '../src/three/ThreeStage';
import { POOL_CAP, liveSlots, resetWebGLProbe } from '../src/three/pool';
import { themedThumb, thumbKey, thumbRendererCount, resetThumbs } from '../src/three/thumbs';
import { setMotionPaused } from '../src/theme';

const realGetContext = HTMLCanvasElement.prototype.getContext;
const flush = () => act(async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); });

function withWebGL(on: boolean) {
  HTMLCanvasElement.prototype.getContext = function (kind: string) {
    return on && /webgl/.test(kind) ? ({} as never) : null;
  } as typeof realGetContext;
  resetWebGLProbe();
}

beforeEach(() => {
  fake.renderers.length = 0;
  fake.mixers.length = 0;
  fake.materials.length = 0;
  setMotionPaused(false);
  withWebGL(true);
});
afterEach(() => {
  cleanup();
  HTMLCanvasElement.prototype.getContext = realGetContext;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ThreeStage load + recolor', () => {
  it('binds crimson materials to the probed accent and re-binds on vsv-theme', async () => {
    let accent = 'rgb(1, 2, 3)';
    const real = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation(((el: Element) => {
      const s = real(el);
      return new Proxy(s, { get: (t, k) => (k === 'color' ? accent : Reflect.get(t, k)) });
    }) as typeof window.getComputedStyle);
    mount(<ThreeStage src="/library/glb/VSV-019.glb" label="rising arc" />);
    await flush();
    const [crimson, graphite] = fake.materials;
    expect(crimson.color.value).toBe('rgb(1, 2, 3)');
    accent = 'rgb(9, 8, 7)';
    await act(async () => { window.dispatchEvent(new Event('vsv-theme')); });
    expect(crimson.color.value).toBe('rgb(9, 8, 7)');
    expect(graphite.color.value).toBe('authored');
  });

  it('labels the live canvas as an image', async () => {
    const { container } = mount(<ThreeStage src="/a.glb" label="rising arc" />);
    await flush();
    const canvas = container.querySelector('canvas')!;
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBe('rising arc');
  });
});

describe('ThreeStage lifecycle', () => {
  it('caps live contexts at 4, falls back to the thumb, and reuses a freed slot', async () => {
    expect(POOL_CAP).toBe(4);
    const views = [0, 1, 2, 3, 4].map((i) => mount(<ThreeStage src={`/m${i}.glb`} label={`m${i}`} thumb={`/t${i}.webp`} />));
    await flush();
    const all = () => views.map((v) => v.container);
    const count = (sel: string) => all().reduce((n, c) => n + c.querySelectorAll(sel).length, 0);
    expect(count('canvas')).toBe(4);
    expect(count('img')).toBe(1);
    expect(views[4].container.querySelector('img')?.getAttribute('alt')).toBe('m4');
    expect(liveSlots()).toBe(4);

    const first = fake.renderers[0];
    views[0].unmount();
    await flush();
    expect(first.dispose).toHaveBeenCalled();
    expect(first.forceContextLoss).toHaveBeenCalled();
    expect(views[4].container.querySelector('canvas')).not.toBeNull();
    expect(liveSlots()).toBe(4);
  });

  it('renders the thumb when WebGL is unavailable', async () => {
    withWebGL(false);
    const { container } = mount(<ThreeStage src="/a.glb" label="rising arc" thumb="/t.webp" />);
    await flush();
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/t.webp');
    expect(liveSlots()).toBe(0);
  });
});

describe('ThreeStage motion', () => {
  function manualFrames() {
    const q: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { q.push(cb); return q.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    return (n: number) => act(() => { for (let i = 0; i < n; i++) { const batch = q.splice(0); batch.forEach((cb) => cb(performance.now())); } });
  }

  it('drives clips with a mixer and stops updating while motion is paused', async () => {
    const frames = manualFrames();
    mount(<ThreeStage src="/loop.glb" label="ribbon loop" loop />);
    await flush();
    const mixer = fake.mixers[0];
    expect(mixer).toBeDefined();
    frames(3);
    expect(mixer.update.mock.calls.length).toBeGreaterThan(0);

    act(() => setMotionPaused(true));
    mixer.update.mockClear();
    frames(3);
    expect(mixer.update).toHaveBeenCalledTimes(0);
    act(() => setMotionPaused(false));
  });

  it('offers a 44px per-tile pause button carrying aria-pressed', async () => {
    const frames = manualFrames();
    const { getByRole } = mount(<ThreeStage src="/loop.glb" label="ribbon loop" loop />);
    await flush();
    const btn = getByRole('button', { name: 'Pause ribbon loop' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    const mixer = fake.mixers[0];
    mixer.update.mockClear();
    frames(3);
    expect(mixer.update).toHaveBeenCalledTimes(0);
  });
});

describe('themed thumbnails', () => {
  beforeEach(() => {
    resetThumbs();
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) { cb(new Blob(['x'], { type: 'image/webp' })); };
    let n = 0;
    URL.createObjectURL = () => `blob:thumb-${n++}`;
    URL.revokeObjectURL = () => {};
  });

  it('keys the cache by brand, mode and id', () => {
    expect(thumbKey({ brand: 'violet', mode: 'light' }, 'VSV-019')).toBe('violet:light:VSV-019');
    expect(thumbKey({ brand: '', mode: 'dark' }, 'VSV-019')).toBe('signature:dark:VSV-019');
    expect(thumbKey({ brand: 'violet', mode: 'dark' }, 'VSV-019')).not.toBe(thumbKey({ brand: 'violet', mode: 'light' }, 'VSV-019'));
  });

  it('renders 30 snapshots through one shared renderer and caches per theme', async () => {
    const theme = { brand: 'cobalt' as const, mode: 'dark' as const };
    const urls = await Promise.all(Array.from({ length: 30 }, (_, i) => themedThumb(theme, `VSV-${i}`, `/g${i}.glb`)));
    expect(new Set(urls).size).toBe(30);
    expect(thumbRendererCount()).toBe(1);
    expect(await themedThumb(theme, 'VSV-0', '/g0.glb')).toBe(urls[0]);
    expect(await themedThumb({ brand: 'violet', mode: 'dark' }, 'VSV-0', '/g0.glb')).not.toBe(urls[0]);
    expect(thumbRendererCount()).toBe(1);
  });
});
