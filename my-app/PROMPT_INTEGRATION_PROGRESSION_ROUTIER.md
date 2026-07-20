# Prompt d'intégration — Progression individuelle des Compagnons (parcours Route)

## Mode d'emploi

Copie le contenu de ce fichier dans l'agent IA de ton choix (Claude Code, Copilot Chat, Codex…) directement dans le dépôt `my-app`. Ce prompt est **déjà adapté à la stack réelle du dépôt** (Next.js App Router, pas de backend séparé) — aucun placeholder à remplacer.

Ce document se concentre volontairement sur le **moteur de progression et de calcul** (§5 à §9, §14), qui est la fonctionnalité clé à livrer. Les sections API/frontend/notifications/stats sont volontairement plus courtes : elles renvoient vers les conventions déjà en place à réutiliser telles quelles.

---

# PROMPT À DONNER À L'AGENT IA

Tu es un développeur senior sur **SCOUT ASCCI**, une application Next.js 16 (App Router) + Prisma + PostgreSQL + next-auth de gestion d'un mouvement scout catholique en Côte d'Ivoire. **Il n'y a pas de backend séparé** : tout passe par des routes `app/api/**/route.ts`.

Je veux intégrer un module autonome : **le parcours de progression individuelle des Compagnons** (branche `BrancheType.COMPAGNONS`, 18-20 ans), inspiré du parcours "Route" (Noviciat → Apprentissage → Compagnonnage → Départ routier). Ce module vient **en plus** du système de badges par branche déjà existant (`Badge`/`ProgressionScout`) — il ne le remplace pas, il cohabite avec lui.

