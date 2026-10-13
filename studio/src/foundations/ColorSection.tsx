import { Group, Section, tokensOf } from './Specimen';

export function ColorSection() {
  return (
    <Section id="color" title="Color" count={tokensOf('canvas', 'accent').length}>
      <Group family="canvas" />
      <Group family="accent" />
    </Section>
  );
}
