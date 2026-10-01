# Obsidian Background

Local wallpapers for a quiet workspace, with a live opacity slider on every tab.

![Backgrounds in a simulated Obsidian workspace](docs/screenshots/workspace.png)

## Features

- Choose separate images for the editor, left sidebar, right sidebar, and terminal panels.
- Click a tab's slider icon to adjust its background from 0–100%, with an immediate preview.
- Keep a choice for one tab, or make it the default for that area.
- Keep text, controls, formulas, and PDF paper at full opacity.
- Preserve one continuous right-sidebar image across split panes.
- Use a responsive popover with a thin slider, a small circular handle, and automatic edge positioning.
- English and Simplified Chinese controls; no runtime dependencies beyond Obsidian.

![Live per-tab opacity controls](docs/screenshots/controls.png)

These screenshots were captured in Obsidian Desktop 1.13.7. All notes and console content are simulated. The wallpapers are original procedural SVG artwork. The demo uses slightly stronger backgrounds to make the effect visible in screenshots.

## Install

Requires **Obsidian Desktop 1.13.7 or newer**.

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/qiulinfan/obsidian-background/releases/latest).
2. Put them in your vault's `.obsidian/plugins/obsidian-background/` folder.
3. Enable **Background** in Settings → Community plugins.
4. Open Settings → Background and choose your images.

Each image is a file inside your vault. PNG, JPEG, WebP, GIF, and SVG are supported. You can use the file picker or enter a vault-relative path such as `Wallpapers/editor.jpg`.

## Adjust the look

Click the small slider icon in a tab header. Drag the slider while looking at the page; the choice is saved automatically in that vault.

**Reset tab** returns that tab to its area default. **Set region default** applies the current value to new tabs and tabs without their own choice; other individually adjusted tabs keep their settings. The command palette also includes **Background: Adjust current tab background strength**.

The initial strengths are deliberately subtle:

| Area | Default |
| --- | ---: |
| Editor, including source and live editing views | 5% |
| Left sidebar | 6% |
| Right sidebar | 4% |
| Terminal | 6% |

Tab choices follow the open tab across layout saves and restarts. Closing a tab removes that tab's override. Use an area default when you want the same strength on future tabs.

## Demo

[docs/demo-vault](docs/demo-vault) contains the simulated notes and four original wallpapers used above. Copy it to a new folder, open that folder as a vault, install Background, and choose the files in `Wallpapers/`.

Background works on the native workspace surfaces and CodeMirror editors. A third-party view that draws its own opaque canvas can cover a background. Images of PDF pages and other paper surfaces keep their original colours.

## Local data

The plugin stores image paths, area defaults, and per-tab strengths in its own `data.json`. It loads local image files through Obsidian's vault adapter. It does not inspect note bodies or terminal history, download wallpapers, or need an API key.

## Development

`main.js` is the source and release artifact. No build step or dependency installation is needed:

```sh
npm run check
```

Copy the three plugin files into a test vault and reload the plugin to try a change. Release tags match `manifest.json`'s version.

## License

[Apache-2.0](LICENSE), including the original demo SVG artwork.
