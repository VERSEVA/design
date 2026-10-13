import { Group, Section, tokensOf } from './Specimen';

export function MaterialSection() {
  return (
    <Section id="material" title="Material" count={tokensOf('material').length}>
      <Group family="material" />
    </Section>
  );
}
