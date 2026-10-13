// Stub until lane L2 lands the library; ids are final.
export const SECTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'objects', label: '3D objects' },
  { id: 'loops', label: 'Loops' },
  { id: 'photography', label: 'Photography' },
  { id: 'video', label: 'Video' },
];
export function AssetLibraryPage() {
  return <section className="page"><h1 className="display">Asset Library</h1></section>;
}
