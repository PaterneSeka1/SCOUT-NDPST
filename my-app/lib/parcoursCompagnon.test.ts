import { describe, it, expect } from 'vitest'
import {
  calculerAgeEntree,
  determinerTrancheAge,
  AgeEntreeInvalideError,
  ajouterMoisCalendaires,
  genererLignesProgression,
  calculerDateFinPrevue,
  calculerStatutAffiche,
  calculerAvancement,
  dejaAlerteRecemment,
  LABELS_ETAPE_COMPAGNON,
  LABELS_TRANCHE_AGE_COMPAGNON,
  LABELS_STATUT_PROGRESSION_COMPAGNON,
  COULEURS_STATUT_PROGRESSION_COMPAGNON,
  type EtapeReferentiel,
  type ProgressionPourAvancement,
} from './parcoursCompagnon'

// Référentiel officiel des 10 activités (voir prisma/seed.ts) — dupliqué ici
// en fixture minimale pour tester le moteur de calcul indépendamment de la DB.
const REFERENTIEL: EtapeReferentiel[] = [
  { id: 'accueil', ordre: 1, type: 'EVENEMENT', dureeDixHuitAns: 0, dureeDixNeufAns: 0, dureeVingtAns: 0 },
  { id: 'aspirant', ordre: 2, type: 'DUREE', dureeDixHuitAns: 1, dureeDixNeufAns: 1, dureeVingtAns: 1 },
  { id: 'engagement', ordre: 3, type: 'DUREE', dureeDixHuitAns: 3, dureeDixNeufAns: 3, dureeVingtAns: 1 },
  { id: 'mini-camp', ordre: 4, type: 'DUREE', dureeDixHuitAns: 3, dureeDixNeufAns: 3, dureeVingtAns: 1 },
  { id: 'ceremonie-apprentissage', ordre: 5, type: 'EVENEMENT', dureeDixHuitAns: 0, dureeDixNeufAns: 0, dureeVingtAns: 0 },
  { id: 'raid', ordre: 6, type: 'DUREE', dureeDixHuitAns: 2, dureeDixNeufAns: 2, dureeVingtAns: 1 },
  { id: 'entreprise', ordre: 7, type: 'DUREE', dureeDixHuitAns: 8, dureeDixNeufAns: 5, dureeVingtAns: 3 },
  { id: 'ceremonie-compagnonnage', ordre: 8, type: 'EVENEMENT', dureeDixHuitAns: 0, dureeDixNeufAns: 0, dureeVingtAns: 0 },
  { id: 'service', ordre: 9, type: 'DUREE', dureeDixHuitAns: 6, dureeDixNeufAns: 3, dureeVingtAns: 1 },
  { id: 'envoi', ordre: 10, type: 'DUREE', dureeDixHuitAns: 3, dureeDixNeufAns: 1, dureeVingtAns: 1 },
]

describe('calculerAgeEntree', () => {
  it('anniversaire déjà passé dans l\'année d\'entrée', () => {
    expect(calculerAgeEntree(new Date('2008-03-10'), new Date('2026-07-20'))).toBe(18)
  })

  it('anniversaire pas encore passé', () => {
    expect(calculerAgeEntree(new Date('2008-11-10'), new Date('2026-07-20'))).toBe(17)
  })

  it('entrée exactement le jour de l\'anniversaire compte l\'âge atteint ce jour-là', () => {
    expect(calculerAgeEntree(new Date('2008-07-20'), new Date('2026-07-20'))).toBe(18)
  })

  it('gère une naissance un 29 février (année bissextile)', () => {
    expect(calculerAgeEntree(new Date('2008-02-29'), new Date('2026-03-01'))).toBe(18)
    expect(calculerAgeEntree(new Date('2008-02-29'), new Date('2026-02-28'))).toBe(17)
  })
})

describe('determinerTrancheAge', () => {
  it('18 ans exacts', () => {
    expect(determinerTrancheAge(18)).toBe('DIX_HUIT_ANS')
  })

  it('19 ans exacts', () => {
    expect(determinerTrancheAge(19)).toBe('DIX_NEUF_ANS')
  })

  it('20 ans exacts', () => {
    expect(determinerTrancheAge(20)).toBe('VINGT_ANS')
  })

  it('refuse un âge inférieur à 18 ans', () => {
    expect(() => determinerTrancheAge(17)).toThrow(AgeEntreeInvalideError)
  })

  it('refuse un âge supérieur à 20 ans', () => {
    expect(() => determinerTrancheAge(21)).toThrow(AgeEntreeInvalideError)
  })
})

