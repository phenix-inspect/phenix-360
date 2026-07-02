# PHÉNIX 360 — Journal des arbitrages produit

Le registre des décisions. **Append-only** : on ajoute, on ne réécrit pas. Chaque
entrée : la décision, le pourquoi, les alternatives rejetées, l'impact. Sert de
mémoire unique quand le produit grandira.

Format :

```
JJ/MM/AAAA
Décision : …
Pourquoi : …
Alternatives rejetées : …
Impact : …
```

---

## 02/07/2026 — Les missions sont conservées

**Décision :** on garde le choix d'une mission (un tap) comme entrée principale.
**Pourquoi :** elle donne un contexte fiable à PHÉNIX et évite une IA qui doit
tout deviner.
**Alternatives rejetées :** capture sans mission (l'IA infère le contexte).
**Impact :** une capture rapide reste disponible pour les imprévus (Art. 4).

## 02/07/2026 — L'application s'ouvre sur le conducteur et sur la journée

**Décision :** l'accueil est « Aujourd'hui » (tous chantiers) ; le conducteur est
l'utilisateur principal.
**Pourquoi :** un conducteur pilote une journée et plusieurs chantiers, pas un
projet unique ; il ne doit pas être invité dans sa propre appli.
**Alternatives rejetées :** ouverture sur l'espace client ; modèle mono-chantier.
**Impact :** nouvelle porte d'entrée transversale ; le chantier devient un
second niveau (Art. 2 & 3).

## 02/07/2026 — Le fait est la colonne vertébrale ; tout le reste est projection

**Décision :** le Journal de faits (append-only) est l'unique source de vérité ;
CR, PV, réserves, fil client, historique en sont des projections.
**Pourquoi :** un seul chemin d'écriture, aucune duplication, aucune refonte.
**Alternatives rejetées :** documents/réserves/modules comme objets autonomes.
**Impact :** on recadre l'existant au lieu de le refondre (Art. 8).

## 02/07/2026 — Capture zéro-tap reportée en V2

**Décision :** on n'essaie pas de deviner automatiquement chantier + mission +
document en V1.
**Pourquoi :** deviner sans erreur n'est pas fiable aujourd'hui ; un tap
d'intention est acceptable et rend PHÉNIX fiable.
**Alternatives rejetées :** entrée entièrement inférée par l'IA dès la V1.
**Impact :** le tap d'intention est conservé ; l'inférence viendra plus tard.

## 02/07/2026 — Gouvernance : toute PR cite les articles de VISION.md

**Décision :** aucune Pull Request n'est validée si elle ne cite explicitement le
ou les articles de `VISION.md` qu'elle respecte.
**Pourquoi :** empêcher la dérive produit à mesure que le code grandit ; garder
une référence unique pour toute décision.
**Alternatives rejetées :** discipline informelle laissée au jugement de chacun.
**Impact :** chaque PR devra référencer la constitution ; les écarts sont
refusés (Art. de gouvernance de `VISION.md`).
