# AQ Protocol – Concepts

## Dokumentum státusza
Ez a dokumentum **nem normatív**.  
Célja az AQ protokoll **értelmezése és mentális modelljeinek** bemutatása azok számára, akik a Canonical Manifestnél mélyebb rálátást szeretnének, de nem implementációs szinten gondolkodnak.

Ez a dokumentum:
- nem specifikáció,
- nem implementáció,
- nem roadmap.

---

## 1. A protokoll mint állapottér
Az AQ nem folyamatokat, hanem **értelmezhető állapotokat** ír le.
A protokoll szintjén nincs „felhasználói művelet” vagy „üzleti logika”, csak állapotok és azok közti relációk.

Következmény:
- nincs implicit flow,
- nincs kötelező lifecycle,
- az értelmezés mindig a futtató környezet feladata.

---

## 2. Hash mint elsődleges valóság
A tartalom-hash nem azonosító egy rendszerben, hanem **maga az állítás**: „ez a konkrét tartalom”.

Ebből következik:
- verzió = hash,
- módosítás = új hash,
- publikáció = állítás rögzítése.

Minden más (URL, path, origin) másodlagos.

---

## 3. Root Object mint nézőpont
A Root Object nem konfigurációs fájl a hagyományos értelemben, hanem egy **kitüntetett nézőpont** az állapottérre.

A root set:
- explicit allowlist,
- szemantikai határ,
- az „ami létezik most” definíciója.

Ami nincs benne:
- az protokoll-szinten nem értelmezhető.

---

## 4. Közösség mint absztrakció
A közösség nem szociológiai fogalom, hanem **állapot-tulajdonlási és döntési egység**.

Egy egyén:
- minimális közösség,
- teljes értékű protokoll-szereplő.

Ezért nincs a közösségnél kisebb protokollszintű egység.

---

## 5. Futás és protokoll szétválasztása
A protokoll nem garantál:
- UX-et,
- elérhetőséget,
- biztonsági policy-t.

A futtatás:
- mindig implementációfüggő,
- mindig környezethez kötött.

Ezért többféle futtatási modell legitim lehet ugyanarra a protokoll-állapotra.

---

## 6. Biztonság mint környezeti réteg
Az AQ protokoll csak az **integritást** definiálja:
- mit jelent egy állapot,
- mi számít változtatásnak.

Minden más:
- sandbox,
- origin,
- policy,
- capability modell
→ környezeti döntés, nem protokoll-elv.

Gyakorlati következmény (referencia loader szemlélet):
- az origin nem trust anchor (gateway/origin instabil lehet),
- a bizalom **csatorna- és tartalomkötésből** épül: `source + token + reply-binding + integritás(hash/CID)`,
- minimális, domainfüggetlen guardok: anti-embedding (`top !== self` → hard fail), valamint a page → host `postMessage` cél-originnel (`hostOrigin`, nem `"*"`).

---

## 7. Miért létezik ez a dokumentum
A Concepts célja:
- a Manifest tisztán tartása,
- az Implementation Guide tehermentesítése,
- a Plan elkülönítése a magyarázattól.

Ez a dokumentum **átjáró**: segít megérteni, de nem dönt helyetted.

---

## Storage capability

A storage capability egy DAO-scope-olt, text-only, hierarchikus kulcstér.

Tulajdonságok:

- capability, nem globális storage
- DAO namespace izoláció
- prefix-zárt invariáns
- atomic rename
- recursive delete
- nincs implicit directory objektum

A storage teljesen host-kontrollált, page közvetlenül nem fér hozzá IndexedDB-hez.