describe('ajouterMoisCalendaires', () => {
  it('ajoute 1 mois', () => {
    expect(ajouterMoisCalendaires(new Date('2026-01-15'), 1)).toEqual(new Date('2026-02-15'))
  })

  it('ajoute 3 mois', () => {
    expect(ajouterMoisCalendaires(new Date('2026-01-15'), 3)).toEqual(new Date('2026-04-15'))
  })

  it('passe décembre → janvier avec changement d\'année', () => {
    expect(ajouterMoisCalendaires(new Date('2026-12-10'), 1)).toEqual(new Date('2027-01-10'))
  })

  it('31 janvier + 1 mois → 28 février sur année non bissextile', () => {
    expect(ajouterMoisCalendaires(new Date('2027-01-31'), 1)).toEqual(new Date('2027-02-28'))
  })

  it('31 janvier + 1 mois → 29 février sur année bissextile', () => {
    expect(ajouterMoisCalendaires(new Date('2028-01-31'), 1)).toEqual(new Date('2028-02-29'))
  })

  it('ajout de 0 mois renvoie la même date (activité événement)', () => {
    expect(ajouterMoisCalendaires(new Date('2026-06-01'), 0)).toEqual(new Date('2026-06-01'))
  })
})

describe('genererLignesProgression', () => {
  it('chaîne séquentiellement et ne décale pas la suivante pour un événement', () => {
    const lignes = genererLignesProgression(REFERENTIEL, 'DIX_HUIT_ANS', new Date('2026-01-01'))

    // Accueil (événement) : début = limite = 2026-01-01
    expect(lignes[0].dateDebutTheorique).toEqual(new Date('2026-01-01'))
    expect(lignes[0].dateLimiteTheorique).toEqual(new Date('2026-01-01'))
    // Aspirant routier (1 mois) démarre là où Accueil s'est terminé, pas décalé
    expect(lignes[1].dateDebutTheorique).toEqual(new Date('2026-01-01'))
    expect(lignes[1].dateLimiteTheorique).toEqual(new Date('2026-02-01'))
  })

  it('respecte l\'ordre du référentiel même si la liste d\'entrée est désordonnée', () => {
    const desordonne = [...REFERENTIEL].reverse()
    const lignes = genererLignesProgression(desordonne, 'DIX_HUIT_ANS', new Date('2026-01-01'))
    expect(lignes.map((l) => l.etapeActiviteId)).toEqual(REFERENTIEL.map((a) => a.id))
  })

  it('durée totale de 26 mois pour la tranche 18 ans', () => {
    const lignes = genererLignesProgression(REFERENTIEL, 'DIX_HUIT_ANS', new Date('2026-01-01'))
    // 2026-01-01 + 26 mois calendaires = 2028-03-01
    expect(calculerDateFinPrevue(lignes)).toEqual(new Date('2028-03-01'))
  })

  it('durée totale de 18 mois pour la tranche 19 ans', () => {
    const lignes = genererLignesProgression(REFERENTIEL, 'DIX_NEUF_ANS', new Date('2026-01-01'))
    expect(calculerDateFinPrevue(lignes)).toEqual(new Date('2027-07-01'))
  })

  it('durée totale de 9 mois pour la tranche 20 ans', () => {
    const lignes = genererLignesProgression(REFERENTIEL, 'VINGT_ANS', new Date('2026-01-01'))
    expect(calculerDateFinPrevue(lignes)).toEqual(new Date('2026-10-01'))
  })
})

describe('calculerStatutAffiche', () => {
  const debut = new Date('2026-01-01')
  const limite = new Date('2026-03-01')

  it('avant la date de début théorique → A_VENIR', () => {
    const statut = calculerStatutAffiche(
      { statut: 'A_VENIR', dateDebutTheorique: debut, dateLimiteTheorique: limite },
      new Date('2025-12-01'),
    )
    expect(statut).toBe('A_VENIR')
  })

  it('entre le début et la limite → EN_COURS', () => {
    const statut = calculerStatutAffiche(
      { statut: 'A_VENIR', dateDebutTheorique: debut, dateLimiteTheorique: limite },
      new Date('2026-02-01'),
    )
    expect(statut).toBe('EN_COURS')
  })

  it('après la date limite → EN_RETARD', () => {
    const statut = calculerStatutAffiche(
      { statut: 'EN_COURS', dateDebutTheorique: debut, dateLimiteTheorique: limite },
      new Date('2026-04-01'),
    )
    expect(statut).toBe('EN_RETARD')
  })

  it.each(['SOUMISE', 'VALIDEE', 'REJETEE', 'ANNULEE'] as const)(
    'un statut métier %s n\'est jamais écrasé par le calcul temporel',
    (statutMetier) => {
      const statut = calculerStatutAffiche(
        { statut: statutMetier, dateDebutTheorique: debut, dateLimiteTheorique: limite },
        new Date('2026-04-01'), // date qui donnerait EN_RETARD si le statut n'était pas déjà métier
      )
      expect(statut).toBe(statutMetier)
    },
  )
})

