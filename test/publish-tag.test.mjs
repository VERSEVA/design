import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const yml = readFileSync(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const root = new URL("..", import.meta.url).pathname;

// The check is a single-line `run:` on the step named "Tag matches package.json version".
const match = yml.match(/- name: Tag matches package\.json version\n(?:\s+if: .*\n)?\s+run: (.+)\n/);

function check(env) {
  return spawnSync("bash", ["-c", match[1]], { cwd: root, env: { ...process.env, ...env } });
}

test("publish.yml checks the tag before npm publish", () => {
  assert.ok(match, "tag check step missing");
  assert.ok(yml.indexOf("Tag matches package.json version") < yml.indexOf("npm publish"));
  assert.match(yml, /if: github\.event_name != 'workflow_dispatch'/);
});

test("matching vX.Y.Z tag passes", () => {
  assert.equal(check({ GITHUB_REF_NAME: `v${pkg.version}` }).status, 0);
});

test("mismatched tag fails", () => {
  assert.notEqual(check({ GITHUB_REF_NAME: "v0.0.0-mismatch" }).status, 0);
});
