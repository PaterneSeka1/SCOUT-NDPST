# feat: suivre les adhésions nationales 2026–2027 et les mandats simultanés

Un encaissement paroissial ne prouve pas un paiement national. La nouvelle adhésion annuelle couvre scouts et chefs avec un tarif figé, conserve chaque réception et ses annulations, puis distingue préparation des lots, versement déclaré et confirmation nationale explicite. Une identité financière commune empêche la facturation répétée d'un chef qui cumule des fonctions.

Les habilitations financières sont nominatives et contrôlées par périmètre. Les mandats se cumulent sur un compte, leur clôture est individuelle et le choix d'espace est vérifié côté serveur. Les nouveaux parcours sont reliés à l'API ; les cotisations d'activité et les archives sont préservées. À partir de 2026–2027, l'ancien module ne permet plus de contourner le nouveau circuit d'adhésion.

Validation : lint, types, builds, 554 tests API, 71 tests partagés, 18 tests frontend, 24 tests PostgreSQL dont 14 financiers/HTTP, et 32 tests navigateur réussis (2 scénarios ignorés selon la résolution). Les 29 migrations ont été rejouées sur une base vierge, sans dérive de schéma ; la sauvegarde/restauration synthétique conserve les totaux.

Trois migrations additives sont à déployer après sauvegarde réelle vérifiée et recette métier. La reprise ne confirme jamais automatiquement le national et reste restreinte à une cible de recette locale. Les anomalies nationales demeurent engagées jusqu'au rapprochement. Aucune donnée réelle modifiée, aucune mise en production effectuée.

Dossier technique : `docs/adhesions-2026-2027/README.md`.