describe('calculerAvancement', () => {
  function ligne(overrides: Partial<ProgressionPourAvancement>): ProgressionPourAvancement {
    return {
      statut: 'A_VENIR',
      dateLimiteTheorique: new Date('2026-01-01'),
      etapeActivite: { id: 'x', nom: 'X', etape: 'NOVICIAT', obligatoire: true, ordre: 1 },
      ...overrides,
    }
  }

  it('0% quand aucune activité obligatoire n\'est validée', () => {
    const resume = calculerAvancement([ligne({ statut: 'A_VENIR' })])
    expect(resume.pourcentageAvancement).toBe(0)
    expect(resume.activitesValidees).toBe(0)
  })

  it('calcule le pourcentage sur les seules activités obligatoires', () => {
    const resume = calculerAvancement([
      ligne({ statut: 'VALIDEE', etapeActivite: { id: 'a', nom: 'A', etape: 'NOVICIAT', obligatoire: true, ordre: 1 } }),
      ligne({ statut: 'A_VENIR', etapeActivite: { id: 'b', nom: 'B', etape: 'NOVICIAT', obligatoire: true, ordre: 2 } }),
      // non obligatoire : ne doit pas compter dans le total
      ligne({ statut: 'A_VENIR', etapeActivite: { id: 'c', nom: 'C', etape: 'NOVICIAT', obligatoire: false, ordre: 3 } }),
    ])
    expect(resume.totalActivitesObligatoires).toBe(2)
    expect(resume.activitesValidees).toBe(1)
    expect(resume.pourcentageAvancement).toBe(50)
    expect(resume.prochaineActivite?.id).toBe('b')
  })

  it('renvoie 100% et aucune prochaine activité quand tout est validé', () => {
    const resume = calculerAvancement([
      ligne({ statut: 'VALIDEE', etapeActivite: { id: 'a', nom: 'A', etape: 'DEPART_ROUTIER', obligatoire: true, ordre: 1 } }),
    ])
    expect(resume.pourcentageAvancement).toBe(100)
    expect(resume.prochaineActivite).toBeNull()
    expect(resume.etapeCourante).toBe('DEPART_ROUTIER')
  })

  it('liste vide → 0%, aucune étape courante', () => {
    const resume = calculerAvancement([])
    expect(resume.pourcentageAvancement).toBe(0)
    expect(resume.etapeCourante).toBeNull()
    expect(resume.prochaineActivite).toBeNull()
  })
})

describe('dejaAlerteRecemment', () => {
  it('jamais alerté → false', () => {
    expect(dejaAlerteRecemment(null, new Date('2026-07-20'))).toBe(false)
  })

  it('alerté il y a moins de 24h → true', () => {
    expect(dejaAlerteRecemment(new Date('2026-07-20T08:00:00'), new Date('2026-07-20T20:00:00'))).toBe(true)
  })

  it('alerté il y a plus de 24h → false', () => {
    expect(dejaAlerteRecemment(new Date('2026-07-18T08:00:00'), new Date('2026-07-20T08:00:00'))).toBe(false)
  })
})

// Non-régression : évite qu'une évolution future des enums oublie un
// libellé/couleur pour l'une des valeurs (même esprit que lib/cotisations.test.ts).
describe('constantes d\'affichage', () => {
  it('LABELS_ETAPE_COMPAGNON couvre les 4 étapes', () => {
    expect(Object.keys(LABELS_ETAPE_COMPAGNON).sort()).toEqual(
      ['APPRENTISSAGE', 'COMPAGNONNAGE', 'DEPART_ROUTIER', 'NOVICIAT'].sort(),
    )
  })

  it('LABELS_TRANCHE_AGE_COMPAGNON couvre les 3 tranches', () => {
    expect(Object.keys(LABELS_TRANCHE_AGE_COMPAGNON).sort()).toEqual(
      ['DIX_HUIT_ANS', 'DIX_NEUF_ANS', 'VINGT_ANS'].sort(),
    )
  })

  it('LABELS_STATUT_PROGRESSION_COMPAGNON et COULEURS_STATUT_PROGRESSION_COMPAGNON couvrent les 7 statuts', () => {
    const STATUTS = ['A_VENIR', 'EN_COURS', 'EN_RETARD', 'SOUMISE', 'VALIDEE', 'REJETEE', 'ANNULEE']
    expect(Object.keys(LABELS_STATUT_PROGRESSION_COMPAGNON).sort()).toEqual([...STATUTS].sort())
    expect(Object.keys(COULEURS_STATUT_PROGRESSION_COMPAGNON).sort()).toEqual([...STATUTS].sort())
  })
})
