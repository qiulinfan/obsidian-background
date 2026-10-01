// SPDX-License-Identifier: MIT-0
// Copyright (c) 2026 Qiulin Fan
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const moduleStub = { exports: {} };
class PluginStub { constructor(app) { this.app = app; } }
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8'), {
  module: moduleStub, console,
  require: name => { assert.equal(name, 'obsidian'); return { Plugin: PluginStub, ItemView: class {}, PluginSettingTab: class {}, SuggestModal: class {}, getLanguage: () => 'en' }; },
});
const Controls = moduleStub.exports;
const plain = value => JSON.parse(JSON.stringify(value));
const images = { editor: '', sidebar: '', right: '', terminal: '' };
const leaf = (id, region = 'editor', type = 'markdown', css = '0.1') => ({
  id, view: { getViewType: () => type },
  containerEl: {
    closest: selector => region === 'right' && selector === '.mod-right-split' || region === 'sidebar' && selector === '.mod-left-split',
    ownerDocument: { body: {}, defaultView: { getComputedStyle: () => ({ getPropertyValue: () => css }) } },
  },
});
function controller() {
  const p = new Controls({ workspace: { iterateAllLeaves: () => {} } });
  p.saved = [];
  p.saveData = async value => p.saved.push(plain(value));
  p.paint = () => {};
  p.refresh = () => {};
  return p;
}

test('loads only finite tab and region choices, without private or arbitrary fields', () => {
  const p = Controls.normalisePrefs({ tabs: { a: 0, b: .25, bad: NaN, out: 2, 'note/file': .4 }, regions: { right: .06, editor: false, unknown: .1 }, providers: [{ apiKey: 'private' }] });
  assert.deepEqual(plain(p), { tabs: { a: 0, b: .25 }, tabImages: {}, regions: { right: .06 }, images });
});
test('right and left placement take precedence over the view type', () => {
  assert.equal(Controls.regionOf(leaf('a', 'right', 'terminal:terminal')), 'right');
  assert.equal(Controls.regionOf(leaf('a', 'sidebar', 'markdown')), 'sidebar');
  assert.equal(Controls.regionOf(leaf('a', 'editor', 'terminal:terminal')), 'terminal');
});
test('zero opacity persists and each tab changes independently', async () => {
  const p = controller(), a = leaf('a'), b = leaf('b');
  p.setOpacity(a, 0); p.setOpacity(b, .2);
  await p.saveTask;
  assert.equal(p.opacityOf(a), 0); assert.equal(p.opacityOf(b), .2);
  assert.deepEqual(p.saved.at(-1), { tabs: { a: 0, b: .2 }, tabImages: {}, regions: {}, images });
});
test('tab overrides win over region choices and restored CSS defaults', () => {
  const p = controller(), l = leaf('a', 'right', 'outline', '0.06');
  assert.equal(p.opacityOf(l), .04);
  p.prefs.regions.right = .08; assert.equal(p.opacityOf(l), .08);
  p.prefs.tabs.a = .13; assert.equal(p.opacityOf(l), .13);
});
test('setting a region default keeps confirmed settings in other tabs', async () => {
  const p = controller(), a = leaf('a', 'right'), b = leaf('b', 'right'), c = leaf('c', 'right');
  p.app.vault = { adapter: { stat: async () => null } };
  p.prefs.tabs = { a: .08, b: .19 };
  p.setRegionDefault(a); await p.saveTask;
  assert.equal(p.opacityOf(a), .08); assert.equal(p.opacityOf(b), .19); assert.equal(p.opacityOf(c), .08);
  assert.deepEqual(plain(p.prefs.tabs), { b: .19 });
});
test('reset removes only the selected tab override', async () => {
  const p = controller(), a = leaf('a'); p.prefs.tabs = { a: .2, b: .3 };
  p.resetTab(a); await p.saveTask;
  assert.equal(p.opacityOf(a), .05); assert.equal(p.prefs.tabs.b, .3);
});
test('ordered snapshots prevent a delayed older save from winning', async () => {
  const p = controller(), a = leaf('a'); let unblock;
  const pending = new Promise(resolve => { unblock = resolve; });
  p.saveData = async value => { if (value.tabs.a === .1) await pending; p.saved.push(plain(value)); };
  p.setOpacity(a, .1); p.setOpacity(a, .27); unblock(); await p.saveTask;
  assert.deepEqual(p.saved.map(x => x.tabs.a), [.1, .27]);
});
test('right pane geometry retains the original dock framing with its own clipping', () => {
  assert.deepEqual(plain(Controls.rightGeometry({ left: 900, top: 0, width: 400, height: 800 }, { left: 920, top: 80, width: 380, height: 320 })), {
    '--obg-width': '400px', '--obg-height': '800px', '--obg-left': '-20px', '--obg-top': '-80px', '--obg-clip': 'inset(80px 0px 400px 20px)',
  });
});
test('invalid input never writes preferences, and empty CSS has a useful default', async () => {
  const p = controller(), a = leaf('a', 'editor', 'markdown', '');
  for (const v of [NaN, -1, 2, '0.1', undefined]) p.setOpacity(a, v);
  await p.saveTask; assert.equal(p.saved.length, 0); assert.equal(p.opacityOf(a), .05);
});
test('restored saved choices remain identical after normalisation', () => {
  const original = { tabs: { abcd1234: .11 }, tabImages: {}, regions: { right: .06, terminal: .09 }, images };
  assert.deepEqual(plain(Controls.normalisePrefs(original)), original);
});
test('popover uses its measured width and stays inside a narrow viewport', () => {
  const result = Controls.popoverPosition({ right: 280, top: 20, bottom: 40 }, { width: 270, height: 150 }, { width: 300, height: 600 }, 8);
  assert.deepEqual(plain(result), { left: 10, top: 48 });
});
test('popover flips above a bottom-edge tab instead of overflowing', () => {
  const result = Controls.popoverPosition({ right: 600, top: 720, bottom: 750 }, { width: 420, height: 160 }, { width: 1000, height: 800 }, 10);
  assert.deepEqual(plain(result), { left: 180, top: 550 });
});
test('resizing the measured panel adapts its anchor without a fixed-width constant', () => {
  const anchor = { right: 900, top: 0, bottom: 30 }, viewport = { width: 1000, height: 800 };
  assert.equal(Controls.popoverPosition(anchor, { width: 280, height: 150 }, viewport, 8).left, 620);
  assert.equal(Controls.popoverPosition(anchor, { width: 480, height: 150 }, viewport, 8).left, 420);
});
test('small viewport clamps vertical placement when neither side has enough room', () => {
  const result = Controls.popoverPosition({ right: 280, top: 70, bottom: 100 }, { width: 270, height: 140 }, { width: 300, height: 180 }, 8);
  assert.deepEqual(plain(result), { left: 10, top: 32 });
});

