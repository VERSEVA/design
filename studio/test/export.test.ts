// "GLB in this theme": filename contract and the accent baked into the exported copy.
import { describe, it, expect, vi } from 'vitest';

const fake = vi.hoisted(() => {
  class Color { value: string; constructor(v = '') { this.value = String(v); } copy(c: Color) { this.value = c.value; return this; } }
  const crimson = { name: 'VSV Crimson', color: new Color('authored') };
  const graphite = { name: 'Graphite', color: new Color('authored') };
  const scene = { traverse: (fn: (o: unknown) => void) => [{ isMesh: true, material: crimson }, { isMesh: true, material: graphite }].forEach(fn) };
  const parsed: Array<{ input: unknown; opts: Record<string, unknown> }> = [];
  class GLTFLoader { loadAsync() { return Promise.resolve({ scene, animations: [{ name: 'clip' }] }); } }
  class GLTFExporter {
    parseAsync(input: unknown, opts: Record<string, unknown>) {
      parsed.push({ input, opts: { ...opts, accentAtExport: crimson.color.value } });
      return Promise.resolve(new ArrayBuffer(8));
    }
  }
  return { THREE: { Color }, GLTFLoader, GLTFExporter, RoomEnvironment: class {}, crimson, graphite, scene, parsed };
});
vi.mock('three', () => fake.THREE);
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: fake.GLTFLoader }));
vi.mock('three/addons/environments/RoomEnvironment.js', () => ({ RoomEnvironment: fake.RoomEnvironment }));
vi.mock('three/addons/exporters/GLTFExporter.js', () => ({ GLTFExporter: fake.GLTFExporter }));

import { themedFilename, exportThemed } from '../src/three/exportThemed';

describe('themed GLB export', () => {
  it('names the file VSV-0xx_<name>__<brand>-<mode>.glb', () => {
    expect(themedFilename({ id: 'VSV-019', name: 'rising-arc' }, { brand: 'violet', mode: 'light' })).toBe('VSV-019_rising-arc__violet-light.glb');
    expect(themedFilename({ id: 'VSV-019', name: 'rising-arc' }, { brand: '', mode: 'dark' })).toBe('VSV-019_rising-arc__signature-dark.glb');
  });

  it('exports a binary GLB with the accent applied to crimson materials only', async () => {
    const blob = await exportThemed('/library/glb/VSV-019.glb', 'rgb(120, 80, 200)');
    expect(blob.type).toBe('model/gltf-binary');
    expect(blob.size).toBe(8);
    const [call] = fake.parsed;
    expect(call.input).toBe(fake.scene);
    expect(call.opts.binary).toBe(true);
    expect(call.opts.accentAtExport).toBe('rgb(120, 80, 200)');
    expect((call.opts.animations as unknown[]).length).toBe(1);
    expect(fake.graphite.color.value).toBe('authored');
  });
});
