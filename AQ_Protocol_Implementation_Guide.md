# AQ Protocol – Implementation Guide

## Dokumentum státusza
Ez a dokumentum **nem normatív**.  
Az AQ protokoll **aktuális referencia implementációját** írja le: azt, ami **jelenleg létezik és működik** a kódban.

Ez a dokumentum:
- nem roadmap,
- nem jövőbeli ígéret,
- nem fogalmi magyarázat.

Ha egy elem kikerül a kódból, **innen is kikerül**.

---

## 1. Dokumentum szerepe
A Guide kizárólag a „**hogyan működik most**” kérdésre válaszol:
- hogyan tölt a loader,
- milyen policy-k vannak érvényben,
- hogyan zajlik a host ↔ iframe kommunikáció.

Minden „később”, „irány”, „lehetőség” a **Plan** dokumentumba került.

---

## 1.1. Névkonvenció (referencia loader / JS)

A referencia loaderben a JavaScript az alábbi névkonvenciót követi:

- **Nyilvános AQ felület**: `aqXxxYyy` (camelCase, `aq` prefix), pl. `aqStorage`, `aqPageKey`.
- **Belső implementáció**: tetszőleges, de lehetőleg konzisztens (camelCase javasolt).
- A konvenció célja: a „protokoll-exponált” és a belső segédfüggvények gyors megkülönböztetése.

---

## 2. Asset betöltés (aktuális)

A referencia loader asset-hivatkozása **string**.

Szabály:
- ha `"/"`-el kezdődik: **lokális path** (csak DEV módban engedett)
- különben: **CID** (immutable), feloldás `cidBase` alapján

`cidBase` forrása: host (bootstrap és loader számára)
- host: `window.aqProtocolPageConf.cidBase` (alapértelmezett / ajánlott)
- DAO config: opcionálisan `cidBase` mezővel felülírhatja

Referencia (explicit) Swarm gateway alap:
- `https://api.gateway.ethswarm.org/bzz/`

Cache policy (referencia loader):
- lokális `"/..."` path: `fetch(..., { cache: "no-store" })` (DEV workflow, mindig friss)
- CID asset: `fetch(..., { cache: "force-cache" })` (immutable tartalom, maximalizált böngésző cache)

Megjegyzés: a CID tartalom integritását a CID + resolver/gateway réteg garantálja; a loader nem végez külön hash-ellenőrzést.

---

## 3. Asset betöltési policy (aktuális)

A loader jelenlegi referencia implementációja:

- lokális `"/..."` path **csak DEV módban** engedett,
- CID alapú assetek engedettek (`cidBase + cid`),
- `{path, hash}` asset objektum **nincs**,
- külön SHA-256 mező és ellenőrzés **nincs** (a CID feloldás integritása a resolver/gateway réteg felelőssége).

---

## 4. Loader bootstrap

### 4.1. Host konfiguráció

A host a `window.aqProtocolPageConf` objektumot biztosítja; ebből indul a betöltés.

Referencia bootstrap (host):
- `index.html`: csak a conf (`<script id="AQ_CONF">`) + a bootstrap betöltése (`<script id="AQ_BOOT" src=".../boot.js">`).
- `boot.js`: a `conf.aqPageLoader` alapján betölti a loadert `fetch → blob → <script>` injektálással.
- bootstrap gate: nem-localhost origin esetén path-alapú loader ref (`"/..."`) **tiltott** (defense-in-depth).
- cache policy (loader fetch):
  - path: `fetch(..., { cache: "no-store" })`
  - CID:  `fetch(..., { cache: "force-cache" })`
- DOM hygiene: a `boot.js` eltávolítja az `AQ_CONF` script taget és a saját script tagjét (SELF_SCRIPT).

Config consumption (loader):
- a loader induláskor kiolvassa a `window.aqProtocolPageConf`-ot, majd törli a globálból (nem marad élő konfiguráció a window-n).

A host felelőssége:
- a DAO config átadása,
- a `cidBase` megadása (ha a DAO config vagy bármely asset CID),
- a futási környezet biztosítása (legalább HTTP(S) origin; `origin !== "null"`).

Dev mód (referencia loader):
- **nem konfigurálható**, nem flag.
- kizárólag a loader origin alapján dől el: `localhost | 127.0.0.1 | ::1`.
- a page nem kap devMode jelzést (nem policy-holder).

### 4.2. DOM-ready invariant
A loader **nem tölt DAO-t vagy page-et** a DOM elkészülte előtt.

