# ADR-006 — Datastore décennal : Supabase (PostgreSQL managé), confirmé

- **Statut :** Accepté — référence (architecture officielle du datastore)
- **Date :** 2026-07-20
- **Auteurs :** CTO PHÉNIX 360
- **Dépend de / amende :** ADR-004 §2.3 (Supabase), ADR-003 (hébergement UE/RGPD),
  ADR-001/002 (journal d'événements + RLS)
- **Portée :** Fige, pour un horizon de **10 ans**, la brique de persistance de
  PHÉNIX 360. Réexamen adversarial de six options avant l'engagement définitif.

---

## 0. Contexte

Avant de créer le projet Supabase de production, le fondateur demande un arbitrage
de CTO « qui engage l'entreprise pour dix ans », comparant **Supabase, Firebase,
Convex, Appwrite, PocketBase, et PostgreSQL + backend maison**, à l'aune du produit
réel (chantiers, photos, PDF, clients, artisans, notifications) et des critères de
long terme (montée en charge, coût, souveraineté, verrou fournisseur, exploitation,
évolution).

Ce n'est pas une confirmation de complaisance d'ADR-004 : chaque option a été prise
au sérieux et l'option retenue doit **survivre au rejet motivé de toutes les autres**.

## 1. Le critère qui tranche

Sur dix ans, deux facteurs dominent tous les autres pour PHÉNIX 360 :

1. **Souveraineté + absence de verrou** — données de chantiers de clients français,
   RGPD, principe directeur ADR-004 §5 (« migrable vers un hébergement souverain
   sans refonte »). La donnée doit rester **portable** et **hébergeable en UE**.
2. **Adéquation au modèle** — le produit EST relationnel et event-sourcé : un
   journal d'événements, des rôles (compagnon / équipe / artisan / client), une
   visibilité appliquée à la source par **RLS** (miroir de `isVisibleToClient()`).

La question décisive devient donc : **quelle option repose sur du PostgreSQL
standard, portable et hébergeable en UE, sans réécrire le modèle ni la sécurité ?**

## 2. Comparaison (note CTO, 10 ans, produit réel)

| Critère | **Supabase** | Firebase | Convex | Appwrite | PocketBase | PG + maison |
|---|---|---|---|---|---|---|
| Modèle relationnel (chantiers/rôles) | ★★★★★ Postgres | ★☆ NoSQL | ★★☆ propriétaire | ★★★ | ★★★ SQLite | ★★★★★ |
| RLS / sécurité à la source | ★★★★★ natif | ★★ règles propr. | ★★ | ★★★ modèle propr. | ★★ | ★★★★★ (à écrire) |
| Photos / PDF (object storage) | ★★★★★ S3-compat | ★★★★ | ★★★ | ★★★★ | ★★★ | ★★★ (à intégrer) |
| Temps réel (fil, notifications) | ★★★★☆ | ★★★★★ | ★★★★★ | ★★★★ | ★★★ | ★★ (à bâtir) |
| Montée en charge | ★★★★☆ | ★★★★★ | ★★★★ | ★★★ | ★★ SQLite | ★★★★★ |
| Coût prévisible | ★★★★☆ | ★★☆ (par lecture) | ★★★ | ★★★★ | ★★★★★ | ★★☆ (ingénierie) |
| **Souveraineté (UE / self-host)** | ★★★★☆ | ★☆ US/CLOUD Act | ★☆ US | ★★★★ | ★★★★ | ★★★★★ |
| **Verrou fournisseur** | ★★★★☆ faible | ★☆ sévère | ★☆ sévère | ★★★ | ★★★★ | ★★★★★ nul |
| Exploitation (ops) | ★★★★★ managé | ★★★★★ | ★★★★★ | ★★★ auto-géré | ★★★★★ | ★☆ tout à tenir |
| Pérennité / évolution | ★★★★☆ | ★★★★ | ★★ (jeune) | ★★★ | ★★ (mono-mainteneur) | ★★★★★ |

## 3. Pourquoi chaque alternative est rejetée

- **Firebase — rejeté.** Firestore est **NoSQL propriétaire** : ni relationnel, ni
  RLS, langage de règles Google-spécifique. Il faudrait **réécrire le modèle de
  données et la sécurité** (le contraire d'ADR-001/002). Hébergement Google
  (US, CLOUD Act) : souveraineté faible. Tarification à la lecture : coûts
  imprévisibles à l'échelle. **Verrou maximal, souveraineté hostile.**

- **Convex — rejeté.** Excellent DX temps réel, mais **plateforme propriétaire**
  (base + fonctions serveur au modèle Convex), self-host balbutiant, hébergement
  US, **jeune entreprise** (risque de pérennité sur 10 ans). Engager toute la
  société sur un socle fermé, non souverain et non éprouvé dans la durée est un
  pari inacceptable pour un datastore décennal. **Verrou + risque fournisseur.**

- **Appwrite — rejeté.** Vrai candidat open-source auto-hébergeable (bon point
  souveraineté), mais sa base n'est pas du **PostgreSQL + RLS** natif : on jette
  le schéma SQL et les policies **déjà écrits et testés en CI**, pour adopter son
  modèle de permissions propre. Écosystème plus petit que Postgres. **Mismatch
  architectural : on détruit un acquit pour un moins-disant relationnel.**

- **PocketBase — rejeté.** Binaire Go + **SQLite** : merveilleux pour un solo/petit
  outil, plafond réel pour un SaaS multi-tenant avec écritures concurrentes, photos
  et croissance (mono-écrivain, HA/réplication faibles). Projet à **mainteneur
  quasi unique** (bus factor). **Plafond de charge + pérennité.**

- **PostgreSQL + backend maison — rejeté (en pratique), retenu (en principe).**
  C'est l'option « zéro verrou, souveraineté maximale » — et c'est précisément
  celle vers laquelle Supabase nous laisse revenir. Mais **bâtir et maintenir
  pendant 10 ans** l'auth, le stockage, le temps réel, le pooling, l'outillage de
  migration et surtout la **sécurité** (rouler sa propre auth = là où les jeunes
  boîtes se font percer), pour une petite équipe, **affame le produit**. Sur-
  ingénierie aujourd'hui, dette d'exploitation demain.

## 4. Décision

**PHÉNIX 360 adopte PostgreSQL comme actif de données durable, exploité via
Supabase (managé, région UE).** Confirmé pour dix ans.

Le raisonnement qui rend ce choix défendable une décennie :

> **Supabase n'est pas un BaaS fermé : c'est du PostgreSQL managé, batteries
> incluses, dont les batteries (auth GoTrue, storage S3-compatible, Realtime, RLS)
> sont open-source.** On obtient ~80 % de la souveraineté du « PG + maison » pour
> ~20 % de sa charge d'exploitation — et c'est la **seule** option qui épouse
> l'architecture déjà écrite (schéma SQL, RLS miroir de `isVisibleToClient()`,
> bucket `attachments/{project_id}/…` S3-compatible, passerelle IA).

**L'actif, c'est Postgres. Supabase est un choix d'hébergement, pas un choix
d'architecture.** Si Supabase (l'entreprise) devait un jour nous décevoir, on
`pg_dump` et on rejoue le **même SQL + les mêmes RLS** sur RDS, Scaleway, un
Supabase auto-hébergé ou un Postgres nu — l'application ne change quasiment pas,
grâce au port `Backend` / adaptateur (`SupabaseBackend`) déjà en place (M1).

