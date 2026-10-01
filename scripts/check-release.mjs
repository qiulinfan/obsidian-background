// SPDX-License-Identifier: MIT-0
// Copyright (c) 2026 Qiulin Fan
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = async name => JSON.parse(await readFile(path.join(root, name), 'utf8'));
const manifest = await json('manifest.json');
const pkg = await json('package.json');
const versions = await json('versions.json');
assert.match(manifest.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
assert.equal(manifest.id, 'background');
assert.equal(manifest.name, 'Background');
assert.equal(manifest.isDesktopOnly, true);
assert.equal(pkg.version, manifest.version, 'package and manifest versions must agree');
assert.equal(versions[manifest.version], manifest.minAppVersion, 'versions.json must describe this release');
assert.equal(pkg.license, 'MIT-0');
const license = await readFile(path.join(root, 'LICENSE'), 'utf8');
assert.ok(license.includes('MIT No Attribution') && license.includes('2026 Qiulin Fan'));
if (process.env.RELEASE_TAG !== undefined) {
  assert.equal(process.env.RELEASE_TAG, manifest.version, 'tag must exactly equal manifest.version, without a v prefix');
}
for (const name of ['main.js', 'manifest.json', 'styles.css', 'README.md', 'README_zh-CN.md']) {
  const file = await stat(path.join(root, name));
  assert.ok(file.isFile() && file.size > 0, `${name} must be a nonempty file`);
}
console.log(`Release metadata checked: ${manifest.id} ${manifest.version} (Obsidian ${manifest.minAppVersion}+, MIT-0)`);
