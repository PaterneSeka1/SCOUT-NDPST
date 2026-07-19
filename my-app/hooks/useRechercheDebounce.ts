'use client'

import { useEffect, useState } from 'react'

// Factorise le pattern (state + setTimeout/clearTimeout manuel) dupliqué à
// l'identique dans plusieurs pages de liste (scouts, parents, utilisateurs).
// La pagination reste à la charge de la page appelante (ex. reset à la page 1
// via un useEffect sur `rechercheDebounce`) — ce hook ne fait que stabiliser
// la valeur de recherche, il ne connaît rien de la pagination.
export function useRechercheDebounce(valeurInitiale = '', delaiMs = 300) {
  const [recherche, setRecherche] = useState(valeurInitiale)
  const [rechercheDebounce, setRechercheDebounce] = useState(valeurInitiale)

  useEffect(() => {
    const timer = setTimeout(() => setRechercheDebounce(recherche), delaiMs)
    return () => clearTimeout(timer)
  }, [recherche, delaiMs])

  return { recherche, setRecherche, rechercheDebounce }
}
