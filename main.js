/*
 * Vim KeyNav
 * Vim-style keyboard navigation for Obsidian reading mode & built-in browser.
 *
 * Scrolling:  j/k, gg, G, Ctrl+d/f, Ctrl+u/b
 * Navigation: Ctrl+o (back), Ctrl+i (forward), H (prev tab), L (next tab)
 * Search:     / (in-page search)
 * Link Hints: f/s (current tab), F/S (new tab)
 */

"use strict";

const obsidian = require("obsidian");

const SCROLL_STEP = 60;
const HINT_CHARS = "fjdkslaghrueiwocmvnt";
const SEQUENCE_TIMEOUT = 500;

// ── Link Hints ──────────────────────────────────────────────

class LinkHints {
	constructor(container) {
		this.container = container;
		this.active = false;
		this.hints = [];
		this.typed = "";
		this.wrapperEl = null;
	}

	activate(openInNewTab) {
		if (this.active) return;
		this.active = true;
		this.typed = "";
		this.openInNewTab = !!openInNewTab;

		const links = Array.from(this.container.querySelectorAll(
			"a, .internal-link, .external-link, .tag, .internal-embed"
		));

		const containerRect = this.container.getBoundingClientRect();
		const visible = links.filter(el => {
			const r = el.getBoundingClientRect();
			return r.top < containerRect.bottom && r.bottom > containerRect.top
				&& r.left < containerRect.right && r.right > containerRect.left
				&& r.width > 0 && r.height > 0;
		});

		if (visible.length === 0) {
			this.active = false;
			return;
		}

		const labels = this._generateLabels(visible.length);

		this.wrapperEl = document.createElement("div");
		this.wrapperEl.className = "vim-link-hints-wrapper";
		this.container.appendChild(this.wrapperEl);

		const wrapperRect = this.wrapperEl.getBoundingClientRect();

		this.hints = visible.map((el, i) => {
			const overlay = document.createElement("span");
			overlay.className = "vim-link-hint";
			overlay.textContent = labels[i];
			const elRect = el.getBoundingClientRect();
			overlay.style.left = (elRect.left - wrapperRect.left) + "px";
			overlay.style.top = (elRect.top - wrapperRect.top) + "px";
			this.wrapperEl.appendChild(overlay);
			return { el, label: labels[i], overlay };
		});
	}

	handleKey(key) {
		if (!this.active) return false;
		if (key === "Escape") { this.deactivate(); return true; }
		if (key === "Backspace") {
			if (this.typed.length > 0) {
				this.typed = this.typed.slice(0, -1);
				this._updateVisibility();
			}
			return true;
		}

		this.typed += key.toLowerCase();
		const exact = this.hints.find(h => h.label === this.typed);
		if (exact) {
			if (this.openInNewTab) {
				exact.el.dispatchEvent(new MouseEvent("click", {
					bubbles: true, cancelable: true, ctrlKey: true, metaKey: true
				}));
			} else {
				exact.el.click();
			}
			this.deactivate(); return true;
		}
		const possible = this.hints.filter(h => h.label.startsWith(this.typed));
		if (possible.length === 0) { this.deactivate(); return true; }
		this._updateVisibility();
		return true;
	}

	deactivate() {
		this.active = false;
		this.typed = "";
		if (this.wrapperEl) { this.wrapperEl.remove(); this.wrapperEl = null; }
		this.hints = [];
	}

	_updateVisibility() {
		for (const h of this.hints) {
			if (h.label.startsWith(this.typed)) {
				h.overlay.style.display = "";
				const matched = h.label.slice(0, this.typed.length);
				const rest = h.label.slice(this.typed.length);
				h.overlay.innerHTML = '<span class="vim-hint-matched">' + matched + "</span>" + rest;
			} else {
				h.overlay.style.display = "none";
			}
		}
	}