Ez garantálja a determinisztikus indulást.

---

## 5. Root Object és DAO config (aktuális forma)

A loader mindig egy DAO configot tölt be, amely:
- `pages` map-et tartalmaz,
- `defaultPage` kulcsot definiál.

A séma **implementációfüggő** és csak a referencia loaderre érvényes.

---

## 6. Page betöltés és váltás

- Egy aktív iframe létezik
- Page váltáskor teljes dokumentumcsere történik
- A blob URL azonnal revoke-ra kerül

Ez a megoldás:
- egyszerű,
- determinisztikus,
- izoláció-barát.

- page JS start (referencia loader): `AQ_INIT` után a page kód indítása 1 task tickkel késleltetett (pl. `setTimeout(startPageJsOnce, 0)`), hogy a host-oldali init/lock ablak ne ütközzön az első `storageGet` jellegű hívásokkal.

Boot override:

- Boot során a loader ellenőrzi a `location.hash` értékét.
- Ha a hash egy létező `pageKey`, akkor azt tölti be a `defaultPage` helyett.
- Ez az override kizárólag az első DAO betöltéskor érvényes.
- `switchDao` esetén mindig a `defaultPage` töltődik be.

### Page assetek (referencia loader)
A referencia loaderben a page definíció `html` / `css` / `js` asseteket adhat meg.
Ezek opcionálisak, de **legalább egynek** szerepelnie kell, különben a page invalid.

---

## 7. Hard block és overlay

### 7.1. Hard block
Kritikus átmenetek során (page / DAO váltás):
- minden protokoll-hívás tiltott,
- kivétel: explicit allowlistelt metódusok.

A tiltott hívások AQ_ERROR "[AQ] locked" választ kapnak.

Megjegyzés: a jelenlegi referencia implementációban **nincs allowlist kivétel** (default deny minden metódusra block alatt).

### 7.2. Overlay
Az overlay kizárólag UX elem.
Nem protokoll-jelzés, nem státuszcsatorna.
Az overlay host-oldali, minimál, és **nem DAO-konfigurálható**.

---

## 8. Üzenetkezelés (postMessage)

Megjegyzés: a boot / block / READY / INIT sorrend kizárólag a referencia loader implementációs viselkedésének leírása.
Nem jelent implicit protokoll-elvárást.

### 8.1. Session modell
- véletlen session token induláskor,
- token minden üzenetben kötelező,
- source ellenőrzés enforced.
- handshake: `AQ_PAGE_READY` → `AQ_INIT` (host átadja: `pageKey`).
- reply-binding: a host a válaszokat mindig **annak az iframe window-nak** küldi vissza, amelyik a hívást küldte (`ev.source`), és **azzal a tokennel**, amit a kérésben kapott (`msg.token`).
- A host nem használhatja a „jelenlegi” globális session tokent reply-hoz (különben navigate közben token-szivárgás és call-id ütközés történhet).
 
### 8.2. Origin kezelés
- Az origin **nem trust anchor** (web3 gateway esetén nem stabil).
- A referencia loader **hard fail**-t ad, ha a host `location.origin === "null"` (opaque origin), mert a page → host üzenetek targetOrigin-jét csak így lehet a host originre szűkíteni.
- A host → page válaszok targetOrigin-je **`"*"`** (vállalt), mert a sandboxolt iframe originje tipikusan opaque (`allow-scripts` mellett, `allow-same-origin` nélkül).
- Következmény: host → page irányban nincs targetOrigin-szűkítés; a védelem `ev.source` + token + reply-binding alapú.

### 8.3. Trust modell: origin helyett tartalom
- A loader **nem tekinti** a futtató domain/origint trust anchornek (web3 gateway esetén ez nem stabil).
- Trust anchor: **token + source + reply-binding** (postMessage csatorna).

Kötelező védelmek (domainfüggetlen):
- anti-embedding guard: `top !== self` → hard fail.
- `ev.source === iframe.contentWindow` (csak a saját iframe beszélhet).
- `msg.token === aqSessionToken` (session token hard gate).
- reply-binding: a host a válaszokat **a kérő window + kért token** alapján küldi vissza (`ev.source` + `msg.token`).
- page → host `postMessage` target origin: **`hostOrigin`** (ne `"*"`). Opaque host origin (`"null"`) esetén hard fail.

