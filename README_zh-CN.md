<h1 align="center">Background</h1>
<p align="center">库内壁纸与每个标签页的实时调节，让 Obsidian 工作区更安静。</p>

<p align="center">
  <a href="https://github.com/qiulinfan/obsidian-background/commits/main"><img src="https://img.shields.io/github/last-commit/qiulinfan/obsidian-background/main?style=flat-square&color=6c5ce7" alt="最近提交"></a>
  <a href="https://github.com/qiulinfan/obsidian-background/stargazers"><img src="https://img.shields.io/github/stars/qiulinfan/obsidian-background?style=flat-square&color=6c5ce7" alt="GitHub 星标"></a>
  <a href="https://github.com/qiulinfan/obsidian-background/releases/latest"><img src="https://img.shields.io/github/v/release/qiulinfan/obsidian-background?style=flat-square&color=00b894" alt="最新发布"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-636e72?style=flat-square" alt="MIT 许可"></a>
</p>
<p align="center"><a href="./README.md">English</a> | <b>简体中文</b></p>

## 亮点

| 为工作区的各个区域选一张壁纸 | 看着页面，直接调节 |
|:--:|:--:|
| ![模拟工作区中的原创壁纸](./docs/screenshots/workspace.png) | ![标签页的实时背景强度调节](./docs/screenshots/controls.png) |
| 编辑区、左侧栏、右侧栏和终端面板可以各用一张库内图片。 | 点击标签页的滑块图标，将图片强度调到 0–100%；文字和控件仍保持原有不透明度。 |

截图拍摄于 **Obsidian Desktop 1.13.7**。其中的笔记和控制台内容均为模拟数据，四张 SVG 壁纸是原创程序绘制作品。为便于展示，演示中的背景比初始默认值更明显。详见[演示库与素材说明](./docs/demo-vault/ARTWORK.md)。

## 背景侧栏

![Obsidian 1.13.7 中的背景侧栏](./docs/screenshots/sidebar.png)

从一个面板选择目标标签页、预览本地图片并调整效果。截图仅使用模拟笔记和原创 SVG 演示素材。

## 功能

| 功能 | 作用 |
| --- | --- |
| 库内图片选择 | 支持 PNG、JPEG、WebP、GIF、SVG，无须额外 CSS snippet。 |
| 标签页实时调节 | 拖动滑块即可预览，改动自动保存。 |
| 背景侧栏 | 独立的右侧控制栏跟随当前标签页，提供图片预览、图片选择和透明度滑块。 |
| 独立标签页 | 每个标签页都可以使用自己的图片和透明度，不影响其他标签页。 |
| 区域默认值 | 为新标签页及没有独立设置的标签页提供默认强度。 |
| 连续的右侧栏背景 | 右侧栏分成多个面板时，保持同一张图片的整体取景。 |
| 内容保持不透明 | 只改变壁纸图层强度，文字、控件和 PDF 纸张保留原有不透明度。 |
| 原生主题控件 | 使用 Obsidian 的颜色变量，弹窗按空间自动定位并适应宽度。 |
| 中英界面 | 控件跟随 Obsidian 的语言设置，命令名称目前为英文。 |
| 小体积运行时 | 使用 Obsidian API，不捆绑框架或运行时依赖；仅支持桌面。 |

## 快速开始

1. 在 Obsidian Desktop **1.13.7 或更新版本**中[安装最新 GitHub release](#安装)。
2. 点击功能区的 **Background** 图片图标，或执行 **Background: Open background sidebar**。
3. 选择标签页，在侧栏更换本地图片、调整透明度。标题栏的小滑块按钮仍可用于快速调整。

**设置 → Background** 用于配置区域默认图片。“不显示背景”只隐藏当前标签页的图片；“沿用默认图片”让它重新使用区域默认值。点击控制栏不会改变正在调整的目标。

`Wallpapers/editor.jpg` 这样的路径相对于当前库。点击**选择**打开文件列表；**清除**会恢复该区域的原生背景。

## 安装

### 社区目录

打开 [Background 社区页面](https://community.obsidian.md/plugins/background)，点击 **Add to Obsidian**，然后启用 **Background**。

### 手动安装 release

1. 从[最新发布](https://github.com/qiulinfan/obsidian-background/releases/latest)下载 `main.js`、`manifest.json` 和 `styles.css`。
2. 创建 `<vault>/.obsidian/plugins/background/`，将三个文件放进去。
3. 重启 Obsidian，在 **设置 → 第三方插件** 中启用 **Background**。
4. 在 **设置 → Background** 中选择图片。

插件 ID 和安装文件夹均为 **`background`**。

### 从 0.1.0 更新

0.1.0 使用的 ID 为 `obsidian-background`。安装 0.1.1 或更新版本前，先停用旧插件并备份旧文件夹，再安装到 `background/`。如需保留图片路径和强度设置，在启用新版本前，将旧文件夹中的 `data.json` **仅在本地**复制到新文件夹。只启用一份插件。插件不会自动移动文件夹或改写配置；反馈问题时不要上传 `data.json`。

已发布的 0.1.0 tag 和附件保留原样。

## 调整效果

**恢复默认**会删除当前标签页独立的图片和透明度设置。**设为该区域默认**会将当前图片和透明度用于新标签页及没有独立设置的标签页，其他单独调过的标签页不受影响。命令面板也提供 **Background: Adjust current tab background strength**。

初始默认值较轻：

| 区域 | 强度 |
| --- | ---: |
| 编辑区，包括源码和实时编辑视图 | 5% |
| 左侧栏 | 6% |
| 右侧栏 | 4% |
| 终端 | 6% |

每个标签页的图片和透明度按其 leaf ID 保存，可随布局保存与重启恢复；关闭标签页会移除对应设置。希望以后打开的标签页使用同样图片和透明度时，请设置区域默认值。

Background 用于原生工作区表面和 CodeMirror 编辑器。第三方视图自己的不透明画布、或主题的背景规则，可能遮住壁纸。PDF 和其他纸张表面保留原有颜色。终端等视图插件是可选的，Background 不会安装它们。在 Obsidian 内移动或重命名已选图片时，插件会更新对应配置路径。

## 隐私与本地数据

Background 通过 Obsidian 的 vault adapter 加载你选择的图片，只在自己的本地 `data.json` 中保存库内相对路径、区域默认值和标签页强度。它不读取笔记正文、终端历史或 API 设置，不访问库外文件，不发送网络请求、不收集遥测、不下载壁纸，也不安装依赖。无须账号、API key 或付费。

演示目录仅含模拟笔记和原创素材，没有个人库配置。可以将 [docs/demo-vault](./docs/demo-vault) 复制到新文件夹，作为新库打开，再选择 `Wallpapers/` 下的图片。

## 反馈与开发

[报告问题或提出建议](https://github.com/qiulinfan/obsidian-background/issues)。请提供 Obsidian 版本、操作系统、插件版本、主题和简短复现步骤；截图使用干净演示库，省略个人配置。

`main.js` 同时是手写源码和发布文件。Node.js 仅用于开发检查，无须构建或安装依赖：

```sh
npm run check
```

发布流程检查源码语法、行为测试和版本信息，要求 tag 与 `manifest.json` 的版本完全一致（不带 `v`），然后只上传三个插件文件，不覆盖已有 release。

## 许可

源码、文档及原创演示 SVG 使用 [MIT](./LICENSE)，版权归 **2026 Qiulin Fan**。允许使用、修改、分发和销售，须保留版权与许可声明；Obsidian 和其他独立安装的软件保留各自许可。
