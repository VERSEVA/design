// Shape of src/data/library.json (written by scripts/build-library.mjs).
export interface LibObject {
  id: string; name: string; title: string; family: string; edition: string; uses: string[];
  glb: string; thumb: string; downloads: { png: string; glb: string };
}
export interface LibLoop {
  id: string; name: string; motion: string; title: string; seconds: number; glb: string; thumb: string;
  downloads: { glb: string; webm: string; mp4: string; poster: string };
}
export interface Library { tag?: string; objects: LibObject[]; loops: LibLoop[] }
