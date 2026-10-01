"use strict";
const { Plugin, PluginSettingTab, SuggestModal, Setting, SliderComponent, setIcon, setTooltip, getLanguage } = require("obsidian");

const DEFAULTS = Object.freeze({ editor: 0.05, sidebar: 0.06, right: 0.04, terminal: 0.06 });
const REGIONS = { editor: "Editor", sidebar: "Left sidebar", right: "Right sidebar", terminal: "Terminal" };
const ZH = { Editor: "编辑区", "Left sidebar": "左侧栏", "Right sidebar": "右侧栏", Terminal: "终端", "Background strength": "背景强度", "Adjust background strength": "调整背景强度", "Close background controls": "关闭背景调节", "Background strength percentage": "背景强度百分比", "Live preview, saved automatically. Only the image changes.": "实时预览，自动保存；只改变图片强度。", "Reset tab": "恢复默认", "Set region default": "设为该区域默认", "Background images": "背景图片", "Vault-relative image path; PNG, JPEG, WebP, GIF or SVG.": "库内图片路径，支持 PNG、JPEG、WebP、GIF 和 SVG。", Choose: "选择", Clear: "清除", "Region default": "区域默认强度", "Choose an image in Settings → Background first.": "先在设置 → Background 中选择背景图片。" };
function tr(text) { return typeof getLanguage === "function" && getLanguage().startsWith("zh") ? ZH[text] || text : text; }
function imagePath(value) {
  if (typeof value !== "string") return "";
  const result = value.trim().replace(/\\/g, "/");
  return !result.startsWith("/") && !result.includes(":") && !result.split("/").includes("..") && /\.(?:png|jpe?g|webp|gif|svg)$/i.test(result) ? result : "";
}
const CLASSES = ["obg-main", "obg-left", "obg-right"];
const PROPERTIES = ["--obg-tab-opacity", "--obg-width", "--obg-height", "--obg-left", "--obg-top", "--obg-clip"];