Plusz rétegek, ha a loader **web2 domainről** fut és van header kontroll:
- CSP `frame-ancestors 'none'` (vagy szűk allowlist) + (legacy) `X-Frame-Options: DENY`.
- CSP `script-src` / `connect-src` szűkítés (csak szükséges origin/gateway).
- `Referrer-Policy: no-referrer` (vagy strict).
- `Permissions-Policy` (tiltsd, ami nem kell).
- `Strict-Transport-Security` (HSTS), ha HTTPS.

---

## 9. Watchdog jelzés: `AQ_STUCK`

A loader **nem timeoutol** hívásokat.

Egyes metódusokhoz idő-küszöb tartozik.
Ennek átlépésekor:
- egyszeri `AQ_STUCK` jelzés keletkezik.

Ez:
- nem hiba,
- nem progress,
- nem szakítja meg a hívást.

---

## 10. Capability dispatch (aktuális)

- handler map alapú dispatch
- default deny elv
- ismeretlen metódus → hiba

Ez a modell a referencia implementáció része.

Nincs dev-only capability.
Nincs host write endpoint.

---

## 11. DAO-scoped text storage

A protokoll DAO-scope-olt text storage capability-t biztosít IndexedDB alapon.

### Scope

- Storage namespace = `daoConfig` asset ref string (path vagy CID)
- DAO váltás más namespace-re vált.
- Azonos namespace-re visszatérés az adatokat változatlanul elérhetővé teszi.

Kulcs formátum (host oldalon):

daoRef + "\n" + storageName

### Adatmodell (node séma)

- Rekord: `{ k, v, m }`
  - `k`: namespace + "\n" + name
  - `v`: node text (string)
  - `m`: node meta (string)
- A storage text-only: **mind a text, mind a meta string**.

### Root node (name = "")

- Root `text` **mindig** `""` (nem írható).
- Root `meta` írható/olvasható.
- `storageDelete("")` a teljes DAO namespace-t törli (wipe).

---

### Támogatott metódusok

storagePut(name, { text?, meta? }) → true  
storageGet(name) → { text: string, meta: string } | null  
storageDelete(name) → { deleted: number }  
storageList(prefix, options?) → { items: ... , text?: string }
storageRename(from, to) → { moved: number }

#### storagePut

- `storagePut` részleges update:
  - amit nem adsz meg (`text` vagy `meta`), az megmarad a meglévő node-ból
  - ha egyik sincs megadva → hiba
- Root text tiltás:
  - `storagePut("", { text: ... })` → hiba
  - `storagePut("", { meta: ... })` → OK

#### storageGet

- Nem-root: ha nincs node → `null`
- Root: mindig létező logikai node-ként kezeljük → `{ text:"", meta:"..." }`

#### storageList

Alapértelmezések:
- `options.meta` default: `true`
- `options.text` default: `false`

Visszatérés:
- `items`:
  - ha `meta:true` (default): `[{ name, meta }]`
  - ha `meta:false`: `string[]` (csak a child nevek)
- `text` mező csak akkor szerepel, ha `options.text:true`.

példák:

storageList("a") →
  { items: [ { name:"b", meta:"..." }, ... ] }

storageList("a", { meta:false }) →
  { items: ["b", ...] }

storageList("a", { text:true }) →
  { text:"(a text)", items: [ { name:"b", meta:"..." }, ... ] }

---

### Hierarchia modell (B-modell)

- Kulcsok "/" szeparátorral hierarchikusak.
- Prefix csak akkor létezhet, ha parent prefix is létezik.
- "Directory" létrehozás = üres string put.

példa:

+storagePut("a",   { text:"" })
+storagePut("a/b", { text:"" })
+storagePut("a/b/c", { text:"text" })

---

### Rename invariáns

- atomic subtree move
- target nem létezhet
- target nem lehet source subtree-ja
- rename a subtree összes node-ján megőrzi mind a `text`-et, mind a `meta`-t

Megjegyzés:

A storage prefix-zárt invariánsa miatt elegendő a target prefix létezésének ellenőrzése.
Ha b/c létezik, akkor b is létezik, ezért külön subtree vizsgálat nem szükséges.

---

### Normalizáció

- trim
- multiple "/" → single "/"
- leading "/" eltávolítva
- trailing "/" eltávolítva
- Unicode NFC normalizáció

---

### Karakterek

Engedett:

- Unicode Letter, Number
- space _ - . , : ; @ # ( ) [ ] ' " + = ! ?
- "/" separator

Leaf tartalmazzon legalább egy Letter vagy Number karaktert.
