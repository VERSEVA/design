// Stub until lane L1 lands the sections; ids are final.
export const SECTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'color', label: 'Color' },
  { id: 'status', label: 'Status' },
  { id: 'data', label: 'Data' },
  { id: 'material', label: 'Material' },
  { id: 'radius', label: 'Radius and spacing' },
  { id: 'type', label: 'Type' },
  { id: 'motion', label: 'Motion' },
  { id: 'contrast', label: 'Contrast' },
];
export function FoundationsPage() {
  return <section className="page"><h1 className="display">Foundations</h1></section>;
}