function validOpacity(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function normalisePrefs(raw) {
  const prefs = { tabs: {}, regions: {}, images: { editor: "", sidebar: "", right: "", terminal: "" } };
  for (const [id, value] of Object.entries(raw?.tabs || {})) {
    if (/^[a-zA-Z0-9_-]+$/.test(id) && validOpacity(value)) prefs.tabs[id] = value;
  }
  for (const id of Object.keys(REGIONS)) {
    if (validOpacity(raw?.regions?.[id])) prefs.regions[id] = raw.regions[id];
    prefs.images[id] = imagePath(raw?.images?.[id]);
  }
  return prefs;
}

function regionOf(leaf) {
  if (leaf.containerEl.closest(".mod-right-split")) return "right";
  if (leaf.containerEl.closest(".mod-left-split")) return "sidebar";
  return leaf.view.getViewType() === "terminal:terminal" ? "terminal" : "editor";
}

function rightGeometry(dock, pane) {
  const left = pane.left - dock.left, top = pane.top - dock.top;
  return {
    "--obg-width": dock.width + "px", "--obg-height": dock.height + "px",
    "--obg-left": -left + "px", "--obg-top": -top + "px",
    "--obg-clip": `inset(${top}px ${Math.max(0, dock.width - left - pane.width)}px ${Math.max(0, dock.height - top - pane.height)}px ${left}px)`,
  };
}

function popoverPosition(anchor, size, viewport, gap) {
  const left = Math.max(gap, Math.min(anchor.right - size.width, viewport.width - size.width - gap));
  const below = anchor.bottom + gap;
  const above = anchor.top - size.height - gap;
  const top = below + size.height <= viewport.height - gap ? below
    : above >= gap ? above : Math.max(gap, viewport.height - size.height - gap);
  return { left, top };
}

class BackgroundPlugin extends Plugin {
  records = new Map();
  docks = new Map();
  prefs = normalisePrefs(null);
  resources = {};
  imageEpoch = 0;
  saveTask = Promise.resolve();
  stopped = false;
  frame = null;
  popup = null;

  async onload() {
    await this.loadSettings();
    this.resize = new ResizeObserver(() => this.scheduleRefresh());
    this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleRefresh()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.scheduleRefresh()));
    this.registerEvent(this.app.workspace.on("css-change", () => this.scheduleRefresh()));
    this.addSettingTab(new BackgroundSettings(this.app, this));
    this.registerEvent(this.app.vault.on("modify", file => { if (Object.values(this.prefs.images).includes(file.path)) void this.reloadImages(); }));
    this.registerEvent(this.app.vault.on("delete", file => { if (Object.values(this.prefs.images).includes(file.path)) void this.reloadImages(); }));
    this.addCommand({ id: "adjust-tab-background", name: "Adjust current tab background strength", callback: () => {
      const leaf = this.app.workspace.activeLeaf;
      if (leaf) this.openControls(leaf);
    }});
    this.app.workspace.onLayoutReady(() => {
      if (!this.stopped) this.refresh();
    });
  }

  async loadSettings() {
    this.prefs = normalisePrefs(await this.loadData());
    await this.reloadImages();
  }

  async reloadImages() {
    const epoch = ++this.imageEpoch, resources = {};
    for (const [region, path] of Object.entries(this.prefs.images)) {
      if (!path) continue;
      try {
        const stat = await this.app.vault.adapter.stat(path);
        if (stat?.type === "file") {
          const url = this.app.vault.adapter.getResourcePath(path);
          resources[region] = `url(${JSON.stringify(url + (url.includes("?") ? "&" : "?") + "v=" + stat.mtime)})`;
        }
      } catch { /* A missing image leaves the native surface intact. */ }
    }
    if (this.stopped || epoch !== this.imageEpoch) return;
    this.resources = resources;
    if (this.resize) this.refresh();
  }

  async setImage(region, path) {
    this.prefs.images[region] = imagePath(path);
    await this.savePrefs();
    await this.reloadImages();
  }

  savePrefs() {
    const snapshot = normalisePrefs(this.prefs);
    this.saveTask = this.saveTask.then(() => this.saveData(snapshot)).catch(error => {
      console.error("Background: preferences could not be saved", error);
    });
    return this.saveTask;
  }

  defaultOpacity(leaf, region = regionOf(leaf)) {
    if (Object.hasOwn(this.prefs.regions, region)) return this.prefs.regions[region];
    return DEFAULTS[region];
  }

  opacityOf(leaf) {
    return this.prefs.tabs[leaf.id] ?? this.defaultOpacity(leaf);
  }

  setOpacity(leaf, value) {
    if (!validOpacity(value)) return;
    this.prefs.tabs[leaf.id] = value;
    this.paint(leaf);
    void this.savePrefs();
  }

  setRegionDefault(leaf) {
    const region = regionOf(leaf);
    this.prefs.regions[region] = this.opacityOf(leaf);
    delete this.prefs.tabs[leaf.id];
    this.refresh();
    void this.savePrefs();
  }

  resetTab(leaf) {
    delete this.prefs.tabs[leaf.id];
    this.paint(leaf);
    void this.savePrefs();
  }

  scheduleRefresh() {
    if (this.stopped || this.frame !== null) return;
    const win = this.popup?.doc.defaultView || this.app.workspace.activeLeaf?.containerEl.ownerDocument.defaultView || window;
    const id = win.requestAnimationFrame(() => {
      this.frame = null;
      this.refresh();
    });
    this.frame = { win, id };
  }

  refresh() {
    if (this.stopped) return;
    const live = new Set();
    this.app.workspace.iterateAllLeaves(leaf => {
      live.add(leaf.id);
      const header = leaf.tabHeaderEl;
      const root = leaf.containerEl.querySelector(".workspace-leaf-content");
      if (!header || !root) return;
      let record = this.records.get(leaf.id);
      if (record && (record.header !== header || record.root !== root)) {
        this.removeRecord(record);
        this.records.delete(leaf.id);
        record = null;
      }
      if (!record) {
        const button = header.ownerDocument.createElement("button");
        button.type = "button";
        button.className = "obg-opacity-button clickable-icon";
        button.dataset.leafId = leaf.id;
        setIcon(button, "sliders-horizontal");
        const inner = header.querySelector(".workspace-tab-header-inner") || header;
        inner.insertBefore(button, inner.querySelector(".workspace-tab-header-inner-close-button"));
        const click = async event => {
          event.preventDefault(); event.stopPropagation();
          await this.app.workspace.revealLeaf(leaf);
          if (!this.stopped && this.records.has(leaf.id)) this.openControls(leaf);
        };
        const down = event => event.stopPropagation();
        button.addEventListener("click", click);
        button.addEventListener("pointerdown", down);
        record = { leaf, root, header, button, click, down };
        this.records.set(leaf.id, record);
        this.resize.observe(root);
        const dock = root.closest(".mod-right-split");
        if (dock) this.resize.observe(dock);
      }
      this.paint(leaf);
    });
    let pruned = false;
    for (const [id, record] of this.records) {
      if (!live.has(id)) {
        this.removeRecord(record); this.records.delete(id);
        if (this.popup?.leaf.id === id) this.closeControls();
      }
    }
    for (const id of Object.keys(this.prefs.tabs)) {
      if (!live.has(id)) { delete this.prefs.tabs[id]; pruned = true; }
    }
    if (pruned) void this.savePrefs();
    if (this.popup) this.positionControls();
  }

  paint(leaf) {
    const record = this.records.get(leaf.id);
    if (!record) return;
    const { root, button } = record;
    const region = regionOf(leaf), opacity = this.opacityOf(leaf);
    const selectedClass = region === "right" ? "obg-right" : region === "sidebar" ? "obg-left" : "obg-main";
    const image = this.resources[region];
    for (const name of CLASSES) root.classList.toggle(name, !!image && name === selectedClass);
    root.style.setProperty("--obg-image", image || "none");
    root.style.setProperty("--obg-tab-opacity", String(opacity));
    root.dataset.obgRegion = region;
    const label = tr("Adjust background strength") + ": " + Math.round(opacity * 100) + "%";
    button.setAttribute("aria-label", label);
    setTooltip(button, label);
    if (region === "right") {
      const dock = root.closest(".mod-right-split"), pane = root.getBoundingClientRect();
      if (dock) {
        if (!this.docks.has(dock)) this.docks.set(dock, { original: dock.style.getPropertyValue("--obg-right-opacity"), originalImage: dock.style.getPropertyValue("--obg-right-image"), hadClass: dock.classList.contains("obg-dock") });
        const state = this.docks.get(dock);
        state.applied = String(this.defaultOpacity(leaf, "right"));
        dock.style.setProperty("--obg-right-opacity", state.applied);
        state.image = image || "none";
        dock.style.setProperty("--obg-right-image", state.image);
        dock.classList.toggle("obg-dock", !!image);
      }
      if (dock && pane.width && pane.height) {
        for (const [key, value] of Object.entries(rightGeometry(dock.getBoundingClientRect(), pane))) root.style.setProperty(key, value);
      }
    }
  }

  openControls(leaf) {
    const record = this.records.get(leaf.id);
    if (!record) return;
    if (this.popup?.leaf.id === leaf.id) { this.closeControls(); return; }
    this.closeControls();
    const doc = record.button.ownerDocument, win = doc.defaultView;
    const panel = doc.createElement("div");
    panel.className = "obg-opacity-popover";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", tr("Background strength"));
    panel.dataset.leafId = leaf.id;
    const title = panel.appendChild(doc.createElement("div"));
    title.className = "obg-opacity-title";
    const heading = title.appendChild(doc.createElement("span"));
    heading.textContent = tr(REGIONS[regionOf(leaf)]) + " · " + tr("Background strength");
    const close = title.appendChild(doc.createElement("button"));
    close.type = "button"; close.className = "clickable-icon"; close.setAttribute("aria-label", tr("Close background controls"));
    setIcon(close, "x"); close.addEventListener("click", () => this.closeControls());
    const row = panel.appendChild(doc.createElement("div"));
    row.className = "obg-opacity-slider-row";
    const slider = new SliderComponent(row).setLimits(0, 100, 1).setInstant(true)
      .setDisplayFormat(value => value + "%").setValue(Math.round(this.opacityOf(leaf) * 100))
      .onChange(value => this.setOpacity(leaf, value / 100));
    slider.sliderEl.setAttribute("aria-label", tr("Background strength percentage"));
    const hint = panel.appendChild(doc.createElement("div"));
    hint.className = "obg-opacity-hint";
    hint.textContent = tr(this.resources[regionOf(leaf)] ? "Live preview, saved automatically. Only the image changes." : "Choose an image in Settings → Background first.");
    const actions = panel.appendChild(doc.createElement("div"));
    actions.className = "obg-opacity-actions";
    const reset = actions.appendChild(doc.createElement("button"));
    reset.type = "button"; reset.textContent = tr("Reset tab");
    reset.addEventListener("click", () => { this.resetTab(leaf); slider.setValue(Math.round(this.opacityOf(leaf) * 100)); });
    const defaultButton = actions.appendChild(doc.createElement("button"));
    defaultButton.type = "button"; defaultButton.textContent = tr("Set region default");
    defaultButton.addEventListener("click", () => { this.setRegionDefault(leaf); slider.setValue(Math.round(this.opacityOf(leaf) * 100)); });
    const outside = event => { if (!panel.contains(event.target) && !record.button.contains(event.target)) this.closeControls(); };
    const keys = event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); this.closeControls(); record.button.focus(); }
      else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) event.stopPropagation();
    };
    panel.addEventListener("keydown", keys);
    doc.addEventListener("pointerdown", outside, true);
    doc.body.appendChild(panel);
    const resize = () => this.positionControls();
    win.addEventListener("resize", resize);
    this.resize.observe(panel);
    this.popup = { leaf, panel, doc, outside, keys, resize };
    this.positionControls();
    slider.sliderEl.focus();
  }

  positionControls() {
    if (!this.popup) return;
    const { leaf, panel, doc } = this.popup;
    const record = this.records.get(leaf.id);
    if (!record?.button.isConnected) { this.closeControls(); return; }
    const win = doc.defaultView;
    panel.style.setProperty("--obg-pane-width", record.root.getBoundingClientRect().width + "px");
    const gap = parseFloat(win.getComputedStyle(panel).fontSize) / 2;
    const position = popoverPosition(record.button.getBoundingClientRect(), panel.getBoundingClientRect(),
      { width: win.innerWidth, height: win.innerHeight }, gap);
    panel.style.left = position.left + "px";
    panel.style.top = position.top + "px";
  }

  closeControls() {
    if (!this.popup) return;
    const { panel, doc, outside, keys, resize } = this.popup;
    doc.removeEventListener("pointerdown", outside, true);
    panel.removeEventListener("keydown", keys);
    doc.defaultView.removeEventListener("resize", resize);
    this.resize.unobserve(panel);
    panel.remove(); this.popup = null;
  }

  removeRecord({ root, button, click, down }) {
    button.removeEventListener("click", click); button.removeEventListener("pointerdown", down); button.remove();
    this.resize.unobserve(root);
    root.classList.remove(...CLASSES);
    delete root.dataset.obgRegion;
    root.style.removeProperty("--obg-image");
    for (const key of PROPERTIES) root.style.removeProperty(key);
  }

  onunload() {
    this.stopped = true;
    if (this.frame !== null) this.frame.win.cancelAnimationFrame(this.frame.id);
    this.closeControls();
    for (const record of this.records.values()) this.removeRecord(record);
    this.records.clear(); this.resize?.disconnect();
    for (const [dock, state] of this.docks) {
      if (dock.style.getPropertyValue("--obg-right-opacity") === state.applied) {
        if (state.original) dock.style.setProperty("--obg-right-opacity", state.original);
        else dock.style.removeProperty("--obg-right-opacity");
      }
      if (dock.style.getPropertyValue("--obg-right-image") === state.image) {
        if (state.originalImage) dock.style.setProperty("--obg-right-image", state.originalImage);
        else dock.style.removeProperty("--obg-right-image");
      }
      if (!state.hadClass) dock.classList.remove("obg-dock");
    }
    this.docks.clear();
  }
}