	_generateLabels(count) {
		const chars = HINT_CHARS;
		if (count <= chars.length) {
			return Array.from({ length: count }, (_, i) => chars[i]);
		}
		const labels = [];
		for (let i = 0; i < chars.length && labels.length < count; i++) {
			for (let j = 0; j < chars.length && labels.length < count; j++) {
				labels.push(chars[i] + chars[j]);
			}
		}
		return labels;
	}
}

// ── Styles ──────────────────────────────────────────────────

const HINT_STYLES = `
.vim-link-hints-wrapper {
	position: absolute;
	top: 0; left: 0; width: 0; height: 0;
	z-index: 9999;
	pointer-events: none;
}
.vim-link-hint {
	position: absolute;
	background: #f5c542;
	color: #1a1a1a;
	font-family: monospace;
	font-size: 11px;
	font-weight: bold;
	padding: 1px 4px;
	border-radius: 3px;
	border: 1px solid #d4a830;
	box-shadow: 0 1px 3px rgba(0,0,0,0.3);
	line-height: 1.2;
	text-transform: uppercase;
	z-index: 9999;
	pointer-events: none;
}
.vim-hint-matched {
	color: #c0392b;
}
`;

// ── Webview injected script ─────────────────────────────────
// Self-contained script injected into Obsidian's built-in browser <webview>.
// No external dependencies — all logic is inlined.

