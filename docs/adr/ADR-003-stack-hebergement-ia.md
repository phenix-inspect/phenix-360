# ADR-003 — Stack technique, hébergement UE / RGPD, et IA

- **Statut :** BROUILLON — grands principes validés (PWA, PostgreSQL, IA
  derrière une passerelle, orientation souveraineté). Fournisseurs et
  infrastructure **non figés** : à confirmer **après** conception de la boucle
  héros et du premier écran (principe : l'implémentation se décide une fois
  l'expérience connue). Repasse en « Accepté » à ce moment-là.
- **Date :** 2026-06-27
- **Auteurs :** Fondateur + CTO PHÉNIX 360
- **Dépend de :** ADR-001 (journal d'événements), ADR-002 (modèle d'événement)

---

## 1. Contexte & contraintes

Contraintes héritées du cahier des charges et des ADR précédents :
- **Mobile-first**, qualité d'UX premium (Notion / Linear / Stripe).
- **RGPD non négociable** ; marché français ; la **souveraineté des données**
  (IA comprise) est un argument **commercial**, pas seulement légal.
- **Faibles coûts d'exploitation**, maintenabilité, évolutivité.
- **IA native** (assistant comme point d'entrée).
- **Petite équipe** : on minimise l'ops. Le plus simple d'abord.

Distinction structurante retenue pour toute la suite :
**résidence** (où sont stockés les octets) ≠ **souveraineté** (quel droit peut
contraindre l'accès). Une « région UE » d'un fournisseur américain assure la
résidence, pas la souveraineté (CLOUD Act).

## 2. Client — PWA, mobile-first

**Décision :** une **PWA** (Progressive Web App), pas d'applications natives en
V1.
- Un seul code, déploiement instantané, aucune friction d'App Store, coût de
  distribution quasi nul, itération rapide.
- La caméra, l'enregistrement audio (dictée) et les notifications push sont
  couverts par les API web modernes.

**Caveat assumé :** la **capture hors-ligne** sur chantier à connectivité
faible demande un effort spécifique (service worker + file d'attente locale).
On le traite comme un sujet à surveiller, pas comme un bloqueur V1.

**Reporté :** applications natives — uniquement plus tard, si une exigence
terrain (offline lourd, intégration matérielle) le justifie. Pas avant.

## 3. Données & backend — Postgres + Row-Level Security

**Décision :** le journal d'événements vit dans **PostgreSQL**, et la
**visibilité (`client` / `interne`) + les rôles sont appliqués par
Row-Level Security (RLS)** au niveau de la base, pas dans le code applicatif.

Pourquoi c'est le bon choix, pas une mode :
- Postgres = la « base relationnelle classique avec une table journal » décidée
  en ADR-001. Cohérence totale.
- La RLS fait respecter le champ `visibilité` de l'ADR-002 **à la source**.
  Un client ne peut pas voir un événement `interne`, même en cas de bug
  applicatif. Sécurité et maintenabilité : la règle est écrite une fois, au bon
  endroit.
- **Storage** objet pour les fichiers (`photo`, `document`), **Realtime** pour
  la mise à jour live du fil.

**Brique technique :** la stack **Supabase open-source** (Postgres + Auth +
Storage + Realtime + RLS) fournit tout cela avec une excellente expérience
développeur. Elle est open-source, donc **non verrouillante** : on peut la faire
tourner sur une infra managée OU auto-hébergée, sans réécrire le code client.

## 4. Hébergement & souveraineté — LE point à arbitrer

Le choix n'est pas technique mais stratégique : à quel point la souveraineté
est-elle un argument dès la V1 ?

**Option A — Souveraineté dès le départ (recommandée).**
Déployer la stack Supabase open-source sur une infra **incorporée UE**
(Scaleway, France, ou Hetzner, Allemagne). Argument *« vos données restent en
UE, hors de portée du CLOUD Act »* vrai dès le premier client. Coût
d'exploitation faible (≈ 30–100 €/mois). Contrepartie : un peu plus de mise en
place initiale.

**Option B — Vélocité d'abord, sortie documentée.**
Démarrer sur **Supabase managé en région UE** : DX maximale, zéro ops, livraison
plus rapide. Mais c'est de la **résidence** UE sous **juridiction US** (parent
américain, AWS). Comme la techno est open-source, la migration vers l'Option A
est mécaniquement propre. Risque : devoir re-plateformer le jour où un client
sérieux exige la souveraineté — coût qui croît avec le volume de données.

**Recommandation CTO :** **Option A.** Le cahier des charges rend le RGPD non
négociable et fait de la souveraineté un argument de vente sur le marché
français du bâtiment. Construire la démo sur une base US-juridictionnelle puis
re-plateformer plus tard est le genre de dette qu'on évite quand l'alternative
coûte surtout un peu d'ops au départ. **À valider par le fondateur.**

## 5. IA — Mistral par défaut, derrière une passerelle interne

**Décision :**
- **Fournisseur par défaut : Mistral.** Français, **juridiction UE** (pas
  seulement résidence), RGPD par défaut, open-weight (auto-hébergeable si besoin),
  prix agressifs. Deux briques tombent pile sur notre produit : **Voxtral**
  (transcription de la dictée terrain) et **Mistral OCR** (lecture des documents).
- **Anti-lock-in obligatoire :** l'IA étant *native* au produit, on ne l'appelle
  jamais en direct. On la place derrière une **passerelle IA interne** (notre
  propre interface). On peut alors changer ou mélanger de fournisseur sans
  toucher au produit.
- **Le plus simple d'abord :** l'assistant répond par **récupération
  structurée** dans le journal (les événements sont déjà typés et datés) +
  synthèse par le modèle. **Pas de base vectorielle en V1.** On n'ajoutera des
  vecteurs que si la recherche libre sur un long historique l'exige.

Rappel ADR-001 : l'IA **propose**, l'humain **valide**. La passerelle
n'outrepasse jamais cette règle.

## 6. Coût d'exploitation estimé (V1, ordre de grandeur)
- Infra (Option A, Supabase open-source sur Scaleway/Hetzner) : ≈ 30–100 €/mois.
- IA (Mistral, modèles Small pour l'essentiel) : quelques €/mois à l'échelle MVP.
- **Total V1 réaliste : bien en dessous de 150 €/mois.** Conforme à l'exigence
  de faibles coûts d'exploitation.

## 7. Conformité — EU AI Act
Les sanctions de l'EU AI Act s'appliquent à partir du **2 août 2026**. Notre
posture (IA qui propose / humain qui valide, transparence sur l'usage de l'IA,
fournisseur sous juridiction UE) nous place du bon côté. À formaliser dans un
ADR conformité dédié quand on approchera de la mise en marché.

## 8. Décisions reportées
- Choix précis du framework front PWA (à trancher au moment du 1er écran).
- Provider d'infra exact si Option A (Scaleway vs Hetzner) — détail
  d'implémentation, pas de principe.
- ADR conformité (RGPD + AI Act) dédié avant mise en marché.
- Stratégie de notifications push (web push / e-mail de secours).