Ne crée pas une architecture parallèle. Réutilise :
- les conventions de routes (`app/api/scouts/[id]/...`) ;
- `lib/auth.ts`, `lib/roles.ts`, `lib/session.ts` (`paroisseIdRequise`), `lib/district.ts` (`getParoissesDuDistrict`), `lib/brancheUtilisateur.ts` (`getBrancheUtilisateur`/`getBrancheDistrictUtilisateur`) ;
- `lib/audit.ts` (`enregistrerAudit`) + `lib/audit-labels.ts` pour l'historique — **pas de modèle d'historique dédié**, `JournalAudit` existe déjà et sert cet usage dans tout le reste de l'app ;
- `lib/notifications.ts` (email uniquement pour l'instant, le SMS est un stub) ;
- `lib/storage.ts` + `app/api/upload/route.ts` pour toute pièce jointe (preuve de réalisation) ;
- le style de test de `lib/cotisations.test.ts` (fonctions pures, fixtures `new Date('AAAA-MM-JJ')`) et de `app/api/cotisations/route.test.ts` (mock de `getServerSession`, `@/lib/audit`, `@/lib/prisma`) ;
- le style d'UI de `app/dashboard/scouts/[id]/page.tsx` (JSX + Tailwind direct, pas de shadcn/ui) et `ConfirmDialog` pour toute action irréversible.

Aucun cron interne n'existe (pas de `@nestjs/schedule`, pas de config Vercel). Le seul mécanisme planifié du dépôt est `app/api/cron/rappels-documents/route.ts` : une route `GET` protégée par un header `x-cron-secret` comparé en temps constant, destinée à être appelée par un cron externe (crontab du serveur o2switch). Le job de recalcul des retards doit suivre exactement ce même patron.

---

# 1. Objectif du module

- créer le parcours d'un Compagnon (satellite du `Scout` existant, ne modifie pas le modèle `Scout`) ;
- calculer automatiquement la tranche d'âge et générer tout le parcours théorique ;
- suivre l'avancement activité par activité ;
- gérer le cycle déclaration → soumission → validation/rejet → resoumission ;
- détecter automatiquement les retards ;
- afficher les attributs obtenus et une timeline complète ;
- conserver un historique traçable (via `JournalAudit`).

Le Compagnon peut ne pas avoir de compte `Utilisateur` (déjà le cas pour tout `Scout` — `utilisateurId` optionnel).

---

# 2. Rôles et permissions

Aucun rôle à inventer — mappage direct sur `RoleUtilisateur` et le double système rôle paroissial / rôle district déjà en place :

| Rôle métier du prompt d'origine | Rôle réel de l'app | Périmètre calculé via |
|---|---|---|
| Responsable de communauté | `RESPONSABLE_BRANCHE` / `ADJOINT_BRANCHE` (branche du compte) | `paroisseIdRequise(session)` + `getBrancheUtilisateur(userId) === 'COMPAGNONS'` |
| Validateur de district | `COMMISSAIRE_DISTRICT` / `ADJOINT_DISTRICT` / `ASSISTANT_DISTRICT` (si `brancheTypeDistrict === 'COMPAGNONS'`) | `getParoissesDuDistrict(paroisseAncrage)` |
| Administrateur régional | `ADMIN_PLATEFORME` | aucun périmètre — accès total |

Reprends **exactement** le patron `autoriseSurScout()` de `app/api/scouts/[id]/progressions/route.ts` pour toute route touchant un `ParcoursCompagnon` : même 404 générique "introuvable" en cas de hors-périmètre (ne jamais distinguer "n'existe pas" de "pas autorisé"), même double vérification paroisse+branche côté branche et district+brancheTypeDistrict côté district.

Contraintes métier à coder côté serveur (jamais côté frontend seul) :

- `RESPONSABLE_BRANCHE`/`ADJOINT_BRANCHE` : ne peut pas valider sa propre soumission, ne peut pas modifier une activité déjà `VALIDEE`.
- `ASSISTANT_BRANCHE` : peut déclarer/soumettre mais pas valider/rejeter (à confirmer selon la même granularité que `ROLES_BRANCHE` existant).
- Toute création de `ParcoursCompagnon` doit vérifier `scout.brancheType === 'COMPAGNONS'` (400 sinon) — pas de contrainte DB possible ici (comme les index partiels déjà présents dans le schéma, appliqués manuellement), donc vérification applicative stricte.

---

# 3. Modèle Prisma (satellite de `Scout`, n'y touche pas)

```prisma
enum EtapeCompagnon {
  NOVICIAT
  APPRENTISSAGE
  COMPAGNONNAGE
  DEPART_ROUTIER
}

enum TypeActiviteParcours {
  DUREE
  EVENEMENT
}

enum TrancheAgeCompagnon {
  DIX_HUIT_ANS
  DIX_NEUF_ANS
  VINGT_ANS
}

enum StatutProgressionCompagnon {
  A_VENIR
  EN_COURS
  EN_RETARD
  SOUMISE
  VALIDEE
  REJETEE
  ANNULEE
}

enum StatutParcoursCompagnon {
  ACTIF
  TERMINE
  SUSPENDU
  ABANDONNE
}

// Référentiel administrable des 10 activités officielles (voir §6)
model EtapeParcoursCompagnon {
  id                 String               @id @default(cuid())
  code               String               @unique // ex: ROUTE_ACCUEIL
  nom                String
  description        String?
  etape              EtapeCompagnon
  ordre              Int
  type               TypeActiviteParcours
  dureeDixHuitAns    Int // en mois
  dureeDixNeufAns    Int
  dureeVingtAns      Int
  nomAttribut        String?
  obligatoire        Boolean              @default(true)
  actif              Boolean              @default(true)

  progressions ProgressionCompagnon[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([etape, ordre])
  @@index([actif, ordre])
}

// 1-1 avec Scout — n'existe que pour les scouts brancheType = COMPAGNONS
model ParcoursCompagnon {
  id                  String                  @id @default(cuid())
  dateEntreeParcours  DateTime
  ageEntree           Int // calculé une seule fois, jamais recalculé sauf recalcul explicite (§10)
  trancheAge          TrancheAgeCompagnon
  dateFinPrevue       DateTime
  dateFinReelle       DateTime?
  statut              StatutParcoursCompagnon @default(ACTIF)

  scoutId String @unique
  scout   Scout  @relation(fields: [scoutId], references: [id], onDelete: Cascade)

  // Informationnel : sert de cible de notification, n'est jamais utilisé pour
  // autoriser une action (l'autorisation reste toujours calculée via
  // paroisseIdRequise + getBrancheUtilisateur, comme le reste de l'app).
  responsableId String?
  responsable   Utilisateur? @relation(fields: [responsableId], references: [id], onDelete: SetNull)

  progressions     ProgressionCompagnon[]
  attributsObtenus AttributCompagnon[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([statut])
  @@index([dateFinPrevue])
  @@index([trancheAge])
}

model ProgressionCompagnon {
  id                      String                     @id @default(cuid())
  dateDebutTheorique      DateTime
  dateLimiteTheorique     DateTime
  dateRealisationDeclaree DateTime?

  statut                  StatutProgressionCompagnon @default(A_VENIR)
  commentaireDeclaration  String?
  motifRejet              String?
  preuveUrl               String? // renvoyé par POST /api/upload, voir lib/storage.ts
  numeroSoumission        Int                        @default(0)

  soumisLe               DateTime?
  valideLe               DateTime?
  rejeteLe               DateTime?
  derniereAlerteRetardLe DateTime? // anti-spam du job de recalcul (§10)

  parcoursId String
  parcours   ParcoursCompagnon @relation(fields: [parcoursId], references: [id], onDelete: Cascade)

  etapeActiviteId String
  etapeActivite   EtapeParcoursCompagnon @relation(fields: [etapeActiviteId], references: [id])

  soumisParId String?
  soumisPar   Utilisateur? @relation("ProgressionCompagnonSoumisePar", fields: [soumisParId], references: [id], onDelete: SetNull)

  valideParId String?
  validePar   Utilisateur? @relation("ProgressionCompagnonValideePar", fields: [valideParId], references: [id], onDelete: SetNull)

  rejeteParId String?
  rejetePar   Utilisateur? @relation("ProgressionCompagnonRejeteePar", fields: [rejeteParId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([parcoursId, etapeActiviteId])
  @@index([statut])
  @@index([dateLimiteTheorique])
}

model AttributCompagnon {
  id              String   @id @default(cuid())
  nom             String
  obtenuLe        DateTime

  parcoursId      String
  parcours        ParcoursCompagnon @relation(fields: [parcoursId], references: [id], onDelete: Cascade)

  etapeActiviteId String

  obtenuParId String?
  obtenuPar   Utilisateur? @relation(fields: [obtenuParId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())

  @@unique([parcoursId, etapeActiviteId])
}
```

Ajoute les relations inverses correspondantes sur `Scout` et `Utilisateur` (comme pour toute autre relation existante — voir `Scout.progressions`/`Utilisateur.progressionsValidees` pour le patron).

Historique : **aucun modèle dédié**. Chaque action (génération, soumission, resoumission, validation, rejet, recalcul) écrit une entrée via `enregistrerAudit({ paroisseId, acteurId, action: 'PROGRESSION_COMPAGNON_...', entite: 'ProgressionCompagnon', entiteId, details })`, avec les clés ajoutées dans `lib/audit-labels.ts`.

---

# 4. Référentiel officiel des 10 activités

| Ordre | Étape | Activité | Type | 18 ans | 19 ans | 20 ans | Attribut | Code |
|---:|---|---|---|---:|---:|---:|---|---|
| 1 | NOVICIAT | Accueil | ÉVÉNEMENT | 0 | 0 | 0 | Foulard | `ROUTE_ACCUEIL` |
| 2 | NOVICIAT | Aspirant routier | DURÉE | 1 | 1 | 1 | Flots gris | `ROUTE_ASPIRANT` |
| 3 | APPRENTISSAGE | Engagement | DURÉE | 3 | 3 | 1 | Insigne routier | `ROUTE_ENGAGEMENT` |
| 4 | APPRENTISSAGE | Mini-camp | DURÉE | 3 | 3 | 1 | Étoile marron | `ROUTE_MINI_CAMP` |
| 5 | APPRENTISSAGE | Cérémonie de fin d'étape | ÉVÉNEMENT | 0 | 0 | 0 | Flots marrons | `ROUTE_CEREMONIE_APPRENTISSAGE` |
| 6 | COMPAGNONNAGE | Raid | DURÉE | 2 | 2 | 1 | Étoile blanche | `ROUTE_RAID` |
| 7 | COMPAGNONNAGE | Entreprise | DURÉE | 8 | 5 | 3 | Label de domaine d'action | `ROUTE_ENTREPRISE` |
| 8 | COMPAGNONNAGE | Cérémonie de fin d'étape | ÉVÉNEMENT | 0 | 0 | 0 | Flots routiers | `ROUTE_CEREMONIE_COMPAGNONNAGE` |
| 9 | DEPART_ROUTIER | Service | DURÉE | 6 | 3 | 1 | Étoile or | `ROUTE_SERVICE` |
| 10 | DEPART_ROUTIER | Envoi | DURÉE | 3 | 1 | 1 | Bible | `ROUTE_ENVOI` |

Durées totales théoriques : 26 mois (tranche 18 ans), 18 mois (tranche 19 ans), 9 mois (tranche 20 ans).

Seed idempotent : suis le patron déjà utilisé dans `prisma/seed.ts` (upsert par `code`, pas de doublons, ne supprime jamais une activité déjà utilisée par une progression existante même si elle devient `actif: false`).

---

# 5. Moteur de calcul — le cœur du module

Tout ce qui suit doit vivre dans des **fonctions pures**, testables sans Prisma ni session, dans un seul fichier `lib/parcoursCompagnon.ts` (+ `lib/parcoursCompagnon.test.ts` à côté, comme `lib/cotisations.ts`/`lib/cotisations.test.ts`). Les routes API n'orchestrent que la persistance : elles ne contiennent aucune logique de date ou de statut.

## 5.1 Âge d'entrée

L'âge de référence est l'âge exact à `dateEntreeParcours`, calculé **une seule fois** à la création et jamais recalculé automatiquement ensuite (voir §10 pour la modification de date d'entrée). Prend en compte mois et jour, pas seulement l'année.

```typescript
export function calculerAgeEntree(dateNaissance: Date, dateEntreeParcours: Date): number {
  let age = dateEntreeParcours.getFullYear() - dateNaissance.getFullYear()
  const diffMois = dateEntreeParcours.getMonth() - dateNaissance.getMonth()
  const diffJour = dateEntreeParcours.getDate() - dateNaissance.getDate()

  if (diffMois < 0 || (diffMois === 0 && diffJour < 0)) {
    age -= 1
  }

  return age
}

export class AgeEntreeInvalideError extends Error {
  constructor(public readonly ageEntree: number) {
    super(`Âge d'entrée invalide : ${ageEntree} ans (autorisé : 18 à 20 ans)`)
  }
}

