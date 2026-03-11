(() => {
	if (top !== self) throw new Error("[AQ] embedded not allowed");

	const aqProtocolDbName = "aqProtocol";
	const aqStorageStoreName = "aqStorage";
	const aqStorageAllowedChars = " _-.,:;@#()[]'\"+=!?";

	let aqDaoNamespace = "";
	let aqIdbPromise = null;

	function aqIdbOpen() {
		if (aqIdbPromise) return aqIdbPromise;
		aqIdbPromise = new Promise((resolve, reject) => {
			const req = indexedDB.open(aqProtocolDbName, 1);
			req.onupgradeneeded = () => {
				const db = req.result;
				if (!db.objectStoreNames.contains(aqStorageStoreName)) db.createObjectStore(aqStorageStoreName, { keyPath: "k" });
			};
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error || new Error("[AQ] idb open failed"));
		});
		return aqIdbPromise;
	}

	function aqIdbReq(req) {
		return new Promise((resolve, reject) => {
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error || new Error("[AQ] idb request failed"));
		});
	}

	function aqIdbCommit(tx) {
		return new Promise((resolve, reject) => {
			tx.oncomplete = resolve;
			tx.onerror = () => reject(tx.error || new Error("[AQ] idb tx failed"));
			tx.onabort = () => reject(tx.error || new Error("[AQ] idb tx aborted"));
		});
	}

	function aqStorageNormalizeName(raw) {
		let name = String(raw ?? "").trim();
		while (name.startsWith("/")) name = name.slice(1);
		name = name.replace(/\/{2,}/g, "/");
		while (name.endsWith("/") && name.length > 0) name = name.slice(0, -1);
		if (!name) return "";
		return name.normalize("NFC");
	}

	function aqStorageValidateNewName(name) {
		if (!name) throw new Error("[AQ] storage: invalid name");
		const lastSlash = name.lastIndexOf("/");
		const leaf = lastSlash >= 0 ? name.slice(lastSlash + 1) : name;
		const leafStart = name.length - leaf.length;
		let leafHasAlnum = false;
		for (let i = 0; i < name.length; i++) {
			const ch = name[i];
			if (ch === "/") continue;
			if (/[\p{L}\p{N}]/u.test(ch)) { if (i >= leafStart) leafHasAlnum = true; continue; }
			if (aqStorageAllowedChars.includes(ch)) continue; throw new Error("[AQ] storage: invalid character");
		}
		if (!leafHasAlnum) throw new Error("[AQ] storage: leaf must contain letter or number");
		return true;
	}

	function aqStorageParent(name) { const i = name.lastIndexOf("/"); return i >= 0 ? name.slice(0, i) : ""; }

	function aqStorageKey(name) { return aqDaoNamespace + "\n" + name; }

	async function aqStorageGetExact(st, name) { return await aqIdbReq(st.get(aqStorageKey(name))); }

	function aqRecText(rec) { return rec ? String(rec.v ?? "") : ""; }

	function aqRecMeta(rec) { return rec ? String(rec.m ?? "") : ""; }

	async function aqStorageExists(st, name) {
		const rec = await aqIdbReq(st.get(aqStorageKey(name)));
		return !!rec;
	}

	async function aqStorageAssertImmediateParentExists(st, name) {
		const parent = aqStorageParent(name);
		if (!parent) return;
		if (!(await aqStorageExists(st, parent))) throw new Error("[AQ] storage: missing parent prefix");
	}

	async function aqStoragePut(rawName, patch) {
		const name = aqStorageNormalizeName(rawName);
		if (!patch || typeof patch !== "object") throw new Error("[AQ] storage: invalid put payload");
		const hasText = Object.prototype.hasOwnProperty.call(patch, "text");
		const hasMeta = Object.prototype.hasOwnProperty.call(patch, "meta");
		if (!hasText && !hasMeta) throw new Error("[AQ] storage: invalid put payload");
		if (name === "" && hasText) throw new Error("[AQ] storage: root text not writable");
		if (name !== "") aqStorageValidateNewName(name);
		const db = await aqIdbOpen();
		const tx = db.transaction(aqStorageStoreName, "readwrite");
		const st = tx.objectStore(aqStorageStoreName);
		if (name !== "") await aqStorageAssertImmediateParentExists(st, name);
		const prev = await aqStorageGetExact(st, name);
		const nextV = hasText ? String(patch.text ?? "") : aqRecText(prev);
		const nextM = hasMeta ? String(patch.meta ?? "") : aqRecMeta(prev);
		await aqIdbReq(st.put({ k: aqStorageKey(name), v: nextV, m: nextM }));
		await aqIdbCommit(tx);
		return true;
	}

	async function aqStorageGet(rawName) {
		const name = aqStorageNormalizeName(rawName);
		const db = await aqIdbOpen();
		const tx = db.transaction(aqStorageStoreName, "readonly");
		const st = tx.objectStore(aqStorageStoreName);
		const rec = await aqStorageGetExact(st, name);
		if (name === "") return { text: "", meta: aqRecMeta(rec) };
		if (!rec) return null;
		return { text: aqRecText(rec), meta: aqRecMeta(rec) };
	}

	async function aqStorageDelete(rawName) {
		const name = aqStorageNormalizeName(rawName);
		const db = await aqIdbOpen();
		const tx = db.transaction(aqStorageStoreName, "readwrite");
		const st = tx.objectStore(aqStorageStoreName);
		let deleted = 0;
		let range;
		if (name === "") {
			const nsPrefix = aqDaoNamespace + "\n";
			range = IDBKeyRange.bound(nsPrefix, nsPrefix + "\uffff");
		} else {
			const exactK = aqStorageKey(name);
			const exact = await aqIdbReq(st.get(exactK));
			if (exact) { await aqIdbReq(st.delete(exactK)); deleted++; }
			const subPrefix = aqStorageKey(name + "/");
			range = IDBKeyRange.bound(subPrefix, subPrefix + "\uffff");
		}
		await new Promise((resolve, reject) => {
			const cur = st.openCursor(range);
			cur.onerror = () => reject(cur.error);
			cur.onsuccess = async () => {
				const c = cur.result;
				if (!c) return resolve();
				await aqIdbReq(st.delete(c.primaryKey));
				deleted++;
				c.continue();
			};
		});
		await aqIdbCommit(tx);
		return { deleted };
	}

	async function aqStorageList(rawPrefix, options) {
		const prefix = aqStorageNormalizeName(rawPrefix);
		const wantMeta = !options || options.meta !== false;
		const wantText = !!(options && options.text === true);
		const db = await aqIdbOpen();
		const tx = db.transaction(aqStorageStoreName, "readonly");
		const st = tx.objectStore(aqStorageStoreName);
		const nsPrefix = aqDaoNamespace + "\n";
		const items = new Set();
		if (!prefix) {
			const range = IDBKeyRange.bound(nsPrefix, nsPrefix + "\uffff");
			const rootText = wantText ? "" : undefined;
			await new Promise((resolve, reject) => {
				const cur = st.openCursor(range);
				cur.onerror = () => reject(cur.error);
				cur.onsuccess = () => {
					const c = cur.result;
					if (!c) return resolve();
					const namePart = String(c.key).slice(nsPrefix.length);
					const seg = namePart.split("/")[0];
					if (seg) items.add(seg);
					c.continue();
				};
			});
			const names = [...items].sort();
			if (!wantMeta) { const out = { items: names }; if (wantText) out.text = rootText; return out; }
			const out = [];
			for (const name of names) {
				const rec = await aqIdbReq(st.get(aqStorageKey(name)));
				out.push({ name, meta: rec ? String(rec.m ?? "") : "" });
			}
			const result = { items: out };
			if (wantText) result.text = rootText;
			return result;
		}
		let text;
		if (wantText) { const rec = await aqIdbReq(st.get(aqStorageKey(prefix))); text = rec ? String(rec.v ?? "") : ""; }
		const subPrefix = aqStorageKey(prefix + "/");
		const range = IDBKeyRange.bound(subPrefix, subPrefix + "\uffff");
		await new Promise((resolve, reject) => {
			const cur = st.openCursor(range);
			cur.onerror = () => reject(cur.error);
			cur.onsuccess = () => {
				const c = cur.result;
				if (!c) return resolve();
				const namePart = String(c.key).slice(nsPrefix.length);
				const rest = namePart.slice((prefix + "/").length);
				const seg = rest.split("/")[0];
				if (seg) items.add(seg);
				c.continue();
			};
		});
		const names = [...items].sort();
		if (!wantMeta) { const out = { items: names }; if (wantText) out.text = text; return out; }
		const out = [];
		for (const name of names) {
			const child = prefix + "/" + name;
			const rec = await aqIdbReq(st.get(aqStorageKey(child)));
			out.push({ name, meta: rec ? String(rec.m ?? "") : "" });
		}
		const result = { items: out };
		if (wantText) result.text = text;
		return result;
	}

	async function aqStorageRename(rawFrom, rawTo) {
		const from = aqStorageNormalizeName(rawFrom);
		const to = aqStorageNormalizeName(rawTo);
		if (!from || !to) throw new Error("[AQ] storage: invalid rename");
		aqStorageValidateNewName(to);
		if (to === from || to.startsWith(from + "/")) throw new Error("[AQ] storage: invalid rename target");
		const db = await aqIdbOpen();
		const tx = db.transaction(aqStorageStoreName, "readwrite");
		const st = tx.objectStore(aqStorageStoreName);
		if (!(await aqStorageExists(st, from))) throw new Error("[AQ] storage: source not found");
		await aqStorageAssertImmediateParentExists(st, to);
		if (await aqStorageExists(st, to)) throw new Error("[AQ] storage: target exists");
		const toWrite = [];
		const toDelete = [];
		const exactK = aqStorageKey(from);
		const exact = await aqIdbReq(st.get(exactK));
		if (exact) { toWrite.push({ name: to, v: String(exact.v ?? ""), m: String(exact.m ?? "") }); toDelete.push(exactK); }
		const subPrefix = aqStorageKey(from + "/");
		const range = IDBKeyRange.bound(subPrefix, subPrefix + "\uffff");
		await new Promise((resolve, reject) => {
			const cur = st.openCursor(range);
			cur.onerror = () => reject(cur.error);
			cur.onsuccess = () => {
				const c = cur.result;
				if (!c) return resolve();
				const fullKey = String(c.key);
				const namePart = fullKey.slice((aqDaoNamespace + "\n").length);
				const suffix = namePart.slice((from + "/").length);
				toWrite.push({ name: to + "/" + suffix, v: String((c.value && c.value.v) ?? ""), m: String((c.value && c.value.m) ?? "") });
				toDelete.push(c.primaryKey);
				c.continue();
			};
		});
		if (toWrite.length === 0) throw new Error("[AQ] storage: source not found");
		for (const it of toWrite) { await aqIdbReq(st.put({ k: aqStorageKey(it.name), v: it.v, m: it.m })); }
		for (const k of toDelete) { await aqIdbReq(st.delete(k)); }
		await aqIdbCommit(tx);
		return { moved: toWrite.length };
	}
	
	function randomHex(nBytes) {
		const a = new Uint8Array(nBytes);
		crypto.getRandomValues(a);
		return [...a].map(b => b.toString(16).padStart(2, "0")).join("");
	}
	
	let aqSessionToken;
	
	if (!window.aqProtocolPageConf) throw new Error("[AQ] missing aqProtocolPageConf");
	const conf = window.aqProtocolPageConf;
	try { delete window.aqProtocolPageConf; } catch { try { window.aqProtocolPageConf = undefined; } catch {} }
	
	const hostOrigin = location.origin;
	if (!hostOrigin || hostOrigin === "null") throw new Error("[AQ] invalid host origin: " + hostOrigin);
	
	const hn = (location.hostname || "").toLowerCase();
	const devMode = (hn === "localhost" || hn === "127.0.0.1" || hn === "::1");

	let aqCidBase = "";
	let cfg = null;
	let currentKey = null;
	let currentBlobUrl = null;
	let pendingInitKey = null;
	let _locked = false;
	const ALLOW_WHILE_LOCKED = new Set(); // cancel, status, ping
	let _readyResolve = null;

	const iframe = document.createElement("iframe");
	iframe.src = "about:blank";
	const sandboxFlags = "allow-scripts allow-downloads";
	iframe.setAttribute("sandbox", sandboxFlags);
	iframe.style.width = "100%";
	iframe.style.height = "100%";
	iframe.style.border = "0";

	document.documentElement.style.height = "100%";
	document.body.style.height = "100%";
	document.body.style.margin = "0";
	document.body.appendChild(iframe);

	const overlayEl = document.createElement("div");
	overlayEl.style.cssText = "position:fixed;inset:0;display:none;background:rgba(0,0,0,0);z-index:999999;pointer-events:auto";
	document.body.appendChild(overlayEl);

	let _overlayTimer = null;
	function overlayShowLocked() {
		overlayEl.style.display = "block";
		overlayEl.style.background = "rgba(0,0,0,0)";
		if (_overlayTimer) { clearTimeout(_overlayTimer); _overlayTimer = null; }
		_overlayTimer = setTimeout(() => { _overlayTimer = null; if (!_locked) return; overlayEl.style.background = "rgba(0,0,0,.35)"; }, 150);
	}
	
	function overlayHide() {
		if (_overlayTimer) { clearTimeout(_overlayTimer); _overlayTimer = null; }
		overlayEl.style.display = "none";
	}

	async function fetchAssetBytes(assetRef) {
		const ref = String(assetRef ?? "").trim();
		if (!ref) throw new Error("[AQ] asset ref must be a non-empty string");
		let url;
		let fetchOpts;
		if (ref.startsWith("/")) {
			if (!devMode) throw new Error("[AQ] local path not allowed: " + ref);
			url = ref;
			fetchOpts = { cache: "no-store" };
		} else {
			const base = String(aqCidBase ?? "").trim();
			if (!base) throw new Error("[AQ] missing cidBase");
			const sep = base.endsWith("/") ? "" : "/";
			url = base + sep + ref;
			fetchOpts = { cache: "force-cache" };
		}
		const r = await fetch(url, fetchOpts);
		if (!r.ok) throw new Error(`[AQ] fetch failed ${r.status} ${url}`);
		return await r.arrayBuffer();
	}

	async function fetchAssetText(asset) {
		if (!asset) return "";
		const bytes = await fetchAssetBytes(asset);
		return new TextDecoder("utf-8").decode(bytes);
	}

	async function fetchAssetJSON(asset) {
		const text = await fetchAssetText(asset);
		try { return JSON.parse(text); }
		catch (e) { throw new Error("[AQ] invalid JSON: " + (e?.message || e)); }
	}

	function buildIframeDoc({ html, css, js, token, hostOrigin }) {
		return `<!doctype html>
<html>
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width,initial-scale=1" />
	<style>${css || ""}</style>
</head>
<body>
${html || ""}
<script type="text/plain" id="AQ_PAGE_JS">${(js || "").replace(/<\/script/gi, "<\\/script")}</script>
<script>
"use strict";
const AQ_TOKEN = ${JSON.stringify(token)};
const AQ_HOST_ORIGIN = ${JSON.stringify(hostOrigin)};

let _seq = 0;
const pending = new Map();

function send(type, payload) {
	parent.postMessage({aq: 1, token: AQ_TOKEN, type, payload}, AQ_HOST_ORIGIN);
}

let _aqInited = false;
let _aqPageStarted = false;

function call(method, params) {
	if (!_aqInited) return Promise.reject(new Error("[AQ] not inited"));
	const id = ++_seq;
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject, method, params, startedAt: Date.now(), warnTimer: null, warnMs: null });		
		send("AQ_CALL", { id, method, params });
	});
}

function startPageJsOnce() {
	if (_aqPageStarted) return;
	_aqPageStarted = true;
	const el = document.getElementById("AQ_PAGE_JS");
	const code = el ? (el.textContent || "") : "";
	if (!code) return;
	(new Function(code))();
}

window.addEventListener("message", (ev) => {
	if (ev.source !== parent) return;
	const msg = ev.data;
	if (!msg || msg.aq !== 1) return;
	if (msg.token !== AQ_TOKEN) return;

	if (msg.type === "AQ_RESULT") {
		const p = pending.get(msg.payload.id);
		if (!p) return;
		if (p.warnTimer) clearTimeout(p.warnTimer);
		pending.delete(msg.payload.id);
		p.resolve(msg.payload.result);
		return;
	}

	if (msg.type === "AQ_ERROR") {
		const p = pending.get(msg.payload.id);
		if (!p) return;
		if (p.warnTimer) clearTimeout(p.warnTimer);
		pending.delete(msg.payload.id);
		p.reject(new Error(msg.payload.error));
		return;
	}

	if (msg.type === "AQ_ACK") {
		const p = pending.get(msg.payload.id);
		if (!p) return;
		const warnMs = Number(msg.payload.warnMs);
		if (!Number.isFinite(warnMs) || warnMs <= 0) return;
		p.warnMs = warnMs;
		if (p.warnTimer) clearTimeout(p.warnTimer);
		p.warnTimer = setTimeout(() => {
			if (!pending.has(msg.payload.id)) return;
			const elapsedMs = Date.now() - p.startedAt;
			send("AQ_STUCK", { id: msg.payload.id, method: p.method, elapsedMs });
		}, warnMs);
 		return;
 	}
	
	if (msg.type === "AQ_INIT") {
		window.aqPageKey = msg.payload?.pageKey;
		_aqInited = true;
		setTimeout(startPageJsOnce, 0);
		return;
	}
});

window.aq = {
	call,
	protocolInfo: () => call("protocolInfo"),
	navigate: (pageKey) => call("navigate", { pageKey }),
	switchDao: (daoConfig) => call("switchDao", { daoConfig }),
	storagePut: (name, patch) => call("storagePut", { name, patch }),
	storageGet: (name) => call("storageGet", { name }),
	storageDelete: (name) => call("storageDelete", { name }),
	storageList: (prefix, options) => call("storageList", { prefix, options }),
	storageRename: (from, to) => call("storageRename", { from, to })
};

send("AQ_PAGE_READY", { });
</script>
</body>
</html>`;
	}

	async function loadPage(pageKey) {
		const key = pageKey;
		if (key === currentKey) return true;
		const page = cfg.pages[key];
		if (!page) throw new Error("[AQ] Unknown page: " + key);
		if (!page.html && !page.css && !page.js) throw new Error("[AQ] page has no assets: " + pageKey);
		const html = await fetchAssetText(page.html || null);
		const css  = await fetchAssetText(page.css  || null);
		const js   = await fetchAssetText(page.js   || null);
		aqSessionToken = randomHex(16);
		const doc = buildIframeDoc({ html, css, js, token: aqSessionToken, hostOrigin });
		if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
		currentBlobUrl = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
		try {
			const w = iframe.contentWindow;
			if (w && w.location) w.location.replace(currentBlobUrl);
			else iframe.src = currentBlobUrl;
		} catch { iframe.src = currentBlobUrl; }
		currentKey = key;
		pendingInitKey = key;
		return new Promise((resolve) => { _readyResolve = resolve; });
	}

	let _bootHashConsumed = false;
	async function loadDaoConfig(asset) {
		const daoRef = String(asset ?? "").trim();
		if (!daoRef) throw new Error("[AQ] missing daoConfig");
		const hostCidBase = String(conf?.cidBase ?? "").trim();
		aqCidBase = hostCidBase || "";
		if (!aqCidBase && !daoRef.startsWith("/")) throw new Error("[AQ] missing cidBase");
		const nextCfg = await fetchAssetJSON(daoRef);
		if (!nextCfg?.pages || !nextCfg?.defaultPage) throw new Error("[AQ] Invalid DAO config (needs defaultPage + pages)");
		cfg = nextCfg;
		aqDaoNamespace = daoRef;
		const daoCidBase = String(cfg?.cidBase ?? "").trim();
		aqCidBase = daoCidBase || hostCidBase;
		if (!aqCidBase) throw new Error("[AQ] missing cidBase");
		currentKey = null;
		pendingInitKey = null;
		let startKey = cfg.defaultPage;
		if (!_bootHashConsumed) {
			_bootHashConsumed = true;
			const h = (location.hash || "").trim();
			if (h && h !== "#") { const key = h.startsWith("#") ? h.slice(1) : h; if (cfg.pages && cfg.pages[key]) startKey = key; }
		}
		await loadPage(startKey);
	}
	
	const postTo = (win, token, type, payload) => { try { win?.postMessage({ aq: 1, token, type, payload }, "*"); } catch {} };

	const handlers = {
		protocolInfo: () => ({ pageKey: currentKey }),
		navigate: (params) => {
			const next = params?.pageKey;
			if (typeof next !== "string" || !next) throw new Error("navigate: missing pageKey");
			if (next !== currentKey) return loadPage(next);
			return true;
		},
		switchDao: (params) => {
			const daoConfig = params?.daoConfig;
			if (!daoConfig) throw new Error("switchDao: missing daoConfig");
			return loadDaoConfig(daoConfig);
 		},
		storagePut: (p) => aqStoragePut(p?.name, p?.patch),
		storageGet: (p) => aqStorageGet(p?.name),
		storageDelete: (p) => aqStorageDelete(p?.name),
		storageList: (p) => aqStorageList(p?.prefix, p?.options),
		storageRename: (p) => aqStorageRename(p?.from, p?.to)
	};

	window.addEventListener("message", (ev) => {
		if (ev.source !== iframe.contentWindow) return;
		const msg = ev.data;
		if (!msg || msg.aq !== 1) return;
		if (msg.token !== aqSessionToken) return;
		const replyWin = ev.source;
		const replyToken = msg.token;
		const reply = (type, payload) => postTo(replyWin, replyToken, type, payload);
		if (msg.type === "AQ_PAGE_READY") {
			const initPayload = { pageKey: pendingInitKey ?? currentKey };
			setTimeout(() => { postTo(iframe.contentWindow, aqSessionToken, "AQ_INIT", initPayload); if (_readyResolve) { const r = _readyResolve; _readyResolve = null; r(true); } }, 0);
			return;			
		}
		if (msg.type === "AQ_STUCK") {
			const p = msg.payload || {};
			console.warn("[AQ] page reports stuck call:", p.method, "id=" + p.id, "elapsedMs=" + p.elapsedMs);
			return;
		}
		if (msg.type !== "AQ_CALL") return;
		const { id, method, params } = msg.payload || {};
		if (_locked && !ALLOW_WHILE_LOCKED.has(method)) {
			reply("AQ_ERROR", { id, error: "[AQ] locked" });
			return;
		}
		const warnMsByMethod = {
			protocolInfo: 2000,
			navigate: 10000,
			switchDao: 10000,
			storagePut: 5000,
			storageGet: 5000,
			storageDelete: 10000,
			storageList: 10000,
			storageRename: 15000,
			"default": 30000
		};
		const warnMs = warnMsByMethod[method] ?? warnMsByMethod["default"];
		reply("AQ_ACK", { id, warnMs });
		const replyOK = (result) => { reply("AQ_RESULT", { id, result }); };
		const replyERR = (error) => { reply("AQ_ERROR", { id, error: String(error) }); };
		(async () => {
			const isAllow = ALLOW_WHILE_LOCKED.has(method);
			if (!isAllow) { _locked = true; overlayShowLocked(); }
			try {
				const h = handlers[method];
				if (!h) throw new Error("Unknown method: " + method);
				const result = await h(params);
				replyOK(result);
			} catch (e) { replyERR(e?.message || e); 
			} finally { if (!isAllow) { _locked = false; overlayHide(); } }
		})();
	});
		
	window.addEventListener("pagehide", () => {
		try { iframe.src = "about:blank"; } catch {}
		try { _locked = false; overlayHide(); } catch {}
		try { if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; } } catch {}
		currentKey = null;
	});

	(async () => {
		const boot = () => {
			_locked = true;
			overlayShowLocked();			
			loadDaoConfig(conf.aqDaoConfig).then(() => { _locked = false; overlayHide(); }).catch((e) => { console.error(e); });
		};
		if (document.readyState !== "loading") boot();
		else document.addEventListener("DOMContentLoaded", boot, { once: true });
	})();
	
})();
