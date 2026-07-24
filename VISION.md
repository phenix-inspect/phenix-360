# PHÉNIX 360 — Vision Produit figée

> **Préambule**
>
> PHÉNIX 360 n'est pas un logiciel de gestion de chantier. C'est le **bureau
> mobile intelligent du conducteur de travaux**. Chaque décision produit doit
> être confrontée à cette vision. Si une fonctionnalité ne respecte pas cette
> constitution, **c'est la fonctionnalité qui change, jamais la constitution.**

La constitution. Tout écran, tout bouton, toute fonctionnalité doit passer ces
articles. S'il en échoue un, il ne rentre pas — même s'il est beau, même s'il
est déjà codé.

---

## Article 1 — PHÉNIX est le bureau mobile du conducteur, pas un générateur de comptes rendus.

Il réunit **tous les outils dont un conducteur a besoin pour piloter sa
journée** — pas seulement les comptes rendus.

**Test :** _la fonctionnalité aide-t-elle à **vivre** la journée, ou seulement à
produire un document ?_

## Article 2 — Le conducteur est toujours l'utilisateur principal. Tous les autres sont des projections.

Client, artisan, architecte, bureau de contrôle : des vues **dérivées**. L'app
s'ouvre **chez lui**, jamais chez un autre.

**Test :** _le conducteur est-il au centre, ou invité dans sa propre appli ?_

## Article 3 — PHÉNIX pilote une journée, pas un chantier.

La porte d'entrée est **« Aujourd'hui »**, tous chantiers confondus (le point du
matin). On entre dans un chantier **ensuite**.

**Test :** _puis-je voir et piloter ma journée entière avant d'ouvrir un
projet ?_

## Article 4 — Une mission = une raison d'être sur site.

Réunion, visite, livraison, pré-réception, réception, SAV. Choisie **en un
tap**, elle configure ce que PHÉNIX cherche et prépare. Une **capture rapide
sans mission** reste toujours possible pour l'imprévu.

**Test :** _la mission **oriente**-t-elle PHÉNIX sans jamais devenir un
formulaire — et l'imprévu peut-il être capté sans elle ?_

## Article 5 — Le conducteur travaille. PHÉNIX rédige.

Il montre, il parle. Il pense _« je termine ma réunion »_, jamais _« je crée un
CR »_. Le CR, le PV, la fiche **apparaissent** — le document est une conséquence,
jamais une tâche.

**Test :** _ai-je demandé au conducteur d'écrire quelque chose que PHÉNIX aurait
dû produire ?_

## Article 6 — Une information n'est saisie qu'une seule fois.

Ce que PHÉNIX sait déjà — commande, planning, présents habituels, dossier — il
le **retrouve**. Il ne le fait jamais ressaisir.

**Test :** _est-ce que je fais retaper une information qui existe déjà quelque
part ?_

## Article 7 — PHÉNIX n'est jamais passif.

Il **prépare, relance, anticipe et accompagne**. Il ne se contente pas d'écrire :
il voit venir (_« si le plombier ne passe pas demain, le carreleur saute — je
préviens ? »_). Mais il **n'invente jamais** un fait que personne n'a constaté,
et il **ne remplace jamais le jugement humain**.

**Test :** _PHÉNIX **anticipe**-t-il, ou se contente-t-il d'enregistrer ? Et :
peut-il affirmer un fait non constaté, ou décider à la place de l'humain ?_

## Article 8 — Les documents et les vues sont des projections, jamais des objets.

CR, PV, fiche SAV, fil client, historique, réserves : tous **dérivés des faits**
(le Journal, append-only, source unique de vérité). On ne « crée » pas un
document, on le **regarde**.

**Test :** _cette chose est-elle une projection des faits, ou un nouveau silo de
vérité ?_

## Article 9 — Chaque destinataire ne voit que ce qui lui est destiné.

Interne par défaut. Partage **ciblé par audience**, dans la bonne langue (**deux
voix**) : l'artisan ses actions, le client son récit + ses photos, le bureau de
contrôle ses réserves. Jamais de fuite (réserve, responsable, montant).

**Test :** _ce destinataire reçoit-il exactement ce qui le concerne, et **rien**
d'interne ?_

## Article 10 — À 18 h, le conducteur rentre la tête vide.

PHÉNIX n'enregistre pas que le passé : il **clôture la journée**, **ramène les
boucles** au bon moment, et **ne laisse jamais tomber un engagement**.

> À 18 h, le conducteur doit pouvoir rentrer chez lui la tête vide. **Si une
> fonctionnalité augmente sa charge mentale, elle est mauvaise, même si elle est
> techniquement parfaite.**

**Test :** _est-ce que ça allège la tête du conducteur — ou est-ce que ça
l'alourdit ?_

## Article 11 — La simplicité est une fonctionnalité.

Chaque écran doit pouvoir être compris en **moins de 10 secondes** par un
conducteur qui ne l'a jamais vu. Si une fonctionnalité nécessite une formation,
elle est probablement mal conçue.

**Test :** _peut-on comprendre cet écran immédiatement, sans manuel ?_

---

## Arbitrages V1 gravés

**Retenu :**

- La **mission reste** (Art. 4) : le conducteur sait pourquoi il descend de
  voiture ; on exploite cette information.
- **Deux entrées, un moteur** : mission (un tap) **+** capture rapide (imprévu).
- L'app **s'ouvre sur le conducteur** et sur **la journée** (Art. 2 & 3).

**Écarté pour la V1 :**

- **Capture zéro-tap** (deviner chantier + mission + document tout seul) → un
  rêve, pas une V1. Un tap est acceptable. _(reviendra en V2+)_
- **Suppression des missions** → non : sans mission, l'IA doit tout deviner,
  moins fiable.

## Exigences V1 qui découlent de la constitution

_(Conséquences non optionnelles, pas des articles.)_

- **Le vrai CR** (Art. 5, 8) : responsable **et** échéance par action, numéro,
  diffusion.
- **La vraie réserve** (Art. 8) : photo · description · responsable · échéance ·
  état · preuve de levée.
- **Les documents partent vraiment** (Art. 1, 9) : PDF / lien / mail — sinon
  l'Art. 1 n'est pas tenu.
- **Le point du matin = accueil** (Art. 3) et **le point du soir** (Art. 10).
- **Une seule porte de création** (Art. 5) : la capture ; on retire les entrées
  qui se marchent dessus.

## Gouvernance

> **Aucune Pull Request ne peut être validée si elle ne cite explicitement le ou
> les articles de `VISION.md` qu'elle respecte.**

Avant de coder quoi que ce soit, on écrit à quel(s) article(s) la fonctionnalité
obéit. Si elle n'en sert aucun, ou si elle en viole un, **on ne la fait pas.**
La constitution prime sur l'envie d'ajouter un écran. Les arbitrages sont
consignés dans `DECISIONS.md` ; les principes d'exécution dans `PRINCIPLES.md`.