export function determinerTrancheAge(ageEntree: number): TrancheAgeCompagnon {
  if (ageEntree < 18 || ageEntree > 20) {
    throw new AgeEntreeInvalideError(ageEntree)
  }
  if (ageEntree === 18) return 'DIX_HUIT_ANS'
  if (ageEntree === 19) return 'DIX_NEUF_ANS'
  return 'VINGT_ANS'
}
```

Une entrée à 20 ans est valide mais doit déclencher une alerte spéciale (parcours compressé à 9 mois) — géré au niveau de la route de création, pas ici.

Tests obligatoires (fixtures `new Date('AAAA-MM-JJ')`, comme `lib/cotisations.test.ts`) :
- anniversaire déjà passé dans l'année d'entrée ;
- anniversaire pas encore passé ;
- entrée exactement le jour de l'anniversaire (doit compter l'âge atteint ce jour-là) ;
- entrée un 29 février (année bissextile) ;
- 17 ans → `AgeEntreeInvalideError` ;
- 21 ans → `AgeEntreeInvalideError` ;
- 18, 19, 20 ans exacts → bonne tranche.

## 5.2 Addition de mois calendaires

`date-fns` n'est pas une dépendance du projet — pas la peine de l'ajouter pour une seule fonction. Implémentation sans dépendance, avec clamp de fin de mois (comportement identique à `addMonths` de `date-fns`) :

```typescript
export function ajouterMoisCalendaires(date: Date, mois: number): Date {
  const resultat = new Date(date)
  const jourOriginal = resultat.getDate()

  resultat.setDate(1) // évite le débordement de setMonth pendant le calcul
  resultat.setMonth(resultat.getMonth() + mois)

  const dernierJourMoisCible = new Date(resultat.getFullYear(), resultat.getMonth() + 1, 0).getDate()
  resultat.setDate(Math.min(jourOriginal, dernierJourMoisCible))

  return resultat
}
```

Tests obligatoires :
- ajout de 1 mois (cas simple) ;
- ajout de 3 mois ;
- décembre → janvier (changement d'année) ;
- 31 janvier + 1 mois → 28 ou 29 février selon l'année ;
- 31 janvier + 1 mois sur année bissextile → 29 février ;
- ajout de 0 mois (activité ÉVÉNEMENT ne décale rien).

## 5.3 Génération de la progression

```typescript
interface LigneProgressionGeneree {
  etapeActiviteId: string
  dateDebutTheorique: Date
  dateLimiteTheorique: Date
}

