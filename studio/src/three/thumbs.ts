// Themed thumbnails: ONE shared offscreen renderer snapshots each GLB in the active theme.
// Cached by brand:mode:id; the baked webp stands in until (or instead of) the snapshot.
import { useEffect, useState } from 'react';
import type * as THREE_NS from 'three';
import { getTheme, resolveMode, type ThemeState } from '../theme';
import { accentMaterials, dressScene, frameModel, loadThree, tokenColor, type ThreeKit } from './kit';
import { hasWebGL } from './pool';

type ThemeKey = Pick<ThemeState, 'brand' | 'mode'>;
const SIZE = 512;

export function thumbKey(theme: ThemeKey, id: string) {
  return `${theme.brand || 'signature'}:${resolveMode(theme.mode)}:${id}`;
}

interface Shot { kit: ThreeKit; renderer: THREE_NS.WebGLRenderer; canvas: HTMLCanvasElement; scene: THREE_NS.Scene; camera: THREE_NS.PerspectiveCamera }
let shot: Promise<Shot> | null = null;
let made = 0;
const cache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

export function thumbRendererCount() { return made; }
export function resetThumbs() {
  cache.forEach((p) => p.then((u) => URL.revokeObjectURL(u), () => {}));
  cache.clear();
  shot?.then((s) => { s.renderer.dispose(); s.renderer.forceContextLoss(); }, () => {});
  shot = null;
  made = 0;
}

function shooter(): Promise<Shot> {
  shot ??= loadThree().then((kit) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const renderer = new kit.THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    made++;
    return { kit, renderer, canvas, ...dressScene(kit, renderer) };
  });
  return shot;
}

async function snap(glb: string): Promise<string> {
  const { kit, renderer, canvas, scene, camera } = await shooter();
  const gltf = await new kit.GLTFLoader().loadAsync(glb);
  const model = gltf.scene;
  const fit = frameModel(kit, model, camera);
  fit();
  scene.add(model);
  const c = new kit.THREE.Color(tokenColor('--accent'));
  accentMaterials(model).forEach((m) => m.color?.copy(c as never));
  renderer.render(scene, camera);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.86));
  scene.remove(model);
  model.traverse((o) => {
    const m = o as { geometry?: { dispose(): void }; material?: { dispose(): void } | Array<{ dispose(): void }> };
    m.geometry?.dispose();
    (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach((x) => x.dispose?.());
  });
  if (!blob) throw new Error('thumb snapshot failed');
  return URL.createObjectURL(blob);
}

/** Snapshot URL for this GLB in this theme; renders run one at a time on the shared renderer. */
export function themedThumb(theme: ThemeKey, id: string, glb: string): Promise<string> {
  const key = thumbKey(theme, id);
  let hit = cache.get(key);
  if (!hit) {
    hit = queue.then(() => snap(glb));
    queue = hit.catch(() => {});
    hit.catch(() => cache.delete(key));
    cache.set(key, hit);
  }
  return hit;
}

/** The grid image source: the baked thumb, swapped for the themed snapshot on every vsv-theme. */
export function useThemedThumb(id: string, glb: string, baked: string): string {
  const [src, setSrc] = useState(baked);
  useEffect(() => {
    if (!hasWebGL()) return;
    let current = '';
    const load = () => {
      const theme = getTheme();
      const key = thumbKey(theme, id);
      current = key;
      themedThumb(theme, id, glb).then((url) => { if (current === key) setSrc(url); }, () => { if (current === key) setSrc(baked); });
    };
    load();
    window.addEventListener('vsv-theme', load);
    return () => { current = ''; window.removeEventListener('vsv-theme', load); };
  }, [id, glb, baked]);
  return src;
}