function buildWebviewScript() {
	return `(function() {
	if (window.__vimReadingModeInjected) return;
	window.__vimReadingModeInjected = true;

	var SCROLL_STEP = 60;
	var HINT_CHARS = "fjdkslaghrueiwocmvnt";
	var SEQUENCE_TIMEOUT = 500;

	// ── Inject styles ──
	function injectStyles(doc) {
		if (doc.__vimStylesInjected) return;
		doc.__vimStylesInjected = true;
		var style = doc.createElement("style");
		style.textContent = \`
.vim-link-hints-wrapper {
	position: fixed; top: 0; left: 0; width: 0; height: 0;
	z-index: 2147483647; pointer-events: none;
}
.vim-link-hint {
	position: fixed;
	background: #f5c542; color: #1a1a1a;
	font-family: monospace; font-size: 11px; font-weight: bold;
	padding: 1px 4px; border-radius: 3px;
	border: 1px solid #d4a830;
	box-shadow: 0 1px 3px rgba(0,0,0,0.3);
	line-height: 1.2; text-transform: uppercase;
	z-index: 2147483647; pointer-events: none;
}
.vim-hint-matched { color: #c0392b; }
		\`;
		(doc.head || doc.documentElement).appendChild(style);
	}
	injectStyles(document);

	// ── Link Hints ──
	var hintsActive = false;
	var hintsOpenInNewTab = false;
	var hints = [];
	var typed = "";
	var wrapperEl = null;

	function collectVisibleLinks() {
		var allLinks = [];
		function gather(doc) {
			try {
				var els = doc.querySelectorAll("a[href], button, [role=button], input[type=submit], [onclick]");
				for (var i = 0; i < els.length; i++) allLinks.push({ el: els[i], doc: doc });
			} catch(e) {}
			try {
				var frames = doc.querySelectorAll("iframe");
				for (var i = 0; i < frames.length; i++) {
					try { if (frames[i].contentDocument) gather(frames[i].contentDocument); } catch(e) {}
				}
			} catch(e) {}
		}
		gather(document);
		return allLinks.filter(function(item) {
			var r = item.el.getBoundingClientRect();
			return r.top < window.innerHeight && r.bottom > 0
				&& r.left < window.innerWidth && r.right > 0
				&& r.width > 0 && r.height > 0;
		});
	}

	function activateHints(openInNewTab) {
		if (hintsActive) return;
		hintsActive = true;
		hintsOpenInNewTab = !!openInNewTab;
		typed = "";
		var visible = collectVisibleLinks();
		if (visible.length === 0) { hintsActive = false; return; }
		var labels = generateLabels(visible.length);
		wrapperEl = document.createElement("div");
		wrapperEl.className = "vim-link-hints-wrapper";
		document.body.appendChild(wrapperEl);
		hints = visible.map(function(item, i) {
			var overlay = document.createElement("span");
			overlay.className = "vim-link-hint";
			overlay.textContent = labels[i];
			var r = item.el.getBoundingClientRect();
			overlay.style.left = r.left + "px";
			overlay.style.top = r.top + "px";
			wrapperEl.appendChild(overlay);
			return { el: item.el, label: labels[i], overlay: overlay };
		});
	}

	function deactivateHints() {
		hintsActive = false; typed = "";
		if (wrapperEl) { wrapperEl.remove(); wrapperEl = null; }
		hints = [];
	}

	function handleHintKey(key) {
		if (!hintsActive) return false;
		if (key === "Escape") { deactivateHints(); return true; }
		if (key === "Backspace") {
			if (typed.length > 0) { typed = typed.slice(0, -1); updateHintVisibility(); }
			return true;
		}
		typed += key.toLowerCase();
		var exact = hints.find(function(h) { return h.label === typed; });
		if (exact) {
			if (hintsOpenInNewTab) {
				exact.el.dispatchEvent(new MouseEvent("click", {
					bubbles: true, cancelable: true, ctrlKey: true, metaKey: true
				}));
			} else {
				exact.el.click();
			}
			deactivateHints(); return true;
		}
		var possible = hints.filter(function(h) { return h.label.startsWith(typed); });
		if (possible.length === 0) { deactivateHints(); return true; }
		updateHintVisibility();
		return true;
	}

	function updateHintVisibility() {
		for (var i = 0; i < hints.length; i++) {
			var h = hints[i];
			if (h.label.startsWith(typed)) {
				h.overlay.style.display = "";
				var matched = h.label.slice(0, typed.length);
				var rest = h.label.slice(typed.length);
				h.overlay.innerHTML = '<span class="vim-hint-matched">' + matched + '</span>' + rest;
			} else {
				h.overlay.style.display = "none";
			}
		}
	}

	function generateLabels(count) {
		var chars = HINT_CHARS;
		if (count <= chars.length) return Array.from({ length: count }, function(_, i) { return chars[i]; });
		var labels = [];
		for (var i = 0; i < chars.length && labels.length < count; i++)
			for (var j = 0; j < chars.length && labels.length < count; j++)
				labels.push(chars[i] + chars[j]);
		return labels;
	}

	var gPending = false;
	var gTimer = null;

	// ── Focus detection ──
	function getDeepActiveElement() {
		var el = document.activeElement;
		while (el && el.shadowRoot && el.shadowRoot.activeElement) {
			el = el.shadowRoot.activeElement;
		}
		return el;
	}

	function isEditable(el) {
		if (!el || el === document.body || el === document.documentElement) return false;
		var tag = el.tagName;
		if (tag === "INPUT") {
			var type = (el.type || "").toLowerCase();
			var nonText = ["button","checkbox","color","file","hidden","image","radio","reset","submit"];
			return nonText.indexOf(type) === -1;
		}
		if (tag === "TEXTAREA") return true;
		if (tag === "SELECT") return true;
		if (el.isContentEditable) {
			var r = el.getBoundingClientRect();
			if (r.height > window.innerHeight * 0.5) return false;
			return true;
		}
		return false;
	}

	// ── Keydown handler ──
	function handleKeydown(evt) {
		if (evt.isTrusted === false) return;
		if (hintsActive) {
			if (handleHintKey(evt.key)) {
				evt.preventDefault();
				evt.stopImmediatePropagation();
			}
			return;
		}
		var active = getDeepActiveElement();
		if (isEditable(active)) return;

		var halfPage = window.innerHeight * 0.5;

		if (evt.ctrlKey && !evt.shiftKey && !evt.altKey && !evt.metaKey) {
			if (evt.key === "d" || evt.key === "f") {
				window.scrollBy({ top: halfPage, behavior: "smooth" });
				evt.preventDefault(); evt.stopImmediatePropagation(); return;
			}
			if (evt.key === "u" || evt.key === "b") {
				window.scrollBy({ top: -halfPage, behavior: "smooth" });
				evt.preventDefault(); evt.stopImmediatePropagation(); return;
			}
			if (evt.key === "o") {
				history.back();
				evt.preventDefault(); evt.stopImmediatePropagation(); return;
			}
			if (evt.key === "i") {
				history.forward();
				evt.preventDefault(); evt.stopImmediatePropagation(); return;
			}
		}
		if (evt.ctrlKey || evt.altKey || evt.metaKey) return;

		if (evt.shiftKey) {
			switch (evt.key) {
				case "G":
					var scrollEl = document.scrollingElement || document.documentElement;
					window.scrollTo({ top: scrollEl.scrollHeight, behavior: "smooth" });
					evt.preventDefault(); evt.stopImmediatePropagation(); return;
				case "F": case "S":
					activateHints(true);
					if (hintsActive) { evt.preventDefault(); evt.stopImmediatePropagation(); }
					return;
			}
			return;
		}

		switch (evt.key) {
			case "j":
				window.scrollBy({ top: SCROLL_STEP });
				evt.preventDefault(); evt.stopImmediatePropagation(); break;
			case "k":
				window.scrollBy({ top: -SCROLL_STEP });
				evt.preventDefault(); evt.stopImmediatePropagation(); break;
			case "/":
				console.log("__VIM_FIND_IN_PAGE__");
				evt.preventDefault(); evt.stopImmediatePropagation(); break;
			case "f": case "s":
				activateHints();
				if (hintsActive) { evt.preventDefault(); evt.stopImmediatePropagation(); }
				break;
			case "g":
				if (gPending) {
					clearTimeout(gTimer); gPending = false;
					window.scrollTo({ top: 0, behavior: "smooth" });
					evt.preventDefault(); evt.stopImmediatePropagation();
				} else {
					gPending = true;
					gTimer = setTimeout(function() { gPending = false; }, SEQUENCE_TIMEOUT);
				}
				break;
			default:
				if (gPending) { clearTimeout(gTimer); gPending = false; }
				break;
		}
	}

	window.addEventListener("keydown", handleKeydown, true);

	// ── Expose globals for host-level control ──
	window.__vimHintsActive = false;
	window.__vimActivateHints = function(openInNewTab) {
		activateHints(openInNewTab);
		window.__vimHintsActive = hintsActive;
	};
	window.__vimDeactivateHints = function() {
		deactivateHints();
		window.__vimHintsActive = false;
	};
	window.__vimHandleHintKey = function(key) {
		var result = handleHintKey(key);
		window.__vimHintsActive = hintsActive;
		return result;
	};

	// ── Inject into same-origin iframes ──
	function injectIntoFrames() {
		var frames = document.querySelectorAll("iframe");
		for (var fi = 0; fi < frames.length; fi++) {
			try {
				var fdoc = frames[fi].contentDocument;
				if (!fdoc || fdoc.__vimKeyHandlerInjected) continue;
				fdoc.__vimKeyHandlerInjected = true;
				injectStyles(fdoc);
				fdoc.defaultView.addEventListener("keydown", function(evt) {
					handleKeydown(evt);
				}, true);
			} catch(e) {}
		}
	}

	injectIntoFrames();
	var mo = new MutationObserver(function() { injectIntoFrames(); });
	mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
	var retries = 0;
	var retryInterval = setInterval(function() {
		injectIntoFrames();
		if (++retries >= 20) clearInterval(retryInterval);
	}, 1000);
})();`;
}

