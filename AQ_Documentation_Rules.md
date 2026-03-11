# AQ – Dokumentációs szabálykészlet

## 0. Alapaxioma
**Egy állításnak pontosan egy helye lehet.**  
Ha nem tudod, hova tartozik, az az állítás még nincs tisztázva.

---

## 1. Canonical Manifest – *mi kötelező érvényű*
Ide csak az kerülhet, ami:
- időtlen (évek múlva is igaz),
- protokoll-szintű,
- vitában hivatkozási alap.

**Tilos:**
- „most”, „később”, „dev”, „prod” jellegű állítások,
- implementációs részletek (loader, iframe, UX),
- policy, timeout, cache, lifecycle.

Ha változik:
- új verzió, nem átírás.

---

## 2. Concepts – *hogyan kell gondolkodni róla*
Ide az kerül, ami:
- segít megérteni a Manifest mögötti logikát,
- nagyobb technikai rálátást ad,
- **nem dönt**, csak értelmez.

**Megengedett:**
- absztrakciók,
- mentális modellek,
- következmények („ebből az következik…”).

**Tilos:**
- konkrét API-k,
- kötelező folyamatleírás,
- „így kell csinálni” típusú állítások.

---

## 3. Implementation Guide – *mi van megcsinálva*
Ide az kerül, ami:
- ténylegesen létezik a kódban,
- visszakereshető a referencia implementációban,
- ma kipróbálható.

**Megengedett:**
- pontos DEV / PROD különbségek,
- konkrét policy-k,
- edge case-ek.

**Tilos:**
- jövőbeli tervek,
- spekuláció,
- „később így lesz”.

Ha kikerül a kódból:
- kikerül innen is.

---

## 4. Plan – *ami még nincs kész*
Ide kerül minden, ami:
- irány, de nem döntés,
- döntés, de nincs implementálva,
- nyitott kérdés.

**Megengedett:**
- alternatívák,
- pro / kontra érvek,
- feltételes jövőképek.

**Tilos:**
- kész tényként leírni bármit,
- meglévő rendszerként hivatkozni rá.

---

## 5. Mozgási szabály
Az információ **mindig lefelé mozog**:

Plan → Implementation Guide → Manifest  
       ↑  
      Concepts (oldalról értelmez)

---

## 6. Duplikáció tilalma
Ugyanaz az állítás:
- nem szerepelhet két dokumentumban,
- még más megfogalmazásban sem.

Ha igen:
- az egyik helyen rossz.

---

## 7. Kötelező bevezető minden dokumentumhoz
Minden doksi elején szerepeljen:
- dokumentum státusza (normatív / nem normatív),
- célközönség,
- mire **nem** szolgál.

---

## 8. Gyors döntési teszt
Egy mondatra kérdezd meg:
- számonkérhető? → Manifest
- magyaráz? → Concepts
- ma lefut? → Guide
- majd egyszer? → Plan

Ha egyik sem:
- törlendő.
