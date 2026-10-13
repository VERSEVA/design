import { Group, Section, tokensOf } from './Specimen';

export function StatusSection() {
  return (
    <Section id="status" title="Status" count={tokensOf('status').length}>
      <Group family="status" />
    </Section>
  );
}
