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

	const SCROLL_STEP = 60;
	const HINT_CHARS = "fjdkslaghrueiwocmvnt";
	const SEQUENCE_TIMEOUT = 500;

	// ── Inject styles ──
	function injectStyles(doc) {
		if (doc.__vimStylesInjected) return;
		doc.__vimStylesInjected = true;
		const style = doc.createElement("style");
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

	// ── Link Hints (webview version, uses fixed positioning) ──
	let hintsActive = false;
	let hintsOpenInNewTab = false;
	let hints = [];
	let typed = "";
	let wrapperEl = null;

	function collectVisibleLinks() {
		// Collect from main document and all accessible iframes
		const allLinks = [];
		function gather(doc) {
			try {
				const els = doc.querySelectorAll("a[href], button, [role=button], input[type=submit], [onclick]");
				for (const el of els) allLinks.push({ el, doc });
			} catch(e) {}
			try {
				const frames = doc.querySelectorAll("iframe");
				for (const f of frames) {
					try { if (f.contentDocument) gather(f.contentDocument); } catch(e) {}
				}
			} catch(e) {}
		}
		gather(document);
		return allLinks.filter(({ el }) => {
			const r = el.getBoundingClientRect();
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

		const visible = collectVisibleLinks();
		if (visible.length === 0) { hintsActive = false; return; }

		const labels = generateLabels(visible.length);
		wrapperEl = document.createElement("div");
		wrapperEl.className = "vim-link-hints-wrapper";
		document.body.appendChild(wrapperEl);

		hints = visible.map(({ el }, i) => {
			const overlay = document.createElement("span");
			overlay.className = "vim-link-hint";
			overlay.textContent = labels[i];
			const r = el.getBoundingClientRect();
			overlay.style.left = r.left + "px";
			overlay.style.top = r.top + "px";
			wrapperEl.appendChild(overlay);
			return { el, label: labels[i], overlay };
		});
	}

	function deactivateHints() {
		hintsActive = false;
		typed = "";
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
		const exact = hints.find(h => h.label === typed);
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
		const possible = hints.filter(h => h.label.startsWith(typed));
		if (possible.length === 0) { deactivateHints(); return true; }
		updateHintVisibility();
		return true;
	}

	function updateHintVisibility() {
		for (const h of hints) {
			if (h.label.startsWith(typed)) {
				h.overlay.style.display = "";
				const matched = h.label.slice(0, typed.length);
				const rest = h.label.slice(typed.length);
				h.overlay.innerHTML = '<span class="vim-hint-matched">' + matched + '</span>' + rest;
			} else {
				h.overlay.style.display = "none";
			}
		}
	}

	function generateLabels(count) {
		const chars = HINT_CHARS;
		if (count <= chars.length) return Array.from({ length: count }, (_, i) => chars[i]);
		const labels = [];
		for (let i = 0; i < chars.length && labels.length < count; i++)
			for (let j = 0; j < chars.length && labels.length < count; j++)
				labels.push(chars[i] + chars[j]);
		return labels;
	}

	// ── Key sequence state ──
	let gPending = false;
	let gTimer = null;

	// ── Determine if target is a real text input (not Lark's contentEditable viewer) ──
	function isRealInput(t) {
		if (t.tagName === "INPUT") {
			const type = (t.type || "").toLowerCase();
			// Only block text-like inputs, not buttons/checkboxes
			return ["text","password","email","search","url","tel","number",""].includes(type);
		}
		if (t.tagName === "TEXTAREA") return true;
		// For contentEditable: only treat as input if it looks like an actual editor
		// (has a small bounding box or is explicitly an editor role)
		if (t.isContentEditable) {
			// Skip if it's a large container (likely Lark's page-level contentEditable wrapper)
			const r = t.getBoundingClientRect();
			if (r.height > window.innerHeight * 0.5) return false;
			return true;
		}
		return false;
	}

	// ── Main keydown handler — on window capture for highest priority ──
	function handleKeydown(evt) {
		// Link hints intercept
		if (hintsActive) {
			if (handleHintKey(evt.key)) {
				evt.preventDefault();
				evt.stopImmediatePropagation();
			}
			return;
		}

		if (isRealInput(evt.target)) return;

		const scrollEl = document.scrollingElement || document.documentElement;
		const halfPage = window.innerHeight * 0.5;

		// Ctrl combos
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

		// Shift keys
		if (evt.shiftKey) {
			switch (evt.key) {
				case "G":
					window.scrollTo({ top: scrollEl.scrollHeight, behavior: "smooth" });
					evt.preventDefault(); evt.stopImmediatePropagation(); return;
				case "F": case "S":
					activateHints(true);
					if (hintsActive) { evt.preventDefault(); evt.stopImmediatePropagation(); }
					return;
			}
			return;
		}

		// Plain keys
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

	// Listen on window (capture) — runs before any document-level handlers
	window.addEventListener("keydown", handleKeydown, true);

	// ── Expose globals for host-level control (before-input-event) ──
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
		const result = handleHintKey(key);
		window.__vimHintsActive = hintsActive;
		return result;
	};

	// ── Report input focus state to host ──
	document.addEventListener("focusin", function(e) {
		const t = e.target;
		if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) {
			console.log("__VIM_INPUT_FOCUS__");
		}
	}, true);
	document.addEventListener("focusout", function(e) {
		console.log("__VIM_INPUT_BLUR__");
	}, true);

	// ── Inject into same-origin iframes ──
	function injectIntoFrames() {
		const frames = document.querySelectorAll("iframe");
		for (const frame of frames) {
			try {
				const fdoc = frame.contentDocument;
				if (!fdoc || fdoc.__vimKeyHandlerInjected) continue;
				fdoc.__vimKeyHandlerInjected = true;
				injectStyles(fdoc);
				// Forward key events from iframe to top window's handler
				fdoc.defaultView.addEventListener("keydown", function(evt) {
					handleKeydown(evt);
				}, true);
				// Also report focus from iframes
				fdoc.addEventListener("focusin", function(e) {
					const t = e.target;
					if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) {
						console.log("__VIM_INPUT_FOCUS__");
					}
				}, true);
				fdoc.addEventListener("focusout", function() {
					console.log("__VIM_INPUT_BLUR__");
				}, true);
			} catch(e) { /* cross-origin, skip */ }
		}
	}

	// Run once now, then watch for new iframes
	injectIntoFrames();
	const mo = new MutationObserver(function() { injectIntoFrames(); });
	mo.observe(document.body || document.documentElement, { childList: true, subtree: true });

	// Also retry periodically for lazy-loaded iframes (e.g. Lark)
	let retries = 0;
	const retryInterval = setInterval(function() {
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
		// Inject hint styles
		this._styleEl = document.createElement("style");
		this._styleEl.textContent = HINT_STYLES;
		document.head.appendChild(this._styleEl);

		// Reading mode keybindings
		this.registerDomEvent(document, "keydown", this._onKeydown);

		// Webview injection
		this._setupWebviewObserver();

		// Auto-focus webview when switching to a tab that contains one
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (!leaf) return;
				// Small delay to let the DOM settle after tab switch
				setTimeout(() => {
					const wv = leaf.view.containerEl.querySelector("webview");
					if (wv) {
						try { wv.focus(); } catch (e) { /* ignore */ }
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
		// Inject into any existing webviews
		document.querySelectorAll("webview").forEach(wv => this._attachWebview(wv));

		// Watch for new webviews
		this._observer = new MutationObserver(mutations => {
			for (const m of mutations) {
				for (const node of m.addedNodes) {
					if (node.nodeName === "WEBVIEW") {
						this._attachWebview(node);
					}
					// Also check children (webview might be nested)
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
			try { webview.executeJavaScript(script); } catch (e) { /* ignore */ }
		};

		const injectAndFocus = () => {
			inject();
			try { webview.focus(); } catch (e) { /* ignore */ }
		};

		// Inject when ready and on each navigation
		webview.addEventListener("dom-ready", injectAndFocus);
		webview.addEventListener("did-navigate", inject);
		webview.addEventListener("did-navigate-in-page", inject);

		// Handle find-in-page requests from injected script
		webview.addEventListener("console-message", (e) => {
			if (e.message === "__VIM_FIND_IN_PAGE__") {
				this._openWebviewSearch(webview);
			}
		});

		// If already loaded, inject now
		if (webview.getURL && webview.getURL()) {
			inject();
		}

		// ── Host-level key handler via before-input-event ──
		// This fires BEFORE page JS in ALL frames (including cross-origin iframes).
		// Solves Lark docs and other complex SPAs.
		this._setupHostKeyHandler(webview);
	}

	_setupHostKeyHandler(webview) {
		let gPending = false;
		let gTimer = null;
		let hintsActive = false;
		let inputFocused = false;

		// Track input focus state from injected script
		webview.addEventListener("console-message", (e) => {
			if (e.message === "__VIM_INPUT_FOCUS__") inputFocused = true;
			if (e.message === "__VIM_INPUT_BLUR__") inputFocused = false;
		});

		const execJS = (expr) => {
			try { webview.executeJavaScript(expr); } catch (e) {}
		};

		// Resend a native keyboard event to the webview.
		// Native keyboard events (Down/Up/PageDown/PageUp/Home/End) trigger
		// browser-level scrolling that works even in cross-origin iframes
		// (e.g. Lark docs), unlike JS scrollBy or mouseWheel sendInputEvent.
		const resendKey = (keyCode, modifiers) => {
			try {
				const ev = { type: "keyDown", keyCode: keyCode };
				if (modifiers) ev.modifiers = modifiers;
				webview.sendInputEvent(ev);
				webview.sendInputEvent(Object.assign({}, ev, { type: "keyUp" }));
			} catch (e) {
				// sendInputEvent not available — fall back to JS scrolling
				// (only works for non-iframe pages)
				const jsMap = {
					"Down": "window.scrollBy({top:60})",
					"Up": "window.scrollBy({top:-60})",
					"Pagedown": "window.scrollBy({top:window.innerHeight*0.5,behavior:'smooth'})",
					"Pageup": "window.scrollBy({top:-window.innerHeight*0.5,behavior:'smooth'})",
					"Home": "window.scrollTo({top:0,behavior:'smooth'})",
					"End": "window.scrollTo({top:document.scrollingElement.scrollHeight,behavior:'smooth'})"
				};
				if (jsMap[keyCode]) execJS(jsMap[keyCode]);
			}
		};

		const handleBeforeInput = (event) => {
			// Electron's <webview> spreads input properties directly onto the DOM Event
			// via Object.assign(event, input). event.type stays "before-input-event"
			// (readonly), so we must NOT check for "keyDown".
			const key = event.key;
			if (!key) return;

			const ctrl = !!(event.control);
			const shift = !!(event.shift);
			const alt = !!(event.alt);
			const meta = !!(event.meta);

			// If link hints are active, route keys to injected script and block page
			if (hintsActive) {
				if (key === "Escape") {
					execJS("if(window.__vimDeactivateHints) window.__vimDeactivateHints()");
					hintsActive = false;
				} else if (key === "Backspace") {
					execJS("if(window.__vimHandleHintKey) window.__vimHandleHintKey('Backspace')");
				} else if (key.length === 1) {
					execJS(
						"if(window.__vimHandleHintKey&&window.__vimHandleHintKey('" +
						key.replace(/'/g, "\\'") + "')) {}" +
						"; void(0)"
					);
					webview.executeJavaScript("!!window.__vimHintsActive")
						.then(v => { hintsActive = v; }).catch(() => {});
				}
				event.preventDefault();
				return;
			}

			// Skip single-letter keys if user is in a text input
			if (inputFocused && !ctrl && !meta) return;

			// Ctrl combos (Ctrl+d/f → PageDown, Ctrl+u/b → PageUp)
			if (ctrl && !shift && !alt && !meta) {
				if (key === "d" || key === "f") {
					event.preventDefault();
					resendKey("Pagedown");
					return;
				}
				if (key === "u" || key === "b") {
					event.preventDefault();
					resendKey("Pageup");
					return;
				}
				if (key === "o") {
					try { webview.goBack(); } catch (e) {
						execJS("history.back()");
					}
					event.preventDefault(); return;
				}
				if (key === "i") {
					try { webview.goForward(); } catch (e) {
						execJS("history.forward()");
					}
					event.preventDefault(); return;
				}
			}

			if (ctrl || alt || meta) return;

			// Shift combos (H/L/G)
			if (shift) {
				if (key === "H") {
					this._switchTab(-1);
					event.preventDefault(); return;
				}
				if (key === "L") {
					this._switchTab(1);
					event.preventDefault(); return;
				}
				if (key === "F" || key === "S") {
					execJS("if(window.__vimActivateHints) window.__vimActivateHints(true)");
					webview.executeJavaScript("!!window.__vimHintsActive")
						.then(v => { hintsActive = v; }).catch(() => {});
					event.preventDefault(); return;
				}
				if (key === "G") {
					event.preventDefault();
					resendKey("End", ["control"]);
					return;
				}
				return;
			}

			// Plain keys — resend native scroll keys so browser handles
			// scrolling at the native level (works in cross-origin iframes)
			switch (key) {
				case "j":
					event.preventDefault();
					resendKey("Down");
					break;
				case "k":
					event.preventDefault();
					resendKey("Up");
					break;
				case "/":
					this._openWebviewSearch(webview);
					event.preventDefault(); break;
				case "f":
				case "s":
					execJS("if(window.__vimActivateHints) window.__vimActivateHints()");
					webview.executeJavaScript("!!window.__vimHintsActive")
						.then(v => { hintsActive = v; }).catch(() => {});
					event.preventDefault(); break;
				case "g":
					if (gPending) {
						clearTimeout(gTimer); gPending = false;
						event.preventDefault();
						resendKey("Home", ["control"]);
					} else {
						gPending = true;
						gTimer = setTimeout(() => { gPending = false; }, 500);
					}
					break;
				default:
					if (gPending) { clearTimeout(gTimer); gPending = false; }
					break;
			}
		};

		// Primary: Electron webview DOM before-input-event
		webview.addEventListener("before-input-event", handleBeforeInput);

		// Fallback: try to get webContents for native Electron before-input-event
		// (more reliable, works even if DOM event doesn't propagate)
		const tryWebContents = () => {
			try {
				let wc = null;
				if (typeof webview.getWebContents === "function") {
					wc = webview.getWebContents();
				}
				if (!wc) {
					try {
						const remote = require("@electron/remote") || require("electron").remote;
						if (remote && typeof webview.getWebContentsId === "function") {
							wc = remote.webContents.fromId(webview.getWebContentsId());
						}
					} catch (e) {}
				}
				if (wc) {
					wc.on("before-input-event", (electronEvent, input) => {
						if (input.type !== "keyDown") return;
						const fakeEvent = {
							key: input.key,
							control: input.control,
							shift: input.shift,
							alt: input.alt,
							meta: input.meta,
							defaultPrevented: false,
							preventDefault() {
								this.defaultPrevented = true;
								electronEvent.preventDefault();
							}
						};
						handleBeforeInput.call(this, fakeEvent);
					});
				}
			} catch (e) { /* electron APIs not available */ }
		};

		// Try immediately and also after dom-ready
		tryWebContents();
		webview.addEventListener("dom-ready", () => tryWebContents(), { once: true });
	}

	_openWebviewSearch(webview) {
		// Trigger Obsidian's built-in search for the active view,
		// or fall back to webview.findInPage with a prompt
		try {
			this.app.commands.executeCommandById("editor:open-search");
		} catch (e) {
			// Fallback: minimal prompt-based search
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
			// Source/editing mode — don't interfere
			return null;
		}

		// Other view types (PDF viewer, image viewer, etc.)
		const leaf = this.app.workspace.activeLeaf;
		if (!leaf || !leaf.view) return null;

		// Webview tabs are handled by _setupHostKeyHandler
		if (leaf.view.containerEl.querySelector("webview")) return null;

		const content = leaf.view.containerEl.querySelector(".view-content");
		return content || null;
	}

	_isInputFocused(evt) {
		const t = evt.target;
		return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
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

		// Ctrl combos
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

		// Shift keys
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

		// Plain keys
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
