// Format CSV partagé pour toute cotisation exportée (plateforme, district ou
// paroisse) — évite de tripler cette mise en forme à chaque niveau
// d'autorisation, qui ne diffèrent que par les colonnes de localisation
// (District/Paroisse) préfixées à ENTETE_COTISATION_CSV par l'appelant.
import { champCsv as champ } from './csv'
import { LABELS_BRANCHES } from './branches'
import { LABELS_STATUT_COTISATION, LABELS_TYPE_COTISATION } from './cotisations'
import { LABELS_ROLES } from './roles'

interface ParticipantCotisationCsv {
  nom: string
  prenom: string
  matricule: string | null
  brancheType: string | null
}

export interface CotisationCsv {
  type: string
  libelle: string | null
  montant: number
  montantPaye: number
  anneeScolaire: string
  statut: string
  datePaiement: Date | string | null
  modePaiement: string | null
  scout: ParticipantCotisationCsv | null
  utilisateur: (ParticipantCotisationCsv & { role: string }) | null
  collectePar: { nom: string; prenom: string; role: string } | null
  enregistrePar: { nom: string; prenom: string; role: string } | null
}

export const ENTETE_COTISATION_CSV =
  '"Participant";"Profil";"Matricule";"Branche";"Année scolaire";"Type";"Libellé";"Montant dû";"Montant reçu";"Reste à recevoir";"Statut";"Date mouvement";"Mode paiement";"Argent reçu par";"Dernière saisie par"'

/** Une ligne CSV pour une cotisation, cible scout ou staff (utilisateur) indifféremment. */
export function ligneCotisationCsv(c: CotisationCsv): string {
  const participant = c.scout ?? c.utilisateur
  const profil = c.scout ? 'Scout' : c.utilisateur ? LABELS_ROLES[c.utilisateur.role] ?? c.utilisateur.role : ''
  const branche = participant?.brancheType ? LABELS_BRANCHES[participant.brancheType] ?? participant.brancheType : ''

  return [
    champ(participant ? `${participant.prenom} ${participant.nom}` : ''),
    champ(profil),
    champ(participant?.matricule),
    champ(branche),
    champ(c.anneeScolaire),
    champ(LABELS_TYPE_COTISATION[c.type] ?? c.type),
    champ(c.libelle),
    c.montant,
    c.montantPaye,
    Math.max(0, c.montant - c.montantPaye),
    champ(LABELS_STATUT_COTISATION[c.statut] ?? c.statut),
    champ(c.datePaiement ? new Date(c.datePaiement).toLocaleDateString('fr-FR') : ''),
    champ(c.modePaiement),
    champ(c.collectePar ? `${c.collectePar.prenom} ${c.collectePar.nom} (${LABELS_ROLES[c.collectePar.role] ?? c.collectePar.role})` : ''),
    champ(c.enregistrePar ? `${c.enregistrePar.prenom} ${c.enregistrePar.nom} (${LABELS_ROLES[c.enregistrePar.role] ?? c.enregistrePar.role})` : ''),
  ].join(';')
}
