import './foundations.css';
import { ColorSection } from './ColorSection';
import { StatusSection } from './StatusSection';
import { DataSection } from './DataSection';
import { MaterialSection } from './MaterialSection';
import { RadiusSpacingSection } from './RadiusSpacingSection';
import { TypeSection } from './TypeSection';
import { MotionSection } from './MotionSection';
import { ContrastSection } from './ContrastSection';

// Section ids are final (sidebar anchors and deep links depend on them).
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
  return (
    <section className="page">
      <h1 className="display">Foundations</h1>
      <ColorSection />
      <StatusSection />
      <DataSection />
      <MaterialSection />
      <RadiusSpacingSection />
      <TypeSection />
      <MotionSection />
      <ContrastSection />
    </section>
  );
}
