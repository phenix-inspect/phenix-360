# ADR-001 — Architecture « colonne vertébrale » et périmètre de la V1

- **Statut :** Accepté
- **Date :** 2026-06-27
- **Auteurs :** Fondateur + CTO PHÉNIX 360
- **Portée :** Fondation produit et technique. Cet ADR conditionne tous les suivants.

---

## 1. Contexte

L'état d'un chantier est aujourd'hui éparpillé entre SMS, photos WhatsApp,
e-mails et appels. Il n'existe aucune **source de vérité unique** partagée entre
le client, l'équipe Phénix et les sous-traitants.

PHÉNIX 360 vise à remplacer ces canaux par une plateforme unique, mobile-first,
avec une IA native. Le produit doit rester volontairement simple en V1 tout en
permettant d'absorber, sans refonte, des modules futurs (choix & validations de
matériaux, sous-traitants, dépôt de factures, SAV, carnet numérique du logement).

Principe fondateur retenu : **« Une seule saisie. Plusieurs bénéfices. »**

## 2. Décision d'architecture : le projet est un journal d'événements unique

Un **projet (chantier)** est modélisé comme un **journal chronologique
d'événements** = la colonne vertébrale technique et produit.

- Une action terrain = **un seul** événement écrit, à un seul endroit.
- Chaque « module » (photos, documents, SAV, factures, carnet, etc.) n'est
  **pas** un silo de données : c'est une **vue** (lecture filtrée) du journal.
- L'assistant IA **lit** ce journal ; il ne détient pas de données propres.

Conséquence : ajouter un module futur = ajouter une **vue** sur des données qui
existent déjà → **aucune refonte**. Le principe « une saisie, plusieurs
bénéfices » devient structurellement vrai, et non un effort permanent.

### Garde-fou explicite (anti-usine-à-gaz)
On retient le **modèle mental** d'un flux d'événements, mais **pas** son
folklore technique. **L'event-sourcing académique (CQRS, projections
reconstruites, event store dédié) est refusé en V1** : coût d'exploitation et de
maintenance trop élevés. Implémentation cible : **base de données relationnelle
classique**, une table « journal » au centre, des vues/lectures filtrées
au-dessus. Robuste, ennuyeux, bon marché.

## 3. Décision IA : « l'IA propose, l'humain valide »

La valeur du produit repose sur sa **fiabilité** en tant que source de vérité.
Une IA qui publierait une information fausse détruirait la confiance, donc le
produit.

Règle non négociable en V1 :
- l'IA **rédige** le compte-rendu à partir de la dictée, **classe** les photos,
  **suggère** un avancement ;
- l'équipe Phénix **valide** d'un geste **avant** toute publication.

On conserve le gain de temps, on supprime le risque sur la confiance.

## 4. Périmètre de la V1

La V1 se limite à **une seule boucle**, faite parfaitement.

### Côté Phénix — la boucle de capture terrain (écran héros)
Ouvrir un chantier → dicter un compte-rendu + prendre des photos →
l'IA rédige / classe / suggère un avancement → **validation humaine** →
le fil se met à jour → le client est notifié **automatiquement**.

### Côté client — l'expérience PHÉNIX 360 (lecture + IA)
- consultation du **fil**, des **photos**, des **documents** (lecture seule) ;
- **assistant IA** comme surface d'interaction principale (questions répondues
  à partir du journal).

> L'ouverture au client coûte peu : ce sont des **vues** sur un journal déjà
> alimenté par Phénix. Une saisie Phénix → bénéfice client, sans ressaisie.

### Hors périmètre V1 (clipsables plus tard, sans refonte)
Choix & validations de matériaux · sous-traitants · dépôt de factures · SAV ·
carnet numérique du logement.
Chacun = une future **vue** sur le même journal.

## 5. Conséquences

**Positives**
- V1 minuscule à construire, vision long terme préservée par l'architecture.
- Démo qui prouve « une saisie, plusieurs bénéfices » dès le premier chantier.
- Coûts d'exploitation faibles (DB classique, pas d'infra événementielle).
- Confiance protégée par la validation humaine systématique.

**Coûts / contraintes acceptés**
- Discipline requise : tout passe par le journal, on n'autorise aucun module à
  stocker ses propres données en parallèle.
- L'avancement reste **suggéré**, jamais publié automatiquement.

## 6. Surface d'interaction du client — l'IA comme point d'entrée unique + modèle « demande »

**Décision :** le client ne parle **jamais** directement à Phénix. Son unique
point d'entrée est **l'assistant IA**.
- Quand l'IA sait répondre (à partir du journal), elle répond immédiatement.
- Quand une intervention humaine est nécessaire (question spécifique, demande de
  modification, problème, rendez-vous…), une **demande** est créée dans
  PHÉNIX 360.
- Phénix ne gère donc **pas une messagerie**, mais une **liste de demandes à
  traiter**. La réponse de Phénix est relayée au client **par l'assistant**.

**Intégration architecture :** une « demande » est un **type d'événement** du
journal. La liste de Phénix est une **vue** filtrée sur les demandes ouvertes.
La réponse est un événement relayé par l'assistant. Aucun nouveau silo.

**Garde-fou 1 — l'humain n'est jamais enfermé derrière le jugement de l'IA.**
La détection « ceci nécessite un humain » est une classification, terrain
fragile de l'IA. Donc : l'IA escalade quand elle le peut, **et** le client
dispose toujours d'un bouton **« Transmettre à l'équipe Phénix »** dans
l'assistant. « Jamais bloqué » est garanti **par construction**, pas par la
qualité d'un classifieur. (Application du principe « l'IA propose, l'humain
valide » au canal client.)

**Garde-fou 2 — une demande a un cycle de vie, ce n'est PAS un fil.**
**Une demande = un besoin = une résolution**, états *ouverte → traitée → close*.
Un nouveau besoin = une nouvelle demande. Pas de conversation libre qui
s'enroule. C'est le coupe-feu qui maintient Phénix sur une liste de tâches, et
jamais sur un chat.

**Hors périmètre V1 (sur ce point) :** upload de fichiers par le client ; temps
réel, minuteurs de SLA, accusés de lecture ; fil multi-messages par demande.

## 7. Décisions reportées (volontairement non tranchées ici)
- Stack technique (front, back, hébergement) — à décider **après** verrouillage
  du périmètre.
- Hébergement UE / RGPD et souveraineté des données IA — orientation forte, à
  formaliser dans un ADR dédié.
- Modèle de données concret de la table « journal ».
