(() => {
	"use strict";
	const SELF_SCRIPT = document.currentScript;
	if (top !== self) throw new Error("[AQ] embedded not allowed");
	const conf = window.aqProtocolPageConf;
	if (!conf || typeof conf !== "object") throw new Error("[AQ] missing aqProtocolPageConf");
	const hostOrigin = location.origin;
	if (!hostOrigin || hostOrigin === "null") throw new Error("[AQ] invalid host origin: " + hostOrigin);
	const hn = (location.hostname || "").toLowerCase();
	const devMode = (hn === "localhost" || hn === "127.0.0.1" || hn === "::1");
	if (!devMode && conf.aqPageLoader) throw "[AQ] aqPageLoader not allowed outside devMode"
	const refRaw = String(conf.aqPageLoader ?? "");
	const ref = refRaw.trim();
	if (!ref) throw new Error("[AQ] missing aqPageLoader");
	if (ref !== refRaw) throw new Error("[AQ] aqPageLoader must be trimmed");
	if (/[\r\n\t]/.test(ref)) throw new Error("[AQ] invalid aqPageLoader");
	const isPath = ref.startsWith("/");
	if (!devMode && isPath) throw new Error("[AQ] local path loader not allowed here: " + ref);
	const CID_RE = /^[0-9a-f]{64,128}$/i;

	const RPC_URLS = ["https://rpc.gnosischain.com","https://gnosis-rpc.publicnode.com","https://rpc.gnosis.gateway.fm"];
	const DAO_CONTRACT = "0x64521be8D93483f5A41c40c21176137aEd65296D";
	const SEL_getSwarmHash = "0xcc2fb628";

	const rpcCall = async (url, method, params) => {
		const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
		if (!r.ok) throw new Error("[AQ] rpc http " + r.status);
		const j = await r.json();
		if (j.error) throw new Error("[AQ] rpc error");
		return j.result;
	};

	const encodeUint256 = (n) => {
		const bn = BigInt(String(n));
		return bn.toString(16).padStart(64, "0");
	};

	const resolveDaoCid = async (tokenId) => {
		const data = SEL_getSwarmHash + encodeUint256(tokenId);
		let lastErr;
		for (const url of RPC_URLS) {
			try {
				const r = await rpcCall(url, "eth_call", [{ to: DAO_CONTRACT, data }, "latest"]);
				if (!/^0x[0-9a-fA-F]{64}$/.test(r)) throw new Error("[AQ] invalid bytes32"); 
				return r.slice(2).toLowerCase();
			} catch (e) { lastErr = e; }
		}
		throw lastErr || new Error("[AQ] dao resolve failed");
	};

	let url;
	let fetchOpts;

	if (isPath) { url = ref; fetchOpts = { cache: "no-store" };
	} else {
		if (/[\/\s?#]/.test(ref)) throw new Error("[AQ] invalid CID ref: " + ref);
		if (!CID_RE.test(ref)) throw new Error("[AQ] invalid CID (hex 64..128): " + ref);
		const baseRaw0 = String(conf.cidBase ?? "");
		const baseRaw = baseRaw0.trim();
		if (!baseRaw) throw new Error("[AQ] missing cidBase");
		if (baseRaw !== baseRaw0) throw new Error("[AQ] cidBase must be trimmed");
		if (/[\r\n\t]/.test(baseRaw)) throw new Error("[AQ] invalid cidBase");
		let baseUrl;
		try { baseUrl = new URL(baseRaw); }
		catch { throw new Error("[AQ] invalid cidBase URL: " + baseRaw); }
		if (!devMode && baseUrl.protocol !== "https:") throw new Error("[AQ] cidBase must be https in non-dev");
		const sep = baseRaw.endsWith("/") ? "" : "/";
		url = baseRaw + sep + ref.toLowerCase();
		fetchOpts = { cache: "force-cache" };
	}

	const removeSelfScript = () => { try { SELF_SCRIPT?.remove(); } catch {} };
	const removeConfScriptById = () => { try { document.getElementById("AQ_CONF")?.remove(); } catch {} };

	(async () => {
		const daoRefRaw = String(conf.aqDaoConfig ?? "").trim();
		if (/^\d+$/.test(daoRefRaw)) { const cid = await resolveDaoCid(daoRefRaw); conf.aqDaoConfig = cid; }
		const r = await fetch(url, fetchOpts);
		if (!r.ok) throw new Error("[AQ] fetch failed " + r.status + " " + url);
		const ab = await r.arrayBuffer();
		const head = new TextDecoder("utf-8", { fatal: false }).decode(ab.slice(0, 384));
		if (/<\s*(!doctype|html|head|body)\b/i.test(head)) throw new Error("[AQ] loader bytes look like HTML, abort");
		const blobUrl = URL.createObjectURL(new Blob([ab], { type: "text/javascript" }));
		const s = document.createElement("script");
		s.src = blobUrl;
		s.async = false;
		s.onload = () => { try { URL.revokeObjectURL(blobUrl); } catch {} };
		s.onerror = () => { try { URL.revokeObjectURL(blobUrl); } catch {} throw new Error("[AQ] loader exec failed: " + url); };
		try { Object.freeze(conf); } catch {}
		removeConfScriptById();
		removeSelfScript();
		(document.head || document.documentElement).appendChild(s);
	})().catch((e) => {
		console.error(e);
		throw e;
	});
})();