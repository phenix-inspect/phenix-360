# PHÉNIX 360 — Décisions d'architecture (ADR)

Référence officielle du projet. Tout développement doit respecter ces ADR.
Toute évolution structurelle se fait par un **nouvel ADR** qui amende les précédents.

| ADR | Sujet | Statut |
|---|---|---|
| [ADR-001](./ADR-001-architecture-colonne-vertebrale.md) | Architecture « colonne vertébrale » & périmètre V1 | Accepté |
| [ADR-002](./ADR-002-modele-evenement.md) | Modèle d'événement (enveloppe + contenu typé) | Accepté |
| [ADR-003](./ADR-003-stack-hebergement-ia.md) | Stack, hébergement UE/RGPD, IA | Accepté (tranché par ADR-004) |
| [ADR-004](./ADR-004-architecture-technique-et-depot.md) | Architecture technique, dépôt & principes | **Accepté — référence** |
| [ADR-005](./ADR-005-conventions-de-nommage.md) | Conventions de nommage (code, schéma, vocabulaire) | Accepté (amende ADR-004 §4) |

## Principes directeurs (rappel ADR-004 §0)

1. **L'expérience prime sur la technique.** En cas de conflit, l'UX gagne, toujours.
2. **Une seule source de vérité** : le journal d'événements.
3. **Une seule saisie, plusieurs bénéfices.**
4. **L'IA propose, l'humain valide.**
5. **Portabilité sans lock-in** : migrable vers un hébergement souverain sans refonte.
6. **Le modèle d'IA est invisible au client** : tout passe par la passerelle.
