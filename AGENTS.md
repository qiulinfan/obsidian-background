# Background plugin guidance

- This is a small desktop Obsidian plugin. Obsidian supplies every runtime API;
  no bundled framework, image engine, CSS snippet or network service is required.
- Only vault-relative image paths are accepted. Never read note bodies, shell
  history, API settings or unrelated files for background rendering.
- Keep text, controls, PDF pages and cropped paper opaque. Image layers alone
  change opacity, use pointer-events none and respect native theme colours.
- Per-tab choices use leaf IDs; region defaults preserve other tab overrides.
  Keep legacy numeric `tabs` opacity values; `tabImages` adds independent image
  paths. An absent image override inherits the region, while an empty string
  explicitly removes the background. Reset clears both overrides for one tab.
- The `background-controls` ItemView opens in the right sidebar, reuses its
  existing leaf and remembers the last selected non-control tab. Do not paint
  the controls view or retarget it when the sidebar gains focus. Update control
  values without rebuilding its DOM on every opacity or layout change.
- Renames update exact configured image paths. Resource resolution is limited
  to configured vault images, deduplicated by path, and guarded against stale
  async results. A chooser finishing after its target closes changes nothing.
  Resize/layout changes retain one continuous right-dock framing across panes.
- Popovers use their own responsive grid, measured placement and local key
  handling. Never bind global editor keys or add modal dimming.
- Remove elements, callbacks, observers and owned CSS properties on unload.
  Validate layout with Obsidian 1.13.7 after changing native tab-header hooks.
- Run npm run check. Release tags match manifest.version and contain main.js,
  manifest.json and styles.css; do not publish data.json or .obsidian state.
- Screenshots and demo files contain simulated data and original SVG artwork
  only. Never capture a personal vault for public documentation.
