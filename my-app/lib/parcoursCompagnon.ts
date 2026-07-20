// Moteur de calcul du parcours de progression individuelle des Compagnons
// (référentiel "Route" : Noviciat → Apprentissage → Compagnonnage → Départ
// routier). Fonctions pures, sans dépendance à Prisma ni à une session — les
// routes API n'orchestrent que la persistance, aucune logique de date ou de
// statut ne doit vivre ailleurs qu'ici. Voir PROMPT_INTEGRATION_PROGRESSION_ROUTIER.md.

export type TrancheAgeCompagnon = 'DIX_HUIT_ANS' | 'DIX_NEUF_ANS' | 'VINGT_ANS'
export type StatutProgressionCompagnon =
  | 'A_VENIR'
  | 'EN_COURS'
  | 'EN_RETARD'
  | 'SOUMISE'
  | 'VALIDEE'
  | 'REJETEE'
  | 'ANNULEE'
export type EtapeCompagnon = 'NOVICIAT' | 'APPRENTISSAGE' | 'COMPAGNONNAGE' | 'DEPART_ROUTIER'
export type TypeActiviteParcours = 'DUREE' | 'EVENEMENT'

// ---------------------------------------------------------------------------
// 1. Âge d'entrée dans le parcours
// ---------------------------------------------------------------------------

/**
 * Âge exact à la date d'entrée dans le parcours, en tenant compte du mois et
 * du jour (pas une simple différence d'années). Calculé une seule fois à la
 * création du parcours — jamais recalculé automatiquement ensuite.
 */
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
    this.name = 'AgeEntreeInvalideError'
  }
}

/**
 * Détermine la tranche d'âge (18/19/20 ans) à partir de l'âge d'entrée.
 * Lève AgeEntreeInvalideError en dehors de 18-20 ans — à la charge de
 * l'appelant (route de création) de prévoir une procédure administrative
 * exceptionnelle si besoin, jamais silencieusement ici.
 */
export function determinerTrancheAge(ageEntree: number): TrancheAgeCompagnon {
  if (ageEntree < 18 || ageEntree > 20) {
    throw new AgeEntreeInvalideError(ageEntree)
  }
  if (ageEntree === 18) return 'DIX_HUIT_ANS'
  if (ageEntree === 19) return 'DIX_NEUF_ANS'
  return 'VINGT_ANS'
}

// ---------------------------------------------------------------------------
// 2. Addition de mois calendaires
// ---------------------------------------------------------------------------

/**
 * Ajoute un nombre de mois calendaires à une date, avec clamp de fin de mois
 * (identique au comportement de `addMonths` de date-fns — non ajouté comme
 * dépendance pour une seule fonction). Une activité de 3 mois doit avancer de
 * 3 mois calendaires, jamais d'un nombre fixe de jours.
 */
export function ajouterMoisCalendaires(date: Date, mois: number): Date {
  const resultat = new Date(date)
  const jourOriginal = resultat.getDate()

  resultat.setDate(1) // évite le débordement de setMonth pendant le calcul
  resultat.setMonth(resultat.getMonth() + mois)

  const dernierJourMoisCible = new Date(resultat.getFullYear(), resultat.getMonth() + 1, 0).getDate()
  resultat.setDate(Math.min(jourOriginal, dernierJourMoisCible))

  return resultat
}

// ---------------------------------------------------------------------------
// 3. Génération de la progression
// ---------------------------------------------------------------------------

export interface EtapeReferentiel {
  id: string
  ordre: number
  type: TypeActiviteParcours
  dureeDixHuitAns: number
  dureeDixNeufAns: number
  dureeVingtAns: number
}

export interface LigneProgressionGeneree {
  etapeActiviteId: string
  dateDebutTheorique: Date
  dateLimiteTheorique: Date
}

function dureeSelonTranche(activite: EtapeReferentiel, tranche: TrancheAgeCompagnon): number {
  if (tranche === 'DIX_HUIT_ANS') return activite.dureeDixHuitAns
  if (tranche === 'DIX_NEUF_ANS') return activite.dureeDixNeufAns
  return activite.dureeVingtAns
}

/**
 * Génère séquentiellement les lignes de progression théorique à partir du
 * référentiel actif. Les activités sont chaînées dans l'ordre : une activité
 * ÉVÉNEMENT (durée 0) ne décale jamais la date de début de l'activité
 * suivante (dateLimiteTheorique === dateDebutTheorique).
 */
export function genererLignesProgression(
  activites: EtapeReferentiel[],
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
    curseur = limite
  }

  return lignes
}

