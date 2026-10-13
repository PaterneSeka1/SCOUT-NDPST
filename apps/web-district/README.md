# Application district

Application Next.js de la plateforme district SCOUT ASCCI, sur sa propre installation (API et base distinctes de celles de la paroisse). Elle accueille la console de l'administrateur plateforme : paroisses, districts, comptes, journal d'audit et apparence.

Depuis cette console, l'administrateur gère aussi les installations autonomes déclarées dans `INSTALLATIONS_GEREES` (par exemple l'installation de la paroisse Wiradjuri). Un seul compte, une seule connexion : l'installation district signe ses jetons avec une clé privée, et chaque installation administrée les vérifie avec la clé publique, uniquement pour le rôle `ADMIN_PLATEFORME`. Un bandeau rappelle en permanence l'installation administrée.

Voir le [README du dépôt](../../README.md) et la [procédure de déploiement](../../docs/deploiement-ovh.md).