Je **ne change pas d'avis** vis-à-vis d'ADR-004 §2.3 ; je le **confirme** après
réexamen adversarial, en explicitant les garde-fous anti-verrou ci-dessous.

## 5. Garde-fous anti-verrou (rendre la sortie possible, pas théorique)

1. **La donnée reste du PostgreSQL pur** : schéma en migrations SQL versionnées,
   aucune extension propriétaire dans le chemin critique. Sauvegardes = `pg_dump`
   + PITR (cf. docs/PRODUCTION.md).
2. **Le port `Backend` isole l'app** : un seul fichier (`SupabaseBackend`) connaît
   Supabase. Changer d'hébergeur = un adaptateur, pas une refonte.
3. **Storage adressé S3-compatible** (`{project_id}/…`) : réutilisable sur MinIO /
   Scaleway sans changer les clés d'objets.
4. **Auth via JWT standard** : identités et rôles portés par `project_member` (SQL),
   pas par un modèle propriétaire ; migration d'auth possible.
5. **Realtime isolé** derrière l'abstraction de réactivité existante
   (`useSyncExternalStore`) : remplaçable (BroadcastChannel, WebSocket, autre)
   sans toucher l'UI.

## 6. Risques assumés

- Auth / Storage / Realtime sont « saveur Supabase » : une sortie demande de les
  re-câbler (la **donnée**, elle, part intacte). Mitigation : §5.
- L'auto-hébergement de Supabase est plus lourd que le managé : on reste **managé
  tant qu'on est petit** ; la portabilité est une **assurance**, pas une pratique
  quotidienne.
- Dépendance à la santé de l'entreprise Supabase : mitigée par l'open-source et
  par le fait que l'actif (Postgres) survit à l'outil.

## 7. Conséquences

- La migration SaaS (docs/MIGRATION.md, M1→M8) se poursuit sur Supabase.
- Toute brique propriétaire ajoutée doit passer le test : « puis-je la remplacer
  sans réécrire le produit ? » Sinon, elle est isolée derrière un port.
- Cette décision est **l'architecture officielle du datastore** ; toute remise en
  cause future se fait par un nouvel ADR qui amende celui-ci.
