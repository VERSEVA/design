import { Group, Section, tokensOf } from './Specimen';

export function DataSection() {
  return (
    <Section id="data" title="Data" count={tokensOf('data').length}>
      <Group family="data" />
    </Section>
  );
}