/** Date de fin prévisionnelle du parcours = date limite de la dernière activité générée. */
export function calculerDateFinPrevue(lignes: LigneProgressionGeneree[]): Date {
  if (lignes.length === 0) {
    throw new Error('Impossible de calculer une date de fin prévue sans lignes de progression.')
  }
  return lignes.reduce(
    (max, ligne) => (ligne.dateLimiteTheorique > max ? ligne.dateLimiteTheorique : max),
    lignes[0].dateLimiteTheorique,
  )
}

// ---------------------------------------------------------------------------
// 4. Statut affiché (métier vs temporel)
// ---------------------------------------------------------------------------

const STATUTS_METIER: StatutProgressionCompagnon[] = ['SOUMISE', 'VALIDEE', 'REJETEE', 'ANNULEE']

export interface ProgressionPourCalculStatut {
  statut: StatutProgressionCompagnon
  dateDebutTheorique: Date
  dateLimiteTheorique: Date
}

/**
 * Calcule le statut à afficher/persister. Un statut métier (SOUMISE, VALIDEE,
 * REJETEE, ANNULEE) n'est jamais remplacé automatiquement par un statut
 * temporel — seules les lignes encore A_VENIR/EN_COURS/EN_RETARD sont
 * réévaluées par le job de recalcul (§5).
 */
export function calculerStatutAffiche(
  progression: ProgressionPourCalculStatut,
  maintenant: Date,
): StatutProgressionCompagnon {
  if (STATUTS_METIER.includes(progression.statut)) {
    return progression.statut
  }
  if (maintenant < progression.dateDebutTheorique) return 'A_VENIR'
  if (maintenant <= progression.dateLimiteTheorique) return 'EN_COURS'
  return 'EN_RETARD'
}

// ---------------------------------------------------------------------------
// 5. Pourcentage d'avancement
// ---------------------------------------------------------------------------

export interface ProgressionPourAvancement {
  statut: StatutProgressionCompagnon
  dateLimiteTheorique: Date
  etapeActivite: {
    id: string
    nom: string
    etape: EtapeCompagnon
    obligatoire: boolean
    ordre: number
  }
}

export interface ResumeAvancementParcours {
  totalActivitesObligatoires: number
  activitesValidees: number
  activitesSoumises: number
  activitesEnRetard: number
  activitesAVenir: number
  pourcentageAvancement: number
  etapeCourante: EtapeCompagnon | null
  prochaineActivite: { id: string; nom: string; dateLimite: Date } | null
}

/**
 * Pourcentage d'avancement = activités obligatoires validées / total des
 * activités obligatoires actives. Les activités non obligatoires n'entrent
 * pas dans le calcul (mais restent affichées dans la timeline).
 */
export function calculerAvancement(progressions: ProgressionPourAvancement[]): ResumeAvancementParcours {
  const obligatoires = progressions.filter((p) => p.etapeActivite.obligatoire)
  const validees = obligatoires.filter((p) => p.statut === 'VALIDEE')

  const prochaine = obligatoires
    .filter((p) => p.statut !== 'VALIDEE')
    .sort((a, b) => a.etapeActivite.ordre - b.etapeActivite.ordre)[0]

  const derniere = obligatoires.slice().sort((a, b) => a.etapeActivite.ordre - b.etapeActivite.ordre).at(-1)

  return {
    totalActivitesObligatoires: obligatoires.length,
    activitesValidees: validees.length,
    activitesSoumises: obligatoires.filter((p) => p.statut === 'SOUMISE').length,
    activitesEnRetard: obligatoires.filter((p) => p.statut === 'EN_RETARD').length,
    activitesAVenir: obligatoires.filter((p) => p.statut === 'A_VENIR').length,
    pourcentageAvancement: obligatoires.length === 0 ? 0 : Math.round((validees.length / obligatoires.length) * 100),
    etapeCourante: (prochaine ?? derniere)?.etapeActivite.etape ?? null,
    prochaineActivite: prochaine
      ? { id: prochaine.etapeActivite.id, nom: prochaine.etapeActivite.nom, dateLimite: prochaine.dateLimiteTheorique }
      : null,
  }
}

// ---------------------------------------------------------------------------
// 6. Anti-spam des alertes de retard (job de recalcul, voir route cron)
// ---------------------------------------------------------------------------

const DELAI_MINIMUM_ENTRE_ALERTES_MS = 24 * 60 * 60 * 1000

/** Évite d'envoyer la même alerte de retard à chaque exécution du job quotidien. */
export function dejaAlerteRecemment(derniereAlerteRetardLe: Date | null, maintenant: Date): boolean {
  if (!derniereAlerteRetardLe) return false
  return maintenant.getTime() - derniereAlerteRetardLe.getTime() < DELAI_MINIMUM_ENTRE_ALERTES_MS
}