// ── Plugin ──────────────────────────────────────────────────

class VimReadingModePlugin extends obsidian.Plugin {
	constructor() {
		super(...arguments);
		this._gPending = false;
		this._gTimer = null;
		this._linkHints = null;
		this._styleEl = null;
		this._observer = null;
		this._trackedWebviews = new WeakSet();
		this._onKeydown = this._onKeydown.bind(this);
	}

	async onload() {
		this._styleEl = document.createElement("style");
		this._styleEl.textContent = HINT_STYLES;
		document.head.appendChild(this._styleEl);

		this.registerDomEvent(document, "keydown", this._onKeydown);
		this._setupWebviewObserver();

		// When switching to a webview tab, keep it unfocused (normal mode)
		// so document keydown can capture vim keys.
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (!leaf) return;
				setTimeout(() => {
					const wv = leaf.view.containerEl.querySelector("webview");
					if (wv && document.activeElement === wv) {
						wv.blur();
					}
				}, 50);
			})
		);
	}

	onunload() {
		if (this._gTimer) clearTimeout(this._gTimer);
		if (this._linkHints) this._linkHints.deactivate();
		if (this._styleEl) this._styleEl.remove();
		if (this._observer) this._observer.disconnect();
	}

	// ── Webview observer ──

	_setupWebviewObserver() {
		document.querySelectorAll("webview").forEach(wv => this._attachWebview(wv));
		this._observer = new MutationObserver(mutations => {
			for (const m of mutations) {
				for (const node of m.addedNodes) {
					if (node.nodeName === "WEBVIEW") {
						this._attachWebview(node);
					}
					if (node.querySelectorAll) {
						node.querySelectorAll("webview").forEach(wv => this._attachWebview(wv));
					}
				}
			}
		});
		this._observer.observe(document.body, { childList: true, subtree: true });
	}

	_attachWebview(webview) {
		if (this._trackedWebviews.has(webview)) return;
		this._trackedWebviews.add(webview);

		const script = buildWebviewScript();

		const inject = () => {
			try { webview.executeJavaScript(script); } catch (e) {}
		};

		const injectAndBlur = () => {
			inject();
			// Keep webview unfocused so document keydown captures vim keys.
			// Lark and similar SPAs use cross-origin iframes that swallow
			// keyboard events — by keeping focus on the host document,
			// we can intercept keys and forward them via executeJavaScript.
			setTimeout(() => {
				if (document.activeElement === webview) {
					webview.blur();
				}
			}, 100);
		};

		webview.addEventListener("dom-ready", injectAndBlur);
		webview.addEventListener("did-navigate", injectAndBlur);
		webview.addEventListener("did-navigate-in-page", inject);
		webview.addEventListener("did-finish-load", () => {
			inject();
			// Blur again after full load — SPAs may re-grab focus
			setTimeout(() => {
				if (document.activeElement === webview) {
					webview.blur();
				}
			}, 300);
		});

		// Prevent webview from auto-grabbing focus (e.g. from Lark's JS).
		// Stop preventing after user explicitly clicks on the webview.
		const preventAutoFocus = () => {
			if (document.activeElement === webview) {
				webview.blur();
			}
		};
		webview.addEventListener("focus", preventAutoFocus);

		// User click = enter "insert mode" — allow webview to have focus
		webview.addEventListener("mousedown", () => {
			webview.removeEventListener("focus", preventAutoFocus);
		}, { once: true });

		// Handle console messages from injected script
		webview.addEventListener("console-message", (e) => {
			if (e.message === "__VIM_FIND_IN_PAGE__") {
				this._openWebviewSearch(webview);
			}
			if (e.message === "__VIM_EXIT_INSERT__") {
				// User pressed Escape in the webview — blur to return to normal mode
				webview.blur();
				// Re-install focus prevention
				webview.addEventListener("focus", preventAutoFocus);
				// Remove it again on next mousedown
				webview.addEventListener("mousedown", () => {
					webview.removeEventListener("focus", preventAutoFocus);
				}, { once: true });
			}
		});

		if (webview.getURL && webview.getURL()) {
			inject();
		}
	}

	_openWebviewSearch(webview) {
		try {
			this.app.commands.executeCommandById("editor:open-search");
		} catch (e) {
			const term = prompt("Search in page:");
			if (term) {
				webview.findInPage(term);
			}
		}
	}

	// ── Helpers ──

	_switchTab(direction) {
		const leaf = this.app.workspace.activeLeaf;
		if (!leaf || !leaf.parent) return;
		const siblings = leaf.parent.children;
		const idx = siblings.indexOf(leaf);
		if (idx < 0) return;
		const next = direction > 0
			? (idx + 1) % siblings.length
			: (idx - 1 + siblings.length) % siblings.length;
		this.app.workspace.setActiveLeaf(siblings[next], { focus: true });
	}

	_getScrollContainer() {
		const mdView = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
		if (mdView) {
			if (mdView.getMode() === "preview") {
				const el = mdView.previewMode.containerEl.querySelector(".markdown-preview-view");
				return el || mdView.previewMode.containerEl;
			}
			return null;
		}

		const leaf = this.app.workspace.activeLeaf;
		if (!leaf || !leaf.view) return null;

		if (leaf.view.containerEl.querySelector("webview")) return null;

		const content = leaf.view.containerEl.querySelector(".view-content");
		return content || null;
	}

	_isInputFocused(evt) {
		const t = evt.target;
		return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
	}

	// ── Direct webview key handler ──
	// Uses executeJavaScript to forward vim keys to the webview.
	// Works regardless of webview focus state.

	_handleWebviewKeyDirect(webview, evt) {
		const key = evt.key;
		const ctrl = evt.ctrlKey;
		const shift = evt.shiftKey;
		const alt = evt.altKey;
		const meta = evt.metaKey;

		const execJS = (expr) => {
			try { webview.executeJavaScript(expr); } catch (e) {}
		};

		if (ctrl && !shift && !alt && !meta) {
			if (key === "d" || key === "f") {
				execJS("window.scrollBy({top:window.innerHeight*0.5,behavior:'smooth'})");
				evt.preventDefault(); return;
			}
			if (key === "u" || key === "b") {
				execJS("window.scrollBy({top:-window.innerHeight*0.5,behavior:'smooth'})");
				evt.preventDefault(); return;
			}
			if (key === "o") {
				try { webview.goBack(); } catch (e) {
					execJS("history.back()");
				}
				evt.preventDefault(); return;
			}
			if (key === "i") {
				try { webview.goForward(); } catch (e) {
					execJS("history.forward()");
				}
				evt.preventDefault(); return;
			}
		}

		if (ctrl || alt || meta) return;

		if (shift) {
			if (key === "H") { this._switchTab(-1); evt.preventDefault(); return; }
			if (key === "L") { this._switchTab(1); evt.preventDefault(); return; }
			if (key === "G") {
				execJS("window.scrollTo({top:(document.scrollingElement||document.documentElement).scrollHeight,behavior:'smooth'})");
				evt.preventDefault(); return;
			}
			if (key === "F" || key === "S") {
				execJS("if(window.__vimActivateHints) window.__vimActivateHints(true)");
				evt.preventDefault(); return;
			}
			return;
		}

		switch (key) {
			case "j":
				execJS("window.scrollBy({top:60})");
				evt.preventDefault(); break;
			case "k":
				execJS("window.scrollBy({top:-60})");
				evt.preventDefault(); break;
			case "/":
				this._openWebviewSearch(webview);
				evt.preventDefault(); break;
			case "f": case "s":
				execJS("if(window.__vimActivateHints) window.__vimActivateHints()");
				evt.preventDefault(); break;
			case "g":
				if (this._gPending) {
					clearTimeout(this._gTimer);
					this._gPending = false;
					execJS("window.scrollTo({top:0,behavior:'smooth'})");
					evt.preventDefault();
				} else {
					this._gPending = true;
					this._gTimer = setTimeout(() => { this._gPending = false; }, SEQUENCE_TIMEOUT);
				}
				break;
			default:
				if (this._gPending) {
					clearTimeout(this._gTimer);
					this._gPending = false;
				}
				break;
		}
	}

	// ── Keydown handler (all view types) ──

	_onKeydown(evt) {
		// Link Hints intercept
		if (this._linkHints && this._linkHints.active) {
			if (this._linkHints.handleKey(evt.key)) {
				evt.preventDefault();
				evt.stopPropagation();
			}
			return;
		}

		if (this._isInputFocused(evt)) return;

		// If active view has a webview, handle keys via executeJavaScript
		const leaf = this.app.workspace.activeLeaf;
		if (leaf && leaf.view) {
			const wv = leaf.view.containerEl.querySelector("webview");
			if (wv) {
				this._handleWebviewKeyDirect(wv, evt);
				return;
			}
		}

		// ── Global navigation (works in any view type) ──

		if (evt.ctrlKey && !evt.shiftKey && !evt.altKey && !evt.metaKey) {
			if (evt.key === "o") {
				this.app.commands.executeCommandById("app:go-back");
				evt.preventDefault(); return;
			}
			if (evt.key === "i") {
				this.app.commands.executeCommandById("app:go-forward");
				evt.preventDefault(); return;
			}
		}

		if (evt.shiftKey && !evt.ctrlKey && !evt.altKey && !evt.metaKey) {
			if (evt.key === "H") {
				this._switchTab(-1);
				evt.preventDefault(); return;
			}
			if (evt.key === "L") {
				this._switchTab(1);
				evt.preventDefault(); return;
			}
		}

		// ── Scrolling keys (require a scrollable container) ──

		const container = this._getScrollContainer();
		if (!container) return;

		const halfPage = container.clientHeight * 0.5;

		if (evt.ctrlKey && !evt.shiftKey && !evt.altKey && !evt.metaKey) {
			if (evt.key === "d" || evt.key === "f") {
				container.scrollBy({ top: halfPage, behavior: "smooth" });
				evt.preventDefault(); return;
			}
			if (evt.key === "u" || evt.key === "b") {
				container.scrollBy({ top: -halfPage, behavior: "smooth" });
				evt.preventDefault(); return;
			}
		}

		if (evt.ctrlKey || evt.altKey || evt.metaKey) return;

		if (evt.shiftKey) {
			if (evt.key === "G") {
				container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
				evt.preventDefault();
			}
			if (evt.key === "F" || evt.key === "S") {
				this._linkHints = new LinkHints(container);
				this._linkHints.activate(true);
				if (this._linkHints.active) {
					evt.preventDefault();
				} else {
					this._linkHints = null;
				}
			}
			return;
		}

		switch (evt.key) {
			case "j":
				container.scrollBy({ top: SCROLL_STEP });
				evt.preventDefault(); break;
			case "k":
				container.scrollBy({ top: -SCROLL_STEP });
				evt.preventDefault(); break;
			case "/":
				this.app.commands.executeCommandById("editor:open-search");
				evt.preventDefault(); break;
			case "f":
			case "s":
				this._linkHints = new LinkHints(container);
				this._linkHints.activate();
				if (this._linkHints.active) {
					evt.preventDefault();
				} else {
					this._linkHints = null;
				}
				break;
			case "g":
				if (this._gPending) {
					clearTimeout(this._gTimer);
					this._gPending = false;
					container.scrollTo({ top: 0, behavior: "smooth" });
					evt.preventDefault();
				} else {
					this._gPending = true;
					this._gTimer = setTimeout(() => { this._gPending = false; }, SEQUENCE_TIMEOUT);
				}
				break;
			default:
				if (this._gPending) {
					clearTimeout(this._gTimer);
					this._gPending = false;
				}
				break;
		}
	}
}

module.exports = VimReadingModePlugin;
