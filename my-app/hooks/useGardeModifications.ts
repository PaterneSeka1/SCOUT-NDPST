'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirmer } from '@/app/components/ConfirmDialog'

// Comparaison structurelle simple (JSON.stringify) — suffisante ici car les
// états de formulaire de l'app sont des objets sérialisables sans référence
// circulaire (voir les types FormXxx distincts des entités API dans chaque page).
export function sontDifferents(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) !== JSON.stringify(b)
}

interface OptionsGarde {
  titreConfirmation?: string
  descriptionConfirmation?: string
}

const TITRE_DEFAUT = 'Quitter sans enregistrer ?'
const DESCRIPTION_DEFAUT = 'Des modifications non enregistrées seront perdues si vous quittez cette page.'

// Généralise le pattern rodé sur app/admin/apparence/page.tsx : bouton de
// sauvegarde désactivé tant que rien n'a changé, confirmation à la fermeture
// d'onglet/rechargement (beforeunload), et confirmation optionnelle sur les
// boutons "Retour"/"Annuler" via `partirVers`. Next.js App Router n'expose pas
// de blocage de navigation interne natif (pas d'équivalent du `useBlocker` de
// react-router) : la navigation via la sidebar n'est donc volontairement pas
// interceptée, seule celle déclenchée explicitement via `partirVers` l'est.
export function useGardeModifications(etatCourant: unknown, options?: OptionsGarde) {
  const router = useRouter()
  const referenceRef = useRef<{ valeur: unknown } | null>(null)
  const [estModifie, setEstModifie] = useState(false)

  useEffect(() => {
    if (!referenceRef.current) return
    setEstModifie(sontDifferents(etatCourant, referenceRef.current.valeur))
  }, [etatCourant])

  useEffect(() => {
    if (!estModifie) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [estModifie])

  // À appeler une fois après le chargement initial des données, ET après
  // chaque sauvegarde réussie (sinon la garde resterait déclenchée avec
  // l'ancienne référence après un enregistrement qui a pourtant réussi).
  function definirReference(etat: unknown) {
    referenceRef.current = { valeur: etat }
    setEstModifie(false)
  }

  async function partirVers(destination: string) {
    if (estModifie) {
      const ok = await confirmer({
        titre: options?.titreConfirmation ?? TITRE_DEFAUT,
        description: options?.descriptionConfirmation ?? DESCRIPTION_DEFAUT,
        labelConfirmer: 'Quitter sans enregistrer',
        danger: true,
      })
      if (!ok) return
    }
    router.push(destination)
  }

  return { estModifie, definirReference, partirVers }
}
