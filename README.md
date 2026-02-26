# Vim KeyNav

Vim-style keyboard navigation for Obsidian's **reading mode** and **built-in web browser**.

Obsidian's built-in Vim mode (`Settings → Editor → Vim key bindings`) only works in edit mode. This plugin brings the same muscle memory to reading mode and webview tabs — scroll with `j`/`k`, jump to top/bottom with `gg`/`G`, open links with Vimium-style hint labels, and more.

## Keybindings

| Key | Action |
|-----|--------|
| `j` / `k` | Scroll down / up |
| `gg` | Scroll to top |
| `G` | Scroll to bottom |
| `Ctrl+d` / `Ctrl+f` | Half-page down |
| `Ctrl+u` / `Ctrl+b` | Half-page up |
| `H` | Go back in history |
| `L` | Go forward in history |
| `/` | In-page search |
| `f` / `s` | Activate link hints |

All keybindings work in both reading mode and the built-in browser (webview).

### Link Hints

Press `f` or `s` to show yellow labels on every visible link. Type the label characters to click that link. Press `Escape` to cancel.

Link hints use home-row characters (`fjdkslaghrueiwocmvnt`) and automatically switch to two-character labels when there are more than 20 links visible.

## Webview Support

The plugin injects keybindings into Obsidian's built-in browser tabs. It uses Electron's `before-input-event` to intercept keys at the host level, which allows it to work on complex web apps with cross-origin iframes (e.g. Lark/Feishu docs). Keys that map to scroll actions are translated into native browser scroll events (`ArrowDown`, `PageDown`, etc.) so they work regardless of page structure.

Input fields are detected automatically — vim keybindings are disabled while you're typing in a text field, search box, or editor.

## Installation

### Manual

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/user/obsidian-vim-keynav/releases/latest).
2. Create a folder `vim-keynav` inside your vault's `.obsidian/plugins/` directory.
3. Copy `main.js` and `manifest.json` into that folder.
4. Restart Obsidian, then enable **Vim KeyNav** in `Settings → Community Plugins`.

## License

[MIT](LICENSE)