test('image paths remain inside the vault and accept ordinary image formats', () => {
  assert.equal(Controls.imagePath(' art/夜空.svg '), 'art/夜空.svg');
  assert.equal(Controls.imagePath('images\\photo.png'), 'images/photo.png');
  for (const v of ['../private.png', '/private/photo.png', 'https://example.com/photo.png', 'file:///tmp/photo.png', 'photo.tex', null]) assert.equal(Controls.imagePath(v), '');
});
test('image preferences normalise without importing arbitrary private fields', () => {
  const prefs = Controls.normalisePrefs({ images: { editor: 'images/sky.png', right: '../secret.svg' }, apiKey: 'private' });
  assert.equal(prefs.images.editor, 'images/sky.png'); assert.equal(prefs.images.right, '');
  assert.equal(prefs.apiKey, undefined);
});
test('image resource URLs use the vault adapter and its mtime', async () => {
  const p = controller(); p.prefs.images.editor = 'images/sky.png';
  p.app.vault = { adapter: { stat: async () => ({ type: 'file', mtime: 42 }), getResourcePath: path => 'app://demo/' + path } };
  await p.reloadImages(); assert.equal(p.resources['images/sky.png'], 'app://demo/images/sky.png?v=42');
});
test('a missing image leaves the native surface available', async () => {
  const p = controller(); p.prefs.images.editor = 'images/missing.png';
  p.app.vault = { adapter: { stat: async () => null, getResourcePath: () => { throw Error('not called'); } } };
  await p.reloadImages(); assert.deepEqual(plain(p.resources), {});
});