function dureeSelonTranche(activite: EtapeParcoursCompagnon, tranche: TrancheAgeCompagnon): number {
  if (tranche === 'DIX_HUIT_ANS') return activite.dureeDixHuitAns
  if (tranche === 'DIX_NEUF_ANS') return activite.dureeDixNeufAns
  return activite.dureeVingtAns
}

export function genererLignesProgression(
  activites: EtapeParcoursCompagnon[],
  tranche: TrancheAgeCompagnon,
  dateDepart: Date,
): LigneProgressionGeneree[] {
  const activitesTriees = [...activites].sort((a, b) => a.ordre - b.ordre)
  let curseur = dateDepart
  const lignes: LigneProgressionGeneree[] = []

  for (const activite of activitesTriees) {
    const debut = curseur
    const estEvenement = activite.type === 'EVENEMENT'
    const limite = estEvenement ? debut : ajouterMoisCalendaires(debut, dureeSelonTranche(activite, tranche))

    lignes.push({ etapeActiviteId: activite.id, dateDebutTheorique: debut, dateLimiteTheorique: limite })

    // Une activité sans durée ne décale jamais la suivante : curseur = limite,
    // qui vaut debut pour un événement.
    curseur = limite
  }

  return lignes
}

export function calculerDateFinPrevue(lignes: LigneProgressionGeneree[]): Date {
  return lignes.reduce(
    (max, ligne) => (ligne.dateLimiteTheorique > max ? ligne.dateLimiteTheorique : max),
    lignes[0].dateLimiteTheorique,
  )
}
```

À la création d'un `ParcoursCompagnon`, la route orchestre dans une transaction `prisma.$transaction([...])` (patron déjà utilisé dans `app/api/cotisations/route.ts`) :

1. `calculerAgeEntree` + `determinerTrancheAge` (throw → 400 si hors 18-20, sauf procédure administrative explicite) ;
2. lecture du référentiel actif (`EtapeParcoursCompagnon.findMany({ where: { actif: true }, orderBy: { ordre: 'asc' } })`) ;
3. `genererLignesProgression` + `calculerDateFinPrevue` ;
4. création du `ParcoursCompagnon` + toutes les `ProgressionCompagnon` en une seule transaction ;
5. `enregistrerAudit({ action: 'PARCOURS_COMPAGNON_GENERE', ... })`.

Tests obligatoires (génération) :
- total 26 mois pour la tranche 18 ans (somme des durées) ;
- total 18 mois pour la tranche 19 ans ;
- total 9 mois pour la tranche 20 ans ;
- une activité ÉVÉNEMENT ne décale pas la suivante ;
- l'ordre des lignes générées respecte `ordre` du référentiel même si la requête Prisma ne trie pas.

## 5.4 Statut affiché (métier vs temporel)

Un statut métier (`SOUMISE`, `VALIDEE`, `REJETEE`, `ANNULEE`) ne doit **jamais** être écrasé automatiquement par un statut temporel.

```typescript
const STATUTS_METIER: StatutProgressionCompagnon[] = ['SOUMISE', 'VALIDEE', 'REJETEE', 'ANNULEE']

