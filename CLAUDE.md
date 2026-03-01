# Vim KeyNav - Obsidian Plugin

## Overview

Vim-style keyboard navigation for Obsidian's reading mode and built-in browser (webview).

## Directory Layout

```
~/claude/obsidian-vim-keynav/    # Development repo (this directory)
├── main.js                      # Plugin entry point (plain JS, no build step)
├── manifest.json                # Obsidian plugin metadata
├── README.md
├── LICENSE
└── CLAUDE.md

$WIKI/.obsidian/plugins/vim-keynav/   # Runtime install in vault
├── main.js
└── manifest.json
```

`$WIKI` resolves to `~/wiki/`.

## Development Workflow

1. Edit code in `~/claude/obsidian-vim-keynav/`.
2. Deploy to vault for testing:
   ```bash
   cp ~/claude/obsidian-vim-keynav/{main.js,manifest.json} ~/wiki/.obsidian/plugins/vim-keynav/
   ```
3. In Obsidian: disable then re-enable **Vim KeyNav** in `Settings → Community Plugins` (or restart Obsidian) to reload.
4. Test in both reading mode and webview tabs.
5. Commit to git in `~/claude/obsidian-vim-keynav/`.

## Architecture

The plugin is a single `main.js` with no build step or dependencies.

### Key Components

- **`LinkHints`** — Vimium-style link hint overlay for reading mode.
- **`buildWebviewScript()`** — Self-contained JS string injected into `<webview>` via `executeJavaScript()`. Includes its own link hints, keydown handler, iframe injection, and focus tracking.
- **`VimReadingModePlugin`** — Main plugin class:
  - `_onKeydown()` — Reading mode key handler (registered on `document`).
  - `_setupWebviewObserver()` — MutationObserver that detects new `<webview>` elements.
  - `_attachWebview()` — Injects script, sets up console-message listener, calls `_setupHostKeyHandler()`.
  - `_setupHostKeyHandler()` — Host-level key interception via `before-input-event`. Translates vim keys into native scroll keys (`Down`/`Up`/`Pagedown`/`Pageup`/`Home`/`End`) via `sendInputEvent()` for cross-origin iframe compatibility.

### Webview Key Handling (two layers)

1. **Injected script** (runs inside webview top frame): Handles keys for same-origin pages via `window.addEventListener("keydown", ..., true)`. Also injects into same-origin iframes.
2. **Host-level handler** (`before-input-event` on `<webview>` DOM element): Intercepts keys before they reach page JS in ANY frame (including cross-origin). Translates vim keys to native browser scroll keys via `sendInputEvent()`.

Both layers coexist. The host-level handler takes priority for cross-origin iframe pages (e.g. Lark/Feishu docs).

## Git Worktree

本项目使用了 git worktree。当前目录可能是一个 worktree 而非主仓库，`git checkout master` 会失败。执行需要切换到 master 的操作（如 rebase 合并）前，先用 `git worktree list` 确认 master 所在的 worktree 路径，然后通过 `git -C <主仓库路径>` 在对应目录执行 merge 命令。
