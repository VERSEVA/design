/** verseva brief <name>: one component's source, the laws that bind it, and its contract section. */
import { buildBrief } from './brief.mjs';

export const match = 'brief';
export const order = 12;
export const usage = ['npx verseva brief <name>'];

/* Returning without exiting hands over to the help text (exit 2). */
export async function run({ pkgRoot, registry, rest }) {
  if (rest[0] === undefined) return;
  if (rest.length > 1) {
    console.error('refused: verseva brief takes one name');
    process.exit(1);
  }
  const { text, error } = buildBrief(pkgRoot, registry, rest[0]);
  if (error) {
    console.error(error);
    process.exit(1);
  }
  /* Wait for the write: stdout to a pipe is asynchronous on macOS, and exit would cut it. */
  await new Promise((resolve) => process.stdout.write(text, resolve));
  process.exit(0);
}
