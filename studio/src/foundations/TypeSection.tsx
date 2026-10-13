import { Group, Section, tokensOf } from './Specimen';

export function TypeSection() {
  return (
    <Section id="type" title="Type" count={tokensOf('type').length}>
      <Group family="type" />
    </Section>
  );
}
