# AQ Protocol – Canonical Manifest

## Dokumentum státusza
Ez a dokumentum **normatív**.  
A benne rögzített állítások az AQ protokoll **kanonikus alapelvei**.
Ha egy elem nincs itt definiálva, az **nem része a protokollnak**.

Ez a dokumentum:
- nem implementáció,
- nem roadmap,
- nem policy leírás.

---

## Cél

Az AQ Protocol egy **nyílt, decentralizált digitális közmű** jellegű protokoll, amely közösségek számára biztosít hosszú távon stabil, auditálható és semleges **digitális állapotkezelést**.

Az AQ:
- nem alkalmazás,
- nem platform,
- nem tartalom,
hanem ezek **alapinfrastruktúrája**.

---

## Digitális közmű jelleg

Az AQ protokoll digitális közműként viselkedik:
- közösségi használatra szolgál,
- működése semleges és protokoll-alapú,
- állapotai visszamenőleg auditálhatók,
- kiesése vagy manipulációja közösségi kárt okoz.

A közmű jelleg **kizárólag a protokollra** vonatkozik, nem az arra épülő alkalmazásokra vagy tartalmakra.

---

## Alapelvek

### Közösség mint alapegység
A protokoll legkisebb egysége a **közösség**.
Egy egyéni felhasználó önálló, egyszemélyes közösségnek tekintendő.
A közösségnél kisebb protokollszintű egység nem létezik.

---

### Immutable by default
Egy publikált állapot **nem módosítható**.
Új állapot kizárólag új publikált állapotként jöhet létre.

---

### Verzió = publikus hash
Az AQ protokoll nem alkalmaz hagyományos verziószámozást.
Egy állapot akkor tekinthető verziónak, ha:
- publikált,
- tartalom-hash alapján egyértelműen címezhető.

---

### URL ≠ identitás
Az URL kizárólag elérési mechanizmus.
Az identitást **a tartalom-hash** határozza meg.

A protokoll futtatásához szükséges a **hash → tartalom (byte)** feloldás, amelynek módja implementációfüggő.

---

### Offline-first, local-first
Az állapotok és struktúrák lokálisan épülnek fel.
A publikálás külön, tudatos művelet.

---

## Canonical állapot

A rendszer egy adott pillanatban értelmezhető teljes állapotát egy **Root Object** reprezentálja.

A Root Object:
- tartalom-hash alapján egyértelműen azonosítható,
- explicit módon meghatározza az aktuális **root set-et**,
- opcionálisan hivatkozhat egy korábbi publikált állapotra.

---

## Root set

A root set határozza meg:
- mely állapotok,
- mely tartalmak,
- mely funkcionalitások
tekinthetők az adott pillanatban létezőnek.

Ami nincs a root set-ben:
- az protokoll-szinten nem létezik.

---

## Állapotváltás és publikáció

Egy publikált állapot megváltoztathatatlan.
Új állapot kizárólag új Root Object létrehozásával jöhet létre, amely opcionálisan hivatkozhat korábbi publikált állapotokra.

A konfiguráció **a gyökér**: minden élő tartalom és funkcionalitás csak ezen keresztül érhető el.

---

## Referencia implementációk

A referencia implementációk a jelen Manifestben rögzített elvek értelmezésére szolgálnak.

- Nem normatívak.
- Kommentjeik nem képezik a protokoll részét.
- Nem módosítják a Manifest jelentését.

---

## Normativitási záradék

Ha egy működési szabály, policy vagy mechanizmus kanonikus érvényűvé válik, annak **ebben a dokumentumban** kell megjelennie.
