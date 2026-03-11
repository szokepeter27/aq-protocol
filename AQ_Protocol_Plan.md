# AQ Protocol – Plan

## Dokumentum státusza
Ez a dokumentum **nem normatív**.  
Az AQ protokoll minden olyan elemét tartalmazza, amely **még nem implementált**, vagy **nem végleges döntés**.

---

## 1. Resolver és terjesztési réteg
- IPFS / Swarm integráció
- több resolver párhuzamos használata
- offline preload modell

---

## 2. Cache stratégia
- hash-alapú immutable cache
- DEV és PROD alatti viselkedés
- cache policy egységessége
- (opció) részleges újratöltés / shared asset reuse (pl. CSS/JS megtartása page váltáskor)

---

## 3. Produkciós biztonsági modell
- trustedOrigins kanonikus forrásból
- aláírt host konfiguráció
- revocation és rotáció

---

## 4. Sandbox és capability evolúció
- finomabb jogkör-modellek
- worker-alapú futtatás
- capability API stabilizálása

---

## 5. Lifecycle és státusz
- explicit státuszcsatorna lehetősége
- progress / cancel modell
- DAO-váltás lifecycle

---

## 6. DAO és cross-DAO működés
- DAO-identitás hosszú távon
- discovery és ajánlási mechanizmusok

---

## 7. Perzisztencia és workflow
- storage capability
- lokális workflow mentés
- hash-alapú checkpoint / export

---

## 8. Publikáció és hitelesítés
- on-chain anchor
- időbélyegzés
- audit lánc

---

## 9. Kód- és architektúra-evolúció
- loader modularizálása
- protocol bus elkülönítése
- capability modulok szétválasztása

---

## Completed

- DAO-scoped storage capability
- IndexedDB backend
- rename / delete / list / namespace isolation
- async handler modell
- blocked → AQ_ERROR policy

## Pending

- single-flight user action policy (block lifecycle kiterjesztése)
- status / cancel capability
