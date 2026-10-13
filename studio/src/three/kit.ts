// Lazy three: nothing WebGL ships in the first paint bundle.
import type * as THREE_NS from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

export type Three = typeof THREE_NS;
export interface ThreeKit {
  THREE: Three;
  GLTFLoader: typeof import('three/addons/loaders/GLTFLoader.js').GLTFLoader;
  RoomEnvironment: typeof import('three/addons/environments/RoomEnvironment.js').RoomEnvironment;
}
export type { GLTF };

let kit: Promise<ThreeKit> | null = null;
export function loadThree(): Promise<ThreeKit> {
  kit ??= Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/environments/RoomEnvironment.js'),
  ]).then(([THREE, g, r]) => ({ THREE, GLTFLoader: g.GLTFLoader, RoomEnvironment: r.RoomEnvironment }));
  kit.catch(() => { kit = null; });
  return kit;
}

/** Materials authored as crimson carry the brand accent. */
export const ACCENT_MATERIAL = /crimson/i;

type Mat = { name: string; color?: { copy: (c: never) => unknown } };
export function accentMaterials(root: { traverse: (fn: (o: unknown) => void) => void }): Mat[] {
  const found: Mat[] = [];
  root.traverse((o) => {
    const mesh = o as { isMesh?: boolean; material?: Mat | Mat[] };
    if (!mesh.isMesh || !mesh.material) return;
    const ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    ms.forEach((m) => { if (ACCENT_MATERIAL.test(m.name) && m.color && !found.includes(m)) found.push(m); });
  });
  return found;
}

let probe: HTMLElement | null = null;
/** The resolved value of a color token, as an sRGB string three can parse. */
export function tokenColor(token = '--accent'): string {
  if (!probe || !probe.isConnected) {
    probe = document.createElement('i');
    probe.hidden = true;
    document.body.appendChild(probe);
  }
  probe.style.color = `var(${token})`;
  return toRgb(getComputedStyle(probe).color);
}

/* Modern engines may report oklch() or color(); a 1px 2D canvas normalizes to rgb. */
function toRgb(css: string): string {
  if (/^rgba?\(/.test(css) || !css) return css;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const g = c.getContext('2d');
    if (!g) return css;
    g.fillStyle = css;
    g.fillRect(0, 0, 1, 1);
    const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${gr}, ${b})`;
  } catch {
    return css;
  }
}

/** Shared scene dressing: room environment, key light, filmic tone mapping. */
export function dressScene(kit: ThreeKit, renderer: THREE_NS.WebGLRenderer) {
  const { THREE } = kit;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new kit.RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const key = new THREE.DirectionalLight('white', 1.6);
  key.position.set(3, 5, 4);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  return { scene, camera };
}

/** Centers the model and frames it from the house three-quarter angle. */
export function frameModel(kit: ThreeKit, model: THREE_NS.Object3D, camera: THREE_NS.PerspectiveCamera) {
  const { THREE } = kit;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()).length();
  model.position.sub(box.getCenter(new THREE.Vector3()));
  return () => {
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = Math.max(camera.aspect, 0.5);
    const d = ((size * 0.5) / Math.tan(fov / 2) / Math.min(aspect, 1)) * 1.15;
    camera.position.copy(new THREE.Vector3(0.62, 0.42, 0.66).normalize().multiplyScalar(d));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };
}