function imageController(leaves) {
  const p = controller();
  p.app.workspace = { activeLeaf: leaves[0], iterateAllLeaves: visit => leaves.forEach(visit) };
  p.app.vault = { adapter: { stat: async () => ({ type: 'file', mtime: 7 }), getResourcePath: path => 'app://demo/' + path } };
  return p;
}
test('old opacity preferences load intact and tab images reject unsafe paths', () => {
  const p = Controls.normalisePrefs({ tabs: { a: .17 }, images: { editor: 'images/default.svg' }, tabImages: { a: 'images/a.svg', b: '', bad: '../outside.png', url: 'https://example.com/a.png', 'note/path': 'a.png' } });
  assert.deepEqual(plain(p.tabs), { a: .17 });
  assert.deepEqual(plain(p.tabImages), { a: 'images/a.svg', b: '' });
});
test('each tab selects its own image while an unconfigured tab inherits the region', async () => {
  const a = leaf('a'), b = leaf('b'), c = leaf('c'), p = imageController([a, b, c]);
  p.prefs.images.editor = 'images/default.svg';
  await p.setTabImage(a, 'images/a.svg'); await p.setTabImage(b, 'images/b.svg');
  assert.equal(p.imageOf(a), 'images/a.svg'); assert.equal(p.imageOf(b), 'images/b.svg'); assert.equal(p.imageOf(c), 'images/default.svg');
  assert.equal(p.saved.at(-1).tabImages.b, 'images/b.svg');
  assert.equal(p.imageCss(p.imageOf(a)), 'url("app://demo/images/a.svg?v=7")');
});
test('no-background override is distinct from inheriting the default image', async () => {
  const a = leaf('a'), b = leaf('b'), p = imageController([a, b]); p.prefs.images.editor = 'images/default.svg';
  await p.setTabImage(a, ''); assert.equal(p.imageOf(a), ''); assert.equal(p.imageOf(b), 'images/default.svg');
  await p.useDefaultImage(a); assert.equal(p.imageOf(a), 'images/default.svg');
  assert.equal(Object.hasOwn(p.prefs.tabImages, 'a'), false);
});
test('invalid paths and a chooser completed after tab closure cannot change preferences', async () => {
  const a = leaf('a'), p = imageController([a]); await p.setTabImage(a, 'images/a.svg');
  const count = p.saved.length;
  await p.setTabImage(a, '../outside.png'); assert.equal(p.imageOf(a), 'images/a.svg');
  p.app.workspace.iterateAllLeaves = () => {};
  await p.setTabImage(a, 'images/late.svg'); assert.equal(p.saved.length, count);
});
test('reset restores the selected tab image and opacity without altering another tab', async () => {
  const a = leaf('a'), b = leaf('b'), p = imageController([a, b]);
  p.prefs.images.editor = 'images/default.svg'; p.prefs.tabs = { a: .2, b: .3 };
  p.prefs.tabImages = { a: 'images/a.svg', b: 'images/b.svg' };
  p.resetTab(a); await p.saveTask;
  assert.equal(p.imageOf(a), 'images/default.svg'); assert.equal(p.opacityOf(a), .05);
  assert.equal(p.imageOf(b), 'images/b.svg'); assert.equal(p.opacityOf(b), .3);
});
test('a region default adopts both selected image and strength, preserving other overrides', async () => {
  const a = leaf('a', 'right'), b = leaf('b', 'right'), c = leaf('c', 'right'), p = imageController([a, b, c]);
  p.prefs.tabImages = { a: 'images/a.svg', b: 'images/b.svg' }; p.prefs.tabs = { a: .11, b: .23 };
  p.setRegionDefault(a); await p.saveTask;
  assert.equal(p.imageOf(a), 'images/a.svg'); assert.equal(p.imageOf(c), 'images/a.svg'); assert.equal(p.imageOf(b), 'images/b.svg');
  assert.equal(p.opacityOf(c), .11); assert.equal(p.opacityOf(b), .23);
});
test('renaming an image updates exactly matching region and tab references', async () => {
  const a = leaf('a'), p = imageController([a]);
  p.prefs.images.editor = 'images/a.svg'; p.prefs.tabImages = { a: 'images/a.svg', b: 'images/b.svg' };
  await p.renameImage('images/a.svg', 'images/renamed.svg');
  assert.equal(p.prefs.images.editor, 'images/renamed.svg'); assert.equal(p.imageOf(a), 'images/renamed.svg');
  assert.equal(p.prefs.tabImages.b, 'images/b.svg');
});
test('resource loading deduplicates a shared image and only resolves configured vault images', async () => {
  const a = leaf('a'), p = imageController([a]), seen = [];
  p.prefs.images.editor = 'images/shared.svg'; p.prefs.tabImages.a = 'images/shared.svg';
  p.app.vault.adapter.stat = async path => { seen.push(path); return { type: 'file', mtime: 8 }; };
  await p.reloadImages(); assert.deepEqual(seen, ['images/shared.svg']);
});
test('focusing the Background sidebar keeps the last selected content tab', () => {
  const a = leaf('a'), b = leaf('b'), sidebar = leaf('controls', 'right', Controls.VIEW_TYPE), p = imageController([a, b, sidebar]);
  p.selectTarget(a); p.app.workspace.activeLeaf = sidebar; p.selectTarget(sidebar);
  assert.equal(p.targetLeaf(), a); assert.equal(p.targets().length, 2);
  assert.equal(p.targets()[0], a); assert.equal(p.targets()[1], b);
  p.selectTarget(b); assert.equal(p.targetLeaf(), b);
  p.app.workspace.iterateAllLeaves = visit => [a, sidebar].forEach(visit); assert.equal(p.targetLeaf(), a);
});
test('opening the sidebar reuses an existing control leaf and preserves the target', async () => {
  const a = leaf('a'), sidebar = leaf('controls', 'right', Controls.VIEW_TYPE), p = imageController([a, sidebar]); let revealed;
  sidebar.view.updateControls = () => {};
  p.app.workspace.getLeavesOfType = type => type === Controls.VIEW_TYPE ? [sidebar] : [];
  p.app.workspace.getRightLeaf = () => { throw Error('must reuse the existing sidebar'); };
  p.app.workspace.revealLeaf = async target => { revealed = target; p.app.workspace.activeLeaf = target; p.selectTarget(target); };
  await p.openSidebar(); assert.equal(revealed, sidebar); assert.equal(p.targetLeaf(), a);
});