export function calculerStatutAffiche(
  progression: { statut: StatutProgressionCompagnon; dateDebutTheorique: Date; dateLimiteTheorique: Date },
  maintenant: Date,
): StatutProgressionCompagnon {
  if (STATUTS_METIER.includes(progression.statut)) {
    return progression.statut
  }
  if (maintenant < progression.dateDebutTheorique) return 'A_VENIR'
  if (maintenant <= progression.dateLimiteTheorique) return 'EN_COURS'
  return 'EN_RETARD'
}
```

Tests obligatoires :
- avant `dateDebutTheorique` → `A_VENIR` ;
- entre début et limite → `EN_COURS` ;
- après la limite → `EN_RETARD` ;
- statut déjà `SOUMISE`/`VALIDEE`/`REJETEE`/`ANNULEE` → renvoyé tel quel, quelles que soient les dates.

## 5.5 Job de recalcul des retards

Pas de `@nestjs/schedule` disponible : suis exactement le patron de `app/api/cron/rappels-documents/route.ts` (route `GET`, header `x-cron-secret` comparé via `timingSafeEqual`, appelée par un cron externe — crontab du serveur o2switch, documenté dans `.env.example`).

```typescript
// app/api/cron/recalcul-progressions-compagnons/route.ts
export async function GET(request: NextRequest) {
  // ... vérification x-cron-secret, identique à rappels-documents ...

  const progressions = await prisma.progressionCompagnon.findMany({
    where: { statut: { in: ['A_VENIR', 'EN_COURS', 'EN_RETARD'] } },
  })

  for (const progression of progressions) {
    const nouveauStatut = calculerStatutAffiche(progression, new Date())
    if (nouveauStatut === progression.statut) continue

    await prisma.progressionCompagnon.update({
      where: { id: progression.id },
      data: { statut: nouveauStatut },
    })

    if (nouveauStatut === 'EN_RETARD' && !dejaAlerteRecemment(progression.derniereAlerteRetardLe)) {
      // notifier + mettre à jour derniereAlerteRetardLe
    }
  }

  return NextResponse.json({ traitees: progressions.length })
}
```

Prévoir aussi une route administrative `POST /api/admin/parcours-compagnons/recalculer` (réservée `ADMIN_PLATEFORME`) qui exécute la même logique à la demande.

---

# 6. Pourcentage d'avancement

```typescript
export interface ResumeAvancementParcours {
  totalActivitesObligatoires: number
  activitesValidees: number
  activitesSoumises: number
  activitesEnRetard: number
  activitesAVenir: number
  pourcentageAvancement: number
  etapeCourante: EtapeCompagnon
  prochaineActivite: { id: string; nom: string; dateLimite: Date } | null
}

