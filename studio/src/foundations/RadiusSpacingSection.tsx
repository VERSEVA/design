import { Group, Section, tokensOf } from './Specimen';

export function RadiusSpacingSection() {
  return (
    <Section id="radius" title="Radius and spacing" count={tokensOf('radius', 'spacing', 'layout').length}>
      <Group family="radius" />
      <Group family="spacing" />
      <Group family="layout" />
    </Section>
  );
}
