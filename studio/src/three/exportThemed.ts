// "GLB in this theme": a fresh copy of the model with the active accent baked into its crimson materials.
import { resolveMode, type ThemeState } from '../theme';
import { accentMaterials, loadThree, tokenColor } from './kit';

export function themedFilename(obj: { id: string; name: string }, theme: Pick<ThemeState, 'brand' | 'mode'>) {
  return `${obj.id}_${obj.name}__${theme.brand || 'signature'}-${resolveMode(theme.mode)}.glb`;
}

/** Loads the GLB (a new copy, never a live scene), applies the accent, returns binary glTF. */
export async function exportThemed(glb: string, accent: string): Promise<Blob> {
  const [kit, { GLTFExporter }] = await Promise.all([loadThree(), import('three/addons/exporters/GLTFExporter.js')]);
  const gltf = await new kit.GLTFLoader().loadAsync(glb);
  const c = new kit.THREE.Color(accent);
  accentMaterials(gltf.scene).forEach((m) => m.color?.copy(c as never));
  const out = await new GLTFExporter().parseAsync(gltf.scene, { binary: true, animations: gltf.animations });
  return new Blob([out as ArrayBuffer], { type: 'model/gltf-binary' });
}

/** Exports in the current theme and hands the file to the browser. */
export async function downloadThemed(obj: { id: string; name: string; glb: string }, theme: Pick<ThemeState, 'brand' | 'mode'>) {
  const blob = await exportThemed(obj.glb, tokenColor('--accent'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = themedFilename(obj, theme);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