class ImageChooser extends SuggestModal {
  constructor(app, choose) { super(app); this.choose = choose; }
  getSuggestions(query) { return this.app.vault.getFiles().filter(file => imagePath(file.path) && file.path.toLowerCase().includes(query.toLowerCase())); }
  renderSuggestion(file, el) { el.setText(file.path); }
  onChooseSuggestion(file) { void this.choose(file.path); }
}
class BackgroundSettings extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl: el, plugin } = this; el.empty();
    el.createEl("h2", { text: tr("Background images") });
    for (const region of Object.keys(REGIONS)) {
      let input;
      new Setting(el).setName(tr(REGIONS[region])).setDesc(tr("Vault-relative image path; PNG, JPEG, WebP, GIF or SVG."))
        .addText(text => { input = text; text.setValue(plugin.prefs.images[region]).onChange(path => void plugin.setImage(region, path)); })
        .addButton(button => button.setButtonText(tr("Choose")).onClick(() => new ImageChooser(this.app, path => { input.setValue(path); return plugin.setImage(region, path); }).open()))
        .addButton(button => button.setButtonText(tr("Clear")).onClick(() => { input.setValue(""); void plugin.setImage(region, ""); }));
      new Setting(el).setName(tr("Region default"))
        .addSlider(slider => slider.setLimits(0, 100, 1).setInstant(true).setDisplayFormat(value => value + "%")
          .setValue(Math.round((plugin.prefs.regions[region] ?? DEFAULTS[region]) * 100)).onChange(value => {
            plugin.prefs.regions[region] = value / 100; plugin.refresh(); void plugin.savePrefs();
          }));
    }
  }
}

module.exports = BackgroundPlugin;
module.exports.normalisePrefs = normalisePrefs;
module.exports.rightGeometry = rightGeometry;
module.exports.regionOf = regionOf;
module.exports.popoverPosition = popoverPosition;

module.exports.imagePath = imagePath;
module.exports.DEFAULTS = DEFAULTS;