export function calculerAvancement(
  progressions: Array<{
    statut: StatutProgressionCompagnon
    dateLimiteTheorique: Date
    etapeActivite: { id: string; nom: string; etape: EtapeCompagnon; obligatoire: boolean; ordre: number }
  }>,
): ResumeAvancementParcours {
  const obligatoires = progressions.filter((p) => p.etapeActivite.obligatoire)
  const validees = obligatoires.filter((p) => p.statut === 'VALIDEE')

  const prochaine = obligatoires
    .filter((p) => p.statut !== 'VALIDEE')
    .sort((a, b) => a.etapeActivite.ordre - b.etapeActivite.ordre)[0]

  return {
    totalActivitesObligatoires: obligatoires.length,
    activitesValidees: validees.length,
    activitesSoumises: obligatoires.filter((p) => p.statut === 'SOUMISE').length,
    activitesEnRetard: obligatoires.filter((p) => p.statut === 'EN_RETARD').length,
    activitesAVenir: obligatoires.filter((p) => p.statut === 'A_VENIR').length,
    pourcentageAvancement: obligatoires.length === 0 ? 0 : Math.round((validees.length / obligatoires.length) * 100),
    etapeCourante: (prochaine ?? obligatoires[obligatoires.length - 1]).etapeActivite.etape,
    prochaineActivite: prochaine
      ? { id: prochaine.etapeActivite.id, nom: prochaine.etapeActivite.nom, dateLimite: prochaine.dateLimiteTheorique }
      : null,
  }
}
```

Le parcours passe à `StatutParcoursCompagnon.TERMINE` quand `activitesValidees === totalActivitesObligatoires` : enregistrer `dateFinReelle`, appeler `enregistrerAudit`, notifier (§9), et empêcher une double notification (vérifier que `statut` n'était pas déjà `TERMINE` avant d'agir).

---

# 7. Workflow soumission / validation / rejet

Reprend le patron déjà utilisé pour la validation de badge (`POST /api/scouts/[id]/progressions`) mais avec les étapes supplémentaires du cycle complet :

- **Déclaration/soumission** (`POST /api/parcours-compagnons/progressions/[id]/soumettre`) : vérifie périmètre via le patron `autoriseSurScout`, vérifie que le statut n'est pas déjà `VALIDEE`, enregistre `dateRealisationDeclaree`/`commentaireDeclaration`/`preuveUrl` (issu de `POST /api/upload`, jamais un chemin arbitraire), passe `statut = 'SOUMISE'`, `soumisLe`/`soumisParId`, `enregistrerAudit('PROGRESSION_COMPAGNON_SOUMISE')`.
- **Validation** (`.../valider`) : vérifie périmètre du validateur (branche/district selon §2), refuse si `soumisParId === session.user.id` (pas de validation de sa propre soumission), passe `VALIDEE`, crée l'`AttributCompagnon` correspondant si `nomAttribut` est défini, recalcule `calculerAvancement`, vérifie la complétion du parcours (§6).
- **Rejet** (`.../rejeter`) : `motifRejet` obligatoire (400 sinon), passe `REJETEE`.
- **Resoumission** : conserve le rejet précédent dans l'historique (`JournalAudit`, jamais supprimé), incrémente `numeroSoumission`, repasse `SOUMISE`.

Dialogue de confirmation `ConfirmDialog` (déjà utilisé pour la validation de badge, "action non réversible") à réutiliser pour valider/rejeter.

---

# 8. Modification de la date d'entrée

- **Aucune activité validée** : recalcul automatique (âge, tranche, toutes les dates) via les fonctions du §5, `enregistrerAudit('PARCOURS_COMPAGNON_RECALCULE')`.
- **Au moins une activité `VALIDEE`** : ne recalcule jamais silencieusement. Route dédiée qui renvoie d'abord un **aperçu** de l'impact (nouvelles dates, activités qui changeraient de statut) sans écrire en base, puis exige une confirmation explicite (`ADMIN_PLATEFORME` uniquement) avant d'appliquer. Ne supprime jamais les validations existantes.

---

# 9. Notifications

`lib/notifications.ts` gère déjà l'email (SMS = stub). Pas de notification in-app persistée dans le dépôt actuellement (pas de modèle `Notification`, pas de cloche) — en ajouter une serait un net-new, pas une extension. Pour ce module, ajoute deux builders d'email sur le même patron que `envoyerEmailBienvenue`/`envoyerEmailRappelDocuments` :

- activité soumise → email au validateur compétent ;
- activité en retard / parcours à échéance dans moins de 3 mois / parcours terminé → email au responsable (`ParcoursCompagnon.responsableId`).

---

# 10. Sécurité

- Toute route protégée par `getServerSession` + le patron `autoriseSurScout`/périmètre district, jamais une confiance dans le frontend.
- Fichiers de preuve : `POST /api/upload` (déjà en place — sniffing magic-byte via `lib/fileSignature.ts`, 5 Mo max, nom de fichier généré côté serveur), puis persistance de l'URL retournée dans `ProgressionCompagnon.preuveUrl`. Ne jamais faire confiance au type MIME déclaré par le client.
- Journal d'audit : jamais de suppression physique d'une validation ; `JournalAudit` utilise déjà `onDelete: Restrict`/`SetNull`, cohérent avec le reste du schéma.

---

# 11. Ordre d'implémentation

1. **Schéma** : enums + modèles du §3, migration Prisma, seed du référentiel (§4).
2. **Moteur de calcul** (`lib/parcoursCompagnon.ts` + tests) : §5 en entier, avant tout le reste — c'est la fondation de tout ce qui suit.
3. **Routes API** : CRUD parcours, soumission/validation/rejet/resoumission, recalcul, route cron.
4. **Frontend** : section "Progression Compagnon" dans `app/dashboard/scouts/[id]/page.tsx` (même style JSX que la section badges existante) + file de validation pour les rôles concernés.
5. **Vérification** : `npx prisma format && npx prisma validate`, `npx prisma migrate dev --name add_parcours_compagnon`, `npm run lint`, `npm test`, `npm run build`.

Ne génère pas tous les fichiers d'un coup : commence par le schéma + le moteur de calcul (avec ses tests qui passent), présente-les, puis enchaîne sur les routes et le frontend.
